import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://baseplay.games";
const farcasterMiniAppEmbed = JSON.stringify({
  version: "1",
  imageUrl: `${appUrl}/brand/farcaster-embed.png`,
  button: {
    title: "Play BasePlay",
    action: {
      type: "launch_miniapp",
      name: "BasePlay",
      url: appUrl,
      splashImageUrl: `${appUrl}/brand/farcaster-splash.png`,
      splashBackgroundColor: "#0B5CFF"
    }
  }
});
const farcasterFrameEmbed = JSON.stringify({
  version: "1",
  imageUrl: `${appUrl}/brand/farcaster-embed.png`,
  button: {
    title: "Play BasePlay",
    action: {
      type: "launch_frame",
      name: "BasePlay",
      url: appUrl,
      splashImageUrl: `${appUrl}/brand/farcaster-splash.png`,
      splashBackgroundColor: "#0B5CFF"
    }
  }
});

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"]
});

const appDescription =
  "Provably fair mini games on Base with on-chain settlement, Chainlink VRF randomness, instant payouts, XP, quests, referrals, and weekly plus all-time leaderboards.";
const socialPreviewImage = {
  url: "/brand/farcaster-hero.png",
  width: 1200,
  height: 630,
  alt: "BasePlay - Play. Compete. Win on Base."
};

export const metadata: Metadata = {
  applicationName: "BasePlay",
  title: { default: "BasePlay", template: "%s - BasePlay" },
  description: appDescription,
  metadataBase: new URL(appUrl),
  icons: {
    icon: "/brand/baseplay-mark-transparent.png",
    apple: "/brand/baseplay-mark-transparent.png"
  },
  openGraph: {
    title: "BasePlay - Mini Onchain Games",
    description: appDescription,
    images: [socialPreviewImage]
  },
  twitter: {
    card: "summary_large_image",
    title: "BasePlay - Mini Onchain Games",
    description: appDescription,
    images: [socialPreviewImage],
    creator: "@BasePlayGames"
  },
  other: {
    "fc:miniapp": farcasterMiniAppEmbed,
    "fc:frame": farcasterFrameEmbed,
    "base:app_id": "69f93e9942d4fe010f1c28e7"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <AppProviders>
          <div className="app-shell flex min-h-screen flex-col">
            <Navbar />
            <div className="flex-1">{children}</div>
            <Footer />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
