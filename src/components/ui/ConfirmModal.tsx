"use client";

import { AlertTriangle, Trash2 } from "lucide-react";

interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "Confirmar",
  variant = "danger",
  onConfirm,
  onCancel,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-white border border-gray-200 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${
            variant === "danger" ? "bg-red-100" : "bg-amber-100"
          }`}
        >
          {variant === "danger" ? (
            <Trash2 className="w-5 h-5 text-red-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          )}
        </div>

        <h3 className="text-gray-900 font-semibold text-base mb-2">{title}</h3>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-gray-600
              hover:border-gray-400 hover:text-gray-900 text-sm font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              variant === "danger"
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-amber-500 hover:bg-amber-600 text-black"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
