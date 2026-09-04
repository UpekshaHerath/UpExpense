import { LoanDetail } from "@/components/loans/loan-detail";

export default async function LoanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Keyed by id so navigating between loans remounts with fresh state.
  return <LoanDetail key={id} id={id} />;
}
