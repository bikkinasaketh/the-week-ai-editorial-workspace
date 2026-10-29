# Product & Engineering Note

**User and problem.** The primary user is a newsletter editor who needs to move from scattered source material to an evidence-aware, reader-friendly draft without losing editorial control.

**Workflow.** Submit at least three URLs; inspect extraction status and a structured brief; draft or paste a newsletter; run deterministic writing checks and optional AI feedback; accept or reject individual suggestions; compare original and revised copy.

**Trade-offs.** The MVP prioritizes the end-to-end editorial workflow, visible source links, clear labels for facts versus analysis, and failure handling. It leaves out user accounts, collaborative editing, social-platform scraping, and a publishing CMS. Extraction can fail for paywalls and blocked pages; failed URLs are reported rather than silently omitted.

**AI versus deterministic logic.** An optional OpenAI-compatible LLM endpoint creates the structured brief and contextual writing feedback. JavaScript rules flag long sentences, common passive constructions, and filler phrases; word count, average sentence length, reading time, and a Flesch-style estimate are calculated locally on the backend. These checks are heuristics, not authoritative grammar judgments.

**Trust and evaluation.** Source URLs remain attached to source notes. Editors must verify claims in the linked articles, and analysis is labelled separately. Track extraction success, accepted suggestion rate, time to first usable draft, and editor feedback. With one more day, improve passive-voice detection, add tests, and support pasted article text as a fallback.

**Disclosure.** React, Vite, Express, `@extractus/article-extractor`, and custom JavaScript checks are used. Optional AI requests go through a configured OpenAI-compatible API. AI-assisted content requires human review.
