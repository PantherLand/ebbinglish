import Link from "next/link";
import { auth, signIn } from "@/src/auth";
import EbbinglishBrand from "@/app/components/ebbinglish-brand";

export default async function Home() {
  const session = await auth();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <EbbinglishBrand href="/" />
        <p className="max-w-2xl text-slate-600">
          Learn vocabulary with a round-driven encounter/polish workflow and YouGlish video immersion.
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
        <div className="font-semibold text-slate-900">MVP scope</div>
        <ul className="list-disc pl-5">
          <li>Word library (manual + CSV import)</li>
          <li>Round-based first-impression mastery model</li>
          <li>YouGlish link/iframe per word</li>
        </ul>
      </section>
    </div>
  );
}
