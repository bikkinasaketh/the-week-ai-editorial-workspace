# The Week AI — Editorial Workspace

A React + Express editorial tool for turning article URLs into a source-linked research brief and reviewing a newsletter draft with explainable writing checks.

## Features
- Accepts 3–8 article URLs, reports per-source failures, and preserves original links.
- Uses an optional OpenAI-compatible LLM endpoint to generate a structured brief and additional writing feedback.
- Clearly separates source notes from editorial analysis; fallback content is labelled as a fallback and is not represented as verified AI research.
- Rule-based checks for long sentences, possible passive voice, and filler phrases.
- Accept/reject controls, original draft preservation, comparison view, and word count, reading time, average sentence length, and Flesch-style readability estimate.
- Friendly errors for empty drafts, invalid URL lists, failed extraction, and AI response problems.

## Run locally
Requirements: Node.js 18+.

1. Copy `backend/.env.example` to `backend/.env` and optionally add your provider API key.
2. In one terminal: `cd backend && npm install && npm run dev`
3. In another terminal: `cd frontend && npm install && npm run dev`
4. Open the Vite URL shown in the terminal (usually `http://localhost:5173`).

Set `VITE_API_URL` in `frontend/.env` to the backend origin if it is not `http://localhost:5000`. The backend reads `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL`. Use a provider's currently available free-tier model if offered; free model availability and limits can change. Never put provider keys in frontend code or commit `.env`.

## Deploy
- Deploy `backend` as a Node service (Render/Railway). Start command: `npm start`; set environment variables in the host dashboard.
- Deploy `frontend` to Vercel/Netlify. Build command: `npm run build`; output directory: `dist`; set `VITE_API_URL` to the deployed backend URL.
- Configure backend `FRONTEND_ORIGIN` to your deployed frontend origin.
- Test `/api/health`, then test the complete research and writing workflows on the public site.

## Product & engineering decisions
Primary user: a newsletter editor who must turn multiple inputs into a grounded story and a readable draft. The core path is sources → research brief → draft → feedback → accept/reject → compare. We prioritized source attribution, failure handling, writer control, and explainable deterministic checks over accounts, collaboration, and a complex publishing CMS. LLM calls are optional and isolated in the backend; measurable checks use JavaScript. Article extraction may fail for paywalled, blocked, or script-rendered pages, and the UI exposes each failure. Claims should be checked against original sources; summaries and analysis are not a substitute for verification. Useful metrics include successful source extraction rate, accepted-suggestion rate, time to first draft, and editor-reported usefulness. With another day, add richer sentence-level rewrites, better passive-voice parsing, automated end-to-end tests, and more robust article extraction.

## AI / library disclosure
Built with React, Vite, Express, `@extractus/article-extractor`, and JavaScript writing heuristics. Optional AI uses a configured OpenAI-compatible API endpoint. No provider key is included in this repository. AI-generated text should be checked by a human editor.
