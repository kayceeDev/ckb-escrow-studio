import type { Metadata } from "next";
import Link from "next/link";

import { MobileNav } from "../src/components/MobileNav";
import { ProductNavbarWallet } from "../src/components/ProductNavbarWallet";
import { Badge, Button } from "../src/components/ui";
import { ProductWorkspaceProvider } from "../src/product/ProductWorkspaceContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "CKB Escrow",
  description:
    "Standalone decentralized escrow app for known buyer, seller, and arbitrator parties on CKB.",
};

const navItems = [
  { href: "/", label: "Home" },
  { href: "/escrows", label: "Escrows" },
  { href: "/escrows/create", label: "Create" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ProductWorkspaceProvider>
          <div className="relative flex min-h-screen flex-col overflow-x-hidden">
            <div className="absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top_left,rgba(30,122,70,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(133,181,146,0.12),transparent_30%)]" />

            <header className="sticky top-0 z-30 border-b border-border/80 bg-background/86 backdrop-blur-xl">
              <div className="relative mx-auto flex min-h-16 w-full max-w-[1280px] items-center justify-between gap-3 px-4 py-3 md:px-6">
                <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
                  <Badge variant="success" className="whitespace-nowrap">CKB Escrow</Badge>
                  <span className="hidden max-w-[13rem] truncate text-sm text-muted-foreground xl:inline">
                    Standalone decentralized escrow
                  </span>
                </Link>

                <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
                  <nav className="flex items-center gap-1 rounded-full border border-border/70 bg-white/60 p-1 shadow-sm backdrop-blur">
                    {navItems.map((item) => (
                      <Button key={item.href} asChild variant="ghost" size="sm">
                        <Link href={item.href}>{item.label}</Link>
                      </Button>
                    ))}
                  </nav>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <ProductNavbarWallet />
                  <MobileNav items={navItems} />
                </div>
              </div>
            </header>

            <main className="flex-1">{children}</main>

            <footer className="mt-12 border-t border-border/80 bg-background/82 backdrop-blur">
              <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 px-4 py-7 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-6">
                <p>
                  A calmer way to hold funds until work is delivered and accepted.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <Link className="hover:text-foreground" href="/escrows">
                    Escrow ledger
                  </Link>
                  <Link className="hover:text-foreground" href="/studio">
                    Studio
                  </Link>
                </div>
              </div>
            </footer>
          </div>
        </ProductWorkspaceProvider>
      </body>
    </html>
  );
}
