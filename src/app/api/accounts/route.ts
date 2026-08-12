import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { GMAIL_CONFIGURED } from "@/lib/gmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const accounts = await db.account.findMany({
    where: { userId: auth.userId },
    select: { id: true, provider: true, email: true, createdAt: true },
  });
  return NextResponse.json({ accounts, gmailConfigured: GMAIL_CONFIGURED });
}

export async function DELETE(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const { id } = (await req.json().catch(() => ({}))) as { id?: string };
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.account.deleteMany({ where: { id, userId: auth.userId } });
  return NextResponse.json({ ok: true });
}
