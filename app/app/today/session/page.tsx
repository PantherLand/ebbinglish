import { redirect } from "next/navigation";

export default function LegacyTodaySessionRedirect() {
  redirect("/app/today");
}
