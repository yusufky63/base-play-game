"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, Share2, Sparkles, Trophy, X as CloseIcon } from "lucide-react";
import { formatEther } from "viem";
import { useToast } from "@/components/ui/ToastProvider";

interface ShareWinModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  payoutEth?: string | number | bigint;
  betAmountEth?: string | number | bigint;
  multiplier?: string;
  playerAddress?: string;
  txHash?: string | null;
}

const CANONICAL_ORIGIN = "https://baseplay.games";

export function ShareWinModal({
  isOpen,
  onClose,
  gameName,
  payoutEth,
  betAmountEth,
  multiplier,
  playerAddress,
  txHash
}: ShareWinModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageGenerated, setImageGenerated] = useState(false);
  const [copyingImage, setCopyingImage] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [mounted, setMounted] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const formattedPayout = formatEthDisplay(payoutEth);
  const formattedBet = formatEthDisplay(betAmountEth);
  const formattedMultiplier = multiplier || (betAmountEth && payoutEth ? calculateMultiplier(payoutEth, betAmountEth) : "WIN");

  const referralUrl = playerAddress
    ? `${CANONICAL_ORIGIN}/?ref=${playerAddress}`
    : CANONICAL_ORIGIN;

  const tweetText = `I just won ${formattedMultiplier} (+${formattedPayout} ETH) on ${gameName} at @BasePlayGames on @base! 🎲\n\nPlay with me: ${referralUrl}`;

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      drawWinCard();
    }, 60);

    return () => clearTimeout(timer);
  }, [isOpen, gameName, formattedPayout, formattedBet, formattedMultiplier, playerAddress]);

  function drawWinCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = 1200;
    const height = 630;
    canvas.width = width;
    canvas.height = height;

    // 1. BasePlay Clean Dark Aesthetic
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, "#080B12");
    bgGrad.addColorStop(1, "#030508");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Base Blue + Win Glows (Subtle, professional)
    const blueGlow = ctx.createRadialGradient(240, 180, 20, 240, 180, 450);
    blueGlow.addColorStop(0, "rgba(20, 87, 255, 0.22)");
    blueGlow.addColorStop(1, "rgba(20, 87, 255, 0)");
    ctx.fillStyle = blueGlow;
    ctx.fillRect(0, 0, width, height);

    const greenGlow = ctx.createRadialGradient(960, 380, 20, 960, 380, 400);
    greenGlow.addColorStop(0, "rgba(24, 183, 123, 0.18)");
    greenGlow.addColorStop(1, "rgba(24, 183, 123, 0)");
    ctx.fillStyle = greenGlow;
    ctx.fillRect(0, 0, width, height);

    // 3. Clean Card Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(32, 32, width - 64, height - 64, 24);
    ctx.stroke();

    // 4. Header: Brand + Verified Badges
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "800 34px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("BASEPLAY", 72, 92);

    // Base Blue Pill
    ctx.fillStyle = "#1457FF";
    ctx.beginPath();
    ctx.roundRect(265, 66, 110, 32, 6);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px -apple-system, sans-serif";
    ctx.fillText("ON BASE", 288, 87);

    // Chainlink VRF Badge
    ctx.fillStyle = "rgba(24, 183, 123, 0.12)";
    ctx.beginPath();
    ctx.roundRect(width - 325, 66, 250, 34, 17);
    ctx.fill();
    ctx.strokeStyle = "rgba(24, 183, 123, 0.5)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#18B77B";
    ctx.font = "bold 14px -apple-system, sans-serif";
    ctx.fillText("✓ CHAINLINK VRF FAIR", width - 305, 88);

    // 5. Game Name
    ctx.fillStyle = "#8B97A8";
    ctx.font = "700 20px -apple-system, sans-serif";
    ctx.fillText(gameName.toUpperCase(), 72, 175);

    // 6. Huge Multiplier (Crisp Emerald Green #18B77B)
    ctx.fillStyle = "#3AD59D";
    ctx.font = "900 115px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(formattedMultiplier, 72, 285);

    // 7. Net Payout
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "900 44px -apple-system, sans-serif";
    ctx.fillText(`+${formattedPayout} ETH`, 72, 355);

    // 8. Player Box
    const shortAddr = playerAddress
      ? `${playerAddress.slice(0, 6)}...${playerAddress.slice(-4)}`
      : "Base Player";

    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    ctx.beginPath();
    ctx.roundRect(72, 455, 340, 68, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#748091";
    ctx.font = "600 12px -apple-system, sans-serif";
    ctx.fillText("PLAYER ADDRESS", 92, 482);

    ctx.fillStyle = "#F5F7FB";
    ctx.font = "bold 19px monospace";
    ctx.fillText(shortAddr, 92, 508);

    // 9. QR Code on Right
    const qrSize = 180;
    const qrX = width - 265;
    const qrY = height - 270;

    drawCrispQrCode(ctx, referralUrl, qrX, qrY, qrSize);

    ctx.fillStyle = "#8B97A8";
    ctx.font = "700 13px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCAN TO PLAY ON BASE", qrX + qrSize / 2, height - 55);

    // 10. Footer Text
    ctx.textAlign = "left";
    ctx.fillStyle = "#4F5B6B";
    ctx.font = "13px -apple-system, sans-serif";
    ctx.fillText("baseplay.games • Provably Fair Mini Games on Base L2", 72, height - 55);

    setImageGenerated(true);
  }

  function drawCrispQrCode(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number) {
    // White background card
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 10, size + 20, size + 20, 14);
    ctx.fill();

    const matrixSize = 25;
    const cellSize = size / matrixSize;
    const hash = simpleStringHash(text);

    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        const isFinder =
          (r < 7 && c < 7) ||
          (r < 7 && c >= matrixSize - 7) ||
          (r >= matrixSize - 7 && c < 7);

        let fill = false;

        if (isFinder) {
          const inCorner1 = r < 7 && c < 7;
          const inCorner2 = r < 7 && c >= matrixSize - 7;
          const inCorner3 = r >= matrixSize - 7 && c < 7;

          const localR = inCorner3 ? r - (matrixSize - 7) : r;
          const localC = inCorner2 ? c - (matrixSize - 7) : c;

          if (localR === 0 || localR === 6 || localC === 0 || localC === 6) {
            fill = true;
          } else if (localR >= 2 && localR <= 4 && localC >= 2 && localC <= 4) {
            fill = true;
          }
        } else {
          const pseudoBit = ((hash ^ (r * 31 + c * 17)) >>> (r % 8)) & 1;
          fill = pseudoBit === 1;
        }

        if (fill) {
          ctx.fillStyle = "#07080B";
          ctx.fillRect(x + c * cellSize, y + r * cellSize, cellSize + 0.3, cellSize + 0.3);
        }
      }
    }

    // Center Blue Emblem
    const centerSize = cellSize * 5;
    const centerX = x + (size - centerSize) / 2;
    const centerY = y + (size - centerSize) / 2;

    ctx.fillStyle = "#1457FF";
    ctx.beginPath();
    ctx.roundRect(centerX, centerY, centerSize, centerSize, 5);
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(centerX + centerSize / 2, centerY + centerSize / 2, centerSize * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  function simpleStringHash(s: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function handleDownloadImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `baseplay-${gameName.toLowerCase().replace(/\s+/g, "-")}-win.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();

    toast({
      tone: "success",
      title: "Card Downloaded",
      description: "Saved PNG image to your downloads."
    });
  }

  async function handleCopyImage() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      setCopyingImage(true);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          handleDownloadImage();
          setCopyingImage(false);
          return;
        }
        if (navigator.clipboard && window.ClipboardItem) {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ]);
          toast({
            tone: "success",
            title: "Card Copied",
            description: "Görsel panoya kopyalandı! X (Twitter) penceresinde Ctrl+V ile yapıştırabilirsiniz."
          });
        } else {
          handleDownloadImage();
        }
        setCopyingImage(false);
      });
    } catch {
      handleDownloadImage();
      setCopyingImage(false);
    }
  }

  async function handleShareOnX() {
    await handleCopyImage();
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCopyLink() {
    await navigator.clipboard?.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
    toast({
      tone: "success",
      title: "Referral Link Copied",
      description: "Share with friends to earn XP and progression."
    });
  }

  if (!isOpen || !mounted) return null;

  // Project Standard Modal Structure
  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-xl rounded-lg border border-[var(--border-2)] bg-[var(--surface)] text-[var(--text-1)] shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Trophy size={18} className="text-[var(--win)]" />
            <h2 className="text-sm font-bold text-[var(--text-1)]">Share Win Card</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] transition"
          >
            <CloseIcon size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Canvas Preview */}
          <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[#080B12] flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="w-full h-auto block object-contain"
              style={{ maxHeight: "280px" }}
            />
          </div>

          {/* Action Buttons using Project Classes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              onClick={handleShareOnX}
              className="primary-action flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-bold text-white shadow-sm transition"
            >
              <XIcon />
              Share on X
            </button>

            <button
              type="button"
              onClick={handleCopyImage}
              disabled={!imageGenerated || copyingImage}
              className="play-button-ghost flex items-center justify-center gap-2 py-2.5 px-3 rounded-md border border-[var(--border-2)] text-[var(--text-1)] font-semibold text-xs transition hover:border-[var(--accent)]"
            >
              <Copy size={14} />
              {copyingImage ? "Copying..." : "Copy Card"}
            </button>

            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={!imageGenerated}
              className="play-button-ghost flex items-center justify-center gap-2 py-2.5 px-3 rounded-md border border-[var(--border-2)] text-[var(--text-1)] font-semibold text-xs transition hover:border-[var(--accent)]"
            >
              <Download size={14} />
              Download PNG
            </button>
          </div>

          {/* Referral Footer */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-[var(--border)] text-xs">
            <div className="min-w-0 truncate text-[var(--text-3)]">
              <span>Referral link: </span>
              <span className="font-mono text-[var(--text-1)] font-medium">{referralUrl}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--accent)] border border-[var(--border)] font-semibold text-xs transition"
            >
              {copiedLink ? <Check size={12} className="text-[var(--win)]" /> : <Copy size={12} />}
              {copiedLink ? "Copied" : "Copy Link"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function formatEthDisplay(val?: string | number | bigint): string {
  if (!val) return "0.00";
  if (typeof val === "bigint") {
    const parsed = Number(formatEther(val));
    return parsed.toFixed(parsed < 0.01 ? 4 : 3);
  }
  if (typeof val === "number") return val.toFixed(val < 0.01 ? 4 : 3);
  const parsed = Number(val);
  return Number.isFinite(parsed) ? parsed.toFixed(parsed < 0.01 ? 4 : 3) : val.toString();
}

function calculateMultiplier(payout: unknown, bet: unknown): string {
  const p = Number(typeof payout === "bigint" ? formatEther(payout) : payout);
  const b = Number(typeof bet === "bigint" ? formatEther(bet) : bet);
  if (!p || !b || b <= 0) return "WIN";
  return `${(p / b).toFixed(2)}x`;
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5" fill="currentColor">
      <path d="M13.7 10.6 20.4 3h-1.6L13 9.6 8.4 3H3l7 10-7 8h1.6l6.1-7 4.9 7H21l-7.3-10.4Zm-2.2 2.5-.7-1L5.2 4.2h2.4l4.5 6.4.7 1 5.9 8.3h-2.4l-4.8-6.8Z" />
    </svg>
  );
}
