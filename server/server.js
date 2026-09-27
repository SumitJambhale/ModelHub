import express from "express";
import cors from "cors";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const app = express();
app.use(cors());
app.use(express.json({ limit: "15mb" }));

const PORT = process.env.PORT || 3001;

// ---------- Health check ----------
app.get("/", (req, res) => res.send("ModelHub relay is running."));
app.get("/api/health", (req, res) => res.json({ status: "ok", message: "ModelHub relay is running." }));

// ---------- Test Key Endpoint ----------
app.post("/api/test-key", async (req, res) => {
  const { provider, apiKey, model } = req.body || {};

  if (!provider || !apiKey) {
    return res.status(400).json({ success: false, error: "Missing provider or apiKey." });
  }

  const startTime = Date.now();

  try {
    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/models", {
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
      return res.json({ success: true, latencyMs, message: "OpenAI API key is valid and connected!" });
    }

    if (provider === "anthropic") {
      const chosenModel = model || "claude-sonnet-5";
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: chosenModel,
          max_tokens: 10,
          messages: [{ role: "user", content: "Ping" }],
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          error: data?.error?.message || `Anthropic error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: "Anthropic API key is valid and connected!" });
    }

    if (provider === "google") {
      const targetModel = model || "gemini-2.5-flash";
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Ping" }] }],
          }),
        }
      );
      const latencyMs = Date.now() - startTime;
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          error: data?.error?.message || `Google Gemini error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: "Google Gemini API key is valid and connected!" });
    }

    if (provider === "xai") {
      const resp = await fetch("https://api.x.ai/v1/models", {
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
      return res.json({ success: true, latencyMs, message: "xAI Grok API key is valid and connected!" });
    }

    if (provider === "tavily") {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: "ping",
          max_results: 1,
        }),
      });
      const latencyMs = Date.now() - startTime;
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({
          success: false,
          error: data?.message || data?.error || `Tavily error (${resp.status})`,
        });
      }
      return res.json({ success: true, latencyMs, message: "Tavily Search API key is valid and connected!" });
    }

    return res.status(400).json({ success: false, error: `Unknown provider: ${provider}` });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Connection test failed",
    });
  }
});

// ---------- Chat relay (currently used for Anthropic; extendable to all) ----------
app.post("/api/chat", async (req, res) => {
  const { provider, apiKey, messages } = req.body || {};

  if (!provider || !apiKey || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Missing provider, apiKey, or messages." });
  }

  try {
    if (provider === "anthropic") {
      // Anthropic wants "system" separated out from the messages array.
      const systemMsgs = messages.filter((m) => m.role === "system");
      const chatMsgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        }));

      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 1024,
          system: systemMsgs.map((m) => m.content).join("\n\n") || undefined,
          messages: chatMsgs,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return res
          .status(resp.status)
          .json({ error: data?.error?.message || `Anthropic error (${resp.status})` });
      }
      const text = data?.content?.map((c) => c.text || "").join("") || "";
      return res.json({ reply: text });
    }

    if (provider === "openai") {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5.5",
          messages,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: data?.error?.message || `OpenAI error (${resp.status})` });
      }
      return res.json({ reply: data?.choices?.[0]?.message?.content || "" });
    }

    if (provider === "xai") {
      const resp = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-4.7",
          messages,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        return res.status(resp.status).json({ error: data?.error?.message || `xAI error (${resp.status})` });
      }
      return res.json({ reply: data?.choices?.[0]?.message?.content || "" });
    }

    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Unknown relay error." });
  }
});

// ---------- Email: fetch recent messages via IMAP ----------
app.post("/api/email/fetch", async (req, res) => {
  const { email, appPassword } = req.body || {};

  if (!email || !appPassword) {
    return res.status(400).json({ error: "Missing email or appPassword." });
  }

  const cleanPass = String(appPassword).replace(/\s+/g, "");

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    const results = [];
    try {
      // Fetch the 20 most recent messages.
      const mailbox = client.mailbox;
      const total = mailbox.exists;
      if (total > 0) {
        const start = Math.max(1, total - 19);
        for await (const msg of client.fetch(`${start}:${total}`, {
          envelope: true,
          source: true,
        })) {
          let snippet = "";
          try {
            const parsed = await simpleParser(msg.source);
            snippet = (parsed.text || "").slice(0, 200);
          } catch {
            snippet = "";
          }
          results.push({
            id: msg.uid,
            from: msg.envelope?.from?.[0]?.address || "unknown",
            subject: msg.envelope?.subject || "(no subject)",
            date: msg.envelope?.date || null,
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
  } catch (err) {
    try { await client.logout(); } catch {}
    return res.status(401).json({
      error:
        "Couldn't connect to Gmail. Check the email address and app password, and confirm 2-Step Verification + IMAP are enabled: " +
        (err.message || ""),
    });
  }
});

// ---------- Email: fetch one full message body ----------
app.post("/api/email/read", async (req, res) => {
  const { email, appPassword, uid } = req.body || {};
  if (!email || !appPassword || !uid) {
    return res.status(400).json({ error: "Missing email, appPassword, or uid." });
  }

  const cleanPass = String(appPassword).replace(/\s+/g, "");

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    let body = "";
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      const parsed = await simpleParser(msg.source);
      body = parsed.text || parsed.html || "(no readable content)";
    } finally {
      lock.release();
    }
    await client.logout();
    return res.json({ body });
  } catch (err) {
    try { await client.logout(); } catch {}
    return res.status(500).json({ error: err.message || "Couldn't read that email." });
  }
});

app.listen(PORT, () => console.log(`ModelHub relay listening on port ${PORT}`));
