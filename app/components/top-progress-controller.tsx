"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import NProgress from "nprogress";

const ROUTE_BOUNDARY_EVENT = "ebbinglish:route-boundary";
const MIN_VISIBLE_MS = 420;
const MAX_VISIBLE_MS = 12000;
const MAX_PENDING_PROGRESS = 0.5;
const FINISH_STAGE_ONE_MS = 120;
const FINISH_STAGE_TWO_MS = 130;
const DEFAULT_PROGRESS_COLOR = "#4f46e5";
let boundaryCount = 0;
let navigationPending = false;
let startedAt = 0;
let hideTimer: number | null = null;
let finishStageOneTimer: number | null = null;
let finishStageTwoTimer: number | null = null;
let maxTimer: number | null = null;
let isFinishing = false;

function applyBrandProgressStyles() {
  const cssColor =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--brand-primary").trim()
      : "";
  const progressColor = cssColor || DEFAULT_PROGRESS_COLOR;
  const bar = document.querySelector<HTMLElement>("#nprogress .bar");
  if (bar) {
    bar.style.background = progressColor;
    bar.style.backgroundColor = progressColor;
    bar.style.height = "2px";
  }
  const peg = document.querySelector<HTMLElement>("#nprogress .peg");
  if (peg) {
    peg.style.boxShadow = `0 0 8px ${progressColor}, 0 0 4px ${progressColor}`;
  }
}

function clearTimers() {
  if (hideTimer) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
  if (finishStageOneTimer) {
    window.clearTimeout(finishStageOneTimer);
    finishStageOneTimer = null;
  }
  if (finishStageTwoTimer) {
    window.clearTimeout(finishStageTwoTimer);
    finishStageTwoTimer = null;
  }
  if (maxTimer) {
    window.clearTimeout(maxTimer);
    maxTimer = null;
  }
  isFinishing = false;
}

function startBar() {
  clearTimers();
  startedAt = Date.now();
  if (NProgress.status === null) {
    NProgress.start();
    applyBrandProgressStyles();
  }
  NProgress.set(MAX_PENDING_PROGRESS);
  applyBrandProgressStyles();
  maxTimer = window.setTimeout(() => {
    boundaryCount = 0;
    navigationPending = false;
    isFinishing = false;
    NProgress.done(true);
  }, MAX_VISIBLE_MS);
}

function tryFinishBar() {
  if (boundaryCount > 0 || navigationPending || NProgress.status === null || isFinishing) {
    return;
  }
  isFinishing = true;
  const elapsed = Date.now() - startedAt;
  const remaining = Math.max(MIN_VISIBLE_MS - elapsed, 0);
  if (hideTimer) {
    window.clearTimeout(hideTimer);
  }
  hideTimer = window.setTimeout(() => {
    if ((NProgress.status ?? 0) < MAX_PENDING_PROGRESS) {
      NProgress.set(MAX_PENDING_PROGRESS);
    }
    finishStageOneTimer = window.setTimeout(() => {
      NProgress.set(0.78);
      finishStageTwoTimer = window.setTimeout(() => {
        NProgress.set(0.92);
        NProgress.done();
        isFinishing = false;
      }, FINISH_STAGE_TWO_MS);
    }, FINISH_STAGE_ONE_MS);
  }, remaining);
}

function isModifiedEvent(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

export default function TopProgressController() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const routeKey = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    navigationPending = false;
    tryFinishBar();
  }, [routeKey]);

  useEffect(() => {
    NProgress.configure({
      showSpinner: false,
      trickle: false,
      minimum: 0.08,
      easing: "ease",
      speed: 320,
    });
    applyBrandProgressStyles();

    const onClickCapture = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedEvent(event)) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) {
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) {
        return;
      }

      let nextUrl: URL;
      try {
        nextUrl = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (nextUrl.origin !== window.location.origin) {
        return;
      }

      const currentKey = `${window.location.pathname}${window.location.search}`;
      const nextKey = `${nextUrl.pathname}${nextUrl.search}`;
      if (currentKey === nextKey) {
        return;
      }

      navigationPending = true;
      startBar();
    };

    const onRouteBoundary = (event: Event) => {
      const customEvent = event as CustomEvent<{ phase?: string }>;
      const phase = customEvent.detail?.phase;
      if (phase === "start") {
        boundaryCount += 1;
        startBar();
        return;
      }
      if (phase === "end") {
        boundaryCount = Math.max(boundaryCount - 1, 0);
        tryFinishBar();
      }
    };

    const onPopState = () => {
      navigationPending = true;
      startBar();
    };

    window.addEventListener("popstate", onPopState);
    document.addEventListener("click", onClickCapture, true);
    window.addEventListener(ROUTE_BOUNDARY_EVENT, onRouteBoundary as EventListener);

    return () => {
      document.removeEventListener("click", onClickCapture, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(ROUTE_BOUNDARY_EVENT, onRouteBoundary as EventListener);
      clearTimers();
      NProgress.done(true);
    };
  }, []);

  return null;
}
