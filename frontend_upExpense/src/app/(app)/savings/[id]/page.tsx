import { SavingDetail } from "@/components/savings/saving-detail";

export default async function SavingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Keyed by id so navigating between pots remounts with fresh state.
  return <SavingDetail key={id} id={id} />;
}
