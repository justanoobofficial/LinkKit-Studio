import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { analyzeUrl } from './lib/marketingService.js';
import { validateUrl } from './lib/validators.js';

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, 'public');
const preferredPort = Number(process.env.PORT || 5000);

app.disable('x-powered-by');
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(publicDir));

const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Please try again later.' },
  keyGenerator: (req) => req.ip || 'unknown-ip',
});
app.use((req, res, next) => {
  req.setTimeout(60000);
  res.setTimeout(60000);
  next();
});

app.get('/', (_req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'linkkit-studio-api' });
});

app.post('/api/analyze', analyzeLimiter, async (req, res, next) => {
  try {
    const { url } = req.body ?? {};
    const validation = validateUrl(url);

    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error });
    }

    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254'];
    const hostname = new URL(validation.normalized).hostname.toLowerCase();
    if (blockedHosts.includes(hostname) || hostname.endsWith('.local')) {
      return res.status(400).json({ success: false, error: 'Private or local addresses are not allowed.' });
    }

    const result = await analyzeUrl(validation.normalized);
    const marketing = result.marketing || {};
    const copy = {
      tagline: marketing.tagline,
      summary: marketing.summary,
      highlights: marketing.highlights || [],
      whatsapp: marketing.whatsappMessage,
      captions: {
        instagram: marketing.socialCaption,
        facebook: marketing.socialCaption,
        x: marketing.socialCaption,
      },
      hashtags: marketing.highlights || [],
    };

    return res.status(200).json({
      success: true,
      screenshot: result.screenshot,
      marketing,
      copy,
      data: {
        screenshot: result.screenshot,
        marketing,
        copy,
      },
      metadata: result.metadata,
    });
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error?.code === 'ETIMEDOUT' || error?.name === 'TimeoutError' || /timeout/i.test(error?.message || '')) {
    return res.status(504).json({ success: false, error: 'The request timed out while analyzing the site.' });
  }

  console.error('Unhandled error:', error);
  return res.status(500).json({ success: false, error: 'Unable to analyze the website right now.' });
});

export function startServer() {
  if (process.env.NODE_ENV === 'production') {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const server = app.listen(port, () => {
        server.requestTimeout = 60000;
        server.headersTimeout = 65000;
        server.keepAliveTimeout = 65000;
        process.env.PORT = String(port);
        console.log(`Server listening on http://localhost:${port}`);
        resolve(server);
      });

      server.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
          console.warn(`Port ${port} is busy, trying ${port + 1}...`);
          server.close(() => tryListen(port + 1));
        } else {
          reject(error);
        }
      });
    };

    tryListen(preferredPort);
  });
}

if (process.env.NODE_ENV !== 'production') {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    startServer().catch((error) => {
      console.error(error);
      process.exit(1);
    });
  }
}

export { app };
export default app;
