"use client";

import { useEffect } from "react";

const ROUTE_BOUNDARY_EVENT = "ebbinglish:route-boundary";

export default function RouteBoundarySignal() {
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent(ROUTE_BOUNDARY_EVENT, {
        detail: { phase: "start" },
      }),
    );
    return () => {
      window.dispatchEvent(
        new CustomEvent(ROUTE_BOUNDARY_EVENT, {
          detail: { phase: "end" },
        }),
      );
    };
  }, []);

  return null;
}
