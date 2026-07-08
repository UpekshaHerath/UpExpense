import { redirect } from "next/navigation";
import { isValidISODate, todayISO } from "@/lib/format";
import { DayView } from "@/components/day-view";

export default async function DayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  if (!isValidISODate(date)) {
    redirect(`/day/${todayISO()}`);
  }

  // Keyed by date: navigation remounts the view with fresh state.
  return <DayView key={date} date={date} />;
}
