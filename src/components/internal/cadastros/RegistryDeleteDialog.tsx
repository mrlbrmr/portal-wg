"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { getRegistry } from "@/lib/settings/registry";
import { deleteCategory, updateCategory, type CatEntity } from "@/lib/admissao/config-actions";
import type { RegistryItem } from "@/lib/admissao/registry-data";

interface Props {
  entity: CatEntity;
  item: RegistryItem | null;
  onClose: () => void;
}

/**
 * Exclusão de cadastro com verificação de uso:
 *  • sem uso → exclui;
 *  • em uso e com status → oferece DESATIVAR (histórico preservado);
 *  • tag em uso → oferece remover a tag (admissões e talentos) e excluir;
 *  • tipo de documento em uso → não exclui (os anexos perderiam a categoria).
 */
export function RegistryDeleteDialog({ entity, item, onClose }: Props) {
  const reg = getRegistry(entity);
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();

  if (!item) return null;
  const current = item;
  const used = current.usage.total > 0;
  const usageText = current.usage.parts.map((p) => `${p.count} ${p.label}`).join(" e ");
  const canDeactivate = used && current.active !== null;
  const canDetach = used && entity === "tag";
  const blocked = used && !canDeactivate && !canDetach;
  const the = reg.article === "a" ? "a" : "o";
  const This = reg.article === "a" ? "Esta" : "Este";

  function act(kind: "delete" | "deactivate" | "detach") {
    startTransition(async () => {
      const res =
        kind === "deactivate"
          ? await updateCategory(entity, current.id, { active: false })
          : await deleteCategory(entity, current.id, { detachTags: kind === "detach" });
      if (!res.ok) {
        notify("error", res.error);
        return;
      }
      notify(
        "success",
        kind === "deactivate"
          ? `“${current.name}” desativad${the}. O histórico foi preservado.`
          : `“${current.name}” excluíd${the}.`
      );
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog
      open
      alert
      onClose={onClose}
      busy={pending}
      title={`Excluir ${the} ${reg.singular} “${current.name}”?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {blocked ? "Fechar" : "Cancelar"}
          </Button>
          {!used && (
            <Button variant="destructive" loading={pending} onClick={() => act("delete")}>
              Excluir
            </Button>
          )}
          {canDeactivate && current.active && (
            <Button variant="primary" loading={pending} onClick={() => act("deactivate")}>
              Desativar
            </Button>
          )}
          {canDetach && (
            <Button variant="destructive" loading={pending} onClick={() => act("detach")}>
              Remover a tag e excluir
            </Button>
          )}
        </>
      }
    >
      {!used ? (
        <p className="text-body text-wg-ink-secondary">
          {This} {reg.singular} não está em uso e será excluíd{the} definitivamente.
        </p>
      ) : (
        <div className="space-y-3 text-body text-wg-ink-secondary">
          <div className="flex items-start gap-2 rounded-control border border-warning-border bg-warning-bg px-3 py-2.5 text-warning-fg">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <p>
              {This} {reg.singular} está sendo utilizad{the} em <strong>{usageText}</strong>.
            </p>
          </div>
          {canDeactivate &&
            (current.active ? (
              <p>
                Para não perder o histórico, {the} {reg.singular} não pode ser excluíd{the}. Você pode{" "}
                <strong>desativá-l{the}</strong>: deixa de aparecer em novos cadastros e continua nos registros
                existentes.
              </p>
            ) : (
              <p>
                {This} {reg.singular} já está desativad{the} e continua apenas nos registros existentes, preservando o
                histórico.
              </p>
            ))}
          {canDetach && (
            <p>
              Excluir a tag a remove das admissões e talentos que a usam. Nenhum registro é apagado — só a etiqueta deixa de aparecer.
            </p>
          )}
          {blocked && (
            <p>
              A exclusão deixaria esses anexos sem categoria, por isso não é permitida.
            </p>
          )}
          {entity === "documentType" && (
            <p className="text-meta text-wg-ink-muted">
              Atenção: o Formulário de Admissão Digital classifica os anexos pelo nome exato do tipo de documento. Se
              renomear um tipo, ajuste também o nome do documento no formulário.
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}
