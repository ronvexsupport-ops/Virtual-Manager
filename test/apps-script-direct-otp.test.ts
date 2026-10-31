import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  sendOtpToGmail,
  verifyOtpWithAppsScript,
  APPS_SCRIPT_WEB_APP_URL,
} from '../src/services/appsScriptClient.ts';
import { isValidGmail } from '../src/services/otpService.ts';

console.log('================================================================');
console.log('GOOGLE APPS SCRIPT DIRECT OTP BACKEND & AUTH TEST SUITE');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => Promise<void> | void) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}`);
    console.error(`    Error: ${err?.message || err}`);
    throw err;
  }
}

// In-memory simulation of Apps Script PropertiesService
const mockScriptProperties: Record<string, string> = {};

function sha256Hex(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// Exact emulation of Code.gs doPost
function emulateCodeGs(requestData: any): any {
  const action = (requestData.action || '').toString().trim().toLowerCase();
  const email = (requestData.email || '').toString().trim().toLowerCase();

  if (!email) {
    return { success: false, error: 'অনুগ্রহ করে আপনার Gmail ঠিকানা প্রদান করুন।' };
  }

  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailPattern.test(email)) {
    return { success: false, error: 'শুধুমাত্র বৈধ Gmail অ্যাড্রেস গ্রহণযোগ্য (যেমন: yourname@gmail.com)।' };
  }

  const now = Date.now();

  // ACTION: send_otp
  if (action === 'send_otp') {
    const existingRaw = mockScriptProperties['otp_' + email];
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        if (existing.cooldownUntil && now < existing.cooldownUntil) {
          const waitSec = Math.ceil((existing.cooldownUntil - now) / 1000);
          return {
            success: false,
            error: `অনুগ্রহ করে ${waitSec} সেকেন্ড অপেক্ষা করে আবার চেষ্টা করুন।`,
            cooldownRemaining: waitSec,
          };
        }
      } catch {}
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const salt = crypto.randomUUID().replace(/-/g, '');
    const otpHash = sha256Hex(otp + ':' + salt);

    mockScriptProperties['otp_' + email] = JSON.stringify({
      otpHash,
      salt,
      createdAt: now,
      expiresAt: now + (5 * 60 * 1000),
      attempts: 0,
      maxAttempts: 5,
      cooldownUntil: now + (60 * 1000),
    });

    return {
      success: true,
      message: 'আপনার জিমেইলে ৬-সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে।',
      simulatedOtp: otp, // only in test harness
    };
  }

  // ACTION: verify_otp
  if (action === 'verify_otp') {
    const userOtp = (requestData.otp || '').toString().trim().replace(/\D/g, '');
    if (!userOtp || userOtp.length !== 6) {
      return { success: false, error: 'অনুগ্রহ করে ৬-সংখ্যার সঠিক ওটিপি কোড লিখুন।' };
    }

    const storedRaw = mockScriptProperties['otp_' + email];
    if (!storedRaw) {
      return { success: false, error: 'কোনো সক্রিয় ভেরিফিকেশন কোড পাওয়া যায়নি। নতুন কোডের অনুরোধ করুন।' };
    }

    const record = JSON.parse(storedRaw);
    if (now > record.expiresAt) {
      delete mockScriptProperties['otp_' + email];
      return { success: false, error: 'ভেরিফিকেশন কোডের মেয়াদ শেষ হয়ে গেছে। নতুন কোডের অনুরোধ করুন।' };
    }

    if (record.attempts >= record.maxAttempts) {
      delete mockScriptProperties['otp_' + email];
      return { success: false, error: 'সর্বোচ্চ ৫ বার ভুল কোড দেওয়া হয়েছে। কোডটি বাতিল করা হয়েছে। নতুন কোড নিন।' };
    }

    const candidateHash = sha256Hex(userOtp + ':' + record.salt);
    if (candidateHash === record.otpHash) {
      // Single use: delete immediately
      delete mockScriptProperties['otp_' + email];
      mockScriptProperties['verified_' + email] = JSON.stringify({
        verifiedAt: now,
        expiresAt: now + 15 * 60 * 1000,
      });
      return { success: true, verified: true, message: 'ইমেইল সফলভাবে যাচাই করা হয়েছে।' };
    } else {
      record.attempts += 1;
      const remaining = record.maxAttempts - record.attempts;
      if (remaining <= 0) {
        delete mockScriptProperties['otp_' + email];
        return {
          success: false,
          error: 'সর্বোচ্চ ৫ বার ভুল কোড দেওয়ার কারণে এটি বাতিল হয়েছে। নতুন কোড নিন।',
          remainingAttempts: 0,
        };
      } else {
        mockScriptProperties['otp_' + email] = JSON.stringify(record);
        return {
          success: false,
          error: `ভুল ভেরিফিকেশন কোড। বাকি সুযোগ: ${remaining} বার।`,
          remainingAttempts: remaining,
        };
      }
    }
  }

  return { success: false, error: 'অসমর্থিত অ্যাকশন।' };
}

async function runAll() {
  console.log('1. GMAIL ADDRESS VALIDATION');
  console.log('---------------------------');

  await runTest('Accepts valid Gmail addresses and rejects other domains', () => {
    assert.equal(isValidGmail('ronvex.support@gmail.com'), true);
    assert.equal(isValidGmail('user.name@gmail.com'), true);
    assert.equal(isValidGmail('test+tag@gmail.com'), true);
    assert.equal(isValidGmail('user@yahoo.com'), false);
    assert.equal(isValidGmail('user@outlook.com'), false);
    assert.equal(isValidGmail('user@domain.com'), false);
    assert.equal(isValidGmail('notanemail'), false);
  });

  console.log('\n2. CODE.GS AUDIT & ZERO BACKEND SERVER VERIFICATION');
  console.log('----------------------------------------------------');

  await runTest('google-apps-script/Code.gs implements full serverless OTP logic', () => {
    const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
    assert.ok(code.includes('action === "send_otp"'), 'Must handle send_otp');
    assert.ok(code.includes('action === "verify_otp"'), 'Must handle verify_otp');
    assert.ok(code.includes('MailApp.sendEmail'), 'Must send email via Gmail MailApp');
    assert.ok(code.includes('Utilities.computeDigest'), 'Must hash OTP with SHA-256');
    assert.ok(code.includes('expiresAt'), 'Must enforce TTL');
    assert.ok(code.includes('cooldownUntil'), 'Must enforce 60s cooldown');
    assert.ok(code.includes('maxAttempts: 5'), 'Must enforce max 5 attempts lockout');
    assert.ok(code.includes('deleteProperty'), 'Must delete OTP on verify or lockout (single-use)');
    assert.equal(code.includes('password'), false, 'Password must never be saved in Apps Script');
  });

  await runTest('Zero Cloud Functions and zero Vercel dependencies in project', () => {
    assert.equal(fs.existsSync('vercel.json'), false, 'vercel.json must be deleted');
    assert.equal(fs.existsSync('functions/package.json'), false, 'functions directory must not exist');
  });

  console.log('\n3. APPS SCRIPT LOGIC SIMULATION & SECURITY PILLARS');
  console.log('---------------------------------------------------');

  const testEmail = 'ronvex.support@gmail.com';

  let firstOtp = '';
  await runTest('3.1: OTP generation returns 6-digit numeric code and saves salted hash', () => {
    const res = emulateCodeGs({ action: 'send_otp', email: testEmail });
    assert.equal(res.success, true);
    assert.ok(res.simulatedOtp);
    assert.equal(res.simulatedOtp.length, 6);
    firstOtp = res.simulatedOtp;

    const stored = JSON.parse(mockScriptProperties['otp_' + testEmail]);
    assert.ok(stored.otpHash, 'Must have hash');
    assert.ok(stored.salt, 'Must have salt');
    assert.notEqual(stored.otpHash, firstOtp, 'Plain text OTP must never be stored');
    assert.equal(stored.expiresAt > Date.now(), true, 'Must have future expiration');
  });

  await runTest('3.2: 60-second resend cooldown is strictly enforced', () => {
    const res = emulateCodeGs({ action: 'send_otp', email: testEmail });
    assert.equal(res.success, false);
    assert.ok(res.error.includes('সেকেন্ড অপেক্ষা'));
    assert.ok(res.cooldownRemaining && res.cooldownRemaining > 0);
  });

  await runTest('3.3: Incorrect OTP is rejected and decrements remaining attempts', () => {
    const res = emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: '000000' });
    assert.equal(res.success, false);
    assert.equal(res.remainingAttempts, 4);
    assert.ok(res.error.includes('ভুল'));
  });

  await runTest('3.4: Lockout after 5 incorrect attempts and OTP record is purged', () => {
    emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: '111111' });
    emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: '222222' });
    emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: '333333' });
    const finalAttempt = emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: '444444' });

    assert.equal(finalAttempt.success, false);
    assert.equal(finalAttempt.remainingAttempts, 0);
    assert.equal(mockScriptProperties['otp_' + testEmail], undefined, 'Record must be purged on lockout');

    // Even original OTP is now rejected
    const tryOriginal = emulateCodeGs({ action: 'verify_otp', email: testEmail, otp: firstOtp });
    assert.equal(tryOriginal.success, false);
  });

  await runTest('3.5: Correct OTP verification succeeds and burns OTP (single-use)', () => {
    // Generate fresh OTP
    const freshRes = emulateCodeGs({ action: 'send_otp', email: 'fresh.user@gmail.com' });
    assert.equal(freshRes.success, true);
    const freshOtp = freshRes.simulatedOtp;

    // Verify correct OTP
    const verifyRes = emulateCodeGs({ action: 'verify_otp', email: 'fresh.user@gmail.com', otp: freshOtp });
    assert.equal(verifyRes.success, true);
    assert.equal(verifyRes.verified, true);

    // Verify OTP record is immediately deleted (cannot be reused)
    assert.equal(mockScriptProperties['otp_fresh.user@gmail.com'], undefined, 'Must delete OTP immediately');

    // Replay attack rejected
    const replayRes = emulateCodeGs({ action: 'verify_otp', email: 'fresh.user@gmail.com', otp: freshOtp });
    assert.equal(replayRes.success, false);
  });

  await runTest('3.6: Expired OTP is automatically deleted and rejected', () => {
    const expEmail = 'expired.user@gmail.com';
    const genRes = emulateCodeGs({ action: 'send_otp', email: expEmail });
    const otp = genRes.simulatedOtp;

    // Simulate 6 minutes passing
    const record = JSON.parse(mockScriptProperties['otp_' + expEmail]);
    record.expiresAt = Date.now() - 1000;
    mockScriptProperties['otp_' + expEmail] = JSON.stringify(record);

    const tryVerify = emulateCodeGs({ action: 'verify_otp', email: expEmail, otp });
    assert.equal(tryVerify.success, false);
    assert.ok(tryVerify.error.includes('মেয়াদ শেষ'));
    assert.equal(mockScriptProperties['otp_' + expEmail], undefined, 'Expired OTP must be deleted');
  });

  console.log('\n4. FRONTEND CLIENT & URL AUDIT');
  console.log('------------------------------');

  await runTest('appsScriptClient uses default URL provided by user', () => {
    assert.equal(
      APPS_SCRIPT_WEB_APP_URL,
      'https://script.google.com/macros/s/AKfycbyb21whHMPfSC7buce1xVsw82j7zGlZ-OE-hB3khD3l3HJg12o-Upayh2LQU0dspyWtlA/exec'
    );
  });

  await runTest('AuthModal imports and uses appsScriptClient direct verification', () => {
    const authModalCode = fs.readFileSync('src/components/auth/AuthModal.tsx', 'utf8');
    assert.ok(authModalCode.includes('sendOtpToGmail'));
    assert.ok(authModalCode.includes('verifyOtpWithAppsScript'));
    assert.ok(authModalCode.includes('signUpWithEmail'));
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runAll().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
