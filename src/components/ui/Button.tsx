import Link from "next/link";
import { cn } from "@/lib/utils";

interface ButtonProps {
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline";
  size?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function Button({
  href,
  onClick,
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  disabled,
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full font-semibold transition-opacity active:opacity-80 disabled:opacity-50";
  const variants = {
    primary: "bg-brown text-white",
    secondary: "border border-brown bg-white text-brown",
    outline: "border-2 border-brown bg-transparent text-brown",
  };
  const sizes = {
    md: "px-5 py-2.5 text-sm",
    lg: "px-6 py-3.5 text-base",
  };

  const classes = cn(base, variants[variant], sizes[size], className);

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button type={type} onClick={onClick} disabled={disabled} className={classes}>
      {children}
    </button>
  );
}
