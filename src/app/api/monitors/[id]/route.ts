import { NextResponse } from "next/server";
import { deleteMonitor, setMonitorEnabled } from "@/lib/db/monitors";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = (await request.json()) as { enabled?: boolean };

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled は真偽値で指定してください。" }, { status: 400 });
  }

  const monitor = setMonitorEnabled(id, body.enabled);
  if (!monitor) {
    return NextResponse.json({ error: "監視対象が見つかりません。" }, { status: 404 });
  }
  return NextResponse.json({ monitor });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  deleteMonitor(id);
  return NextResponse.json({ ok: true });
}
