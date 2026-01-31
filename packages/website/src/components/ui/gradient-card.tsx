import Link from "next/link";

interface GradientCardProps {
  children: React.ReactNode;
  href?: string;
  className?: string;
  disabled?: boolean;
}

export function GradientCard({
  children,
  href,
  className = "",
  disabled = false,
}: GradientCardProps) {
  const wrapperClasses = `group relative rounded-xl p-px transition-all duration-300 ${
    disabled ? "opacity-70" : "hover:-translate-y-1"
  } ${className}`;

  const gradientClasses = `absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500 via-pink-500 to-violet-500
    opacity-0 ${disabled ? "" : "group-hover:opacity-100"} transition-opacity duration-300`;

  const shadowClasses = disabled ? "" : "group-hover:shadow-[0_0_15px_rgba(124,58,237,0.15)]";

  const contentClasses = `relative bg-background rounded-xl p-6 h-full border border-border
    ${disabled ? "" : "group-hover:border-transparent"} transition-colors ${shadowClasses}`;

  if (href && !disabled) {
    return (
      <Link href={href} className={wrapperClasses}>
        <div className={gradientClasses} />
        <div className={contentClasses}>{children}</div>
      </Link>
    );
  }

  return (
    <div className={wrapperClasses}>
      <div className={gradientClasses} />
      <div className={contentClasses}>{children}</div>
    </div>
  );
}
