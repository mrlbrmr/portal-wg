import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isEmailConfigured, rhInboxEmail, sendEmail } from "@/lib/email";
import { retentionDigestEmail } from "@/lib/email-templates";
import { getRetentionMonths, listRetentionRows } from "@/lib/privacy/retention-service";

// Cron semanal (vercel.json): AVISA o RH de quantos talentos venceram o prazo de retenção.
// NÃO anonimiza nada — a decisão é do RH, em /configuracoes/privacidade.
// Exige CRON_SECRET (a Vercel envia `Authorization: Bearer <CRON_SECRET>`).

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    const admin = createAdminClient();
    const months = await getRetentionMonths(admin);
    const due = (await listRetentionRows(admin, months)).filter((r) => r.eligible);
    if (due.length === 0) return NextResponse.json({ due: 0, sent: false });

    const to = rhInboxEmail();
    if (!to || !isEmailConfigured()) return NextResponse.json({ due: due.length, sent: false, reason: "email_not_configured" });
    const { subject, html } = retentionDigestEmail({ count: due.length, months });
    const result = await sendEmail({ to, subject, html });
    return NextResponse.json({ due: due.length, sent: result.sent });
  } catch (err) {
    console.error("[cron] retenção", err);
    return NextResponse.json({ error: "Falha ao verificar retenção." }, { status: 500 });
  }
}
