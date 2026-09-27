import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));

function normalizeGeminiModel(m?: string): string {
  if (!m) return 'gemini-3.8-flash';
  const trimmed = m.trim();
  if (
    trimmed.startsWith('gemini-1.5') ||
    trimmed.startsWith('gemini-2.0') ||
    trimmed.startsWith('gemini-2.5') ||
    trimmed === 'gemini-pro'
  ) {
    return 'gemini-3.8-flash';
  }
  return trimmed;
}

// ---------- Health check ----------
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'ModelHub relay is running.' });
});

// ---------- Test Key Endpoint ----------
app.post('/api/test-key', async (req: Request, res: Response) => {
  const { provider, apiKey, model } = req.body || {};

  if (!provider || !apiKey) {
    return res.status(400).json({ success: false, error: 'Missing provider or apiKey.' });
  }

  const startTime = Date.now();

  try {
    if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        return res.status(resp.status).json({
          success: false,
          error: err?.error?.message || `OpenAI error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: 'OpenAI API key is valid and connected!' });
    }

    if (provider === 'anthropic') {
      const chosenModel = model || 'claude-sonnet-5';
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: chosenModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Ping' }],
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await resp.json() as any;
      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          error: data?.error?.message || `Anthropic error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: 'Anthropic API key is valid and connected!' });
    }

    if (provider === 'google') {
      const targetModel = normalizeGeminiModel(model);
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ success: false, error: 'No Google API key provided.' });
      }

      const ai = new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      await ai.models.generateContent({
        model: targetModel,
        contents: 'Ping',
      });
      const latencyMs = Date.now() - startTime;
      return res.json({
        success: true,
        latencyMs,
        message: `Google Gemini (${targetModel}) connected successfully!`,
      });
    }

    if (provider === 'xai') {
      const resp = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const latencyMs = Date.now() - startTime;
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        return res.status(resp.status).json({
          success: false,
          error: err?.error?.message || `xAI error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: 'xAI Grok API key is valid and connected!' });
    }

    if (provider === 'tavily') {
      const resp = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: 'ping',
          max_results: 1,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await resp.json() as any;
      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          error: data?.message || data?.error || `Tavily error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: 'Tavily Search API key is valid and connected!' });
    }

    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Connection test failed',
    });
  }
});

// ---------- Chat Relay ----------
app.post('/api/chat', async (req: Request, res: Response) => {
  const { provider, apiKey, messages, model } = req.body || {};

  if (!provider || !apiKey || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Missing provider, apiKey, or messages.' });
  }

  try {
    if (provider === 'anthropic') {
      // Anthropic requires "system" separated out from the messages array.
      const systemMsgs = messages.filter((m: { role: string; content: string }) => m.role === 'system');
      const chatMsgs = messages
        .filter((m: { role: string; content: string }) => m.role !== 'system')
        .map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));

      const chosenModel = model || 'claude-sonnet-5';

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: chosenModel,
          max_tokens: 1024,
          system: systemMsgs.map((m: { content: string }) => m.content).join('\n\n') || undefined,
          messages: chatMsgs,
        }),
      });

      const data = await resp.json() as any;
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ error: data?.error?.message || `Anthropic error (${resp.status})` });
      }
      const text = data?.content?.map((c: any) => c.text || '').join('') || '';
      return res.json({ reply: text });
    }

    if (provider === 'openai') {
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'gpt-5.5',
          messages,
        }),
      });

      const data = await resp.json() as any;
      if (!resp.ok) {
        return res.status(resp.status).json({
          error: data?.error?.message || `OpenAI error (${resp.status})`,
        });
      }
      return res.json({ reply: data?.choices?.[0]?.message?.content || '' });
    }

    if (provider === 'xai') {
      const resp = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model || 'grok-4.7',
          messages,
        }),
      });

      const data = await resp.json() as any;
      if (!resp.ok) {
        return res.status(resp.status).json({
          error: data?.error?.message || `xAI Grok error (${resp.status})`,
        });
      }
      return res.json({ reply: data?.choices?.[0]?.message?.content || '' });
    }

    if (provider === 'google') {
      const targetModel = normalizeGeminiModel(model);
      const keyToUse = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToUse) {
        return res.status(400).json({ error: 'Missing Google API key.' });
      }

      const ai = new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemMsgs = messages.filter((m: { role: string }) => m.role === 'system');
      const chatContents = messages
        .filter((m: { role: string }) => m.role !== 'system')
        .map((m: { role: string; content: string }) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

      const config: any = {};
      if (systemMsgs.length > 0) {
        config.systemInstruction = systemMsgs.map((s: { content: string }) => s.content).join('\n\n');
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents: chatContents.length > 0 ? chatContents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      return res.json({ reply: response.text || '' });
    }

    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Unknown relay error.' });
  }
});

