export function Logo({ size = 24, className, variant = "mark" }: { size?: number; className?: string; variant?: "mark" | "full" }) {
  const src = variant === "full" ? "/brand/baseplay-logo-full.png" : "/brand/baseplay-mark-transparent.png";
  const alt = variant === "full" ? "BasePlay logo" : "BasePlay mark";

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`object-contain ${className ?? ""}`}
    />
  );
}
