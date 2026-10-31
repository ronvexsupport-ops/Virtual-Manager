import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { getAdminFirestore } from './firebaseAdmin.ts';

export interface OtpRecord {
  email: string;
  otpHash: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
  lastSentAt: number;
  cooldownUntil: number;
  verified: boolean;
  verifiedAt?: number;
}

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;

// Server secret for salting hashes
const SERVER_SECRET =
  process.env.OTP_SECRET ||
  process.env.SESSION_SECRET ||
  'virtual-manager-secure-otp-secret-key-2026';

// Multi-instance persistent storage directory for local fallback
const STORAGE_DIR = path.resolve(process.cwd(), '.data');
const STORAGE_FILE = path.join(STORAGE_DIR, 'otp_store.json');

// Memory cache synchronized with persistent store for local fallback
let memoryStore: Record<string, OtpRecord> = {};

function initPersistentStorage() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      memoryStore = JSON.parse(data);
    }
  } catch (err) {
    // Memory store fallback if filesystem is read-only
  }
}

initPersistentStorage();

function reloadStore() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, 'utf8');
      memoryStore = JSON.parse(data);
    }
  } catch (err) {
    // Keep in-memory
  }
}

function saveStore() {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    // If running in ephemeral serverless container
  }
}

/**
 * Normalizes email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates whether the email is a valid Gmail address.
 * Accepts standard valid Gmail addresses and rejects other domains.
 */
export function isValidGmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const normalized = normalizeEmail(email);
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  return gmailRegex.test(normalized);
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Hashes an OTP with a cryptographic salt using HMAC-SHA-256.
 */
export function hashOtp(otp: string, salt: string): string {
  return crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${otp}:${salt}`)
    .digest('hex');
}

/**
 * Requests an OTP for a given email address.
 * Enforces cooldown, invalidates prior codes, and saves hashed record to Firestore (with local fallback).
 */
export async function requestOtp(email: string): Promise<{
  success: boolean;
  otp?: string;
  error?: string;
  cooldownRemaining?: number;
}> {
  const normEmail = normalizeEmail(email);

  if (!isValidGmail(normEmail)) {
    return {
      success: false,
      error: 'Please enter a valid Gmail address (e.g., name@gmail.com).',
    };
  }

  const now = Date.now();
  const db = getAdminFirestore();

  // Try Firestore persistence first
  if (db) {
    try {
      const docRef = db.collection('otp_verifications').doc(normEmail);
      const docSnap = await docRef.get();
      const existing = docSnap.exists ? (docSnap.data() as OtpRecord) : null;

      // Check Resend Cooldown (60 seconds)
      if (existing && now < existing.cooldownUntil) {
        const remainingSeconds = Math.ceil((existing.cooldownUntil - now) / 1000);
        return {
          success: false,
          error: `Please wait ${remainingSeconds} seconds before requesting another code.`,
          cooldownRemaining: remainingSeconds,
        };
      }

      const otp = generateSecureOtp();
      const salt = crypto.randomBytes(16).toString('hex');
      const otpHash = hashOtp(otp, salt);

      const newRecord: OtpRecord = {
        email: normEmail,
        otpHash,
        salt,
        createdAt: now,
        expiresAt: now + OTP_TTL_MS,
        attempts: 0,
        maxAttempts: MAX_ATTEMPTS,
        lastSentAt: now,
        cooldownUntil: now + RESEND_COOLDOWN_MS,
        verified: false,
      };

      await docRef.set(newRecord);

      return {
        success: true,
        otp,
      };
    } catch (firestoreErr) {
      // If Firestore connection fails, fall through to persistent file storage
    }
  }

  // Fallback to file storage
  reloadStore();
  const existing = memoryStore[normEmail];

  if (existing && now < existing.cooldownUntil) {
    const remainingSeconds = Math.ceil((existing.cooldownUntil - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingSeconds} seconds before requesting another code.`,
      cooldownRemaining: remainingSeconds,
    };
  }

  const otp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const otpHash = hashOtp(otp, salt);

  const newRecord: OtpRecord = {
    email: normEmail,
    otpHash,
    salt,
    createdAt: now,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastSentAt: now,
    cooldownUntil: now + RESEND_COOLDOWN_MS,
    verified: false,
  };

  memoryStore[normEmail] = newRecord;
  saveStore();

  return {
    success: true,
    otp,
  };
}

/**
 * Rollback an OTP request if email delivery fails.
 * Guarantees that failed email delivery leaves NO usable verification request.
 */
