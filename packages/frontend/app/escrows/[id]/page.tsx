import { EscrowDetailProduct } from "../../../src/product/EscrowDetailProduct";

export default async function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <EscrowDetailProduct escrowId={id} />;
}
