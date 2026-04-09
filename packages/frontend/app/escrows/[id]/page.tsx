import { notFound } from "next/navigation";

import { EscrowDetailProduct } from "../../../src/product/EscrowDetailProduct";
import { getEscrowById } from "../../../src/product/mock-data";

export default async function EscrowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const escrow = getEscrowById(id);

  if (!escrow) {
    notFound();
  }

  return <EscrowDetailProduct escrow={escrow} />;
}
