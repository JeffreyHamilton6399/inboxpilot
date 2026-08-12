import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      name: true,
      toneProfile: true,
      accounts: {
        select: { id: true, provider: true, email: true, createdAt: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      toneProfile: user.toneProfile ? JSON.parse(user.toneProfile) : null,
    },
    accounts: user.accounts,
  });
}
