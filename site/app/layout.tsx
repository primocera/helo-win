import type { Metadata } from "next";
import { product } from "@/lib/product";
import "./globals.css";

export const metadata: Metadata = {
  title: `${product.name}: ${product.tagline}`,
  description: `Answer your coding agents, see when things finish and control your music from an island at the top of your Windows screen. ${product.price} once.`,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
