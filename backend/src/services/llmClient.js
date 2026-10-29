
const DEFAULT_MODEL = "gemini-3.8-flash";

export async function askLLM(messages) {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error(
      "AI_API_KEY missing. Add your Gemini API key to backend/.env"
    );
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("Please provide messages for the AI.");
  }

  const systemInstructions = [];
  const contents = [];

  for (const message of messages) {
    if (!message || typeof message.content !== "string") {
      continue;
    }

    if (message.role === "system" || message.role === "developer") {
      systemInstructions.push(message.content);
    } else if (message.role === "assistant") {
      contents.push({
        role: "model",
        parts: [{ text: message.content }],
      });
    } else {
      contents.push({
        role: "user",
        parts: [{ text: message.content }],
      });
    }
  }

  if (contents.length === 0) {
    throw new Error("No valid user messages were provided.");
  }

  const body = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  if (systemInstructions.length > 0) {
    body.systemInstruction = {
      parts: [{ text: systemInstructions.join("\n\n") }],
    };
  }

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${encodeURIComponent(model)}:generateContent`;

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
  } catch (error) {
    if (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    ) {
      throw new Error(
        "Gemini request timed out after 30 seconds. Check network, model availability, and API status."
      );
    }

    throw new Error(`Could not connect to Gemini: ${error.message}`);
  }

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Gemini API error (${response.status}): ${responseText.slice(0, 600)}`
    );
  }

  let data;

  try {
    data = JSON.parse(responseText);
  } catch {
    throw new Error("Gemini returned an invalid JSON response.");
  }

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!content) {
    const reason =
      data.promptFeedback?.blockReason ||
      data.candidates?.[0]?.finishReason;

    throw new Error(
      reason
        ? `Gemini returned no text. Reason: ${reason}`
        : "Gemini returned an empty response."
    );
  }

  return content;
}
