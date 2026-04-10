import { handleChat } from '../mcp/chat-handler.js';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const role = req.query.role === 'admin' ? 'admin' : 'user';
    const reply = await handleChat(message, apiKey, role);
    res.json({ reply });
  } catch (err) {
    console.error('[Chat] Error:', err?.message || err);
    res.status(502).json({ error: `Chat error: ${err?.message || 'Unknown error'}` });
  }
}
