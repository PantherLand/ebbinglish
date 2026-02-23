"use client";

import { useEffect, useId, useMemo, useState } from "react";
import YouglishLoadingOverlay from "@/app/components/youglish-loading-overlay";

type YouglishModalProps = {
  headword: string;
  onClose: () => void;
};

export default function YouglishModal({
  headword,
  onClose,
}: YouglishModalProps) {
  const rawWidgetId = useId();
  const widgetId = rawWidgetId.replace(/[:]/g, "");
  const youglishAnchorId = `yg-widget-${widgetId}`;
  const youglishHostId = `yg-host-${widgetId}`;
  const normalizedHeadword = headword.trim();
  const youglishQuery = useMemo(
    () => encodeURIComponent(normalizedHeadword),
    [normalizedHeadword],
  );

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!normalizedHeadword) {
      return;
    }

    const startedAt = Date.now();
    const minVisibleMs = 900;
    const scriptId = `youglish-widget-script-${widgetId}`;
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.remove();
    }

    const finishLoading = () => {
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, minVisibleMs - elapsed);
      window.setTimeout(() => setLoading(false), delay);
    };

    const host = document.getElementById(youglishHostId);
    let observer: MutationObserver | null = null;
    const bindIframeReady = (iframe: HTMLIFrameElement) => {
      if (iframe.dataset.ygBound === "1") {
        return;
      }
      iframe.dataset.ygBound = "1";
      iframe.addEventListener("load", finishLoading, { once: true });
    };

    if (host) {
      host.querySelectorAll<HTMLIFrameElement>("iframe").forEach(bindIframeReady);
      observer = new MutationObserver(() => {
        host.querySelectorAll<HTMLIFrameElement>("iframe").forEach(bindIframeReady);
      });
      observer.observe(host, { childList: true, subtree: true });
    }

    const script = document.createElement("script");
    script.id = scriptId;
    script.async = true;
    script.src = "https://youglish.com/public/emb/widget.js";
    script.charset = "utf-8";
    script.onerror = () => setLoading(false);
    document.body.appendChild(script);
    const fallbackTimer = window.setTimeout(() => setLoading(false), 10000);

    return () => {
      window.clearTimeout(fallbackTimer);
      observer?.disconnect();
      script.remove();
    };
  }, [widgetId, normalizedHeadword, youglishHostId]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  if (!normalizedHeadword) {
    return null;
  }

  return (
    <div
      aria-label="YouGlish modal"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-slate-950/50 p-4 md:p-10"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="mx-auto flex h-full w-full items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl md:h-[88vh] md:w-[70vw]">
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-500">YouGlish</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{normalizedHeadword}</div>
            </div>
            <button
              aria-label="Close YouGlish"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-700"
              onClick={onClose}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                viewBox="0 0 24 24"
              >
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <div className="relative flex-1 overflow-auto bg-slate-50 p-4 md:p-8">
            {loading ? <YouglishLoadingOverlay headword={normalizedHeadword} /> : null}
            <div id={youglishHostId}>
              <a
                className={`youglish-widget transition-opacity duration-300 ${
                  loading ? "opacity-0" : "opacity-100"
                }`}
                data-bkg-color="theme_light"
                data-components="8415"
                data-lang="english"
                data-query={youglishQuery}
                href="https://youglish.com"
                id={youglishAnchorId}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                Visit YouGlish.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
