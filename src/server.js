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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

//  Routes

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

// Constants
const MAX_DOCUMENT_SIZE = 1024 * 1024; // 1MB

// Chat endpoint - now with file support
// Request format: { message: string, sessionId: string, images: Array<{data, mimeType}>, documents: Array<{content, name}> }
// Note: sessionId is the unique identifier for a chat conversation
// Images should be base64-encoded data URLs
// Documents should be text content (PDF, Word, etc. are not supported - use TXT or MD)
app.post('/api/chat', async (req, res) => {
  const { message, sessionId, images = [], documents = [], history = [] } = req.body;

  // Either message or files should exist
  if ((!message || !message.trim()) && images.length === 0 && documents.length === 0) {
    return res.status(400).json({ error: 'Message or files required hai' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY set nahi hai' });
  }

  // Validate document sizes
  for (const doc of documents) {
    if (doc.content && doc.content.length > MAX_DOCUMENT_SIZE) {
      return res.status(400).json({ error: `Document "${doc.name}" is too large. Maximum size is 1MB.` });
    }
  }

  // Session get ya banao
  let session = sessions.get(sessionId);
  if (!session) {
    const newId = sessionId || uuidv4();
    session = {
      id: newId,
      history: normalizeClientHistory(history),
      createdAt: Date.now(),
      lastActive: Date.now(),
      messageCount: Math.ceil(history.length / 2)
    };
    sessions.set(newId, session);
  }

  if (Array.isArray(history) && history.length && session.history.length === 0) {
    session.history = normalizeClientHistory(history);
    session.messageCount = Math.ceil(history.length / 2);
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

    // Build message parts - support text + images + documents
    const messageParts = [];

    // Add text message
    if (message && message.trim()) {
      messageParts.push({ text: message.trim() });
    }

    // Add images as inline_data
    if (images && images.length > 0) {
      for (const img of images) {
        if (img.data && img.mimeType) {
          // Extract base64 data (remove data:image/... prefix if present)
          let base64Data = img.data;
          if (base64Data.includes(',')) {
            base64Data = base64Data.split(',')[1];
          }
          messageParts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: base64Data
            }
          });
        }
      }
    }

    // Add documents as text
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        if (doc.content) {
          messageParts.push({
            text: `[Document: ${doc.name || 'Unnamed'}]\n${doc.content}`
          });
        }
      }
    }

    // If no parts, that's an error
    if (messageParts.length === 0) {
      return res.status(400).json({ error: 'No valid content to send' });
    }

    const result = await chat.sendMessage(messageParts);
    const responseText = result.response.text();

    // Build user message for history (text only for storage efficiency)
    const userHistoryParts = [];
    if (message && message.trim()) {
      userHistoryParts.push({ text: message.trim() });
    }
    if (images && images.length > 0) {
      userHistoryParts.push({ text: `[User sent ${images.length} image(s)]` });
    }
    if (documents && documents.length > 0) {
      userHistoryParts.push({ text: `[User sent ${documents.length} document(s)]` });
    }

    // History update karo (userHistoryParts guaranteed to have content due to validation above)
    session.history.push(
      { role: 'user', parts: userHistoryParts },
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


function normalizeClientHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(item => item && ['user', 'model'].includes(item.role) && typeof item.text === 'string' && item.text.trim())
    .slice(-40)
    .map(item => ({
      role: item.role,
      parts: [{ text: item.text.trim() }]
    }));
}
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
  console.log(`Bhadauriya AI Chatbot running on port ${PORT}`);
});
