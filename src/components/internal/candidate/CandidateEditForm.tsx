"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Section } from "./Section";
import { formatPhoneMask, type CandidateDetail } from "./types";

export interface CandidateProfilePatch {
  fullName: string;
  email: string;
  phone: string;
  country: string | null;
  candidateCity: string | null;
  candidateState: string | null;
  availablePresential: boolean | null;
  salaryExpectation: number | null;
}

interface Props {
  data: CandidateDetail;
  saving: boolean;
  onCancel: () => void;
  /** Recebe os dados já validados; a etapa NUNCA é alterada por aqui. */
  onSave: (patch: CandidateProfilePatch) => void;
  onInvalid: (message: string) => void;
}

const inputCls =
  "h-9 w-full rounded-control border border-wg-border-light bg-white px-2.5 text-body text-wg-ink outline-none placeholder:text-wg-ink-muted/60 focus:border-wg-green focus:ring-2 focus:ring-wg-green/30";
const labelCls = "mb-1 block text-label text-wg-ink-secondary";

/** "Editar dados": só dados cadastrais da candidatura. */
export function CandidateEditForm({ data, saving, onCancel, onSave, onInvalid }: Props) {
  const [f, setF] = useState({
    fullName: data.fullName,
    email: data.email,
    phone: formatPhoneMask(data.phone),
    candidateCity: data.candidateCity ?? "",
    candidateState: data.candidateState ?? "",
    country: data.country ?? "",
    salaryExpectation: data.salaryExpectation !== null ? String(data.salaryExpectation) : "",
    availablePresential: data.availablePresential === null ? "" : data.availablePresential ? "true" : "false",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const phone = f.phone.replace(/\D/g, "");
    if (f.fullName.trim().length < 2) return onInvalid("Informe o nome completo.");
    if (phone.length !== 11) return onInvalid("Telefone inválido. Informe DDD + 9 dígitos.");
    const salary = f.salaryExpectation ? parseFloat(f.salaryExpectation.replace(",", ".")) : null;
    onSave({
      fullName: f.fullName.trim(),
      email: f.email.trim(),
      phone,
      country: f.country.trim() || null,
      candidateCity: f.candidateCity.trim() || null,
      candidateState: f.candidateState.trim().toUpperCase() || null,
      availablePresential: f.availablePresential === "" ? null : f.availablePresential === "true",
      salaryExpectation: salary !== null && !isNaN(salary) ? salary : null,
    });
  };

  return (
    <Section title="Editar dados do candidato">
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="edit-fullName" className={labelCls}>Nome completo</label>
          <input id="edit-fullName" value={f.fullName} onChange={set("fullName")} maxLength={120} required className={inputCls} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-email" className={labelCls}>E-mail</label>
            <input id="edit-email" type="email" value={f.email} onChange={set("email")} required className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-phone" className={labelCls}>Telefone (com DDD)</label>
            <input
              id="edit-phone"
              inputMode="numeric"
              value={f.phone}
              onChange={(e) => setF((prev) => ({ ...prev, phone: formatPhoneMask(e.target.value) }))}
              placeholder="(41) 99999-9999"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-[1fr_72px] gap-3 sm:grid-cols-[1fr_72px_1fr]">
          <div>
            <label htmlFor="edit-city" className={labelCls}>Cidade</label>
            <input id="edit-city" value={f.candidateCity} onChange={set("candidateCity")} maxLength={120} className={inputCls} />
          </div>
          <div>
            <label htmlFor="edit-uf" className={labelCls}>UF</label>
            <input
              id="edit-uf"
              value={f.candidateState}
              onChange={(e) => setF((prev) => ({ ...prev, candidateState: e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase() }))}
              placeholder="PR"
              className={inputCls}
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="edit-country" className={labelCls}>País</label>
            <input id="edit-country" value={f.country} onChange={set("country")} maxLength={80} className={inputCls} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-salary" className={labelCls}>Pretensão salarial (R$)</label>
            <input
              id="edit-salary"
              type="number"
              min={0}
              step={100}
              value={f.salaryExpectation}
              onChange={set("salaryExpectation")}
              className={inputCls}
            />
          </div>
          <div>
            <label htmlFor="edit-presential" className={labelCls}>Trabalho presencial</label>
            <select id="edit-presential" value={f.availablePresential} onChange={set("availablePresential")} className={inputCls}>
              <option value="">Não informado</option>
              <option value="true">Disponível</option>
              <option value="false">Não disponível</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Salvar dados
          </Button>
        </div>
      </form>
    </Section>
  );
}
