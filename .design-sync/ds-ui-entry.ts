// Bundle entry for design-sync: re-exports the shared UI primitives.
// Uses the "@/*" -> "src/*" tsconfig alias so it is location-independent.
export { AnimateIn } from "@/components/ui/AnimateIn";
export { ConfirmModal } from "@/components/ui/ConfirmModal";
export { EmptyState } from "@/components/ui/EmptyState";
export { Skeleton } from "@/components/ui/Skeleton";
export { ToastProvider, useToast } from "@/components/ui/ToastProvider";
