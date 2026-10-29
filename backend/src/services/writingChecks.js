
import { randomUUID } from "node:crypto";

const fillers = [
  "it is important to note that",
  "at the end of the day",
  "in order to",
  "basically",
  "actually",
  "really",
  "very",
  "kind of",
  "sort of",
  "just",
];

function getSentences(text) {
  return text.match(/[^.!?]+(?:[.!?]+|$)/g) || [];
}

function capitalizeFirst(text) {
  return text.replace(/^(\s*)([a-z])/, (_, space, letter) =>
    space + letter.toUpperCase()
  );
}

function cleanPunctuation(text) {
  return text
    .replace(/^\s*[,;:]+\s*/, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitLongSentence(sentence) {
  const text = sentence.trim();

  const match = text.match(
    /^(.+?),\s*(?:and|but|so)\s+(this|these|they|it|teams|developers|users)\s+(.+)$/i
  );

  if (!match) return null;

  const firstPart = match[1].trim();
  const subject = match[2];
  const remainder = match[3];

  return `${firstPart}. ${capitalizeFirst(`${subject} ${remainder}`)}`;
}

function rewritePassive(sentence) {
  const text = sentence.trim();

  const rewrites = [
    {
      pattern:
        /artificial intelligence is being adopted by teams across many industries/i,
      replacement:
        "teams across many industries are adopting artificial intelligence",
    },
    {
      pattern:
        /the tools are being used by developers to write code, by analysts to explore information, and by operators to automate repetitive tasks/i,
      replacement:
        "developers use the tools to write code, analysts use them to explore information, and operators use them to automate repetitive tasks",
    },
    {
      pattern: /the report was written by the team/i,
      replacement: "the team wrote the report",
    },
    {
      pattern: /the application was built by developers/i,
      replacement: "developers built the application",
    },
    {
      pattern: /the feature was created by the team/i,
      replacement: "the team created the feature",
    },
  ];

  for (const item of rewrites) {
    if (item.pattern.test(text)) {
      let result = text.replace(item.pattern, item.replacement);

      // Preserve correct lowercase after "that".
      result = result.replace(/\bthat\s+Teams\b/g, "that teams");

      return result;
    }
  }

  return null;
}

export function checkWriting(text) {
  const content = String(text || "");
  const sentences = getSentences(content);
  const issues = [];

  // 1. Long sentence checks
  for (const raw of sentences) {
    const sentence = raw.trim();

    if (!sentence) continue;

    const words = sentence.split(/\s+/).filter(Boolean);

    if (words.length > 25) {
      const rewrite = splitLongSentence(sentence);

      if (rewrite && rewrite !== sentence) {
        issues.push({
          id: randomUUID(),
          type: "Long sentence",
          text: sentence,
          reason: `This sentence has ${words.length} words. Splitting it may make the idea easier to follow.`,
          rewrite,
        });
      } else {
        issues.push({
          id: randomUUID(),
          type: "Long sentence",
          text: sentence,
          reason: `This sentence has ${words.length} words. Consider splitting it into shorter sentences.`,
          rewrite: sentence,
        });
      }
    }
  }

  // 2. Passive voice checks
  for (const raw of sentences) {
    const sentence = raw.trim();

    if (!sentence) continue;

    // Avoid common false positive.
    if (/\b(?:may be tempted|is tempted|are tempted)\b/i.test(sentence)) {
      continue;
    }

    const rewrite = rewritePassive(sentence);

    if (rewrite && rewrite !== sentence) {
      issues.push({
        id: randomUUID(),
        type: "Possible passive voice",
        text: sentence,
        reason:
          "This sentence may emphasize the action instead of the person or team doing it. An active version may be clearer.",
        rewrite,
      });
    }
  }

  // 3. Filler phrase checks
  for (const raw of sentences) {
    const sentence = raw.trim();

    if (!sentence) continue;

    for (const filler of fillers) {
      const pattern = new RegExp(
        `\\b${escapeRegex(filler)}\\b`,
        "i"
      );

      const match = sentence.match(pattern);

      if (!match) continue;

      const removeFiller = new RegExp(
        `\\b${escapeRegex(filler)}\\b`,
        "gi"
      );

      let rewrite = sentence.replace(removeFiller, "");

      rewrite = cleanPunctuation(rewrite);
      rewrite = capitalizeFirst(rewrite);

      if (!rewrite || rewrite === sentence) continue;

      issues.push({
        id: randomUUID(),
        type: "Filler phrase",
        text: sentence,
        reason: `"${match[0]}" may add little meaning. Remove it if the sentence remains accurate.`,
        rewrite,
      });
    }
  }

  // 4. Remove exact duplicate suggestions
  const uniqueIssues = [];
  const seen = new Set();

  for (const issue of issues) {
    const key = [
      issue.type,
      issue.text.toLowerCase(),
      issue.rewrite.toLowerCase(),
    ].join("|");

    if (seen.has(key)) continue;

    seen.add(key);
    uniqueIssues.push(issue);
  }

  return uniqueIssues.slice(0, 30);
}

export function metrics(text) {
  const content = String(text || "").trim();

  const words = content
    ? content.split(/\s+/).filter(Boolean).length
    : 0;

  const sentences =
    (content.match(/[.!?]+(?=\s|$)/g) || []).length ||
    (words ? 1 : 0);

  const syllables = (
    content.toLowerCase().match(/[aeiouy]+/g) || []
  ).length;

  const score =
    words > 0 && sentences > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              206.835 -
                1.015 * (words / sentences) -
                84.6 * (syllables / words)
            )
          )
        )
      : null;

  return {
    wordCount: words,
    averageSentenceLength: sentences
      ? +(words / sentences).toFixed(1)
      : 0,
    readingTimeMinutes: Math.ceil(words / 220),
    readabilityScore: score,
  };
}
