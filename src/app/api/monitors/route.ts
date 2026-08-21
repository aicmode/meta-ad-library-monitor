import { NextResponse } from "next/server";
import { countMonitors, createMonitor, listMonitors } from "@/lib/db/monitors";
import { DEMO_LIMITS, isDemoMode } from "@/lib/config/demo";
import {
  DuplicateMonitorError,
  GENERIC_ERROR_MESSAGE,
  isSafeError,
  toPublicMessage,
} from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ monitors: listMonitors() });
  } catch (error) {
    return NextResponse.json(
      { error: toPublicMessage("monitors:list", error) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let body: { name?: string; adLibraryUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  if (typeof body?.name !== "string" || typeof body?.adLibraryUrl !== "string") {
    return NextResponse.json(
      { error: "広告主名とURLを入力してください。" },
      { status: 400 },
    );
  }

  try {
    // Demo testers may add monitors, but not an unbounded number — every
    // monitor is a future Playwright run.
    if (isDemoMode() && countMonitors() >= DEMO_LIMITS.MAX_MONITORS) {
      return NextResponse.json(
        {
          error: `デモ版で登録できる監視対象は${DEMO_LIMITS.MAX_MONITORS}件までです。`,
        },
        { status: 403 },
      );
    }

    const monitor = createMonitor({
      name: body.name,
      adLibraryUrl: body.adLibraryUrl,
    });
    return NextResponse.json({ monitor }, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateMonitorError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (isSafeError(error)) {
      return NextResponse.json(
        { error: toPublicMessage("monitors:create", error) },
        { status: 400 },
      );
    }
    console.error("[monitors:create]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
