import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestOtp, rollbackOtp } from './src/services/otpService.ts';
import { sendOtpViaAppsScript } from './src/services/appsScriptEmailService.ts';
import registerHandler from './api/auth/register.ts';
import sendOtpHandler from './api/auth/send-otp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());

// API: Send OTP (via Google Apps Script)
app.post('/api/auth/send-otp', async (req, res) => {
  return sendOtpHandler(req, res);
});

// API: Register (Atomic OTP verification & Firebase Admin account creation)
app.post('/api/auth/register', async (req, res) => {
  return registerHandler(req, res);
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
