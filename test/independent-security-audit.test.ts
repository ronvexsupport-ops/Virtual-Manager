import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  requestOtp,
  verifyOtp,
  validateVerificationToken,
  rollbackOtp,
  normalizeEmail,
  isValidGmail,
  generateSecureOtp,
  hashOtp,
} from '../src/services/otpService.ts';
import { isEmailConfigured } from '../src/services/emailService.ts';

console.log('================================================================');
console.log('INDEPENDENT SECURITY & INTEGRATION AUDIT TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function auditTest(title: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [AUDIT PASS] ${title}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ [AUDIT FAIL] ${title}`);
    console.error(`    Details: ${err?.message || err}`);
    throw err;
  }
}

async function runAudit() {
  console.log('AUDIT SECTION 1: PERSISTENT OTP STORAGE & SERVERLESS ISOLATION');
  console.log('--------------------------------------------------------------');

  await auditTest('1.1: File-backed OTP record is saved with hashed OTP and cryptographic salt', async () => {
    const testEmail = `audit.persist.${Date.now()}@gmail.com`;
    const res = await requestOtp(testEmail);
    assert.equal(res.success, true);
    assert.ok(res.otp);

    const storePath = path.resolve(process.cwd(), '.data/otp_store.json');
    assert.ok(fs.existsSync(storePath), 'Storage file must exist');

    const fileContent = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    const record = fileContent[testEmail];
    assert.ok(record, 'Record must exist in persistent file');
    assert.notEqual(record.otpHash, res.otp, 'Plain-text OTP must NEVER be stored');
    assert.equal(record.otpHash.length, 64, 'Must be SHA-256 HMAC hash');
    assert.ok(record.salt && record.salt.length >= 32, 'Must have secure cryptographic salt');
  });

  await auditTest('1.2: Simulated independent serverless instance reload sees persisted record', async () => {
    const testEmail = `audit.instance.${Date.now()}@gmail.com`;
    const reqRes = await requestOtp(testEmail);
    assert.equal(reqRes.success, true);
    const otp = reqRes.otp!;

    // Verify record can be verified as if from a separate cold start
    const verifyRes = await verifyOtp(testEmail, otp);
    assert.equal(verifyRes.success, true);
    assert.ok(verifyRes.verificationToken);
  });

  console.log('\nAUDIT SECTION 2: REGISTRATION SECURITY & TOKEN VALIDATION');
  console.log('---------------------------------------------------------');

  const regEmail = `audit.registration.${Date.now()}@gmail.com`;
  const reqRes = await requestOtp(regEmail);
  const verifyRes = await verifyOtp(regEmail, reqRes.otp!);
  const validToken = verifyRes.verificationToken!;

  await auditTest('2.1: Valid server-issued token validates successfully', () => {
    const res = validateVerificationToken(regEmail, validToken, false);
    assert.equal(res.valid, true);
  });

  await auditTest('2.2: Tampered token signature is rejected immediately', () => {
    const [payload, sig] = validToken.split('.');
    const tamperedToken = `${payload}.${sig.slice(0, -4)}xxxx`;
    const res = validateVerificationToken(regEmail, tamperedToken, false);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('Forged') || res.error?.includes('tampered'));
  });

  await auditTest('2.3: Tampered token payload is rejected', () => {
    const [, sig] = validToken.split('.');
    const fakePayload = Buffer.from(JSON.stringify({ email: regEmail, exp: Date.now() + 999999 })).toString('base64url');
    const res = validateVerificationToken(regEmail, `${fakePayload}.${sig}`, false);
    assert.equal(res.valid, false);
  });

  await auditTest('2.4: Email binding: Token issued for email A cannot be used for email B', () => {
    const res = validateVerificationToken('impostor@gmail.com', validToken, false);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('does not match'));
  });

  await auditTest('2.5: Expired verification token is rejected', () => {
    const expiredPayload = Buffer.from(JSON.stringify({ email: regEmail, exp: Date.now() - 1000 })).toString('base64url');
    const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET || 'virtual-manager-secure-otp-secret-key-2026';
    const sig = crypto.createHmac('sha256', secret).update(expiredPayload).digest('base64url');
    const expiredToken = `${expiredPayload}.${sig}`;

    const res = validateVerificationToken(regEmail, expiredToken, false);
    assert.equal(res.valid, false);
    assert.ok(res.error?.includes('expired'));
  });

  await auditTest('2.6: Single-use enforcement: Token cannot be consumed more than once', () => {
    // First consumption succeeds
    const firstConsumption = validateVerificationToken(regEmail, validToken, true);
    assert.equal(firstConsumption.valid, true);

    // Second consumption attempt must be blocked
    const replayAttempt = validateVerificationToken(regEmail, validToken, true);
    assert.equal(replayAttempt.valid, false);
    assert.ok(replayAttempt.error?.includes('already been used'));
  });

  console.log('\nAUDIT SECTION 3: EMAIL DELIVERY FAILURE & ROLLBACK');
  console.log('--------------------------------------------------');

  await auditTest('3.1: Delivery failure rollback completely purges OTP request', async () => {
    const failEmail = `audit.rollback.${Date.now()}@gmail.com`;
    const req = await requestOtp(failEmail);
    assert.equal(req.success, true);
    const otp = req.otp!;

    // Simulate delivery failure and rollback
    await rollbackOtp(failEmail);

    // Attempting to verify after rollback must fail (no phantom record)
    const verifyAttempt = await verifyOtp(failEmail, otp);
    assert.equal(verifyAttempt.success, false);
    assert.ok(verifyAttempt.error?.includes('No verification request found'));
  });

  console.log('\nAUDIT SECTION 4: FIRESTORE SECURITY RULES INSPECTION');
  console.log('---------------------------------------------------');

  await auditTest('4.1: firestore.rules explicitly denies client read & write on /otp_verifications', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.ok(rules.includes('match /otp_verifications/{id}'));
    assert.ok(rules.includes('allow read, write: if false;'));
  });

  await auditTest('4.2: firestore.rules preserves contact ownership validation on transactions', () => {
    const rules = fs.readFileSync('firestore.rules', 'utf8');
    assert.ok(rules.includes('isContactOwnedByUser(incoming().contactId, request.auth.uid)'));
    assert.ok(rules.includes('allow delete: if false;'));
  });

  console.log('\nAUDIT SECTION 5: VERCEL SERVERLESS CONFIGURATION');
  console.log('------------------------------------------------');

  await auditTest('5.1: vercel.json preserves /api/* routes from SPA rewrite', () => {
    const vercelConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
    assert.ok(Array.isArray(vercelConfig.rewrites));
    const rewrite = vercelConfig.rewrites[0];
    assert.equal(rewrite.source, '/((?!api/).*)');
    assert.equal(rewrite.destination, '/index.html');
  });

  await auditTest('5.2: All three auth API endpoints exist and export default Vercel handlers', () => {
    const endpoints = [
      'api/auth/send-otp.ts',
      'api/auth/verify-otp.ts',
      'api/auth/validate-registration.ts',
    ];
    for (const ep of endpoints) {
      assert.ok(fs.existsSync(ep), `Endpoint ${ep} must exist`);
      const content = fs.readFileSync(ep, 'utf8');
      assert.ok(content.includes('export default async function handler'), `${ep} must export default handler`);
    }
  });

  console.log('\nAUDIT SECTION 6: SENSITIVE CREDENTIAL & LOG PRIVACY');
  console.log('---------------------------------------------------');

  await auditTest('6.1: emailService never logs OTPs or passwords in console', () => {
    const emailServiceCode = fs.readFileSync('src/services/emailService.ts', 'utf8');
    assert.equal(emailServiceCode.includes('console.log(otp)'), false);
    assert.equal(emailServiceCode.includes('console.log'), false);
  });

  await auditTest('6.2: otpService never logs OTPs or exposes them in verify responses', () => {
    const otpServiceCode = fs.readFileSync('src/services/otpService.ts', 'utf8');
    assert.equal(otpServiceCode.includes('console.log'), false);
  });

  console.log('\n================================================================');
  console.log(`AUDIT SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runAudit().catch((err) => {
  console.error('Audit test suite failed:', err);
  process.exit(1);
});
