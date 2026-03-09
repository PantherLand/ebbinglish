import { NextResponse, type NextRequest } from "next/server";
import { authenticateMobileRequest } from "../auth";
import { loadLibraryWordPage } from "@/src/study-queries";

export async function GET(req: NextRequest) {
  const result = await authenticateMobileRequest(req);
  if (result instanceof NextResponse) return result;
  const userId = result;

  const { searchParams } = req.nextUrl;
  const keyword = searchParams.get("keyword") ?? "";
  const status = searchParams.get("status") ?? "all";
  const tag = searchParams.get("tag") ?? "";
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get("pageSize")) || 20));

  const validStatuses = ["all", "new", "known", "fuzzy", "unknown", "mastered", "frozen", "priority", "normal", "achieved"];
  const selectedStatus = validStatuses.includes(status) ? status as "all" | "new" | "known" | "fuzzy" | "unknown" | "mastered" | "frozen" | "priority" | "normal" | "achieved" : "all";

  const data = await loadLibraryWordPage({
    userId,
    keyword,
    selectedTag: tag,
    selectedStatus,
    currentPage: page,
    pageSize,
  });

  return NextResponse.json({
    words: data.pageWords,
    total: data.filteredCount,
    page: data.safePage,
    pageSize,
  });
}
