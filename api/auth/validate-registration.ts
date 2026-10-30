import { validateVerificationToken } from '../../src/services/otpService.ts';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  try {
    const { email, verificationToken } = req.body || {};
    if (!email || !verificationToken) {
      return res.status(400).json({ valid: false, error: 'Email and verification token are required.' });
    }

    const validation = validateVerificationToken(email, verificationToken, true);
    if (!validation.valid) {
      return res.status(403).json({ valid: false, error: validation.error });
    }

    return res.status(200).json({ valid: true });
  } catch (err: any) {
    return res.status(500).json({ valid: false, error: 'Internal server error.' });
  }
}
