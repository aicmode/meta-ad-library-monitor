import { NextResponse } from "next/server";
import { runCheck } from "@/lib/monitor/runCheck";

export const runtime = "nodejs";
// Launching a browser and scrolling results takes well over the default budget.
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;
  try {
    const result = await runCheck(id);
    return NextResponse.json(result, { status: result.status === "error" ? 502 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "取得に失敗しました。" },
      { status: 404 },
    );
  }
}
