
import "dotenv/config";

const apiKey = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || "gemini-3.8-flash";

try {
  console.log("Testing generation with:", model);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: "Summarize in one sentence: AI can help editors research information, but important claims must be verified.",
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 100,
        },
      }),
      signal: AbortSignal.timeout(30000),
    }
  );

  const result = await response.text();

  console.log("HTTP status:", response.status);
  console.log("Response:", result);
} catch (error) {
  console.log("Generation test failed:", error.message);
}
