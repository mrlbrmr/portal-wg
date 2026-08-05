import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Não autorizado" }, { status: 403 });

  const { id: jobId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("job_stage_config")
    .select("stageId")
    .eq("jobId", jobId);
  return NextResponse.json({ stageIds: (data ?? []).map((r: { stageId: string }) => r.stageId) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user.role !== "ADMIN_RH") {
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
  }

  const { id: jobId } = await params;
  const body = await req.json() as { stageIds?: string[] };
  const stageIds = Array.isArray(body.stageIds) ? body.stageIds : [];

  const supabase = await createClient();

  const { error: delErr } = await supabase
    .from("job_stage_config")
    .delete()
    .eq("jobId", jobId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  if (stageIds.length > 0) {
    const { error: insErr } = await supabase
      .from("job_stage_config")
      .insert(stageIds.map((stageId) => ({ jobId, stageId })));
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
