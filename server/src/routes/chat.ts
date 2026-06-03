import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db';
import { generateReply, HistoryMessage } from '../llm';

const router = Router();

const MAX_MESSAGE_LENGTH = 1000;
const HISTORY_LIMIT = 10;

router.post('/message', async (req: Request, res: Response) => {
  try {
    const { message, sessionId } = req.body as { message: unknown; sessionId: unknown };

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required and must be a string' });
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const finalMessage =
      trimmed.length > MAX_MESSAGE_LENGTH ? trimmed.slice(0, MAX_MESSAGE_LENGTH) : trimmed;

    // Resolve or create conversation
    let conversationId: string;
    if (sessionId && typeof sessionId === 'string') {
      const existing = db.prepare('SELECT id FROM conversations WHERE id = ?').get(sessionId);
      if (existing) {
        conversationId = sessionId;
      } else {
        // Unknown session — start fresh silently
        conversationId = uuidv4();
        db.prepare('INSERT INTO conversations (id, createdAt) VALUES (?, ?)').run(
          conversationId,
          new Date().toISOString()
        );
      }
    } else {
      conversationId = uuidv4();
      db.prepare('INSERT INTO conversations (id, createdAt) VALUES (?, ?)').run(
        conversationId,
        new Date().toISOString()
      );
    }

    // Persist user message
    const userMsgId = uuidv4();
    const userTimestamp = new Date().toISOString();
    db.prepare(
      'INSERT INTO messages (id, conversationId, sender, text, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(userMsgId, conversationId, 'user', finalMessage, userTimestamp);

    // Fetch recent history (excluding the message we just inserted)
    const rawHistory = db
      .prepare(
        `SELECT sender, text FROM messages
         WHERE conversationId = ? AND id != ?
         ORDER BY timestamp DESC
         LIMIT ?`
      )
      .all(conversationId, userMsgId, HISTORY_LIMIT) as unknown as HistoryMessage[];

    rawHistory.reverse();

    // Call LLM
    let reply: string;
    try {
      reply = await generateReply(rawHistory, finalMessage);
    } catch (llmErr: unknown) {
      const err = llmErr as { message?: string; status?: number };
      console.error('LLM error:', err);

      if (err.message?.includes('API_KEY') || err.message?.includes('not configured')) {
        reply =
          "Our support agent isn't configured right now. Please reach us directly at support@shopease.com.";
      } else if (err.status === 429 || err.message?.toLowerCase().includes('quota')) {
        reply =
          "I'm a bit overwhelmed with requests at the moment. Please try again in a few minutes!";
      } else {
        reply =
          "Sorry, I'm having trouble connecting right now. Please try again in a moment, or email us at support@shopease.com.";
      }
    }

    // Persist AI reply
    db.prepare(
      'INSERT INTO messages (id, conversationId, sender, text, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).run(uuidv4(), conversationId, 'ai', reply, new Date().toISOString());

    return res.json({ reply, sessionId: conversationId });
  } catch (err) {
    console.error('Unexpected error in POST /chat/message:', err);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
});

router.get('/history/:sessionId', (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    const conversation = db.prepare('SELECT id FROM conversations WHERE id = ?').get(sessionId);
    if (!conversation) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = db
      .prepare(
        'SELECT id, sender, text, timestamp FROM messages WHERE conversationId = ? ORDER BY timestamp ASC'
      )
      .all(sessionId);

    return res.json({ messages, sessionId });
  } catch (err) {
    console.error('Error in GET /chat/history:', err);
    return res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

export default router;