// ---------- Email: Fetch recent messages via IMAP ----------
app.post('/api/email/fetch', async (req: Request, res: Response) => {
  const { email, appPassword } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ error: 'Missing email or appPassword.' });
  }

  // Format clean app password (strip spaces)
  const cleanPass = String(appPassword).replace(/\s+/g, '');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
    clientInfo: { name: 'ModelHub', version: '1.0.0' },
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    const results: Array<{ id: number; from: string; subject: string; date: string | null; snippet: string }> = [];
    try {
      const mailbox = client.mailbox;
      if (!mailbox) {
        throw new Error('Could not open INBOX mailbox.');
      }
      const total = mailbox.exists;
      if (total > 0) {
        const start = Math.max(1, total - 19);
        for await (const msg of client.fetch(`${start}:${total}`, {
          envelope: true,
          source: true,
        })) {
          let snippet = '';
          try {
            if (msg.source) {
              const parsed = await simpleParser(msg.source);
              snippet = (parsed.text || '').slice(0, 200);
            }
          } catch {
            snippet = '';
          }
          results.push({
            id: msg.uid,
            from: msg.envelope?.from?.[0]?.address || msg.envelope?.from?.[0]?.name || 'unknown',
            subject: msg.envelope?.subject || '(no subject)',
            date: msg.envelope?.date ? new Date(msg.envelope.date).toISOString() : null,
            snippet,
          });
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
    results.reverse(); // newest first
    return res.json({ emails: results });
  } catch (err: any) {
    try {
      await client.logout();
    } catch {
      // ignore
    }
    return res.status(401).json({
      error:
        'Couldn\'t connect to Gmail. Check the email address and app password, and confirm 2-Step Verification + IMAP are enabled: ' +
        (err.message || ''),
    });
  }
});

// ---------- Email: Fetch one full message body ----------
app.post('/api/email/read', async (req: Request, res: Response) => {
  const { email, appPassword, uid } = req.body || {};
  if (!email || !appPassword || uid === undefined || uid === null) {
    return res.status(400).json({ error: 'Missing email, appPassword, or uid.' });
  }

  const cleanPass = String(appPassword).replace(/\s+/g, '');

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    let body = '';
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      if (msg && msg.source) {
        const parsed = await simpleParser(msg.source);
        body = parsed.text || parsed.html || '(no readable content)';
      } else {
        body = '(no readable content)';
      }
    } finally {
      lock.release();
    }
    await client.logout();
    return res.json({ body });
  } catch (err: any) {
    try {
      await client.logout();
    } catch {
      // ignore
    }
    return res.status(500).json({ error: err.message || 'Couldn\'t read that email.' });
  }
});

// ---------- Tavily Web Search Proxy ----------
app.post('/api/search', async (req: Request, res: Response) => {
  const { apiKey, query, maxResults = 5 } = req.body || {};
  if (!apiKey || !query) {
    return res.status(400).json({ error: 'Missing apiKey or query.' });
  }

  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
      }),
    });

    const data = await resp.json() as any;
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.message || data?.error || `Tavily error (${resp.status})`,
      });
    }

    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to perform web search.' });
  }
});

// ---------- Vite middleware / static serving ----------
async function startServer() {
  const distPath = path.resolve(__dirname, 'dist');
  const indexPath = path.resolve(distPath, 'index.html');

  if (process.env.NODE_ENV === 'production') {
    // If running in production on Render and dist has not been built yet, trigger auto-build
    if (!fs.existsSync(indexPath)) {
      console.log('⚡ dist/index.html not found at startup. Running automatic frontend build with Vite...');
      try {
        const { execSync } = await import('child_process');
        execSync('npx vite build', { stdio: 'inherit' });
        console.log('✅ Automatic frontend build completed successfully!');
      } catch (buildErr: any) {
        console.error('⚠️ Automatic build could not complete:', buildErr?.message || buildErr);
      }
    }

    if (fs.existsSync(indexPath)) {
      app.use(express.static(distPath));
      app.get('*', (req: Request, res: Response) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        res.sendFile(indexPath, (err) => {
          if (err && !res.headersSent) {
            res.status(500).send('Error loading application.');
          }
        });
      });
    } else {
      // Safe fallback if deployed to Render without running npm run build
      app.get('/', (_req: Request, res: Response) => {
        res.send(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ModelHub Relay</title>
  </head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #09090b; color: #f4f4f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; box-sizing: border-box;">
    <div style="max-width: 580px; width: 100%; background: #18181b; border: 1px solid #27272a; border-radius: 16px; padding: 32px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
        <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #9333ea); display: flex; align-items: center; justify-content: center; font-size: 20px;">⚡</div>
        <div>
          <h2 style="margin: 0; font-size: 18px; color: #ffffff;">ModelHub Backend Relay is Live</h2>
          <p style="margin: 2px 0 0 0; font-size: 12px; color: #a1a1aa;">All API endpoints and proxy services are operating normally.</p>
        </div>
      </div>
      <div style="background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 14px 16px; font-family: monospace; font-size: 13px; color: #34d399; margin: 20px 0;">
        ✓ Status: Online (Port ${PORT})<br/>
        ✓ Endpoints: /api/chat, /api/test-key, /api/email/fetch, /api/health
      </div>
      <div style="background: #27272a40; border-left: 3px solid #6366f1; padding: 12px 14px; border-radius: 6px; font-size: 13px; color: #d4d4d8; line-height: 1.6;">
        <strong>To serve the full frontend UI from Render:</strong><br/>
        Set your Render Web Service <em>Build Command</em> to:<br/>
        <code style="display: inline-block; margin-top: 6px; background: #09090b; border: 1px solid #3f3f46; color: #a5b4fc; padding: 4px 8px; border-radius: 6px; font-size: 12px;">npm install && npm run build</code>
      </div>
    </div>
  </body>
</html>`);
      });

      app.get('*', (req: Request, res: Response) => {
        if (req.path.startsWith('/api')) {
          return res.status(404).json({ error: 'API route not found' });
        }
        res.redirect('/');
      });
    }
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ModelHub server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
