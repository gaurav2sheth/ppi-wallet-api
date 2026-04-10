import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { handleChat } from './mcp/chat-handler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    'https://gaurav2sheth.github.io',
    'http://localhost:5173',
    'http://localhost:5174',
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, tools: 18, version: '1.0.0' });
});

// ── POST /api/chat ───────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
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
});

// ── POST /api/summarise-transactions ─────────────────────────────────────────
app.post('/api/summarise-transactions', async (req, res) => {
  try {
    const { transactions } = req.body;
    if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
      return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured.' });
    }

    const role = req.query.role === 'admin' ? 'admin' : 'user';

    const formatted = transactions.map((t, i) => {
      const dateField = t.created_at || t.createdAt;
      const date = new Date(dateField).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const amountField = t.amount_paise || t.amountPaise;
      const amount = '₹' + (Number(amountField) / 100).toLocaleString('en-IN');
      const type = t.entry_type || t.sagaType || 'unknown';
      const desc = t.description || 'N/A';
      const status = t.status ? ` | Status: ${t.status}` : '';
      const error = t.error ? ` | Error: ${t.error}` : '';
      return `${i + 1}. [${date}] ${type} | ${amount} | ${desc}${status}${error}`;
    }).join('\n');

    const systemPrompt = role === 'admin'
      ? 'You are a financial analyst for a PPI wallet product in India. Be concise, factual, and use INR currency formatting.'
      : 'You are a personal finance assistant for a PPI wallet user in India. Be concise, friendly, and use INR currency formatting. Address the user directly.';

    const userPrompt = role === 'admin'
      ? `Here is a list of wallet transactions. Provide a 3-5 line plain English summary covering: total count, total value, largest transaction, any notable patterns.\n\nTransactions:\n${formatted}`
      : `Here are my recent wallet transactions. Give me a 3-5 line plain English summary covering: total count, total spending vs income, largest transaction, and any tips or patterns you notice.\n\nTransactions:\n${formatted}`;

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const textBlock = message.content.find(b => b.type === 'text');
    const summary = textBlock ? textBlock.text : 'No summary generated.';
    res.json({ summary });
  } catch (err) {
    console.error('[Summarise] Error:', err?.message || err);
    res.status(502).json({ error: `Claude API error: ${err?.message || 'Unknown error'}` });
  }
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`PPI Wallet API server running on port ${PORT}`);
});
