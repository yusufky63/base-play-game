"use client";

import { Share2 } from "lucide-react";
import { BASEPLAY_SOCIAL_LINKS } from "@/lib/socialLinks";

const DEFAULT_TEXT = "BasePlay: on-chain, fair, verifiable mini games on Base.";

export function SharePanel({ compact = false, text = DEFAULT_TEXT, path }: { compact?: boolean; text?: string; path?: string }) {
  const origin = typeof window === "undefined" ? "https://baseplay.app" : window.location.origin;
  const url = path ? `${origin}${path}` : origin;
  const shareUrl = encodeURIComponent(url);
  const shareText = encodeURIComponent(text);

  async function nativeShare() {
    if (navigator.share) {
      await navigator.share({ title: "BasePlay", text, url });
      return;
    }
    await navigator.clipboard?.writeText(url);
  }

  return (
    <div className={compact ? "share-strip share-strip-compact" : "share-strip"}>
      <button type="button" onClick={() => void nativeShare()} className="share-action" aria-label="Share BasePlay">
        <Share2 size={14} />
        {!compact && "Share"}
      </button>
      <a className="share-action" href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} target="_blank" rel="noopener noreferrer">
        <XIcon />
        {!compact && "X"}
      </a>
      <a className="share-action" href={`https://farcaster.xyz/~/compose?text=${shareText}%20${shareUrl}`} target="_blank" rel="noopener noreferrer">
        <FarcasterIcon />
        {!compact && "Farcaster"}
      </a>
      <a className="share-action" href={BASEPLAY_SOCIAL_LINKS.baseApp} target="_blank" rel="noopener noreferrer">
        <BaseAppIcon />
        {!compact && "Base App"}
      </a>
    </div>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M13.7 10.6 20.4 3h-1.6L13 9.6 8.4 3H3l7 10-7 8h1.6l6.1-7 4.9 7H21l-7.3-10.4Zm-2.2 2.5-.7-1L5.2 4.2h2.4l4.5 6.4.7 1 5.9 8.3h-2.4l-4.8-6.8Z" />
    </svg>
  );
}

function FarcasterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="none">
      <path d="M6.5 4.5h11v15h-2.1v-6.8c0-2-1.2-3.3-3.4-3.3s-3.4 1.3-3.4 3.3v6.8H6.5v-15Z" fill="currentColor" />
      <path d="M4.5 8h2v11.5h-2V8Zm13 0h2v11.5h-2V8Z" fill="currentColor" opacity=".72" />
    </svg>
  );
}

function BaseAppIcon() {
  return (
    <img src="/brand/base-app-icon.png" alt="" aria-hidden="true" className="h-3.5 w-3.5 rounded-[3px]" />
  );
}
