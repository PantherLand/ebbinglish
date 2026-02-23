"use client";

import { useEffect, useRef, useState } from "react";

type ToastType = "success" | "error" | "info";

type ToastEventDetail = {
  message: string;
  type?: ToastType;
  durationMs?: number;
};

type ToastState = {
  id: number;
  message: string;
  type: ToastType;
  durationMs: number;
  visible: boolean;
};

declare global {
  interface WindowEventMap {
    "ebbinglish:toast": CustomEvent<ToastEventDetail>;
  }
}

const LEAVE_ANIMATION_MS = 240;

function clearTimer(ref: { current: number | null }) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export default function GlobalToastViewport() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const idRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const removeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const onToast = (event: CustomEvent<ToastEventDetail>) => {
      const message = event.detail?.message?.trim();
      if (!message) {
        return;
      }

      clearTimer(hideTimerRef);
      clearTimer(removeTimerRef);

      const nextId = idRef.current + 1;
      idRef.current = nextId;

      const nextToast: ToastState = {
        id: nextId,
        message,
        type: event.detail?.type ?? "success",
        durationMs: Math.min(Math.max(event.detail?.durationMs ?? 1800, 800), 6000),
        visible: false,
      };

      setToast(nextToast);

      window.requestAnimationFrame(() => {
        setToast((prev) =>
          prev && prev.id === nextId ? { ...prev, visible: true } : prev,
        );
      });

      hideTimerRef.current = window.setTimeout(() => {
        setToast((prev) =>
          prev && prev.id === nextId ? { ...prev, visible: false } : prev,
        );
      }, nextToast.durationMs);

      removeTimerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev && prev.id === nextId ? null : prev));
      }, nextToast.durationMs + LEAVE_ANIMATION_MS);
    };

    window.addEventListener("ebbinglish:toast", onToast as EventListener);

    return () => {
      window.removeEventListener("ebbinglish:toast", onToast as EventListener);
      clearTimer(hideTimerRef);
      clearTimer(removeTimerRef);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[70] flex items-start justify-end p-4 sm:p-6">
      {toast ? (
        <div
          aria-live="polite"
          className={`pointer-events-auto min-w-[220px] max-w-sm rounded-2xl border px-4 py-3 shadow-xl transition-all duration-300 ${
            toast.visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
          } ${
            toast.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : toast.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-sky-200 bg-sky-50 text-sky-900"
          }`}
          role="status"
        >
          <div className="text-sm font-medium">{toast.message}</div>
        </div>
      ) : null}
    </div>
  );
}
