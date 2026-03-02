import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { auth, signIn } from "@/src/auth";

export const metadata: Metadata = {
  title: "Ebbinglish – Learn English Words That Actually Stick",
  description:
    "Build your English vocabulary with spaced repetition, round-based review sessions, and YouGlish pronunciation examples. Available on web, iOS, and as a Chrome extension.",
  alternates: {
    canonical: "/",
  },
};

/* ------------------------------------------------------------------ */
/*  Inline SVG icons                                                   */
/* ------------------------------------------------------------------ */

function BrainIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M12 2a7 7 0 0 0-7 7c0 2.5 1.2 4.7 3 6v3h8v-3c1.8-1.3 3-3.5 3-6a7 7 0 0 0-7-7z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 18h6M10 21h4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2v4M8 6l1 2M16 6l-1 2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M17 1l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 23l-4-4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M18 20V10M12 20V4M6 20v-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PuzzleIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M20 7h-4V3H8v4H4v6h4v8h8v-8h4V7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChromeIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3a7 7 0 0 1 6.33 4H12a3 3 0 0 0-2.83 2.03L6.76 6.97A6.97 6.97 0 0 1 12 5zM5 12c0-1.14.27-2.22.76-3.17L9.43 15A3 3 0 0 0 12 17h.01l-2.42 4.19A7.01 7.01 0 0 1 5 12zm7 7c.71 0 1.39-.13 2.02-.37L16.43 15a3 3 0 0 0 .01-6h4.8A6.97 6.97 0 0 1 19 15.17l-3.68-1.18A3 3 0 0 0 12 19zm0-5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
    </svg>
  );
}

function AppleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function ArrowRightIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: <BrainIcon />,
    title: "Spaced Repetition",
    desc: "Review words at scientifically optimal intervals based on Ebbinghaus forgetting curve, so you remember more and study less.",
  },
  {
    icon: <RepeatIcon />,
    title: "Round-Based Review",
    desc: "Organize vocabulary into focused learning rounds with sessions that adapt to your mastery level.",
  },
  {
    icon: <SpeakerIcon />,
    title: "Real Pronunciation",
    desc: "Hear every word in context through YouGlish, with real examples from native English speakers.",
  },
  {
    icon: <ChartIcon />,
    title: "Progress Analytics",
    desc: "Track your learning health score, mastery rate, daily streaks, and review heatmap at a glance.",
  },
  {
    icon: <PuzzleIcon />,
    title: "Chrome Extension",
    desc: "Save words instantly from any webpage while browsing. One click to add to your library.",
  },
  {
    icon: <ShieldIcon />,
    title: "Smart Dictionary",
    desc: "Built-in dictionary with definitions, usage examples, and part-of-speech breakdowns for every word.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Build Your Library",
    desc: "Add words manually or capture them from the web using our Chrome extension. Each word gets definitions, pronunciation, and context.",
  },
  {
    num: "02",
    title: "Start a Round",
    desc: "Create a learning round from your word library. Filter by tags, priority, or status to focus on what matters.",
  },
  {
    num: "03",
    title: "Review in Sessions",
    desc: "Study in bite-sized sessions. Rate each word as known, fuzzy, or unknown. The system adapts to your progress.",
  },
  {
    num: "04",
    title: "Master & Retain",
    desc: "Spaced repetition ensures words come back at the right time. Watch your mastery rate climb day by day.",
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default async function LandingPage() {
  const session = await auth();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Ebbinglish",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, iOS",
    description:
      "An English vocabulary learning app with spaced repetition, round-based review, and YouGlish pronunciation examples.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />

      {/* ── Sticky Nav ────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link className="inline-flex items-center gap-2.5" href="/">
            <span className="relative inline-flex h-9 w-9 shrink-0 overflow-hidden">
              <Image alt="" className="object-contain" fill priority sizes="36px" src="/icon128.png" />
            </span>
            <span className="text-xl font-bold" style={{ color: "lab(50 54.24 -77.06)" }}>
              Ebbinglish
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <a
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
              href="#features"
            >
              Features
            </a>
            <a
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
              href="#how-it-works"
            >
              How It Works
            </a>
            <a
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:inline-flex"
              href="#download"
            >
              Download
            </a>
            {session?.user ? (
              <Link
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                href="/app/today"
              >
                Open App
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/app/today" });
                }}
              >
                <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                  Sign In
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-indigo-100/60 blur-3xl" />
          <div className="absolute -left-24 top-1/3 h-[400px] w-[400px] rounded-full bg-purple-100/50 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-cyan-100/40 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pb-28 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="landing-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
              </span>
              Powered by Ebbinghaus Forgetting Curve
            </div>

            <h1 className="landing-fade-in text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl sm:leading-[1.1]">
              Learn English words
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-500 bg-clip-text text-transparent">
                that actually stick.
              </span>
            </h1>

            <p className="landing-fade-in mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600 sm:text-xl">
              Ebbinglish uses spaced repetition, round-based review, and real
              pronunciation examples to help you build a vocabulary you
              won&apos;t forget.
            </p>

            <div className="landing-fade-in mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              {session?.user ? (
                <Link
                  className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30"
                  href="/app/today"
                >
                  Go to Dashboard
                  <ArrowRightIcon className="h-5 w-5 transition group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/app/today" });
                  }}
                >
                  <button className="group inline-flex items-center gap-2.5 rounded-2xl bg-indigo-600 px-8 py-3.5 text-lg font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-500/30">
                    Get Started Free
                    <ArrowRightIcon className="h-5 w-5 transition group-hover:translate-x-0.5" />
                  </button>
                </form>
              )}
              <a
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-8 py-3.5 text-lg font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
                href="#how-it-works"
              >
                See How It Works
              </a>
            </div>

            {/* Platform badges */}
            <div className="landing-fade-in mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Web App
              </span>
              <span className="flex items-center gap-1.5">
                <AppleIcon className="h-4 w-4 text-slate-400" />
                iOS App
              </span>
              <span className="flex items-center gap-1.5">
                <ChromeIcon className="h-4 w-4 text-slate-400" />
                Chrome Extension
              </span>
            </div>
          </div>

          {/* Hero visual: abstract app preview */}
          <div className="landing-fade-in-slow relative mx-auto mt-16 max-w-4xl">
            <div className="rounded-3xl border border-slate-200/80 bg-white/70 p-2 shadow-2xl shadow-slate-900/10 backdrop-blur-sm">
              <div className="overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white">
                {/* Mock app header */}
                <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-slate-200" />
                    <div className="h-3 w-3 rounded-full bg-slate-200" />
                    <div className="h-3 w-3 rounded-full bg-slate-200" />
                  </div>
                  <div className="mx-auto flex items-center gap-2">
                    <span className="relative inline-flex h-5 w-5 shrink-0 overflow-hidden">
                      <Image alt="" className="object-contain" fill sizes="20px" src="/icon128.png" />
                    </span>
                    <span className="text-xs font-semibold text-slate-500">ebbinglish.app</span>
                  </div>
                  <div className="w-12" />
                </div>
                {/* Mock app content */}
                <div className="grid gap-4 p-6 sm:grid-cols-3">
                  {/* Card 1 - Daily Progress */}
                  <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white shadow-lg">
                    <div className="text-xs font-medium uppercase tracking-wider text-indigo-200">Daily Progress</div>
                    <div className="mt-2 text-3xl font-bold">24</div>
                    <div className="mt-1 text-sm text-indigo-200">Words Reviewed</div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
                      <div className="h-full w-3/4 rounded-full bg-white/80" />
                    </div>
                  </div>
                  {/* Card 2 - Mastery */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Mastery Rate</div>
                    <div className="mt-2 text-3xl font-bold text-emerald-600">78%</div>
                    <div className="mt-1 text-sm text-slate-500">156 / 200 words</div>
                    <div className="mt-3 flex gap-1">
                      {[...Array(10)].map((_, i) => (
                        <div
                          key={i}
                          className={`h-2 flex-1 rounded-full ${i < 8 ? "bg-emerald-400" : "bg-slate-100"}`}
                        />
                      ))}
                    </div>
                  </div>
                  {/* Card 3 - Streak */}
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="text-xs font-medium uppercase tracking-wider text-slate-500">Learning Day</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">Day 42</div>
                    <div className="mt-1 text-sm text-slate-500">Health score</div>
                    <div className="mt-3 text-2xl font-semibold text-emerald-600">
                      85<span className="ml-1 text-sm font-normal text-slate-400">/ 100</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Shadow glow */}
            <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[2rem] bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-cyan-500/10 blur-2xl" />
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="relative bg-white py-24" id="features">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to
              <br />
              <span className="text-indigo-600">master English vocabulary</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              A complete toolkit designed around how your brain actually learns and retains new words.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                className="group rounded-2xl border border-slate-200 bg-slate-50/50 p-6 transition hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-md"
                key={f.title}
              >
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 transition group-hover:bg-indigo-600 group-hover:text-white">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-50 py-24" id="how-it-works">
        {/* Background decoration */}
        <div className="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-6xl -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Four steps to a
              <span className="text-indigo-600"> stronger vocabulary</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              From adding your first word to achieving mastery — the process is simple and effective.
            </p>
          </div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div className="relative" key={s.num}>
                <div className="mb-4 text-5xl font-black text-indigo-100">{s.num}</div>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Download / Platforms ───────────────────────────────── */}
      <section className="relative bg-white py-24" id="download">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Use Ebbinglish <span className="text-indigo-600">everywhere</span>
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Learn on the web, capture words with our Chrome extension, and review on the go with the iOS app.
            </p>
          </div>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {/* Web App */}
            <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 text-center shadow-sm">
              <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <rect x="2" y="3" width="20" height="14" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M8 21h8M12 17v4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900">Web App</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Full-featured desktop experience. Manage your library, run review sessions, and track progress.
              </p>
              {session?.user ? (
                <Link
                  className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                  href="/app/today"
                >
                  Open Dashboard
                  <ArrowRightIcon />
                </Link>
              ) : (
                <form
                  action={async () => {
                    "use server";
                    await signIn("google", { redirectTo: "/app/today" });
                  }}
                >
                  <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-indigo-700">
                    Sign In to Start
                    <ArrowRightIcon />
                  </button>
                </form>
              )}
            </div>

            {/* iOS App */}
            <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 text-center shadow-sm">
              <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <AppleIcon className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">iOS App</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Review your vocabulary on the go. Quick sessions designed for mobile with offline support.
              </p>
              <a
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-slate-800"
                href="#"
                aria-label="Download on the App Store"
              >
                <AppleIcon className="h-5 w-5" />
                App Store
              </a>
              <span className="mt-2 text-xs text-slate-400">Coming Soon</span>
            </div>

            {/* Chrome Extension */}
            <div className="flex flex-col items-center rounded-3xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-8 text-center shadow-sm">
              <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ChromeIcon className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Chrome Extension</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Save new words from any webpage with one click. Definitions and context captured automatically.
              </p>
              <a
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-blue-700"
                href="#"
                aria-label="Add to Chrome"
              >
                <ChromeIcon className="h-5 w-5" />
                Add to Chrome
              </a>
              <span className="mt-2 text-xs text-slate-400">Chrome Web Store</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 py-20">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl" />

        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Start building your vocabulary today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-indigo-100">
            Join learners who are mastering English with science-backed spaced repetition. Free to get started.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            {session?.user ? (
              <Link
                className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-lg font-bold text-indigo-600 shadow-lg transition hover:bg-indigo-50"
                href="/app/today"
              >
                Go to Dashboard
                <ArrowRightIcon className="h-5 w-5 transition group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/app/today" });
                }}
              >
                <button className="group inline-flex items-center gap-2 rounded-2xl bg-white px-8 py-3.5 text-lg font-bold text-indigo-600 shadow-lg transition hover:bg-indigo-50">
                  Get Started Free
                  <ArrowRightIcon className="h-5 w-5 transition group-hover:translate-x-0.5" />
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <span className="relative inline-flex h-8 w-8 shrink-0 overflow-hidden">
                <Image alt="" className="object-contain" fill sizes="32px" src="/icon128.png" />
              </span>
              <span className="text-lg font-bold" style={{ color: "lab(50 54.24 -77.06)" }}>
                Ebbinglish
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Spaced Repetition
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-500">
              <a className="transition hover:text-slate-700" href="#features">
                Features
              </a>
              <a className="transition hover:text-slate-700" href="#how-it-works">
                How It Works
              </a>
              <a className="transition hover:text-slate-700" href="#download">
                Download
              </a>
            </div>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
            &copy; {new Date().getFullYear()} Ebbinglish. Learn smarter, remember longer.
          </div>
        </div>
      </footer>
    </div>
  );
}
