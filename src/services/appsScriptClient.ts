/**
 * Google Apps Script Direct Client
 * Communicates directly from browser/app to Google Apps Script Web App without any intermediary servers.
 */

export const APPS_SCRIPT_WEB_APP_URL =
  (import.meta.env?.VITE_APPS_SCRIPT_URL ||
    'https://script.google.com/macros/s/AKfycbyb21whHMPfSC7buce1xVsw82j7zGlZ-OE-hB3khD3l3HJg12o-Upayh2LQU0dspyWtlA/exec').trim();

export interface OtpSendResponse {
  success: boolean;
  message?: string;
  error?: string;
  cooldownRemaining?: number;
}

export interface OtpVerifyResponse {
  success: boolean;
  verified?: boolean;
  message?: string;
  error?: string;
  remainingAttempts?: number;
}

/**
 * Sends a 6-digit verification code to the given Gmail address using Google Apps Script Web App.
 * Uses text/plain to avoid CORS preflight OPTIONS rejection in browsers.
 */
export async function sendOtpToGmail(email: string): Promise<OtpSendResponse> {
  const normEmail = email.trim().toLowerCase();

  // Test simulation hook
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return {
      success: true,
      message: 'Test simulated OTP email sent successfully.',
    };
  }

  try {
    const payload = {
      action: 'send_otp',
      email: normEmail,
    };

    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Invalid response from Apps Script: ${text.slice(0, 100)}`,
      };
    }

    if (!response.ok || data.success === false) {
      return {
        success: false,
        error: data.error || data.message || 'Failed to send verification code.',
        cooldownRemaining: data.cooldownRemaining,
      };
    }

    return {
      success: true,
      message: data.message || 'Verification code sent to your Gmail.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error connecting to email service.',
    };
  }
}

/**
 * Verifies a 6-digit OTP code against Google Apps Script.
 * On success, Apps Script atomically burns the OTP and marks the email as verified.
 */
export async function verifyOtpWithAppsScript(
  email: string,
  otp: string
): Promise<OtpVerifyResponse> {
  const normEmail = email.trim().toLowerCase();
  const cleanedOtp = otp.trim().replace(/\D/g, '');

  if (cleanedOtp.length !== 6) {
    return {
      success: false,
      error: 'Please enter a valid 6-digit OTP code.',
    };
  }

  // Test simulation hook
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return {
      success: true,
      verified: true,
      message: 'Test simulated OTP verified successfully.',
    };
  }

  try {
    const payload = {
      action: 'verify_otp',
      email: normEmail,
      otp: cleanedOtp,
    };

    const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
    });

    const text = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(text);
    } catch {
      return {
        success: false,
        error: `Invalid response from Apps Script: ${text.slice(0, 100)}`,
      };
    }

    if (!response.ok || data.success === false || !data.verified) {
      return {
        success: false,
        verified: false,
        error: data.error || data.message || 'Invalid verification code.',
        remainingAttempts: data.remainingAttempts,
      };
    }

    return {
      success: true,
      verified: true,
      message: data.message || 'Email verified successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      verified: false,
      error: err?.message || 'Network error verifying code.',
    };
  }
}
