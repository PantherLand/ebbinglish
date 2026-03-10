import { NextRequest, NextResponse } from "next/server";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { loadWordsWithStatus } from "@/src/study-queries";

function toIOSStatus(status: string) {
  if (status === "known") return "seen";
  return status;
}

export async function GET(req: NextRequest) {
  const apiAuth = await authenticateApiToken(req);
  if (!apiAuth) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const words = await loadWordsWithStatus(apiAuth.userId);

    touchApiTokenLastUsed(apiAuth.tokenId).catch(() => {});

    return NextResponse.json({
      words: words.map((word) => ({
        id: word.id,
        text: word.text,
        note: word.note,
        isPriority: word.isPriority,
        isAchieved: word.isAchieved,
        manualCategory: word.manualCategory,
        status: toIOSStatus(word.status),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load library",
      },
      { status: 500 },
    );
  }
}
