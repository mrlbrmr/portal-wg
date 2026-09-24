"use client";

import { createContext, useContext } from "react";
import type { AdmissionDraft, AdmissionSection, AdmissionTab, DraftField } from "@/lib/admissao/workspace";
import type { AdmissionWorkspaceData, WorkspaceOptions } from "./types";

// Estado compartilhado da Central da admissão. Um ÚNICO rascunho para todas as abas
// (trocar de aba não perde o que foi digitado); cada seção entra em edição sozinha.

export interface AdmissionWorkspaceState {
  data: AdmissionWorkspaceData;
  options: WorkspaceOptions;
  canManage: boolean;
  draft: AdmissionDraft;
  saved: AdmissionDraft;
  patch: (p: Partial<AdmissionDraft>) => void;
  errors: Partial<Record<DraftField, string>>;
  isEditing: (s: AdmissionSection) => boolean;
  startEdit: (s: AdmissionSection) => void;
  /** Volta os campos da seção ao valor salvo e sai da edição. */
  cancelEdit: (s: AdmissionSection) => void;
  isDirty: boolean;
  setTab: (t: AdmissionTab) => void;
}

const Ctx = createContext<AdmissionWorkspaceState | null>(null);

export const AdmissionWorkspaceProvider = Ctx.Provider;

export function useAdmissionWorkspace(): AdmissionWorkspaceState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAdmissionWorkspace deve ser usado dentro de <AdmissionWorkspace>.");
  return v;
}

/** Nome de um item de cadastro pelo id; cai no nome gravado quando o item está inativo. */
export function optionName(
  list: Array<{ id: string; name: string }>,
  id: string,
  savedId: string | null,
  savedName: string | null
): string | null {
  if (!id) return null;
  const found = list.find((o) => o.id === id);
  if (found) return found.name;
  return id === savedId ? savedName : null;
}
