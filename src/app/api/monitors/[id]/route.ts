import { NextResponse } from "next/server";
import { deleteMonitor, setMonitorEnabled } from "@/lib/db/monitors";
import { isDemoMode } from "@/lib/config/demo";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  let body: { enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled は真偽値で指定してください。" },
      { status: 400 },
    );
  }

  try {
    const monitor = setMonitorEnabled(id, body.enabled);
    if (!monitor) {
      return NextResponse.json(
        { error: "監視対象が見つかりません。" },
        { status: 404 },
      );
    }
    return NextResponse.json({ monitor });
  } catch (error) {
    console.error("[monitors:patch]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  // Server-side enforcement. The UI also hides the delete button in demo mode,
  // but this is the control that actually protects the data — a hand-crafted
  // DELETE from a console or curl hits this first.
  if (isDemoMode()) {
    return NextResponse.json(
      { error: "デモ版では監視対象を削除できません。" },
      { status: 403 },
    );
  }

  const { id } = await params;
  try {
    deleteMonitor(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[monitors:delete]", error);
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 500 });
  }
}
