import type { IncomingMessage, ServerResponse } from 'http';
import { requestOtp, rollbackOtp } from '../../src/services/otpService.ts';
import { sendOtpEmail } from '../../src/services/emailService.ts';

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
      await sendOtpEmail(email, otpResult.otp);
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email.',
      });
    } catch (mailErr: any) {
      await rollbackOtp(email);
      console.error('Email delivery error:', mailErr?.message || mailErr);
      return res.status(503).json({
        success: false,
        error:
          mailErr?.message ||
          'Failed to send verification email. Please verify SMTP configuration.',
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
