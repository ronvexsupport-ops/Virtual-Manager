import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { sendOtpViaAppsScript } from '../src/services/appsScriptEmailService.ts';
import { isValidGmail } from '../src/services/otpService.ts';

console.log('================================================================');
console.log('GOOGLE APPS SCRIPT REQUEST & RESPONSE FORMAT VERIFICATION TEST');
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

// Emulate Google Apps Script's doPost handler directly as coded in Code.gs
function simulateAppsScriptDoPost(
  contents: string,
  configuredSecret: string
): { statusCode: number; payload: any } {
  if (!contents) {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'Empty request body.' },
    };
  }

  let requestData: any;
  try {
    requestData = JSON.parse(contents);
  } catch {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'Invalid JSON payload.' },
    };
  }

  const providedSecret =
    requestData.AUTH_SECRET ||
    requestData.auth_secret ||
    requestData.secret ||
    requestData.sharedSecret;

  if (!providedSecret || providedSecret !== configuredSecret) {
    return {
      statusCode: 401,
      payload: {
        success: false,
        statusCode: 401,
        error: 'Unauthorized request: invalid secret.',
      },
    };
  }

  if (requestData.action !== 'send_otp') {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'Unsupported action.' },
    };
  }

  const email = (requestData.email || '').toString().trim().toLowerCase();
  const otp = (requestData.otp || '').toString().trim();

  if (!email || !otp) {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'Missing email or otp.' },
    };
  }

  const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  if (!gmailPattern.test(email)) {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'Only valid @gmail.com addresses accepted.' },
    };
  }

  if (!/^\d{6}$/.test(otp)) {
    return {
      statusCode: 400,
      payload: { success: false, statusCode: 400, error: 'OTP must be 6 numeric digits.' },
    };
  }

  return {
    statusCode: 200,
    payload: {
      success: true,
      statusCode: 200,
      message: 'ভেরিফিকেশন কোড সফলভাবে পাঠানো হয়েছে।',
    },
  };
}

