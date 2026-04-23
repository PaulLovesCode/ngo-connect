import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Helper to get OAuth2 client
const getOAuth2Client = (req?: express.Request) => {
  const redirectUri = req ? getRedirectUri(req) : `${process.env.APP_URL || 'http://localhost:3000'}/auth/callback`;
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

// Check for required env vars
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.warn('WARNING: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set. Google OAuth will not work.');
}

const SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
];

// Helper to get redirect URI
function getRedirectUri(req: express.Request) {
  if (process.env.APP_URL) {
    return `${process.env.APP_URL}/auth/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers.host;
  return `${protocol}://${host}/auth/callback`;
}

// OAuth Routes
app.get('/api/auth/url', (req, res) => {
  const client = getOAuth2Client(req);

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
  res.json({ url });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
  const { code } = req.query;
  try {
    const client = getOAuth2Client(req);

    const { tokens } = await client.getToken(code as string);
    
    const idToken = tokens.id_token;

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                idToken: ${JSON.stringify(idToken)} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// Vite Middleware
if (process.env.NODE_ENV !== 'production') {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
