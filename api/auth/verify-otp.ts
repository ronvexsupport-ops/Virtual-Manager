import { verifyOtp } from '../../src/services/otpService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and 6-digit OTP are required.' });
    }

    const result = await verifyOtp(email, otp);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Invalid verification code.',
        remainingAttempts: result.remainingAttempts,
      });
    }

    return res.status(200).json({
      success: true,
      verificationToken: result.verificationToken,
      message: 'Email verified successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
}
