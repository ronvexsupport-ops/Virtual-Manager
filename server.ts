import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestOtp, verifyOtp, validateVerificationToken, rollbackOtp } from './src/services/otpService.ts';
import { sendOtpEmail } from './src/services/emailService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// API: Send OTP
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
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

    // Deliver OTP via configured email service
    try {
      await sendOtpEmail(email, otpResult.otp);
      return res.status(200).json({
        success: true,
        message: 'Verification code sent to your email.',
      });
    } catch (mailErr: any) {
      // Rollback OTP immediately so no phantom or unusable OTP is left active
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
    console.error('send-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// API: Verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
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
    console.error('verify-otp error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// API: Validate Registration Token
app.post('/api/auth/validate-registration', async (req, res) => {
  try {
    const { email, verificationToken } = req.body;
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
});

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    // Mount Vite middlewares in development
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production serve static build
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Virtual Manager server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
