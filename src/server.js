const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Gemini AI setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-memory session store (Railway ephemeral storage ke liye theek hai)
const sessions = new Map();

// Session cleanup - 30 min baad purane sessions delete
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.lastActive > 30 * 60 * 1000) {
      sessions.delete(id);
    }
  }
}, 5 * 60 * 1000);

// System prompt
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT ||
  'You are Bhadauriya AI, a helpful, intelligent and friendly assistant. Always respond in the same language the user writes in.';

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check (Railway ke liye zaroori)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    bot: process.env.BOT_NAME || 'Bhadauriya AI',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// New session banao
app.post('/api/session', (req, res) => {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    id: sessionId,
    history: [],
    createdAt: Date.now(),
    lastActive: Date.now(),
    messageCount: 0
  });
  res.json({ sessionId });
});

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message required hai' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY set nahi hai' });
  }

  // Session get ya banao
  let session = sessions.get(sessionId);
  if (!session) {
    const newId = sessionId || uuidv4();
    session = {
      id: newId,
      history: [],
      createdAt: Date.now(),
      lastActive: Date.now(),
      messageCount: 0
    };
    sessions.set(newId, session);
  }

  session.lastActive = Date.now();
  session.messageCount++;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT
    });

    const chat = model.startChat({
      history: session.history,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.7,
      }
    });

    const result = await chat.sendMessage(message.trim());
    const responseText = result.response.text();

    // History update karo
    session.history.push(
      { role: 'user', parts: [{ text: message.trim() }] },
      { role: 'model', parts: [{ text: responseText }] }
    );

    // Max 20 turns history rakho (memory management)
    if (session.history.length > 40) {
      session.history = session.history.slice(-40);
    }

    res.json({
      reply: responseText,
      sessionId: session.id,
      messageCount: session.messageCount
    });

  } catch (error) {
    console.error('Gemini API Error:', error.message);

    if (error.message?.includes('API_KEY_INVALID')) {
      return res.status(401).json({ error: 'Gemini API key invalid hai. .env check karo.' });
    }
    if (error.message?.includes('QUOTA_EXCEEDED')) {
      return res.status(429).json({ error: 'API quota khatam ho gaya. Thodi der baad try karo.' });
    }

    res.status(500).json({ error: 'Kuch gadbad ho gayi. Dobara try karo.' });
  }
});

// Clear session history
app.delete('/api/session/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  if (sessions.has(sessionId)) {
    sessions.delete(sessionId);
    res.json({ success: true, message: 'Session clear ho gaya' });
  } else {
    res.json({ success: true, message: 'Session already nahi tha' });
  }
});

// Stats endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    activeSessions: sessions.size,
    uptime: Math.floor(process.uptime()),
    botName: process.env.BOT_NAME || 'Bhadauriya AI'
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   🤖 Bhadauriya AI Chatbot           ║
║   Port: ${PORT}                         ║
║   Status: LIVE ✅                    ║
╚══════════════════════════════════════╝
  `);
});
