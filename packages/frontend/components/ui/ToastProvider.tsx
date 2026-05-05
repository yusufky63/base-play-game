"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastTone = "info" | "success" | "error";
type ToastInput = { title: string; description?: string; tone?: ToastTone };
type Toast = ToastInput & { id: number; tone: ToastTone };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const Provider = ToastContext.Provider as any;

  const push = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const toast: Toast = { id, tone: input.tone ?? "info", title: input.title, description: input.description };
    setToasts((current) => [toast, ...current].slice(0, 4));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, input.tone === "error" ? 6500 : 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <Provider value={value}>
      {children}
      <div className="toast-viewport">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} />
        ))}
      </div>
    </Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const Icon = toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? AlertCircle : Info;
  const toneClass = toast.tone === "success" ? "text-[var(--win)]" : toast.tone === "error" ? "text-[var(--lose)]" : "text-[var(--accent)]";

  return (
    <div className="toast-card grid grid-cols-[auto_1fr_auto] gap-3 rounded-md border border-[var(--border-2)] bg-[var(--surface)] p-3 shadow-[var(--shadow-tight)]">
      <Icon size={18} className={toneClass} />
      <div className="min-w-0">
        <div className="text-sm font-bold text-[var(--text-1)]">{toast.title}</div>
        {toast.description && <div className="mt-1 text-xs leading-5 text-[var(--text-2)]">{toast.description}</div>}
      </div>
      <button type="button" onClick={onClose} aria-label="Close toast" className="text-[var(--text-3)] hover:text-[var(--text-1)]">
        <X size={15} />
      </button>
    </div>
  );
}
