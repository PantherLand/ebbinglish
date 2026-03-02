import type { Metadata } from "next";
import type { ReactNode } from "react";
import GlobalToastViewport from "@/app/components/global-toast-viewport";
import AppShellNav from "@/app/components/app-shell-nav";
import EbbinglishBrand from "@/app/components/ebbinglish-brand";
import { auth, signOut } from "@/src/auth";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 text-slate-900">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white md:flex">
        <div className="border-b border-slate-100 px-6 py-5">
          <EbbinglishBrand sidebar />
        </div>

        <AppShellNav />

        <div className="mt-auto border-t border-slate-100 p-4">
          {session?.user?.email ? (
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Signed in as</div>
              <div className="mt-1 truncate text-sm font-medium text-slate-900">{session.user.email}</div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
                className="mt-3"
              >
                <button
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Not signed in</div>
          )}
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <EbbinglishBrand compact />
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl px-20 py-4 pb-20 md:px-8 md:py-8 md:pb-8">{children}</div>
        </main>
      </div>

      <AppShellNav mobile />
      <GlobalToastViewport />
    </div>
  );
}
