import { NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { isDemoMode } from "@/lib/config/demo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for the hosting platform.
 *
 * Deliberately cheap: it confirms the process is up and SQLite is reachable.
 * It never launches Playwright and never touches the Meta Ad Library, so a
 * platform polling it cannot generate scraping traffic.
 */
export async function GET() {
  try {
    getDb().prepare("SELECT 1").get();
    return NextResponse.json({
      status: "ok",
      demoMode: isDemoMode(),
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[health]", error);
    // No internal detail in the body — just the failed state.
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
