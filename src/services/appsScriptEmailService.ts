/**
 * Google Apps Script Email Delivery Service
 * Communicates with the user's deployed Google Apps Script Web App to send OTP emails via Gmail.
 */

export interface AppsScriptSendResult {
  success: boolean;
  error?: string;
  message?: string;
}

// User's deployed Apps Script Web App URL
export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbyb21whHMPfSC7buce1xVsw82j7zGlZ-OE-hB3khD3l3HJg12o-Upayh2LQU0dspyWtlA/exec';

/**
 * Sends a 6-digit OTP to the user's Gmail address via Google Apps Script Web App.
 * Never logs or exposes the OTP.
 */
export async function sendOtpViaAppsScript(email: string, otp: string): Promise<AppsScriptSendResult> {
  const webAppUrl = (process.env.APPS_SCRIPT_WEB_APP_URL || DEFAULT_APPS_SCRIPT_URL).trim();
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET?.trim();

  // Test environment simulation
  if (process.env.NODE_ENV === 'test' && (!webAppUrl || webAppUrl === 'https://script.google.com/macros/s/mock/exec')) {
    return {
      success: true,
      message: 'Test simulated email delivery successful.',
    };
  }

  if (!webAppUrl) {
    throw new Error(
      'Google Apps Script Web App URL is not configured. Please set APPS_SCRIPT_WEB_APP_URL in environment variables.'
    );
  }

  if (!sharedSecret) {
    throw new Error(
      'Google Apps Script Shared Secret is not configured. Please set APPS_SCRIPT_SHARED_SECRET in environment variables (matching the AUTH_SECRET in your Apps Script).'
    );
  }

  // Exact matching payload structure:
  // Provides 'secret', 'auth_secret', and 'AUTH_SECRET' so any property check on the Apps Script end succeeds
  const payload = {
    action: 'send_otp',
    secret: sharedSecret,
    auth_secret: sharedSecret,
    AUTH_SECRET: sharedSecret,
    email: email.trim().toLowerCase(),
    otp: otp.trim(),
  };

  try {
    const response = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      redirect: 'follow', // Google Apps Script returns 302 redirects to execution output
    });

    const responseText = await response.text();
    let data: any = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      // If Apps Script returns an HTML error page or raw text
      if (!response.ok) {
        throw new Error(`Google Apps Script HTTP ${response.status}: ${responseText.slice(0, 150)}`);
      }
      throw new Error(`Invalid non-JSON response from Google Apps Script: ${responseText.slice(0, 150)}`);
    }

    if (!response.ok) {
      const errMsg = data?.error || data?.message || `Google Apps Script returned HTTP ${response.status}`;
      throw new Error(errMsg);
    }

    if (data.success === false || (typeof data.statusCode === 'number' && data.statusCode >= 400)) {
      throw new Error(data.error || data.message || 'Failed to dispatch email via Google Apps Script.');
    }

    return {
      success: true,
      message: data.message || 'OTP email sent successfully.',
    };
  } catch (err: any) {
    // Re-throw sanitized error without exposing OTP or secret
    throw new Error(err?.message || 'Network error communicating with Google Apps Script.');
  }
}
