import Image from "next/image";
import Link from "next/link";

type EbbinglishBrandProps = {
  href?: string;
  compact?: boolean;
  sidebar?: boolean;
};

function BrandIcon({ compact = false, sidebar = false }: { compact?: boolean; sidebar?: boolean }) {
  const sizeClass = compact ? "h-8 w-8" : sidebar ? "h-10 w-10" : "h-12 w-12";
  return (
    <span aria-hidden="true" className={`relative inline-flex shrink-0 overflow-hidden ${sizeClass}`}>
      <Image alt="" className="object-contain" fill priority sizes="48px" src="/icon128.png" />
    </span>
  );
}

export default function EbbinglishBrand({
  href = "/app/today",
  compact = false,
  sidebar = false,
}: EbbinglishBrandProps) {
  const titleClass = compact
    ? "text-base"
    : sidebar
      ? "text-[1.55rem]"
      : "text-[clamp(1.75rem,3.6vw,2.35rem)]";
  const subtitleClass = compact
    ? "text-[8px] tracking-[0.16em]"
    : sidebar
      ? "text-[0.5rem] tracking-[0.15em]"
      : "text-[0.58rem] tracking-[0.2em]";
  const rootGapClass = sidebar ? "gap-2.5" : "gap-3";

  return (
    <Link className={`inline-flex max-w-full items-center overflow-hidden ${rootGapClass}`} href={href}>
      <BrandIcon compact={compact} sidebar={sidebar} />
      <span className="min-w-0 space-y-1">
        <span
          className={`block whitespace-nowrap font-bold leading-none ${titleClass}`}
          style={{ color: "lab(50 54.24 -77.06)" }}
        >
          Ebbinglish
        </span>
        <span className={`block whitespace-nowrap font-semibold uppercase text-slate-400 ${subtitleClass}`}>
          Spaced Repetition
        </span>
      </span>
    </Link>
  );
}
