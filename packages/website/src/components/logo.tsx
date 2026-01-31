import { cn } from "@/lib/utils";

type LogoVariant = "full" | "symbol" | "wordmark";
type LogoSize = "sm" | "md" | "lg";
type LogoCase = "lower" | "upper" | "capital";

interface LogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  textCase?: LogoCase;
  className?: string;
}

const sizes = {
  sm: { symbol: "size-6", text: "text-lg", gap: "gap-1.5" },
  md: { symbol: "size-7", text: "text-xl", gap: "gap-2" },
  lg: { symbol: "size-9", text: "text-2xl", gap: "gap-2.5" },
} as const;

const textVariants = {
  lower: "nextlytics",
  upper: "NEXTLYTICS",
  capital: "Nextlytics",
} as const;

function LogoSymbol({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className}>
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <clipPath id="logo-circle-clip">
          <circle cx="20" cy="20" r="18" />
        </clipPath>
      </defs>
      <circle cx="20" cy="20" r="18" fill="url(#logo-gradient)" />
      <path
        d="M2 20H8L12 10L28 30L32 20H38"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        clipPath="url(#logo-circle-clip)"
      />
    </svg>
  );
}

function LogoWordmark({
  className,
  textCase = "lower",
}: {
  className?: string;
  textCase?: LogoCase;
}) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-heading)] font-semibold tracking-tight",
        className
      )}
    >
      {textVariants[textCase]}
    </span>
  );
}

export function Logo({ variant = "full", size = "md", textCase = "lower", className }: LogoProps) {
  const sizeConfig = sizes[size];

  if (variant === "symbol") {
    return <LogoSymbol className={cn(sizeConfig.symbol, className)} />;
  }

  if (variant === "wordmark") {
    return <LogoWordmark className={cn(sizeConfig.text, className)} textCase={textCase} />;
  }

  return (
    <div className={cn("flex items-center", sizeConfig.gap, className)}>
      <LogoSymbol className={sizeConfig.symbol} />
      <LogoWordmark className={sizeConfig.text} textCase={textCase} />
    </div>
  );
}

export { LogoSymbol, LogoWordmark };
