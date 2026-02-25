import RouteBoundarySignal from "@/app/components/route-boundary-signal";

export default function AppLoading() {
  return (
    <div className="space-y-4">
      <RouteBoundarySignal />
      <div className="h-10 w-48 animate-pulse rounded-xl bg-slate-200/70" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="h-24 animate-pulse rounded-2xl bg-slate-200/60" />
    </div>
  );
}