async function runSuite() {
  const MOCK_SECRET = 'correct_shared_secret_vm_987';
  let capturedRequests: any[] = [];
  let serverMode = 'normal';

  // Create an HTTP mock server emulating Google Apps Script redirection and responses
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      // Check for Google Apps Script 302 redirect behavior
      if (req.url === '/macros/s/exec' && req.method === 'POST') {
        try {
          const parsed = JSON.parse(body);
          capturedRequests.push({ body: parsed, headers: req.headers });
        } catch {
          capturedRequests.push({ rawBody: body });
        }

        if (serverMode === 'error_500') {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Internal Apps Script quota error.' }));
          return;
        }

        if (serverMode === 'html_error') {
          res.writeHead(403, { 'Content-Type': 'text/html' });
          res.end('<html><head><title>Script Error: Authorization required</title></head></html>');
          return;
        }

        // Standard Google Apps Script responds with 302 redirect to usercontent echo endpoint
        res.writeHead(302, {
          Location: `http://127.0.0.1:${(server.address() as any).port}/echo?contents=${encodeURIComponent(body)}`,
        });
        res.end();
        return;
      }

      if (req.url?.startsWith('/echo')) {
        const urlParams = new URL(req.url, `http://127.0.0.1`).searchParams;
        const contents = urlParams.get('contents') || '';
        const simResult = simulateAppsScriptDoPost(contents, MOCK_SECRET);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(simResult.payload));
        return;
      }

      res.writeHead(404);
      res.end('Not found');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const serverPort = (server.address() as any).port;
  const mockUrl = `http://127.0.0.1:${serverPort}/macros/s/exec`;

  console.log('1. GMAIL ADDRESS VALIDATION SUITE (FIXED REGEX)');
  console.log('------------------------------------------------');

  await runTest('Accepts standard and modern Gmail addresses', () => {
    const validEmails = [
      'ronvex.support@gmail.com',
      'shopowner@gmail.com',
      'user+test@gmail.com',
      'user.name@gmail.com',
      'a.b.c@gmail.com',
      'dev123@gmail.com',
      'short@gmail.com',
      'very.long.user.address.name@gmail.com',
    ];
    for (const em of validEmails) {
      assert.equal(isValidGmail(em), true, `Expected valid: ${em}`);
    }
  });

  await runTest('Rejects non-Gmail addresses and invalid formats', () => {
    const invalidEmails = [
      'user@yahoo.com',
      'user@outlook.com',
      'user@hotmail.com',
      'user@company.com.bd',
      'user@gmail.com.co',
      'user@notgmail.com',
      '@gmail.com',
      'user@',
      'notanemail',
      '',
    ];
    for (const em of invalidEmails) {
      assert.equal(isValidGmail(em), false, `Expected invalid: ${em}`);
    }
  });

  console.log('\n2. END-TO-END APPS SCRIPT POST REQUEST & RESPONSE VERIFICATION');
  console.log('--------------------------------------------------------------');

  // Set environment variables to point to the live test server
  process.env.NODE_ENV = 'production'; // bypass test simulation
  process.env.APPS_SCRIPT_WEB_APP_URL = mockUrl;
  process.env.APPS_SCRIPT_SHARED_SECRET = MOCK_SECRET;

  await runTest('Successful POST dispatch sends correct payload properties', async () => {
    capturedRequests = [];
    const result = await sendOtpViaAppsScript('ronvex.support@gmail.com', '789123');

    assert.equal(result.success, true);
    assert.ok(result.message?.includes('ভেরিফিকেশন কোড সফলভাবে পাঠানো হয়েছে।'));

    assert.equal(capturedRequests.length, 1);
    const req = capturedRequests[0].body;

    // Verify exact property names matching Apps Script expectations
    assert.equal(req.action, 'send_otp');
    assert.equal(req.email, 'ronvex.support@gmail.com');
    assert.equal(req.otp, '789123');
    assert.equal(req.secret, MOCK_SECRET);
    assert.equal(req.AUTH_SECRET, MOCK_SECRET);
    assert.equal(req.auth_secret, MOCK_SECRET);
  });

  await runTest('Rejection when Apps Script secret is incorrect', async () => {
    process.env.APPS_SCRIPT_SHARED_SECRET = 'wrong_secret_123';
    await assert.rejects(
      async () => {
        await sendOtpViaAppsScript('ronvex.support@gmail.com', '123456');
      },
      (err: any) => {
        return err.message.includes('invalid secret') || err.message.includes('Unauthorized');
      }
    );
  });

  console.log('\n3. ERROR RESPONSE & REDIRECT HANDLING');
  console.log('--------------------------------------');

  process.env.APPS_SCRIPT_SHARED_SECRET = MOCK_SECRET;

  await runTest('Handles 500 error from Apps Script gracefully without crash', async () => {
    serverMode = 'error_500';
    await assert.rejects(
      async () => {
        await sendOtpViaAppsScript('ronvex.support@gmail.com', '654321');
      },
      (err: any) => {
        return err.message.includes('quota error') || err.message.includes('500');
      }
    );
  });

  await runTest('Handles HTML error response (e.g. Google auth or 403) cleanly', async () => {
    serverMode = 'html_error';
    await assert.rejects(
      async () => {
        await sendOtpViaAppsScript('ronvex.support@gmail.com', '654321');
      },
      (err: any) => {
        return err.message.includes('Authorization required') || err.message.includes('403');
      }
    );
  });

  serverMode = 'normal';

  console.log('\n4. CODE.GS FILE AUDIT');
  console.log('---------------------');

  await runTest('Code.gs uses MailApp.sendEmail and has no SMTP or Nodemailer', () => {
    const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
    assert.ok(code.includes('MailApp.sendEmail'));
    assert.ok(code.includes('AUTH_SECRET'));
    assert.ok(code.includes('doPost(e)'));
    assert.ok(code.includes('doGet(e)'));
    assert.ok(code.includes('createJsonResponse'));
    assert.equal(code.includes('nodemailer'), false);
    assert.equal(code.includes('createTransport'), false);
    assert.equal(code.includes('SMTP_'), false);
  });

  await runTest('Code.gs contains Virtual Manager branded email template', () => {
    const code = fs.readFileSync('google-apps-script/Code.gs', 'utf8');
    assert.ok(code.includes('ভার্চুয়াল ম্যানেজার'));
    assert.ok(code.includes('ডিজিটাল খাতা ও নিরাপদ বাকি-হিসাব ব্যবস্থাপনা'));
    assert.ok(code.includes('আপনার ভেরিফিকেশন কোড'));
  });

  server.close();

  console.log('\n================================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('================================================================\n');
}

runSuite().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
