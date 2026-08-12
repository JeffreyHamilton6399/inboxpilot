import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const p = getProvider();
  return NextResponse.json({
    provider: p.provider,
    model: p.model,
    ready: p.ready,
  });
}
