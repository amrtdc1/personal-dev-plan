import type { ReactNode } from "react";

export type IconButtonVariant = "default" | "danger" | "success" | "add" | "primary";

type IconButtonProps = {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title: string;
  variant?: IconButtonVariant;
  size?: "sm" | "md";
  className?: string;
  type?: "button" | "submit" | "reset";
};

const BASE = "inline-flex items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-30";

const VARIANTS: Record<IconButtonVariant, string> = {
  default: "border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-100",
  danger: "border-rose-300 text-rose-600 hover:border-rose-400 hover:bg-rose-50",
  success: "border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50",
  add: "border-slate-300 bg-slate-100 text-slate-700 hover:border-slate-400 hover:bg-slate-200",
  primary: "border-transparent bg-slate-900 text-white hover:bg-slate-700",
};

const SIZES: Record<"sm" | "md", string> = {
  sm: "p-1",
  md: "p-1.5",
};

export function IconButton({
  children,
  onClick,
  disabled,
  title,
  variant = "default",
  size = "md",
  className = "",
  type = "button",
}: IconButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {children}
    </button>
  );
}
