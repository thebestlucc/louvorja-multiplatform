import type { Metadata } from "next";
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
        {children}
      </body>
    </html>
  );
}
