"use client";

// Criação interna de solicitação (RH abrindo o pedido em nome de um gestor, ou um gestor
// com acesso ao painel). Mesmo formulário do público — o que muda é poder salvar como
// rascunho em vez de já enviar para a fila do RH.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { createJobRequestInternal } from "@/lib/job-requests/actions";
import {
  EMPTY_JOB_REQUEST_FORM,
  JobRequestFormFields,
  toPayload,
  type JobRequestFormValues,
} from "@/components/job-requests/JobRequestFormFields";
import type { FormFieldConfig } from "@/types/form-config";

interface Props {
  extraFields: FormFieldConfig[];
  unitOptions: string[];
  departmentOptions: string[];
  currentUser: { name: string | null; email: string | null };
}

export function NewJobRequestForm({
  extraFields,
  unitOptions,
  departmentOptions,
  currentUser,
}: Props) {
  const router = useRouter();
  const { notify } = useToast();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState<JobRequestFormValues>(() => ({
    ...EMPTY_JOB_REQUEST_FORM,
    requesterName: currentUser.name ?? "",
    requesterEmail: currentUser.email ?? "",
  }));

  function submit(asDraft: boolean) {
    setErrors({});
    startTransition(async () => {
      const res = await createJobRequestInternal(toPayload(values), asDraft);
      if (!res.ok) {
        if (res.fieldErrors) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) flat[k] = v[0];
          setErrors(flat);
        }
        notify("error", res.error);
        return;
      }
      notify(
        "success",
        asDraft
          ? `Rascunho ${res.code ?? ""} salvo.`
          : `Solicitação ${res.code ?? ""} enviada ao RH.`
      );
      router.push(`/solicitacoes/${res.id}`);
    });
  }

  return (
    <div className="bg-white border border-[#E7EEDD] rounded-2xl p-5">
      <JobRequestFormFields
        values={values}
        onChange={(p) => setValues((prev) => ({ ...prev, ...p }))}
        errors={errors}
        extraFields={extraFields}
        unitOptions={unitOptions}
        departmentOptions={departmentOptions}
      />

      <div className="mt-6 flex flex-wrap gap-2 border-t border-[#E7EEDD] pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(false)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#4F6930] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#415726] disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Enviar para validação do RH
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#E7EEDD] px-4 py-2 text-[13px] font-semibold text-[#55614A] hover:bg-[#F4F7EE] disabled:opacity-50"
        >
          <FileText className="w-3.5 h-3.5" />
          Salvar como rascunho
        </button>
      </div>
    </div>
  );
}
