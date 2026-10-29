
import "dotenv/config";

const GEMINI_API_KEY = process.env.AI_API_KEY;
const model = process.env.AI_MODEL || "gemini-3.5-flash-lite";

async function testGemini() {
  if (!GEMINI_API_KEY) {
    console.error(
      "Error: AI_API_KEY is missing from your .env file."
    );
    process.exitCode = 1;
    return;
  }

  try {
    console.log("Testing generation with:", model);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
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

    if (!response.ok) {
      console.error("Gemini API request failed:", result);
      process.exitCode = 1;
      return;
    }

    try {
      const data = JSON.parse(result);
      const generatedText =
        data.candidates?.[0]?.content?.parts
          ?.map((part) => part.text || "")
          .join("") || "";

      console.log("Generated response:", generatedText);
    } catch {
      console.log("Response:", result);
    }
  } catch (error) {
    console.error("Generation test failed:", error.message);
    process.exitCode = 1;
  }
}

await testGemini();
