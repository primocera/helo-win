import type { MetadataRoute } from "next";
import { product } from "@/lib/product";

// The date the pages last changed. Update it when the copy changes.
const LAST_CHANGED = "2026-11-16";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: product.siteUrl, lastModified: LAST_CHANGED, changeFrequency: "weekly", priority: 1 },
    { url: `${product.siteUrl}/privacy`, lastModified: LAST_CHANGED, changeFrequency: "monthly", priority: 0.3 },
  ];
}
