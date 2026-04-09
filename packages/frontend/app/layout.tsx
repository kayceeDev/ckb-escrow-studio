import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CKB Escrow",
  description: "Standalone decentralized escrow app for known buyer, seller, and arbitrator parties on CKB.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
