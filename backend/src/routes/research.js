
import { Router } from "express";
import { fetchArticle } from "../services/articleExtractor.js";
import { askLLM } from "../services/llmClient.js";

const router = Router();

function parseAIJson(content) {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI response did not contain valid JSON.");
    }

    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function makeFallbackBrief(sources) {
  return {
    headline: "Research Brief: Key Themes Across Sources",
    summary:
      "A reliable AI-generated summary is not available. Review the extracted source text and compare the evidence before drawing conclusions.",
    facts: sources.map((source) => ({
      claim: source.text.slice(0, 250),
      sourceUrl: source.url,
    })),
    analysis:
      "The sources need further comparison. Identify recurring themes, disagreements, and missing context before forming an editorial conclusion.",
    whoShouldCare: [
      "Editors and journalists researching the topic",
      "Readers who need evidence-backed context",
    ],
    newsletterAngles: [
      "Explain the most important development and why it matters.",
      "Compare the evidence and disagreements across the sources.",
    ],
    caveats: [
      "Fallback brief generated; this is not a verified AI research summary.",
    ],
  };
}

function validateBrief(brief, validUrls) {
  if (!brief || typeof brief !== "object") {
    throw new Error("The AI response is not a valid brief.");
  }

  const requiredStrings = [
    "headline",
    "summary",
    "analysis",
  ];

  for (const key of requiredStrings) {
    if (typeof brief[key] !== "string" || !brief[key].trim()) {
      throw new Error(`AI brief is missing a valid ${key}.`);
    }
  }

  if (!Array.isArray(brief.facts)) {
    throw new Error("AI brief must contain a facts array.");
  }

  return {
    headline: brief.headline,
    summary: brief.summary,
    facts: brief.facts
      .filter(
        (fact) =>
          fact &&
          typeof fact.claim === "string" &&
          typeof fact.sourceUrl === "string" &&
          validUrls.has(fact.sourceUrl)
      )
      .map((fact) => ({
        claim: fact.claim,
        sourceUrl: fact.sourceUrl,
      })),
    analysis: brief.analysis,
    whoShouldCare: Array.isArray(brief.whoShouldCare)
      ? brief.whoShouldCare
      : [],
    newsletterAngles: Array.isArray(brief.newsletterAngles)
      ? brief.newsletterAngles
      : [],
    caveats: Array.isArray(brief.caveats) ? brief.caveats : [],
  };
}

router.post("/", async (req, res) => {
  try {
    const inputUrls = Array.isArray(req.body?.urls)
      ? req.body.urls
      : [];

    const urls = [
      ...new Set(
        inputUrls
          .filter((url) => typeof url === "string")
          .map((url) => url.trim())
          .filter(Boolean)
      ),
    ].slice(0, 8);

    if (urls.length < 3) {
      return res.status(400).json({
        error: "Please provide at least 3 unique article URLs.",
      });
    }

    const invalidUrl = urls.find((url) => {
      try {
        const parsed = new URL(url);
        return !["http:", "https:"].includes(parsed.protocol);
      } catch {
        return true;
      }
    });

    if (invalidUrl) {
      return res.status(400).json({
        error: `Invalid URL: ${invalidUrl}`,
      });
    }

    const extractionResults = await Promise.all(
      urls.map(async (url) => {
        try {
          const article = await fetchArticle(url);

          return {
            ...article,
            url,
            status: article?.status || "ok",
          };
        } catch (error) {
          console.error(
            `Article extraction failed for ${url}:`,
            error.message
          );

          return {
            url,
            title: url,
            text: "",
            status: "error",
            error: error.message,
          };
        }
      })
    );

    const sources = extractionResults.map((source) => ({
      url: source.url,
      title: source.title || source.url,
      text: source.text || "",
      status: source.status,
      error: source.error || null,
    }));

    const loaded = sources.filter(
      (source) =>
        source.status === "ok" &&
        typeof source.text === "string" &&
        source.text.trim().length >= 100
    );

    if (loaded.length < 3) {
      return res.status(422).json({
        error:
          "Could not extract readable article text from at least 3 URLs. Use direct article links instead of homepage URLs.",
        sources,
      });
    }

    const validUrls = new Set(loaded.map((source) => source.url));

    const messages = [
      {
        role: "system",
        content: `
You are a careful research assistant for an editorial team.

Analyze the supplied article text only. Do not invent facts, quotes,
dates, statistics, or source URLs. Clearly distinguish verified claims
from interpretation. If the evidence is insufficient, say so.

Return ONLY valid JSON with this exact structure:
{
  "headline": "string",
  "summary": "string",
  "facts": [
    {
      "claim": "A specific claim supported by source text",
      "sourceUrl": "An exact supplied URL"
    }
  ],
  "analysis": "Interpretation clearly distinguished from facts",
  "whoShouldCare": ["audience and why"],
  "newsletterAngles": ["possible editorial angle"],
  "caveats": ["limitations or missing context"]
}

Requirements:
- Include at least 3 evidence-based facts when the supplied material supports them.
- Every facts[].sourceUrl must exactly match a supplied URL.
- Do not treat a source's opinion as an established fact.
- Identify agreements, disagreements, and missing context.
- Be concise, useful, and editorially neutral.
- Do not wrap the JSON in Markdown fences.
        `.trim(),
      },
      {
        role: "user",
        content: JSON.stringify(
          loaded.map((source) => ({
            url: source.url,
            title: source.title,
           text: source.text.slice(0, 1500),
          }))
        ),
      },
    ];

    let brief;
    let aiError = null;

    try {
      const aiResponse = await askLLM(messages);
      const parsedBrief = parseAIJson(aiResponse);
      brief = validateBrief(parsedBrief, validUrls);

      if (brief.facts.length === 0) {
        throw new Error(
          "The AI returned no facts linked to the supplied source URLs."
        );
      }
    } catch (error) {
      aiError = error.message;

      console.error("Research AI error:", error.message);

      brief = makeFallbackBrief(loaded);

      brief.caveats.push(
        `AI request failed: ${error.message}`
      );
    }

    return res.json({
      sources,
      brief,
      aiUsed: !aiError,
      aiError,
    });
  } catch (error) {
    console.error("Research endpoint error:", error.message);

    return res.status(500).json({
      error: "Research request failed.",
      details: error.message,
    });
  }
});

export default router;
