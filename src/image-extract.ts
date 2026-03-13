/** Extract image URLs from raw HTML returned by web_fetch. */

const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
const OG_IMAGE_ALT_RE =
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi;
const DATA_SRC_RE = /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi;

/** Heuristic: skip tiny icons, tracking pixels, and common non-content images. */
function isLikelyContentImage(url: string): boolean {
  const lower = url.toLowerCase();
  // Skip base64 data URIs (usually tiny icons)
  if (lower.startsWith("data:")) return false;
  // Skip common icon/tracking patterns
  const skipPatterns = [
    /favicon/,
    /icon[_-]?\d/,
    /logo[_-]?\d/,
    /pixel/,
    /tracking/,
    /badge/,
    /avatar/,
    /emoji/,
    /\.svg$/,
    /1x1/,
    /spacer/,
    /spinner/,
    /loading/,
  ];
  return !skipPatterns.some((p) => p.test(lower));
}

export type ExtractedImage = {
  url: string;
  source: "img-src" | "data-src" | "og:image";
  alt: string;
};

/**
 * Extract meaningful image URLs from HTML.
 * Returns up to `limit` images, prioritizing og:image (hero/main image) first,
 * then regular img tags in document order.
 */
export function extractImagesFromHtml(
  html: string,
  opts?: { limit?: number; baseUrl?: string },
): ExtractedImage[] {
  const limit = opts?.limit ?? 10;
  const seen = new Set<string>();
  const results: ExtractedImage[] = [];

  function resolve(raw: string): string {
    if (!opts?.baseUrl) return raw;
    try {
      return new URL(raw, opts.baseUrl).href;
    } catch {
      return raw;
    }
  }

  function addImage(url: string, source: ExtractedImage["source"], alt: string) {
    const resolved = resolve(url.trim());
    if (seen.has(resolved) || !isLikelyContentImage(resolved)) return;
    seen.add(resolved);
    results.push({ url: resolved, source, alt });
  }

  // Extract alt text from an img tag string
  function extractAlt(imgTag: string): string {
    const altMatch = /alt=["']([^"']*)["']/i.exec(imgTag);
    return altMatch?.[1] ?? "";
  }

  // 1. og:image — typically the hero/main image of the page
  for (const re of [OG_IMAGE_RE, OG_IMAGE_ALT_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      addImage(m[1], "og:image", "");
    }
  }

  // 2. Regular <img src="...">
  IMG_SRC_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = IMG_SRC_RE.exec(html)) !== null) {
    addImage(m[1], "img-src", extractAlt(m[0]));
  }

  // 3. Lazy-loaded images (data-src) — common on Chinese platforms
  DATA_SRC_RE.lastIndex = 0;
  while ((m = DATA_SRC_RE.exec(html)) !== null) {
    addImage(m[1], "data-src", extractAlt(m[0]));
  }

  return results.slice(0, limit);
}
