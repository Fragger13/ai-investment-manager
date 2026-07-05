import type { MetadataRoute } from "next";

const SITE_URL = "https://www.askpapa.in";

// Let search engines crawl the public site and point them at the sitemap. This
// (plus the richer metadata in layout.tsx) is what lets Google replace the stale
// parking-page snippet once it re-crawls askpapa.in.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
