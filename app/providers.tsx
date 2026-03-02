"use client";

import { Suspense } from "react";
import TopProgressController from "@/app/components/top-progress-controller";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Suspense fallback={null}>
        <TopProgressController />
      </Suspense>
    </>
  );
}
