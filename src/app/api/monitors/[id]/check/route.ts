import { NextResponse } from "next/server";
import { runCheck, MonitorNotFoundError } from "@/lib/monitor/runCheck";
import { acquireCheckSlot } from "@/lib/monitor/checkGuard";
import { getMonitor } from "@/lib/db/monitors";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export const runtime = "nodejs";
// Launching a browser and scrolling results takes well over the default budget.
export const maxDuration = 120;

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  const monitor = getMonitor(id);
  if (!monitor) {
    return NextResponse.json(
      { error: "監視対象が見つかりません。" },
      { status: 404 },
    );
  }

  // Server-side double-run and rate protection. The button being disabled in
  // the UI is a convenience; this is what actually bounds Playwright launches.
  const slot = acquireCheckSlot(id, monitor.lastCheckedAt);
  if (!slot.ok) {
    return NextResponse.json(
      { error: slot.message, reason: slot.reason, retryAfterSec: slot.retryAfterSec },
      {
        status: slot.reason === "running" ? 409 : 429,
        headers: { "Retry-After": String(slot.retryAfterSec) },
      },
    );
  }

  try {
    const result = await runCheck(id);
    return NextResponse.json(result, {
      status: result.status === "error" ? 502 : 200,
    });
  } catch (error) {
    if (error instanceof MonitorNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[monitors:check]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  } finally {
    slot.release();
  }
}
