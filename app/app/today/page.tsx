import { auth } from "@/src/auth";

export default async function TodayPage() {
  const session = await auth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Today</h1>
      <p className="text-sm text-gray-600">
        Ebbinghaus review queue + YouGlish. (MVP scaffold)
      </p>

      <div className="rounded-lg border p-4">
        <div className="text-sm text-gray-600">Signed in as</div>
        <div className="font-medium">{session?.user?.email ?? "—"}</div>
      </div>

      <div className="rounded-lg border p-4">
        <div className="font-medium">Next steps</div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-700">
          <li>Create DB + run Prisma migrate</li>
          <li>Word CRUD (add/import/search)</li>
          <li>Review scheduler (fixed stages) + review logging</li>
          <li>YouGlish integration (link/iframe) per word</li>
        </ul>
      </div>
    </div>
  );
}
