import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { BASEPLAY_SOCIAL_LINKS } from "@/lib/socialLinks";

const socialLinks = [
  { href: BASEPLAY_SOCIAL_LINKS.x, label: "BasePlayGames on X", icon: <XIcon /> },
  { href: BASEPLAY_SOCIAL_LINKS.farcaster, label: "BasePlayGames on Farcaster", icon: <FarcasterIcon /> },
  { href: BASEPLAY_SOCIAL_LINKS.baseApp, label: "BasePlayGames on Base App", icon: <BaseAppIcon /> }
];

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-9 text-sm text-[var(--text-2)] md:grid-cols-[1.35fr_.9fr]">
        <div>
          <div className="mb-3 flex items-center gap-2.5 text-[var(--text-1)]">
            <span className="brand-image-mark">
              <Logo size={34} />
            </span>
            <span className="display-heading text-lg font-bold">BasePlay</span>
          </div>
          <p className="max-w-sm text-sm leading-6">Provably fair mini games on Base with contract-settled results and VRF-backed randomness.</p>
          <div className="mt-4 flex items-center gap-2">
            {socialLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                className="footer-social"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>

        <nav className="footer-nav">
          <h2 className="footer-section-title">Project</h2>
          <div className="footer-link-grid">
            <FooterLink href="/docs">Docs</FooterLink>
            <FooterLink href="/updates">Updates</FooterLink>
            <FooterLink href="/live-feed">Live Feed</FooterLink>
            <FooterLink href="/leaderboard">Leaderboard</FooterLink>
            <FooterLink href="/profile">Profile</FooterLink>
          </div>
        </nav>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="footer-link">
      {children}
    </Link>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M13.7 10.6 20.4 3h-1.6L13 9.6 8.4 3H3l7 10-7 8h1.6l6.1-7 4.9 7H21l-7.3-10.4Zm-2.2 2.5-.7-1L5.2 4.2h2.4l4.5 6.4.7 1 5.9 8.3h-2.4l-4.8-6.8Z" />
    </svg>
  );
}

function FarcasterIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none">
      <path d="M6.5 4.5h11v15h-2.1v-6.8c0-2-1.2-3.3-3.4-3.3s-3.4 1.3-3.4 3.3v6.8H6.5v-15Z" fill="currentColor" />
      <path d="M4.5 8h2v11.5h-2V8Zm13 0h2v11.5h-2V8Z" fill="currentColor" opacity=".72" />
    </svg>
  );
}

function BaseAppIcon() {
  return <img src="/brand/base-app-icon.png" alt="" aria-hidden="true" className="h-4 w-4 rounded-[4px]" />;
}
