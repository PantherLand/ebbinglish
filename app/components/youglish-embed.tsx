"use client";

import { useEffect, useId, useMemo, useState } from "react";

type YouglishEmbedProps = {
  headword: string;
  className?: string;
  minHeightClassName?: string;
};

export default function YouglishEmbed({
  headword,
  className,
  minHeightClassName = "min-h-[200px]",
}: YouglishEmbedProps) {
  const rawId = useId();
  const widgetId = rawId.replace(/[:]/g, "");
  const hostId = `yg-embed-host-${widgetId}`;
  const anchorId = `yg-embed-widget-${widgetId}`;
  const query = headword.trim();
  const encodedQuery = useMemo(
    () => encodeURIComponent(query.replace(/\s+/g, " ").trim()),
    [query],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!query) {
      return;
    }

    const startLoadingTimer = window.setTimeout(() => setLoading(true), 0);
    const scriptId = `youglish-embed-script-${widgetId}`;
    const existing = document.getElementById(scriptId);
    if (existing) {
      existing.remove();
    }

    const startedAt = Date.now();
    const minLoadingMs = 350;
    let observer: MutationObserver | null = null;
    const host = document.getElementById(hostId);

    const finishLoading = () => {
      const elapsed = Date.now() - startedAt;
      const delay = Math.max(0, minLoadingMs - elapsed);
      window.setTimeout(() => setLoading(false), delay);
    };

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
      window.clearTimeout(startLoadingTimer);
      observer?.disconnect();
      window.clearTimeout(fallbackTimer);
      script.remove();
    };
  }, [hostId, query, widgetId]);

  if (!query) {
    return null;
  }

  return (
    <section
      className={`relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 ${minHeightClassName} ${className ?? ""}`}
    >
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-50/95 text-sm text-slate-500 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
            Loading pronunciation clips...
          </span>
        </div>
      ) : null}
      <div className="h-full w-full overflow-auto p-1.5" id={hostId}>
        <a
          className="youglish-widget"
          data-bkg-color="theme_light"
          data-components="8415"
          data-lang="english"
          data-query={encodedQuery}
          data-zones="all,us,uk,aus"
          href="https://youglish.com"
          id={anchorId}
          rel="nofollow noopener noreferrer"
          target="_blank"
        >
          Visit YouGlish.com
        </a>
      </div>
    </section>
  );
}
