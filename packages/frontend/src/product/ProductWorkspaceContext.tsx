"use client";

import { createContext, useContext } from "react";

import { useProductWorkspace, type ProductWorkspaceValue } from "./useProductWorkspace";

const ProductWorkspaceContext = createContext<ProductWorkspaceValue | null>(null);

export function ProductWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const workspace = useProductWorkspace();
  return (
    <ProductWorkspaceContext.Provider value={workspace}>
      {children}
    </ProductWorkspaceContext.Provider>
  );
}

export function useProductWorkspaceContext(): ProductWorkspaceValue {
  const value = useContext(ProductWorkspaceContext);
  if (!value) {
    throw new Error("useProductWorkspaceContext must be used inside ProductWorkspaceProvider");
  }
  return value;
}
