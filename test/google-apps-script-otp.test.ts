import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  requestOtp,
  verifyOtp,
  verifyAndConsumeOtp,
  rollbackOtp,
  isValidGmail,
  normalizeEmail,
} from '../src/services/otpService.ts';
import { sendOtpViaAppsScript } from '../src/services/appsScriptEmailService.ts';

process.env.NODE_ENV = 'test';
process.env.APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/mock/exec';
process.env.APPS_SCRIPT_SHARED_SECRET = 'mock-secret-key-123';

console.log('================================================================');
console.log('GOOGLE APPS SCRIPT GMAIL OTP & REGISTRATION TEST SUITE');
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

async function runAll() {
  console.log('1. GMAIL ADDRESS VALIDATION');
  console.log('---------------------------');

  await runTest('Only valid Gmail addresses (@gmail.com) are accepted', () => {
    assert.equal(isValidGmail('shopowner@gmail.com'), true);
    assert.equal(isValidGmail('rahman.karim@gmail.com'), true);
    assert.equal(isValidGmail('invalid@yahoo.com'), false);
    assert.equal(isValidGmail('user@outlook.com'), false);
    assert.equal(isValidGmail('notanemail'), false);
  });

  console.log('\n2. GOOGLE APPS SCRIPT DISPATCH & OTP GENERATION');
  console.log('------------------------------------------------');

  const testEmail = `test.apps.script.${Date.now()}@gmail.com`;
  let firstOtp = '';

  await runTest('OTP is generated as a secure 6-digit numeric string', async () => {
    const res = await requestOtp(testEmail);
    assert.equal(res.success, true);
    assert.ok(res.otp);
    assert.equal(res.otp.length, 6);
    assert.match(res.otp, /^\d{6}$/);
    firstOtp = res.otp;
  });

  await runTest('Apps Script service dispatches email without errors', async () => {
    const res = await sendOtpViaAppsScript(testEmail, firstOtp);
    assert.equal(res.success, true);
  });

  await runTest('Resend cooldown (60s) is strictly enforced', async () => {
    const res = await requestOtp(testEmail);
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('wait'));
    assert.ok(res.cooldownRemaining && res.cooldownRemaining > 0);
  });

  console.log('\n3. VERIFICATION ATTEMPTS, REJECTIONS & LOCKOUT');
  console.log('-----------------------------------------------');

  await runTest('Incorrect OTP is rejected and decrements remaining attempts', async () => {
    const res = await verifyAndConsumeOtp(testEmail, '000000');
    assert.equal(res.success, false);
    assert.ok(res.error?.includes('Invalid'));
    assert.equal(res.remainingAttempts, 4);
  });

  await runTest('Maximum 5 incorrect attempts triggers complete lockout', async () => {
    // 4 more incorrect attempts
    await verifyAndConsumeOtp(testEmail, '111111');
    await verifyAndConsumeOtp(testEmail, '222222');
    await verifyAndConsumeOtp(testEmail, '333333');
    const finalAttempt = await verifyAndConsumeOtp(testEmail, '444444');

    assert.equal(finalAttempt.success, false);
    assert.ok(finalAttempt.error?.includes('Maximum'));

    // Even original OTP is now rejected due to lockout purge
    const lockedOut = await verifyAndConsumeOtp(testEmail, firstOtp);
    assert.equal(lockedOut.success, false);
  });

  console.log('\n4. RESEND INVALIDATES PREVIOUS OTP');
  console.log('------------------------------------');

  const resendEmail = `test.resend.${Date.now()}@gmail.com`;
  const initialRes = await requestOtp(resendEmail);
  const oldOtp = initialRes.otp!;

  // Simulate cooldown expiration
  const storePath = '.data/otp_store.json';
  if (fs.existsSync(storePath)) {
    const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
    if (data[resendEmail]) {
      data[resendEmail].cooldownUntil = Date.now() - 1000;
      fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
    }
  }

  // Request new OTP
  const secondRes = await requestOtp(resendEmail);
  const newOtp = secondRes.otp!;
  assert.notEqual(oldOtp, newOtp, 'New OTP must differ from old OTP');

  await runTest('Previous OTP is invalidated after resend', async () => {
    const tryOld = await verifyAndConsumeOtp(resendEmail, oldOtp);
    assert.equal(tryOld.success, false);
    assert.ok(tryOld.error?.includes('Invalid'));
  });

  await runTest('New OTP succeeds and atomically consumes record', async () => {
    const tryNew = await verifyAndConsumeOtp(resendEmail, newOtp);
    assert.equal(tryNew.success, true);
  });

  await runTest('Consumed OTP cannot be reused (one-time usage)', async () => {
    const reuseAttempt = await verifyAndConsumeOtp(resendEmail, newOtp);
    assert.equal(reuseAttempt.success, false);
  });

  console.log('\n5. DELIVERY FAILURE ROLLBACK');
  console.log('-----------------------------');

  await runTest('Rollback on delivery failure purges OTP request immediately', async () => {
    const failEmail = `test.fail.${Date.now()}@gmail.com`;
    const gen = await requestOtp(failEmail);
    assert.equal(gen.success, true);

    await rollbackOtp(failEmail);

    const tryVerify = await verifyAndConsumeOtp(failEmail, gen.otp!);
    assert.equal(tryVerify.success, false);
    assert.ok(tryVerify.error?.includes('No verification request found'));
  });

  console.log('\n6. CODE & CONFIGURATION AUDIT: ZERO SMTP DEPENDENCY');
  console.log('---------------------------------------------------');

  await runTest('No active SMTP imports or functions in emailService.ts', () => {
    const code = fs.readFileSync('src/services/emailService.ts', 'utf8');
    assert.equal(code.includes("import nodemailer"), false);
    assert.equal(code.includes("createTransport"), false);
    assert.equal(code.includes("SMTP_HOST"), false);
    assert.equal(code.includes("SMTP_PASS"), false);
  });

  await runTest('google-apps-script/Code.gs exists and is complete', () => {
    assert.ok(fs.existsSync('google-apps-script/Code.gs'));
    const gs = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
    assert.ok(gs.includes('function doPost(e)'));
    assert.ok(gs.includes('MailApp.sendEmail'));
    assert.ok(gs.includes('AUTH_SECRET'));
    assert.ok(gs.includes('ভার্চুয়াল ম্যানেজার'));
  });

  await runTest('.env.example contains Google Apps Script and Firebase Admin variables', () => {
    const envEx = fs.readFileSync('.env.example', 'utf8');
    assert.ok(envEx.includes('APPS_SCRIPT_WEB_APP_URL'));
    assert.ok(envEx.includes('APPS_SCRIPT_SHARED_SECRET'));
    assert.ok(envEx.includes('FIREBASE_SERVICE_ACCOUNT_KEY'));
    assert.equal(envEx.includes('SMTP_HOST'), false);
    assert.equal(envEx.includes('SMTP_PASS'), false);
  });

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runAll().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
