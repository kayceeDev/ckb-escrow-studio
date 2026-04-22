import type { Metadata } from "next";
import Link from "next/link";

import { MobileNav } from "../src/components/MobileNav";
import { Badge, Button } from "../src/components/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "CKB Escrow",
  description:
    "Standalone decentralized escrow app for known buyer, seller, and arbitrator parties on CKB.",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/escrows/create", label: "Create" },
  { href: "/escrows/escrow-website-redesign", label: "Example Escrow" },
  { href: "/studio", label: "Studio" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="relative overflow-x-hidden">
          <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(30,122,70,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(133,181,146,0.12),transparent_30%)]" />

          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur">
            <div className="relative mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4 md:px-6">
              <div className="flex items-center gap-3">
                <Badge variant="success">CKB Escrow</Badge>
                <span className="hidden text-sm text-muted-foreground md:inline">
                  standalone decentralized escrow
                </span>
              </div>
              <nav className="hidden flex-wrap items-center gap-2 md:flex">
                {navItems.map((item) => (
                  <Button key={item.href} asChild variant="ghost" size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </nav>
              <MobileNav items={navItems} />
            </div>
          </header>

          <main>{children}</main>

          <footer className="border-t border-border/80 bg-background/70">
            <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-6 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
              <p>
                Buyer-first escrow experience on CKB, with studio tools kept available for deployment and protocol operations.
              </p>
              <div className="flex items-center gap-3">
                <Link className="hover:text-foreground" href="/escrows/create">
                  Create Escrow
                </Link>
                <Link className="hover:text-foreground" href="/studio">
                  Studio
                </Link>
              </div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
