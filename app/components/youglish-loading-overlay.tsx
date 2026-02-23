"use client";

type YouglishLoadingOverlayProps = {
  headword: string;
};

export default function YouglishLoadingOverlay({
  headword,
}: YouglishLoadingOverlayProps) {
  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-[radial-gradient(circle_at_top,rgba(236,253,255,0.95),rgba(248,250,252,0.96)_55%)] px-6 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200/80 bg-white/95 p-8 text-center shadow-[0_20px_60px_-30px_rgba(2,132,199,0.35)]">
        <div className="mx-auto flex h-20 w-20 items-center justify-center">
          <div className="relative h-16 w-16">
            <span className="absolute inset-0 rounded-full border border-cyan-100/80" />
            <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-transparent border-t-cyan-500 border-r-indigo-500 [animation-duration:1.15s]" />
            <span className="absolute inset-[7px] animate-spin rounded-full border-[3px] border-transparent border-b-cyan-400 border-l-indigo-400 [animation-direction:reverse] [animation-duration:1.8s]" />
            <span className="absolute inset-[40%] rounded-full bg-cyan-500 shadow-[0_0_0_6px_rgba(6,182,212,0.2)]" />
          </div>
        </div>

        <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
          Loading YouGlish
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Preparing real-world clips for{" "}
          <span className="font-medium text-slate-900">{headword}</span>
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500 [animation-delay:-0.25s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.12s]" />
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-cyan-500" />
        </div>

        <div className="mt-6 space-y-2">
          <div className="h-2 w-full animate-pulse rounded-full bg-slate-200" />
          <div className="h-2 w-4/5 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
