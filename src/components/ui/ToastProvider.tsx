"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  /** Dispara uma notificação temporária no canto da tela. */
  notify: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Hook de acesso ao sistema de notificações. Deve estar sob <ToastProvider>. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast deve ser usado dentro de <ToastProvider>.");
  return ctx;
}

const TOAST_TTL = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const notify = useCallback(
    (type: ToastType, message: string) => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, type, message }]);
      setTimeout(() => dismiss(id), TOAST_TTL);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}

      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-xs flex-col gap-2">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const TOAST_CONFIG: Record<
  ToastType,
  { icon: typeof CheckCircle2; iconClass: string; accent: string }
> = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-wg-green-dark",
    accent: "border-l-wg-green",
  },
  error: {
    icon: AlertCircle,
    iconClass: "text-red-600",
    accent: "border-l-red-500",
  },
  info: {
    icon: Info,
    iconClass: "text-blue-600",
    accent: "border-l-blue-500",
  },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { icon: Icon, iconClass, accent } = TOAST_CONFIG[toast.type];

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border border-gray-200 border-l-4 bg-white p-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200 ${accent}`}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <p className="flex-1 text-sm text-gray-700">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-gray-700"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
