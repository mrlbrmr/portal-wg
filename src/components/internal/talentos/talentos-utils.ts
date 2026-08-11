import type { TalentoStatus } from "@/lib/talentos/types";

export const STATUS_LABELS: Record<TalentoStatus, string> = {
  ATIVO:        "Ativo",
  EM_PROCESSO:  "Em processo",
  CONTRATADO:   "Contratado",
  NAO_ADERENTE: "Não aderente",
  ARQUIVADO:    "Arquivado",
};

export const STATUS_COLORS: Record<TalentoStatus, string> = {
  ATIVO:        "bg-green-100 text-green-800",
  EM_PROCESSO:  "bg-blue-100 text-blue-800",
  CONTRATADO:   "bg-wg-green/20 text-wg-green-dark",
  NAO_ADERENTE: "bg-orange-100 text-orange-800",
  ARQUIVADO:    "bg-gray-100 text-gray-500",
};

// Paleta derivada dos tons verde/terra do WG — determinística por hash do nome
export const AVATAR_PALETTE = [
  { bg: "#DCF1CA", fg: "#2F4E1A" },
  { bg: "#C9E2D8", fg: "#1D4A39" },
  { bg: "#DDE6C5", fg: "#3A4E1E" },
  { bg: "#F2E4C5", fg: "#5C440A" },
  { bg: "#F0DDD0", fg: "#6B3A20" },
  { bg: "#E4EDD8", fg: "#374C27" },
  { bg: "#D4E5F0", fg: "#1A3A5C" },
  { bg: "#EDE4F0", fg: "#4A2A5C" },
];

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getAvatarStyle(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
