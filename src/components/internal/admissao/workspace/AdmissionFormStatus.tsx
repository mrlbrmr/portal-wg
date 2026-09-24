"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, CircleDashed, Clock, Copy, Check, FileText, MessageSquare, RefreshCw, Send, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import type { DigitalFormState } from "@/lib/admissao/overview";
import type { FormFillProgress } from "@/lib/admissao/workspace";
import { useAdmissionWorkspace } from "./context";

function fmt(iso: string) {
  return new Date(iso)
    .toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(",", " às");
}

// O sistema não registra quando o candidato abre o link: "Em preenchimento" só aparece
// depois que ele envia o primeiro documento (form.fill).
const STATE: Record<DigitalFormState, { label: string; icon: typeof Circle; className: string }> = {
  NOT_SENT: { label: "Não enviado", icon: Circle, className: "text-wg-ink-muted" },
  WAITING: { label: "Aguardando preenchimento", icon: Clock, className: "text-warning-fg" },
  EXPIRED: { label: "Link expirado", icon: TimerOff, className: "text-danger-fg" },
  SUBMITTED: { label: "Concluído", icon: CheckCircle2, className: "text-success-fg" },
};

const FILLING = { label: "Em preenchimento", icon: CircleDashed, className: "text-info-fg" };

/** Documentos que o candidato já subiu pelo link, antes de concluir o envio. */
function FormFillDetails({ fill, expired }: { fill: FormFillProgress; expired: boolean }) {
  const complete = fill.requiredTotal > 0 && fill.missing.length === 0;
  return (
    <div className="mt-3 rounded-control border border-wg-border-lighter bg-wg-bg p-3">
      <div className="flex items-baseline justify-between gap-2 text-meta">
        <span className="font-semibold text-wg-ink">Documentos obrigatórios</span>
        <span className="tabular-nums text-wg-ink-muted">
          {fill.requiredDone} de {fill.requiredTotal}
        </span>
      </div>
      <ProgressBar
        value={fill.requiredTotal ? (fill.requiredDone / fill.requiredTotal) * 100 : 0}
        label="Documentos obrigatórios enviados pelo candidato"
        tone={complete ? "success" : "info"}
        className="mt-1.5"
      />
      {fill.missing.length > 0 && (
        <p className="mt-2 text-meta text-wg-ink-muted">
          <span className="font-medium text-wg-ink">Faltam:</span> {fill.missing.join(", ")}.
        </p>
      )}
      {fill.hasConditionalRequired && (
        <p className="mt-1 text-meta text-wg-ink-muted">Outros podem ser exigidos conforme as respostas do candidato.</p>
      )}
      {fill.lastUploadAt && (
        <p className="mt-2 text-meta text-wg-ink-muted">
          {fill.uploads} {fill.uploads === 1 ? "arquivo enviado" : "arquivos enviados"} · último em {fmt(fill.lastUploadAt)}
        </p>
      )}
      <p className="mt-2 border-t border-wg-border-lighter pt-2 text-meta text-wg-ink-muted">
        {expired
          ? "O link expirou antes do envio final. Gere um novo link para o candidato concluir."
          : "O formulário só é concluído quando o candidato clica em Enviar. Só então o RH recebe o aviso por e-mail."}
      </p>
    </div>
  );
}

/**
 * Formulário de admissão do candidato: estado real (token/validade/envio) e as ações que o
 * backend suporta — gerar link, copiar link ativo, gerar novo link (invalida o anterior)
 * e ver as respostas.
 */
