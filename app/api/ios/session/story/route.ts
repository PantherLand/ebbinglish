import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";

const generateStorySchema = z.object({
  words: z.array(z.string().min(1)).min(1),
});

export async function POST(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = generateStorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid story request" },
      { status: 422 },
    );
  }

  const apiKey = process.env.OPEN_ROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
  if (!apiKey) {
    return NextResponse.json({ error: "OpenRouter API key not configured." }, { status: 500 });
  }

  const wordList = parsed.data.words.join(", ");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
            content: `Write a short, engaging story (3-5 sentences) that naturally uses ALL of the following English words: ${wordList}. The story should be fun and memorable to help the learner remember them. Bold each target word using **word** markdown syntax.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return NextResponse.json({ error: `API error ${response.status}: ${text}` }, { status: 502 });
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const story = data.choices?.[0]?.message?.content?.trim();
    if (!story) {
      return NextResponse.json({ error: "No response from AI." }, { status: 502 });
    }

    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});
    return NextResponse.json({ story });
  } catch {
    return NextResponse.json({ error: "Failed to generate story." }, { status: 500 });
  }
}
