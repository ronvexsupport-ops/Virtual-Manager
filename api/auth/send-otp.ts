import { requestOtp, rollbackOtp } from '../../src/services/otpService.ts';
import { sendOtpViaAppsScript } from '../../src/services/appsScriptEmailService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email address is required.' });
    }

    const otpResult = await requestOtp(email);
    if (!otpResult.success || !otpResult.otp) {
      return res.status(429).json({
        success: false,
        error: otpResult.error || 'Failed to request OTP.',
        cooldownRemaining: otpResult.cooldownRemaining,
      });
    }

    try {
      await sendOtpViaAppsScript(email, otpResult.otp);
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your Gmail address.',
      });
    } catch (deliveryErr: any) {
      await rollbackOtp(email);
      console.error('Google Apps Script delivery error:', deliveryErr?.message || deliveryErr);
      return res.status(503).json({
        success: false,
        error:
          deliveryErr?.message ||
          'Failed to send verification email via Google Apps Script. Please verify APPS_SCRIPT_WEB_APP_URL.',
      });
    }
  } catch (err: any) {
    console.error('send-otp error:', err?.message || err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
