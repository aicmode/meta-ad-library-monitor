import { NextResponse } from "next/server";
import { createMonitor, listMonitors } from "@/lib/db/monitors";
import { AdLibraryUrlError } from "@/lib/adlib/url";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ monitors: listMonitors() });
}

export async function POST(request: Request) {
  let body: { name?: string; adLibraryUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "リクエストが不正です。" }, { status: 400 });
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "広告主名を入力してください。" }, { status: 400 });
  }
  if (!body.adLibraryUrl?.trim()) {
    return NextResponse.json({ error: "広告ライブラリURLを入力してください。" }, { status: 400 });
  }

  try {
    const monitor = createMonitor({
      name: body.name,
      adLibraryUrl: body.adLibraryUrl,
    });
    return NextResponse.json({ monitor }, { status: 201 });
  } catch (error) {
    if (error instanceof AdLibraryUrlError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
