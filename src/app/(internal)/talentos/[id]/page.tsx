import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { canReadTalentos } from "@/lib/talentos/permissions";
import { computeValidez } from "@/lib/talentos/validity";
import TalentoProfilePage from "@/components/internal/talentos/TalentoProfile";
import type { TalentoProfile, TesteCard, CandidaturaHistorico, TalentoNote, TalentoTag } from "@/lib/talentos/types";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("talentos")
    .select("nomeCompleto")
    .eq("id", id)
    .single();
  const nome = data?.nomeCompleto ?? "Talento";
  return { title: `${nome} — RH` };
}

export default async function TalentoPerfilPage({ params }: Props) {
  const session = await auth();
  if (!canReadTalentos(session?.user.role)) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  // 4 queries paralelas: talento base, sessões, candidaturas, notas
  const [talentoRes, sessoesRes, candidaturasRes, notasRes, tagsRes] = await Promise.all([
    supabase
      .from("talentos")
      .select(
        `id, nomeCompleto, email, cpf, telefone, cidade, estado,
         cargoDesejado, pretensaoSalarial, linkedinUrl, curriculoUrl, curriculoNome,
         resumoProfissional, origem, statusBanco, consentimentoLgpdEm,
         consentimentoValidadeAte, ultimaAtividadeEm, createdAt, updatedAt,
         tagAssignments:talento_tag_assignments(tag:talento_tags(id, nome, cor))`,
      )
      .eq("id", id)
      .single(),

    supabase
      .from("assessment_sessions")
      .select(
        `id, templateId, submittedAt, score, outcome, scoreBreakdown,
         validoAte, invalidadoEm, invalidadoPorId, motivoInvalidacao, createdAt,
         template:assessment_templates(id, name, kind, validityMonths)`,
      )
      .eq("talentoId", id)
      .order("createdAt", { ascending: false }),

    supabase
      .from("applications")
      .select(
        `id, jobId, stageId, createdAt,
         job:jobs(title, city),
         stage:pipeline_stages(name, kind)`,
      )
      .eq("talentoId", id)
      .order("createdAt", { ascending: false }),

    supabase
      .from("talento_notes")
      .select("id, talentoId, autorId, autorNome, conteudo, createdAt")
      .eq("talentoId", id)
      .order("createdAt", { ascending: false }),

    supabase
      .from("talento_tags")
      .select("id, nome, cor")
      .order("nome"),
  ]);

  if (talentoRes.error || !talentoRes.data) notFound();

  const raw = talentoRes.data as Record<string, unknown>;

  // Montar TesteCards: agrupar sessões por template
  type RawSession = {
    id: string; templateId: string; submittedAt: string | null; score: number | null;
    outcome: string | null; scoreBreakdown: Record<string, unknown> | null;
    validoAte: string | null; invalidadoEm: string | null; invalidadoPorId: string | null;
    motivoInvalidacao: string | null; createdAt: string;
    template: { id: string; name: string; kind: string; validityMonths: number } | null;
  };

  const sessoes = (sessoesRes.data ?? []) as unknown as RawSession[];

  const templateMap = new Map<string, { nome: string; kind: string; validityMonths: number }>();
  sessoes.forEach((s) => {
    if (s.template && !templateMap.has(s.templateId)) {
      templateMap.set(s.templateId, {
        nome: s.template.name,
        kind: s.template.kind,
        validityMonths: s.template.validityMonths,
      });
    }
  });

  const testes: TesteCard[] = Array.from(templateMap.entries()).map(([templateId, tpl]) => {
    const templateSessoes = sessoes.filter((s) => s.templateId === templateId);
    const latestSubmitted = templateSessoes.find((s) => s.submittedAt !== null) ?? null;
    return {
      templateId,
      templateNome:   tpl.nome,
      templateKind:   tpl.kind,
      validityMonths: tpl.validityMonths,
      validez:        computeValidez(latestSubmitted),
      sessoes:        templateSessoes.map((s) => ({
        id:                s.id,
        templateId:        s.templateId,
        templateNome:      tpl.nome,
        templateKind:      tpl.kind,
        submittedAt:       s.submittedAt,
        score:             s.score,
        outcome:           s.outcome,
        scoreBreakdown:    s.scoreBreakdown,
        validoAte:         s.validoAte,
        invalidadoEm:      s.invalidadoEm,
        invalidadoPorId:   s.invalidadoPorId,
        motivoInvalidacao: s.motivoInvalidacao,
        createdAt:         s.createdAt,
      })),
    };
  });

  type RawApp = {
    id: string; jobId: string; stageId: string; createdAt: string;
    job: { title: string; city: string | null } | null;
    stage: { name: string; kind: string } | null;
  };

  const candidaturas: CandidaturaHistorico[] = ((candidaturasRes.data ?? []) as unknown as RawApp[]).map((a) => ({
    id:        a.id,
    jobId:     a.jobId,
    jobTitle:  a.job?.title ?? "—",
    jobCity:   a.job?.city ?? null,
    stageId:   a.stageId,
    stageName: a.stage?.name ?? "—",
    stageKind: a.stage?.kind ?? "—",
    createdAt: a.createdAt,
  }));

  const notas: TalentoNote[] = (notasRes.data ?? []) as TalentoNote[];

  const tags: TalentoTag[] = ((raw.tagAssignments as { tag: TalentoTag | null }[]) ?? [])
    .flatMap((a) => a.tag ? [a.tag] : []);

  const talento: TalentoProfile = {
    id:                      raw.id as string,
    nomeCompleto:            raw.nomeCompleto as string,
    email:                   raw.email as string,
    cpf:                     raw.cpf as string | null,
    telefone:                raw.telefone as string | null,
    cidade:                  raw.cidade as string | null,
    estado:                  raw.estado as string | null,
    cargoDesejado:           raw.cargoDesejado as string | null,
    pretensaoSalarial:       raw.pretensaoSalarial as number | null,
    linkedinUrl:             raw.linkedinUrl as string | null,
    curriculoUrl:            raw.curriculoUrl as string | null,
    curriculoNome:           raw.curriculoNome as string | null,
    resumoProfissional:      raw.resumoProfissional as string | null,
    origem:                  raw.origem as TalentoProfile["origem"],
    statusBanco:             raw.statusBanco as TalentoProfile["statusBanco"],
    consentimentoLgpdEm:     raw.consentimentoLgpdEm as string | null,
    consentimentoValidadeAte: raw.consentimentoValidadeAte as string | null,
    ultimaAtividadeEm:       raw.ultimaAtividadeEm as string,
    createdAt:               raw.createdAt as string,
    updatedAt:               raw.updatedAt as string,
    tags,
    testes,
    candidaturas,
    notas,
  };

  // Audit log de acesso (service_role ignora RLS)
  const adminClient = createAdminClient();
  adminClient.from("talento_audit_log").insert({
    talentoId: id,
    userId:    session!.user.id,
    acao:      "ACESSOU_PERFIL",
    entidade:  "talentos",
    entidadeId: id,
    descricao: `Perfil visualizado por ${session!.user.name ?? session!.user.email}`,
  });

  return (
    <TalentoProfilePage
      talento={talento}
      availableTags={(tagsRes.data ?? []) as TalentoTag[]}
      isAdmin={session!.user.role === "ADMIN_RH"}
    />
  );
}
