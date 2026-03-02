import type { Metadata } from "next";
import Link from "next/link";
import { auth, signIn } from "@/src/auth";
import EbbinglishBrand from "@/app/components/ebbinglish-brand";

export const metadata: Metadata = {
  title: "English Vocabulary Learning With Spaced Repetition",
  description:
    "Build your English vocabulary with spaced repetition, round-based review sessions, and YouGlish pronunciation examples.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Ebbinglish: English Vocabulary App with Spaced Repetition & YouGlish",
    description:
      "Build your English vocabulary faster with round-based spaced repetition, real YouGlish pronunciation examples, and AI-powered dictionary lookups.",
    url: "/",
    type: "website",
  },
  twitter: {
    title: "Ebbinglish: English Vocabulary App with Spaced Repetition & YouGlish",
    description:
      "Build your English vocabulary faster with round-based spaced repetition, real YouGlish pronunciation examples, and AI-powered dictionary lookups.",
  },
};

export default async function Home() {
  const session = await auth();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Ebbinglish",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    description:
      "An English vocabulary learning app with spaced repetition, round-based review, and YouGlish pronunciation examples.",
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        type="application/ld+json"
      />
      <header className="space-y-3">
        <EbbinglishBrand href="/" />
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Learn English vocabulary with spaced repetition and real pronunciation examples
        </h1>
        <p className="max-w-3xl text-lg text-slate-600">
          Ebbinglish helps you build a stronger English vocabulary through round-based review,
          focused repetition, and YouGlish examples pulled from real spoken English.
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {session?.user ? (
          <div className="space-y-3">
            <div className="text-sm text-slate-600">Signed in as</div>
            <div className="font-medium text-slate-900">{session.user.email ?? session.user.name}</div>
            <Link className="inline-block rounded-2xl bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700" href="/app/today">
              Go to Today
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-medium text-slate-900">Sign in to start</div>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/app/today" });
              }}
            >
              <button className="rounded-2xl bg-indigo-600 px-5 py-2.5 font-medium text-white transition hover:bg-indigo-700">
                Continue with Google
              </button>
            </form>
            <p className="text-sm text-slate-600">
              (You’ll need GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configured.)
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm">
        <h2 className="font-semibold text-slate-900">Why Ebbinglish works</h2>
        <ul className="list-disc pl-5">
          <li>Save and organize an English vocabulary list for long-term review</li>
          <li>Use spaced repetition rounds to revisit words before you forget them</li>
          <li>Study pronunciation and usage with YouGlish examples for each word</li>
        </ul>
      </section>
    </div>
  );
}
