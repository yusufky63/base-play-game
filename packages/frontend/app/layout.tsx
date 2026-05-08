import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { AppProviders } from "@/components/providers/AppProviders";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://baseplay.games";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"]
});

export const metadata: Metadata = {
  applicationName: "BasePlay",
  title: { default: "BasePlay", template: "%s - BasePlay" },
  description: "Mini onchain games on Base L2. Provably fair, instant payouts.",
  metadataBase: new URL(appUrl),
  icons: {
    icon: "/brand/baseplay-mark-transparent.png",
    apple: "/brand/baseplay-mark-transparent.png"
  },
  openGraph: {
    title: "BasePlay - Mini Onchain Games",
    description: "Provably fair games on Base L2. Small on-chain wagers with XP, quests, and badges.",
    images: ["/brand/baseplay-logo-full.png"]
  },
  twitter: {
    card: "summary_large_image",
    title: "BasePlay - Mini Onchain Games",
    description: "Provably fair games on Base L2. Small on-chain wagers with XP, quests, and badges.",
    images: ["/brand/baseplay-logo-full.png"],
    creator: "@BasePlayGames"
  },
  other: {
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
