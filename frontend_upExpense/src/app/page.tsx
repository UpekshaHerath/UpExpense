import { redirect } from "next/navigation";
import { todayISO } from "@/lib/format";

// Must resolve per-request — a static build would freeze "today".
export const dynamic = "force-dynamic";

export default function Home() {
  // Proxy guarantees an authenticated session here.
  redirect(`/day/${todayISO()}`);
}
