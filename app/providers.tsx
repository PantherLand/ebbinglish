"use client";

import TopProgressController from "@/app/components/top-progress-controller";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TopProgressController />
    </>
  );
}
