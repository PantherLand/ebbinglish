import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/src/prisma";
import { authenticateMobileRequest } from "../auth";

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}
