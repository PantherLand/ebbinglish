import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/src/auth";
import { prisma } from "@/src/prisma";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text")?.trim() || "";
  const language =
    request.nextUrl.searchParams.get("language")?.trim().toLowerCase() || "en";

  if (!text) {
    return NextResponse.json({ exists: false });
  }

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

  const found = await prisma.word.findFirst({
    where: {
      userId: user.id,
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
