import Link from "next/link";
import { cn } from "@/lib/cn";

type Tone = "ink" | "lime" | "chalk" | "ghost" | "ghost-light";
type Size = "sm" | "md" | "lg";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-chalk hover:bg-ink-2",
  lime: "bg-lime text-ink hover:brightness-[1.04]",
  chalk: "bg-chalk text-ink hover:bg-white",
  ghost: "bg-transparent text-ink border-[rgba(12,18,16,0.16)] hover:bg-[rgba(12,18,16,0.05)]",
  "ghost-light":
    "bg-transparent text-chalk border-[rgba(255,255,255,0.18)] hover:bg-[rgba(255,255,255,0.07)]",
};

const SIZES: Record<Size, string> = {
  sm: "px-4 py-2.5 text-[0.875rem]",
  md: "px-5 py-3.5 text-[0.9375rem]",
  lg: "px-6 py-4.5 text-[1.0625rem]",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
  block?: boolean;
};

export function Button({
  tone = "ink",
  size = "lg",
  block = true,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn("btn", block && "w-full", TONES[tone], SIZES[size], className)}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  tone?: Tone;
  size?: Size;
  block?: boolean;
};

export function ButtonLink({
  tone = "ink",
  size = "lg",
  block = true,
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      {...props}
      className={cn("btn", block && "w-full", TONES[tone], SIZES[size], className)}
    />
  );
}
