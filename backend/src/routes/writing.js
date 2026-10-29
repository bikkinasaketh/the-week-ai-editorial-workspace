import { Router } from 'express';
import { checkWriting, metrics } from '../services/writingChecks.js';
import { askLLM } from '../services/llmClient.js';
const router = Router();
router.post('/', async (req, res) => {
  const text = String(req.body?.text || '').slice(0, 30000);
  if (!text.trim()) return res.status(400).json({ error: 'Paste a draft before running checks.' });
  const issues = checkWriting(text);
  let aiFeedback = null;
  try { aiFeedback = await askLLM([{role:'system',content:'You are a careful editor. Give up to 3 actionable suggestions as JSON array of objects {passage,reason,rewrite}. Preserve meaning and technical terms; do not invent facts.'},{role:'user',content:text.slice(0,10000)}]); if (aiFeedback) aiFeedback = JSON.parse(aiFeedback.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')); } catch { aiFeedback = null; }
  res.json({ issues, metrics: metrics(text), aiFeedback, aiUsed: Boolean(aiFeedback) });
});
export default router;
