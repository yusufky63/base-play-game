// Embed mode: a partner site hosts a BasePlay game page in a frame through the Farcaster Mini App host protocol
// and hands BasePlay its wallet. BasePlay then drops its own chrome (header, footer, back link), follows the host's
// theme, connects to the host's wallet without a second prompt, and opens its other pages in a new tab, so the frame
// stays on the game. The mode needs both the `embed` parameter and a mini app host; a plain visit is unchanged.

const EMBED_HOSTS = ["zkcodex"] as const;
const EMBED_STORAGE_KEY = "baseplay:embed";

export type EmbedHost = (typeof EMBED_HOSTS)[number];
export type EmbedTheme = "light" | "dark";
export type EmbedRequest = { host: EmbedHost; theme: EmbedTheme | null };

/** The canonical site, for links an embedded page opens in a new tab. */
export const BASEPLAY_SITE_URL = "https://baseplay.games";

const isEmbedHost = (value: unknown): value is EmbedHost => EMBED_HOSTS.includes(value as EmbedHost);
const asTheme = (value: unknown): EmbedTheme | null => (value === "light" || value === "dark" ? value : null);

/**
 * The embed request of this frame: `?embed=<host>&theme=<light|dark>` on the first page, remembered for the tab so a
 * reload or a navigation inside the frame keeps the mode. Null outside a frame.
 */
export function readEmbedRequest(): EmbedRequest | null {
  if (typeof window === "undefined" || window === window.parent) return null;
  const params = new URLSearchParams(window.location.search);
  const host = params.get("embed");
  if (isEmbedHost(host)) {
    const request = { host, theme: asTheme(params.get("theme")) };
    try {
      window.sessionStorage.setItem(EMBED_STORAGE_KEY, JSON.stringify(request));
    } catch {}
    return request;
  }
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(EMBED_STORAGE_KEY) || "null") as Partial<EmbedRequest> | null;
    return stored && isEmbedHost(stored.host) ? { host: stored.host, theme: asTheme(stored.theme) } : null;
  } catch {
    return null;
  }
}

/** Marks the document as embedded: globals.css hides the app chrome under `html[data-embed]`. */
export function applyEmbedMode(host: EmbedHost) {
  document.documentElement.dataset.embed = host;
}

/**
 * Where a click inside an embedded page should go instead: the full URL to open in a new tab for a link to another
 * BasePlay page, or null when the link is left alone (the same page, such as a PvP room link, or an external link
 * that already opens its own tab). The host shows which game the frame holds, so the frame never leaves that page.
 */
export function embedNewTabUrl(anchor: HTMLAnchorElement, location: Location): string | null {
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, location.href);
  } catch {
    return null;
  }
  if (url.origin !== location.origin || url.pathname === location.pathname) return null;
  return `${BASEPLAY_SITE_URL}${url.pathname}${url.search}${url.hash}`;
}
