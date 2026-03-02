import { NextResponse } from "next/server";
import { prisma } from "@/src/prisma";

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: "ok",
      database: "ok",
      checkedAt,
    });
  } catch {
    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        checkedAt,
      },
      { status: 503 },
    );
  }
}