export async function rollbackOtp(email: string): Promise<void> {
  const normEmail = normalizeEmail(email);
  const db = getAdminFirestore();

  if (db) {
    try {
      await db.collection('otp_verifications').doc(normEmail).delete();
    } catch (err) {
      // ignore
    }
  }

  reloadStore();
  if (memoryStore[normEmail]) {
    delete memoryStore[normEmail];
    saveStore();
  }
}

/**
 * Atomically verifies and consumes an OTP during registration.
 * Guarantees one-time usage: Upon successful verification, the OTP is atomically purged.
 */
export async function verifyAndConsumeOtp(
  email: string,
  userOtp: string
): Promise<{
  success: boolean;
  error?: string;
  remainingAttempts?: number;
}> {
  const normEmail = normalizeEmail(email);
  const cleanedOtp = userOtp.trim().replace(/\D/g, '');

  if (!cleanedOtp || cleanedOtp.length !== 6) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit verification code.',
    };
  }

  const now = Date.now();
  const db = getAdminFirestore();

  // 1. Try Firestore Transaction (Atomic verification and consumption)
  if (db) {
    try {
      const docRef = db.collection('otp_verifications').doc(normEmail);

      const txResult = await db.runTransaction(async (transaction) => {
        const docSnap = await transaction.get(docRef);
        if (!docSnap.exists) {
          return {
            success: false,
            error: 'No verification request found for this email. Please request a code.',
          };
        }

        const record = docSnap.data() as OtpRecord;
        if (!record || !record.otpHash) {
          return {
            success: false,
            error: 'Verification code already used or invalid. Please request a new code.',
          };
        }

        // Check expiration
        if (now > record.expiresAt) {
          transaction.delete(docRef);
          return {
            success: false,
            error: 'Verification code expired. Please request a new code.',
          };
        }

        // Check max attempts
        if (record.attempts >= record.maxAttempts) {
          transaction.delete(docRef);
          return {
            success: false,
            error: 'Maximum incorrect attempts exceeded. Please request a new code.',
          };
        }

        // Timing-safe comparison
        const candidateHash = hashOtp(cleanedOtp, record.salt);
        const isMatch =
          candidateHash.length === record.otpHash.length &&
          crypto.timingSafeEqual(
            Buffer.from(candidateHash, 'utf8'),
            Buffer.from(record.otpHash, 'utf8')
          );

        if (!isMatch) {
          const newAttempts = record.attempts + 1;
          const remaining = record.maxAttempts - newAttempts;
          if (remaining <= 0) {
            transaction.delete(docRef);
            return {
              success: false,
              error: 'Maximum incorrect attempts exceeded. Please request a new code.',
              remainingAttempts: 0,
            };
          } else {
            transaction.update(docRef, { attempts: newAttempts });
            return {
              success: false,
              error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
              remainingAttempts: remaining,
            };
          }
        }

        // Success: Atomically delete the OTP document so it cannot be reused
        transaction.delete(docRef);
        return { success: true };
      });

      return txResult;
    } catch (err: any) {
      // Fall through to file fallback if Firestore transaction fails
    }
  }

  // 2. Fallback to file storage
  reloadStore();
  const record = memoryStore[normEmail];

  if (!record || !record.otpHash) {
    return {
      success: false,
      error: 'No verification request found for this email. Please request a code.',
    };
  }

  if (now > record.expiresAt) {
    delete memoryStore[normEmail];
    saveStore();
    return {
      success: false,
      error: 'Verification code expired. Please request a new code.',
    };
  }

  if (record.attempts >= record.maxAttempts) {
    delete memoryStore[normEmail];
    saveStore();
    return {
      success: false,
      error: 'Maximum incorrect attempts exceeded. Please request a new code.',
    };
  }

  const candidateHash = hashOtp(cleanedOtp, record.salt);
  const isMatch =
    candidateHash.length === record.otpHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'utf8'),
      Buffer.from(record.otpHash, 'utf8')
    );

  if (!isMatch) {
    record.attempts += 1;
    saveStore();
    const remaining = record.maxAttempts - record.attempts;
    if (remaining <= 0) {
      delete memoryStore[normEmail];
      saveStore();
      return {
        success: false,
        error: 'Maximum incorrect attempts exceeded. Please request a new code.',
        remainingAttempts: 0,
      };
    }
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      remainingAttempts: remaining,
    };
  }

  // Atomically delete from file store
  delete memoryStore[normEmail];
  saveStore();

  return { success: true };
}

