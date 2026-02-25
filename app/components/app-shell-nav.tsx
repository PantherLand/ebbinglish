"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: (className?: string) => React.ReactNode;
};

function HomeIcon(className = "h-5 w-5") {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 10.5 12 3l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BookIcon(className = "h-5 w-5") {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2V5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 3v17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon(className = "h-5 w-5") {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 20h16" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 20v-8m5 8V8m5 12v-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RoundIcon(className = "h-5 w-5") {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="7" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SettingsIcon(className = "h-5 w-5") {
  return (
    <svg aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 8a4 4 0 100 8 4 4 0 000-8z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 12h2m12 0h2M12 4v2m0 12v2M6 6l1.5 1.5M16.5 16.5 18 18M6 18l1.5-1.5M16.5 7.5 18 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { href: "/app/today", label: "Today", icon: HomeIcon },
  { href: "/app/rounds", label: "Rounds", icon: RoundIcon },
  { href: "/app/library", label: "Library", icon: BookIcon },
  { href: "/app/stats", label: "Stats", icon: ChartIcon },
  { href: "/app/settings", label: "Settings", icon: SettingsIcon },
];

type AppShellNavProps = {
  mobile?: boolean;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppShellNav({ mobile = false }: AppShellNavProps) {
  const pathname = usePathname();

  if (mobile) {
    return (
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              className={`flex flex-1 flex-col items-center justify-center rounded-xl py-2 transition ${
                active ? "text-indigo-600" : "text-slate-500 hover:text-slate-700"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.icon("h-5 w-5")}
              <span className="mt-1 text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="space-y-1 p-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-base font-medium transition ${
              active
                ? "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
            href={item.href}
            key={item.href}
          >
            <span className={active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"}>
              {item.icon("h-5 w-5")}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
