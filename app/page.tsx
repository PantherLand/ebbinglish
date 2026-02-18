import Link from "next/link";
import { auth, signIn } from "@/src/auth";

export default async function Home() {
  const session = await auth();

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold">Ebbinglish</h1>
        <p className="text-gray-600">
          Learn vocabulary with an Ebbinghaus-style review schedule and YouGlish video
          immersion.
        </p>
      </header>

      <section className="rounded-xl border p-5">
        {session?.user ? (
          <div className="space-y-3">
            <div className="text-sm text-gray-600">Signed in as</div>
            <div className="font-medium">{session.user.email ?? session.user.name}</div>
            <Link className="inline-block rounded-md bg-black px-4 py-2 text-white" href="/app/today">
              Go to Today
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-medium">Sign in to start</div>
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/app/today" });
              }}
            >
              <button className="rounded-md bg-black px-4 py-2 text-white">
                Continue with Google
              </button>
            </form>
            <p className="text-sm text-gray-600">
              (You’ll need GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET configured.)
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2 text-sm text-gray-700">
        <div className="font-medium">MVP scope</div>
        <ul className="list-disc pl-5">
          <li>Word library (manual + CSV import)</li>
          <li>Fixed-stage spaced repetition (Ebbinghaus)</li>
          <li>YouGlish link/iframe per word</li>
        </ul>
      </section>
    </div>
  );
}
