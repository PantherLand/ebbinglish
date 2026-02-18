import type { ReactNode } from "react";
import Link from "next/link";
import { auth, signOut } from "@/src/auth";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="min-h-dvh">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/app/today" className="font-semibold">
              Ebbinglish
            </Link>
            <nav className="flex gap-3 text-sm text-gray-600">
              <Link href="/app/today">Today</Link>
              <Link href="/app/library">Library</Link>
              <Link href="/app/stats">Stats</Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-sm">
            {session?.user?.email ? (
              <>
                <span className="text-gray-600">{session.user.email}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="rounded-md border px-3 py-1">Sign out</button>
                </form>
              </>
            ) : (
              <span className="text-gray-600">Not signed in</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