export function AdmissionFormStatus() {
  const { data, canManage, setTab } = useAdmissionWorkspace();
  const { form } = data;
  const router = useRouter();
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [whatsappMsg, setWhatsappMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<"url" | "msg" | null>(null);

  const fill = form.fill;
  const meta = form.state === "WAITING" && fill ? FILLING : STATE[form.state];
  const Icon = meta.icon;
  const url = generatedUrl ?? form.currentUrl;

  async function generateLink() {
    setConfirmOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/admissoes/${data.id}/digital/start`, { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string; formUrl?: string; whatsappMessage?: string };
      if (!res.ok) {
        notify("error", body.error ?? "Não foi possível gerar o link.");
        return;
      }
      setGeneratedUrl(body.formUrl ?? null);
      setWhatsappMsg(body.whatsappMessage ?? null);
      notify("success", "Link gerado. Copie e envie ao candidato.");
      router.refresh();
    } catch {
      notify("error", "Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  function copy(text: string, kind: "url" | "msg") {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(kind);
        notify("success", kind === "url" ? "Link copiado." : "Mensagem copiada.");
        setTimeout(() => setCopied(null), 2000);
      },
      () => notify("error", "Não foi possível copiar. Selecione o link e copie manualmente.")
    );
  }

  return (
    <div>
      <p className={cn("flex items-center gap-1.5 text-body font-semibold", meta.className)}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        {meta.label}
      </p>
      <dl className="mt-1 space-y-0.5 text-meta text-wg-ink-muted">
        {form.state === "SUBMITTED" && form.submittedAt && (
          <div>
            <dt className="sr-only">Concluído em</dt>
            <dd>{fmt(form.submittedAt)}</dd>
          </div>
        )}
        {form.state !== "SUBMITTED" && form.lastSentAt && (
          <div className="flex gap-1">
            <dt>Link gerado em</dt>
            <dd>{fmt(form.lastSentAt)}</dd>
          </div>
        )}
        {form.state === "WAITING" && form.expiresAt && (
          <div className="flex gap-1">
            <dt>Válido até</dt>
            <dd>{fmt(form.expiresAt)}</dd>
          </div>
        )}
        {form.state === "EXPIRED" && form.expiresAt && (
          <div className="flex gap-1">
            <dt>Expirou em</dt>
            <dd className="text-danger-fg">{fmt(form.expiresAt)}</dd>
          </div>
        )}
      </dl>
      {fill && <FormFillDetails fill={fill} expired={form.state === "EXPIRED"} />}
      {form.state === "NOT_SENT" && canManage && (
        <p className="mt-1 text-meta text-wg-ink-muted">
          Gere um link para o candidato preencher os dados e enviar os documentos. Vale {form.expiryDays} dias.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 empty:hidden">
        {form.state === "SUBMITTED" && (
          <Button size="sm" variant="secondary" icon={FileText} className="w-full" onClick={() => setTab("dados")}>
            Visualizar respostas
          </Button>
        )}

        {canManage && form.state !== "SUBMITTED" && (
          <>
            {url && form.state === "WAITING" && (
              <Button size="sm" variant="secondary" className="w-full" icon={copied === "url" ? Check : Copy} onClick={() => copy(url, "url")}>
                {copied === "url" ? "Link copiado" : "Copiar link"}
              </Button>
            )}
            {whatsappMsg && (
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                icon={copied === "msg" ? Check : MessageSquare}
                onClick={() => copy(whatsappMsg, "msg")}
              >
                {copied === "msg" ? "Mensagem copiada" : "Copiar mensagem para WhatsApp"}
              </Button>
            )}
            {form.state === "NOT_SENT" && (
              <Button size="sm" variant="primary" className="w-full" icon={Send} loading={loading} onClick={generateLink}>
                Gerar link do formulário
              </Button>
            )}
            {form.state === "EXPIRED" && (
              <Button size="sm" variant="primary" className="w-full" icon={RefreshCw} loading={loading} onClick={generateLink}>
                Gerar novo link
              </Button>
            )}
            {form.state === "WAITING" && (
              <Button size="sm" variant="tertiary" className="w-full" icon={RefreshCw} loading={loading} onClick={() => setConfirmOpen(true)}>
                Reenviar (gerar novo link)
              </Button>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        variant="warning"
        title="Gerar um novo link?"
        message={`O link atual deixará de funcionar. O novo link vale por ${form.expiryDays} dias e precisa ser reenviado ao candidato.`}
        confirmLabel="Gerar novo link"
        onConfirm={generateLink}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
