import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/session";
import { db } from "@/lib/db";
import { DEFAULT_TONE } from "@/lib/defaults";
import type { ToneProfile } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ToneSchema = z.object({
  name: z.string(),
  role: z.string(),
  tone: z.string(),
  signature: z.string(),
  length: z.enum(["short", "medium", "long"]),
  formality: z.enum(["casual", "neutral", "formal"]),
  samplePhrases: z.array(z.string()),
  avoid: z.array(z.string()),
});

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { toneProfile: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tone: ToneProfile = user.toneProfile
    ? (JSON.parse(user.toneProfile) as ToneProfile)
    : DEFAULT_TONE;
  return NextResponse.json({ tone });
}

export async function PUT(req: Request) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = ToneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tone profile", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: auth.userId },
    data: { toneProfile: JSON.stringify(parsed.data) },
  });

  return NextResponse.json({ ok: true, tone: parsed.data });
}
