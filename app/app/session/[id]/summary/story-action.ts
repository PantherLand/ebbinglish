"use server";

export async function generateStoryAction(
  words: string[],
): Promise<{ ok: true; story: string } | { ok: false; message: string }> {
  if (words.length === 0) {
    return { ok: false, message: "No words to generate a story with." };
  }

  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  if (!apiKey) {
    return { ok: false, message: "OpenRouter API key not configured." };
  }

  const wordList = words.join(", ");

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 512,
        messages: [
          {
            role: "user",
            content: `Write a short, engaging story (3-5 sentences) that naturally uses ALL of the following English words: ${wordList}. The story should be fun and memorable to help the learner remember these words. Bold each of the target words using **word** markdown syntax.`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, message: `API error ${res.status}: ${text}` };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const story = data.choices?.[0]?.message?.content?.trim();
    if (!story) {
      return { ok: false, message: "No response from AI." };
    }

    return { ok: true, story };
  } catch {
    return { ok: false, message: "Failed to generate story." };
  }
}
