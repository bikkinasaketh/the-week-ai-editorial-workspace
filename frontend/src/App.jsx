
import React, { useMemo, useState } from "react";
import {
  Sparkles,
  BookOpen,
  PenLine,
  ArrowUpRight,
  Check,
  X,
  Copy,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  FileText,
} from "lucide-react";
import { researchSources, reviewDraft } from "./services/api.js";

const demoDraft = `At the end of the day, it is important to note that artificial intelligence is being adopted by teams across many industries, and this is actually changing the way that people work. The tools are being used by developers to write code, by analysts to explore information, and by operators to automate repetitive tasks. Because these systems can produce answers quickly, teams may be tempted to trust them without checking the evidence. This can be a problem when a model gives an outdated answer or confidently states something that is not supported by the source. A better workflow is to treat AI as an assistant, verify important claims against primary sources, and keep a human responsible for the final decision.`;

function getWordCount(text = "") {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getSentenceCount(text = "") {
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.length;
}

function countSyllables(text = "") {
  const words = text.toLowerCase().match(/[a-z]+/g) || [];

  return words.reduce((total, word) => {
    const groups = word.match(/[aeiouy]+/g);
    let count = groups ? groups.length : 1;

    if (word.length > 2 && word.endsWith("e")) count--;
    if (word.endsWith("le") && word.length > 2) count++;

    return total + Math.max(1, count);
  }, 0);
}

function getLiveMetrics(text = "") {
  const words = getWordCount(text);
  const sentences = getSentenceCount(text);

  const averageSentenceLength = sentences
    ? Math.round((words / sentences) * 10) / 10
    : 0;

  const readingTimeMinutes = words
    ? Math.max(1, Math.ceil(words / 220))
    : 0;

  let readabilityScore = null;

  if (words > 0 && sentences > 0) {
    const syllables = countSyllables(text);

    readabilityScore = Math.round(
      206.835 -
        1.015 * (words / sentences) -
        84.6 * (syllables / words)
    );

    readabilityScore = Math.max(
      0,
      Math.min(100, readabilityScore)
    );
  }

  return {
    wordCount: words,
    averageSentenceLength,
    readingTimeMinutes,
    readabilityScore,
  };
}

function renderAnalysis(analysis) {
  if (Array.isArray(analysis)) {
    return analysis.map((item, index) => (
      <p className="bullet-copy" key={index}>
        {typeof item === "string"
          ? item
          : JSON.stringify(item)}
      </p>
    ));
  }

  if (typeof analysis === "string" && analysis.trim()) {
    return <p className="bullet-copy">{analysis}</p>;
  }

  return (
    <p className="bullet-copy">
      No analysis available.
    </p>
  );
}

/*
 * Find the smallest changed region between the original text
 * and a suggested rewrite.
 */
function getTextChange(original, rewrite) {
  let prefix = 0;

  while (
    prefix < original.length &&
    prefix < rewrite.length &&
    original[prefix] === rewrite[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;

  while (
    suffix < original.length - prefix &&
    suffix < rewrite.length - prefix &&
    original[original.length - 1 - suffix] ===
      rewrite[rewrite.length - 1 - suffix]
  ) {
    suffix++;
  }

  return {
    removed: original.slice(prefix, original.length - suffix),
    inserted: rewrite.slice(prefix, rewrite.length - suffix),
  };
}

/*
 * Apply accepted edits from the smallest local change to the
 * largest one. This reduces conflicts when several suggestions
 * refer to the same sentence.
 */
function buildRevisedDraft(originalDraft, issues, decisions) {
  let result = originalDraft;

  const accepted = issues
    .filter(
      (issue) =>
        decisions[issue.id] === "accept" &&
        issue.text &&
        issue.rewrite &&
        issue.text !== issue.rewrite
    )
    .map((issue) => {
      const change = getTextChange(issue.text, issue.rewrite);

      return {
        ...issue,
        ...change,
        changeSize:
          change.removed.length + change.inserted.length,
      };
    })
    .sort((a, b) => a.changeSize - b.changeSize);

  for (const issue of accepted) {
    // Exact replacement works when the sentence has not changed yet.
    if (result.includes(issue.text)) {
      result = result.replace(issue.text, issue.rewrite);
      continue;
    }

    // Otherwise, apply only the changed phrase.
    if (issue.removed && result.includes(issue.removed)) {
      result = result.replace(issue.removed, issue.inserted);
    }
  }

  // Capitalize the beginning of sentences without changing
  // the rest of the writer's wording.
  result = result.replace(
    /(^|[.!?]\s+)([a-z])/g,
    (_, separator, letter) =>
      separator + letter.toUpperCase()
  );

  return result;
}

export default function App() {
  const [tab, setTab] = useState("research");

  const [urls, setUrls] = useState(
    "https://www.theverge.com/\nhttps://techcrunch.com/\nhttps://www.wired.com/"
  );

  const [research, setResearch] = useState(null);
  const [researchBusy, setResearchBusy] = useState(false);
  const [researchError, setResearchError] = useState("");

  const [draft, setDraft] = useState(demoDraft);
  const [original, setOriginal] = useState(demoDraft);
  const [review, setReview] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [error, setError] = useState("");
  const [decisions, setDecisions] = useState({});
  const [showCompare, setShowCompare] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");

  // Build suggestions against the preserved original draft.
  const revised = useMemo(
    () =>
      buildRevisedDraft(
        original,
        review?.issues || [],
        decisions
      ),
    [original, review, decisions]
  );

  // Metrics always describe the current editor text.
  const liveMetrics = useMemo(
    () => getLiveMetrics(draft),
    [draft]
  );

  async function runResearch() {
    setResearchBusy(true);
    setResearchError("");
    setResearch(null);

    try {
      const inputUrls = [
        ...new Set(
          urls
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean)
        ),
      ];

      if (inputUrls.length < 3) {
        throw new Error(
          "Please enter at least 3 unique article URLs."
        );
      }

      if (inputUrls.length > 8) {
        throw new Error("Please enter no more than 8 URLs.");
      }

      const invalidUrl = inputUrls.find((url) => {
        try {
          const parsed = new URL(url);
          return !["http:", "https:"].includes(parsed.protocol);
        } catch {
          return true;
        }
      });

      if (invalidUrl) {
        throw new Error(`Invalid URL: ${invalidUrl}`);
      }

      const result = await researchSources(inputUrls);
      setResearch(result);
    } catch (err) {
      setResearchError(
        err.message || "Unable to generate the research brief."
      );
    } finally {
      setResearchBusy(false);
    }
  }

  async function runReview() {
    if (!draft.trim()) {
      setError("Please enter a draft before analyzing it.");
      return;
    }

    setReviewBusy(true);
    setError("");
    setOriginal(draft);
    setDecisions({});
    setShowCompare(false);
    setCopyMessage("");
    setReview(null);

    try {
      const result = await reviewDraft(draft);
      setReview(result);
    } catch (err) {
      setError(
        `${err.message || "Unable to analyze your draft."} Check that the backend is running.`
      );
    } finally {
      setReviewBusy(false);
    }
  }

  function applyAcceptedChanges() {
    if (acceptedCount === 0) {
      setCopyMessage("Accept at least one suggestion first.");
      return;
    }

    setDraft(revised);
    setShowCompare(true);
    setCopyMessage("Accepted changes applied.");
  }

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setCopyMessage("Draft copied.");
    } catch {
      setCopyMessage(
        "Copy failed. Select and copy the draft manually."
      );
    }
  }

  function decide(issueId, decision) {
    setDecisions((previous) => ({
      ...previous,
      [issueId]:
        previous[issueId] === decision
          ? undefined
          : decision,
    }));

    setCopyMessage("");
  }

  const acceptedCount = Object.values(decisions).filter(
    (value) => value === "accept"
  ).length;

  const rejectedCount = Object.values(decisions).filter(
    (value) => value === "reject"
  ).length;

  const sourceCount = urls
    .split("\n")
    .filter((url) => url.trim()).length;

  const metrics = [
    [
      "WORD COUNT",
      liveMetrics.wordCount,
      "Total words in your current draft",
    ],
    [
      "AVG. SENTENCE",
      liveMetrics.averageSentenceLength,
      "Words per sentence",
    ],
    [
      "READING TIME",
      `${liveMetrics.readingTimeMinutes} min`,
      "Estimated at 220 words/min",
    ],
    [
      "READABILITY",
      liveMetrics.readabilityScore ?? "—",
      "Approximate Flesch score",
    ],
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={19} />
          </div>

          <div>
            <b>
              the week <span>AI</span>
            </b>
            <small>EDITORIAL WORKSPACE</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <button
          className={`nav-item ${
            tab === "research" ? "active" : ""
          }`}
          onClick={() => setTab("research")}
        >
          <BookOpen size={17} />
          Research assistant
        </button>

        <button
          className={`nav-item ${
            tab === "writing" ? "active" : ""
          }`}
          onClick={() => setTab("writing")}
        >
          <PenLine size={17} />
          Writing assistant
        </button>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <span>Editorial workspace</span>
          <span className="v-tag">BETA</span>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Workspace <span>/</span>{" "}
              {tab === "research" ? "Research" : "Writing"}
            </div>

            <h1>
              {tab === "research"
                ? "Research that leads somewhere."
                : "Make every sentence earn its place."}
            </h1>

            <p>
              {tab === "research"
                ? "Turn multiple sources into a clear, evidence-backed editorial brief."
                : "Thoughtful editing, with the writer firmly in control."}
            </p>
          </div>

          <div className="top-badge">
            <span className="green-dot" />
            AI-assisted <span className="divider-v" /> Human-reviewed
          </div>
        </header>

        <div className="tabbar">
          <button
            className={tab === "research" ? "selected" : ""}
            onClick={() => setTab("research")}
          >
            <BookOpen size={16} />
            Research brief <span>01</span>
          </button>

          <button
            className={tab === "writing" ? "selected" : ""}
            onClick={() => setTab("writing")}
          >
            <PenLine size={16} />
            Writing editor <span>02</span>
          </button>
        </div>

        {tab === "research" ? (
          <section className="content">
            <div className="section-head">
              <div>
                <div className="eyebrow">
                  PART A <span>·</span> DISCOVER
                </div>
                <h2>Bring the story into focus</h2>
                <p>
                  Start with at least three article URLs. We’ll
                  extract what we can and organize the evidence.
                </p>
              </div>

              <div className="step-icon">
                <BookOpen size={21} />
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Source collection</h3>
                  <p>One URL per line · Up to 8 sources</p>
                </div>

                <span className="count-pill">
                  {sourceCount} SOURCES
                </span>
              </div>

              <textarea
                className="url-input"
                value={urls}
                onChange={(event) => setUrls(event.target.value)}
                placeholder="https://example.com/article"
                rows={5}
              />

              <div className="panel-foot">
                <span>
                  <ShieldCheck size={14} />
                  Source links stay attached to claims
                </span>

                <button
                  className="primary-btn"
                  disabled={researchBusy}
                  onClick={runResearch}
                  type="button"
                >
                  {researchBusy ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}

                  {researchBusy
                    ? "Researching…"
                    : "Generate research brief"}

                  <ArrowUpRight size={15} />
                </button>
              </div>

              {researchError && (
                <div className="error-box">{researchError}</div>
              )}
            </div>

            {research && (
              <>
                <div className="section-head result-head">
                  <div>
                    <div className="eyebrow">RESEARCH OUTPUT</div>
                    <h2>
                      {research.brief?.headline || "Research brief"}
                    </h2>
                  </div>

                  <span className="count-pill">
                    {
                      research.sources?.filter(
                        (source) => source.status === "ok"
                      ).length
                    }{" "}
                    SOURCES LOADED
                  </span>
                </div>

                {research.aiError && (
                  <div className="notice">
                    <ShieldCheck size={17} />
                    <div>
                      <b>AI research warning</b>
                      <p>
                        AI generation failed. Review the source notes
                        carefully and check the backend configuration.
                      </p>
                    </div>
                  </div>
                )}

                <div className="source-grid">
                  {(research.sources || []).map((source, index) => (
                    <div className="source-card" key={source.url}>
                      <div
                        className={`source-status ${source.status}`}
                      >
                        {source.status === "ok" ? "LOADED" : "FAILED"}
                      </div>

                      <div className="source-number">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <h4>{source.title || source.url}</h4>

                      <p>
                        {source.error ||
                          `${(source.text || "").slice(0, 150)}…`}
                      </p>

                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open source <ExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>

                <div className="brief-grid">
                  <div className="panel brief-main">
                    <div className="eyebrow">THE BIG PICTURE</div>
                    <h3>Executive summary</h3>

                    <p className="brief-copy">
                      {research.brief?.summary ||
                        "No executive summary is available."}
                    </p>

                    <div className="eyebrow sub-eyebrow">
                      VERIFIABLE SOURCE NOTES
                    </div>

                    {(research.brief?.facts || []).map(
                      (fact, index) => (
                        <div className="fact-row" key={index}>
                          <span className="fact-tag">SOURCE NOTE</span>

                          <p>
                            {fact.claim}
                            <br />

                            {fact.sourceUrl ? (
                              <a
                                href={fact.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                View source <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span>Source URL unavailable</span>
                            )}
                          </p>
                        </div>
                      )
                    )}
                  </div>

                  <div className="right-stack">
                    <div className="panel">
                      <div className="eyebrow">
                        EDITORIAL JUDGMENT
                      </div>

                      <h3>Why it matters</h3>
                      {renderAnalysis(research.brief?.analysis)}

                      <h4>Who should care</h4>

                      {(research.brief?.whoShouldCare || []).map(
                        (item, index) => (
                          <div className="list-line" key={index}>
                            <span>↗</span>
                            {item}
                          </div>
                        )
                      )}
                    </div>

                    <div className="panel angle-panel">
                      <div className="eyebrow">POTENTIAL STORY</div>
                      <h3>Newsletter angles</h3>

                      {(research.brief?.newsletterAngles || []).map(
                        (angle, index) => (
                          <p key={index}>{angle}</p>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {research.brief?.caveats?.length > 0 && (
                  <div className="notice">
                    <ShieldCheck size={17} />
                    <div>
                      <b>Editorial caveats</b>
                      <p>{research.brief.caveats.join(" ")}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="hint">
              <Sparkles size={16} />
              <p>
                <b>Editorial principle</b>
                <br />
                Facts are not the same as interpretation. Always verify
                claims in the original source before publishing.
              </p>
            </div>
          </section>
        ) : (
          <section className="content">
            <div className="section-head">
              <div>
                <div className="eyebrow">
                  PART B <span>·</span> REFINE
                </div>
                <h2>Clarity without losing your voice</h2>
                <p>
                  Run deterministic checks, review each suggestion,
                  and decide what makes it into your draft.
                </p>
              </div>

              <div className="step-icon">
                <PenLine size={21} />
              </div>
            </div>

            <div className="metrics-grid">
              {metrics.map((metric) => (
                <div className="metric" key={metric[0]}>
                  <span>{metric[0]}</span>
                  <strong>{metric[1]}</strong>
                  <small>{metric[2]}</small>
                </div>
              ))}
            </div>

            <div className="panel editor-panel">
              <div className="panel-head">
                <div>
                  <h3>Your draft</h3>
                  <p>
                    Original stays safe until you apply accepted changes.
                  </p>
                </div>

                <span className="count-pill">
                  {getWordCount(draft)} WORDS
                </span>
              </div>

              <textarea
                className="draft-input"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  setCopyMessage("");
                }}
                placeholder="Paste your newsletter draft here…"
                rows={10}
              />

              <div className="panel-foot">
                <span>
                  <ShieldCheck size={14} />
                  Your voice. Your final call.
                </span>

                <div className="button-row">
                  <button
                    className="secondary-btn"
                    onClick={copyDraft}
                    type="button"
                  >
                    <Copy size={15} /> Copy draft
                  </button>

                  <button
                    className="primary-btn"
                    onClick={runReview}
                    disabled={reviewBusy}
                    type="button"
                  >
                    {reviewBusy ? (
                      <LoaderCircle className="spin" size={16} />
                    ) : (
                      <Sparkles size={16} />
                    )}

                    {reviewBusy
                      ? "Checking draft…"
                      : "Analyze my writing"}

                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </div>

              {copyMessage && <p>{copyMessage}</p>}
              {error && <div className="error-box">{error}</div>}
            </div>

            {review && (
              <>
                <div className="section-head result-head">
                  <div>
                    <div className="eyebrow">WRITING FEEDBACK</div>
                    <h2>
                      {review.issues.length} suggestions to review
                    </h2>
                    <p>
                      Accept only the changes that preserve your
                      intended meaning.
                    </p>
                  </div>

                  <button
                    className="secondary-btn"
                    onClick={() => setShowCompare((value) => !value)}
                    type="button"
                  >
                    {showCompare
                      ? "Hide comparison"
                      : "Compare versions"}
                  </button>
                </div>

                <div className="suggestions">
                  {review.issues.length === 0 && (
                    <div className="panel">
                      No rule-based issues found. That does not
                      guarantee the draft is perfect—read it aloud
                      and verify claims.
                    </div>
                  )}

                  {review.issues.map((issue, index) => (
                    <div
                      className="suggestion-card"
                      key={issue.id}
                    >
                      <div className="suggestion-top">
                        <span className="suggestion-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="issue-type">
                          {issue.type}
                        </span>

                        <div className="decision-actions">
                          <button
                            type="button"
                            title="Accept"
                            aria-label="Accept suggestion"
                            className={
                              decisions[issue.id] === "accept"
                                ? "chosen-accept"
                                : ""
                            }
                            onClick={() =>
                              decide(issue.id, "accept")
                            }
                          >
                            <Check size={15} />
                          </button>

                          <button
                            type="button"
                            title="Reject"
                            aria-label="Reject suggestion"
                            className={
                              decisions[issue.id] === "reject"
                                ? "chosen-reject"
                                : ""
                            }
                            onClick={() =>
                              decide(issue.id, "reject")
                            }
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>

                      <blockquote>{issue.text}</blockquote>
                      <p className="reason">{issue.reason}</p>

                      <div className="rewrite-box">
                        <span>SUGGESTED REWRITE</span>
                        <p>{issue.rewrite}</p>
                      </div>

                      <div className="decision-label">
                        {decisions[issue.id] === "accept"
                          ? "Accepted"
                          : decisions[issue.id] === "reject"
                          ? "Rejected"
                          : "Awaiting your decision"}
                      </div>
                    </div>
                  ))}
                </div>

                {review.aiFeedback?.length > 0 && (
                  <div className="panel ai-feedback">
                    <div className="eyebrow">AI EDITOR NOTES</div>
                    <h3>Beyond the rules</h3>

                    {review.aiFeedback.map((suggestion, index) => (
                      <div className="fact-row" key={index}>
                        <p>
                          <b>{suggestion.passage}</b>
                          <br />
                          {suggestion.reason}
                          <br />
                          <span className="rewrite-inline">
                            Try: {suggestion.rewrite}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="apply-row">
                  <span>
                    {acceptedCount} accepted · {rejectedCount} rejected
                  </span>

                  <button
                    className="primary-btn"
                    type="button"
                    disabled={acceptedCount === 0}
                    onClick={applyAcceptedChanges}
                  >
                    <Check size={16} /> Apply accepted changes
                  </button>
                </div>

                {showCompare && (
                  <div className="compare-grid">
                    <div className="panel">
                      <div className="eyebrow">ORIGINAL</div>
                      <p className="compare-text">{original}</p>
                    </div>

                    <div className="panel">
                      <div className="eyebrow">REVISED</div>
                      <p className="compare-text">{draft}</p>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="hint">
              <FileText size={16} />
              <p>
                <b>How to read the score</b>
                <br />
                Flesch Reading Ease estimates how easy a passage may
                be to read. It does not measure accuracy, insight, or
                writing quality. Passive-voice detection is heuristic
                and may produce false positives.
              </p>
            </div>
          </section>
        )}

        <footer>
          <span>
            THE WEEK <b>AI</b> · EDITORIAL WORKSPACE
          </span>
          <span>
            Built for clear thinking, not content volume.
          </span>
        </footer>
      </main>
    </div>
  );
}
