import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "LouvorJA CDN Admin",
  description: "Admin panel for managing LouvorJA CDN media packs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="border-b bg-background px-6 py-3 flex items-center gap-6 text-sm">
          <span className="font-semibold text-foreground">LouvorJA CDN Admin</span>
          <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
            Packs
          </Link>
          <Link href="/db" className="text-muted-foreground hover:text-foreground transition-colors">
            Database
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