const TOKEN_TTL_MS = 15 * 60 * 1000;
const CONSUMED_TOKENS_FILE = path.join(STORAGE_DIR, 'consumed_tokens.json');
let consumedTokens: Record<string, number> = {};

try {
  if (fs.existsSync(CONSUMED_TOKENS_FILE)) {
    consumedTokens = JSON.parse(fs.readFileSync(CONSUMED_TOKENS_FILE, 'utf8'));
  }
} catch {}

function saveTokens() {
  try {
    fs.writeFileSync(CONSUMED_TOKENS_FILE, JSON.stringify(consumedTokens, null, 2), 'utf8');
  } catch {}
}

/**
 * Generates an HMAC-SHA256 signed verification token proof.
 */
export function generateVerificationToken(email: string): string {
  const normEmail = normalizeEmail(email);
  const payload = {
    email: normEmail,
    exp: Date.now() + TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString('hex'),
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(payloadBase64)
    .digest('base64url');
  return `${payloadBase64}.${signature}`;
}

/**
 * Verifies a submitted 6-digit OTP and returns a signed token proof.
 */
export async function verifyOtp(
  email: string,
  userOtp: string
): Promise<{
  success: boolean;
  verificationToken?: string;
  error?: string;
  remainingAttempts?: number;
}> {
  reloadStore();
  const normEmail = normalizeEmail(email);
  const record = memoryStore[normEmail];

  if (!record || !record.otpHash) {
    return {
      success: false,
      error: 'No verification request found for this email. Please request a code.',
    };
  }

  const now = Date.now();

  if (now > record.expiresAt) {
    delete memoryStore[normEmail];
    saveStore();
    return {
      success: false,
      error: 'Verification code expired. Please request a new one.',
    };
  }

  if (record.attempts >= record.maxAttempts) {
    delete memoryStore[normEmail];
    saveStore();
    return {
      success: false,
      error: 'Maximum incorrect attempts exceeded. Please request a new verification code.',
    };
  }

  const cleanedOtp = userOtp.trim().replace(/\D/g, '');
  const candidateHash = hashOtp(cleanedOtp, record.salt);

  const isMatch =
    candidateHash.length === record.otpHash.length &&
    crypto.timingSafeEqual(
      Buffer.from(candidateHash, 'utf8'),
      Buffer.from(record.otpHash, 'utf8')
    );

  if (!isMatch) {
    record.attempts += 1;
    saveStore();
    const remaining = record.maxAttempts - record.attempts;
    if (remaining <= 0) {
      delete memoryStore[normEmail];
      saveStore();
      return {
        success: false,
        error: 'Maximum incorrect attempts exceeded. Please request a new code.',
        remainingAttempts: 0,
      };
    }
    return {
      success: false,
      error: `Invalid verification code. ${remaining} attempt(s) remaining.`,
      remainingAttempts: remaining,
    };
  }

  record.verified = true;
  record.verifiedAt = now;
  record.otpHash = '';

  const token = generateVerificationToken(normEmail);
  memoryStore[normEmail] = record;
  saveStore();

  return {
    success: true,
    verificationToken: token,
  };
}

/**
 * Validates and optionally consumes the verification token during registration.
 */
export function validateVerificationToken(
  email: string,
  token: string,
  consume = false
): { valid: boolean; error?: string } {
  if (!token || !token.includes('.')) {
    return { valid: false, error: 'Invalid verification token format.' };
  }

  const normEmail = normalizeEmail(email);
  const [payloadBase64, providedSignature] = token.split('.');

  const expectedSignature = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(payloadBase64)
    .digest('base64url');

  if (
    providedSignature.length !== expectedSignature.length ||
    !crypto.timingSafeEqual(
      Buffer.from(providedSignature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    )
  ) {
    return { valid: false, error: 'Forged or tampered verification token.' };
  }

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  if (consumedTokens[tokenHash]) {
    return { valid: false, error: 'Verification token has already been used. Please verify again.' };
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
    if (payload.email !== normEmail) {
      return { valid: false, error: 'Token does not match the provided email address.' };
    }
    if (Date.now() > payload.exp) {
      return { valid: false, error: 'Verification token has expired. Please verify email again.' };
    }

    if (consume) {
      consumedTokens[tokenHash] = Date.now();
      saveTokens();
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, error: 'Malformed verification token payload.' };
  }
}

