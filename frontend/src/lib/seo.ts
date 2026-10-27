import { useEffect } from "react";
import { BRAND_NAME } from "./brand";

// Search engines and link previews: each page sets its own title, description, canonical address
// and preview tags. Private pages (dashboard, account, sign-in, payment) ask not to be indexed.

const SITE = ((import.meta.env.VITE_SITE_URL as string | undefined) || "").trim().replace(/\/+$/, "");
const DEFAULT_IMAGE = "/og-image.jpg";

interface Seo {
  title: string;
  description?: string;
  /** Address of the page without the domain ("/projects"); the canonical link and og:url use it */
  path?: string;
  image?: string;
  /** Private or temporary page: not in search results */
  noindex?: boolean;
}

function setMeta(attr: "name" | "property", key: string, content: string | null) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content === null) {
    tag?.remove();
    return;
  }
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

function setCanonical(href: string | null) {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (href === null) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}

const absolute = (path: string) => `${SITE || window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;

export function useSeo({ title, description, path, image, noindex }: Seo) {
  useEffect(() => {
    const full = title.includes(BRAND_NAME) ? title : `${title} · ${BRAND_NAME}`;
    document.title = full;
    if (description) {
      setMeta("name", "description", description);
      setMeta("property", "og:description", description);
      setMeta("name", "twitter:description", description);
    }
    setMeta("property", "og:title", full);
    setMeta("name", "twitter:title", full);
    setMeta("property", "og:image", absolute(image || DEFAULT_IMAGE));
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    const url = path !== undefined && !noindex ? absolute(path) : null;
    setCanonical(url);
    setMeta("property", "og:url", url);
  }, [title, description, path, image, noindex]);
}
