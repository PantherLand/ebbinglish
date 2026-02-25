import Link from "next/link";

type EbbinglishBrandProps = {
  href?: string;
  compact?: boolean;
  sidebar?: boolean;
};

function BrandIcon({ compact = false, sidebar = false }: { compact?: boolean; sidebar?: boolean }) {
  const sizeClass = compact ? "h-8 w-8" : sidebar ? "h-10 w-10" : "h-12 w-12";
  return (
    <span
      className={`relative inline-flex overflow-hidden rounded-md border border-slate-200 bg-slate-100 shadow-sm ${sizeClass}`}
    >
      <svg
        aria-hidden="true"
        className="h-full w-full"
        fill="none"
        viewBox="0 0 88 88"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect fill="#EAF3FF" height="88" width="88" />
        <circle cx="66" cy="20" fill="#F4DA85" r="8" />
        <path
          d="M-6 58C10 43 23 40 35 45C47 50 55 58 68 56C78 54 86 49 94 42V88H-6V58Z"
          fill="#4F8BFF"
        />
        <path
          d="M-4 64C9 53 20 51 31 55C40 58 47 65 57 65C65 65 75 60 93 47V88H-4V64Z"
          fill="#2B63D9"
          opacity="0.95"
        />
        <path
          d="M-2 70C11 60 20 60 30 64C38 67 45 72 54 73C66 74 77 69 92 56V88H-2V70Z"
          fill="#1848B9"
        />
      </svg>
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
        <span className={`block whitespace-nowrap font-bold leading-none text-indigo-600 ${titleClass}`}>
          Ebbinglish
        </span>
        <span className={`block whitespace-nowrap font-semibold uppercase text-slate-400 ${subtitleClass}`}>
          Spaced Repetition
        </span>
      </span>
    </Link>
  );
}
