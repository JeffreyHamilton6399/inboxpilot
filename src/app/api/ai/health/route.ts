import { NextResponse } from "next/server";
import { getProvider } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { host, model, ready, reasoningEffort } = getProvider();
  return NextResponse.json({ host, model, ready, reasoningEffort });
}
