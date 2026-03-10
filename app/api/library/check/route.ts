import { NextRequest, NextResponse } from "next/server";
import { authenticateApiToken, touchApiTokenLastUsed } from "@/src/api-token-auth";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim() || "";
  const language =
    request.nextUrl.searchParams.get("language")?.trim().toLowerCase() || "en";

  if (!text) {
    return NextResponse.json({ exists: false });
  }

  const apiAuth = await authenticateApiToken(request);
  let userId = apiAuth?.userId ?? null;

  if (!userId) {
    const session = await auth();
    const email = session?.user?.email;

    if (!email) {
      return NextResponse.json({ exists: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ exists: false }, { status: 404 });
    }

    userId = user.id;
  } else {
    touchApiTokenLastUsed(apiAuth!.tokenId).catch(() => {});
  }

  const found = await prisma.word.findFirst({
    where: {
      userId,
      language,
      text: {
        equals: text,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ exists: Boolean(found) });
}
