import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { product } from "@/lib/product";
import "./globals.css";

// The type is halo-mac.com's: the Apple system font where there is one, Inter everywhere else.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(product.siteUrl),
  title: `${product.name}: ${product.tagline}`,
  description: `Answer your coding agents, see when things finish and control your music from an island at the top of your Windows screen. ${product.price} once.`,
  openGraph: { type: "website", siteName: product.name, url: "/" },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
