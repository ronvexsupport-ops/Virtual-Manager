/**
 * Google Apps Script Email Delivery Service for Virtual Manager
 * Replaces legacy SMTP delivery entirely.
 * Dispatches 6-digit OTP verification emails via the user's Google Apps Script Web App.
 */

export interface AppsScriptDeliveryResult {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Checks if the Google Apps Script delivery service is configured.
 */
export function isEmailConfigured(): boolean {
  return (
    !!process.env.APPS_SCRIPT_WEB_APP_URL?.trim() &&
    !!process.env.APPS_SCRIPT_SHARED_SECRET?.trim()
  );
}

/**
 * Sends a 6-digit OTP verification email to the user's Gmail address via Google Apps Script.
 * Never logs or exposes the OTP.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<AppsScriptDeliveryResult> {
  const webAppUrl = process.env.APPS_SCRIPT_WEB_APP_URL?.trim();
  const sharedSecret = process.env.APPS_SCRIPT_SHARED_SECRET?.trim();

  // Test simulation hook
  if (process.env.NODE_ENV === 'test' && (!webAppUrl || webAppUrl === 'https://script.google.com/macros/s/mock/exec')) {
    return {
      success: true,
      message: 'Test simulated email delivery successful.',
    };
  }

  if (!webAppUrl || !sharedSecret) {
    throw new Error(
      'Google Apps Script email delivery service is not configured. Please configure APPS_SCRIPT_WEB_APP_URL and APPS_SCRIPT_SHARED_SECRET in environment variables.'
    );
  }

  const payload = {
    secret: sharedSecret,
    action: 'send_otp',
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

    if (!response.ok) {
      const errorText = await response.text();
      let parsedError = errorText;
      try {
        const jsonErr = JSON.parse(errorText);
        parsedError = jsonErr.error || jsonErr.message || errorText;
      } catch {
        // use raw text
      }
      throw new Error(`Google Apps Script returned HTTP ${response.status}: ${parsedError}`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to dispatch email via Google Apps Script.');
    }

    return {
      success: true,
      message: data.message || 'OTP email sent successfully.',
    };
  } catch (err: any) {
    throw new Error(err?.message || 'Network error communicating with Google Apps Script.');
  }
}
