import { EscrowListPage } from "../../src/product/EscrowListPage";

export default async function EscrowsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;

  return <EscrowListPage createdEscrowId={created ?? null} />;
}
