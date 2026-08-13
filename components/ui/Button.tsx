import Link from "next/link";
import { cn } from "@/lib/cn";

type Tone = "ink" | "saffron" | "cobalt" | "jade" | "tomato" | "ghost";
type Size = "md" | "lg" | "xl";

const TONES: Record<Tone, string> = {
  ink: "bg-ink text-paper border-ink",
  saffron: "bg-saffron text-ink border-ink",
  cobalt: "bg-cobalt text-paper border-ink",
  jade: "bg-jade text-ink border-ink",
  tomato: "bg-tomato text-paper border-ink",
  ghost: "bg-transparent text-ink border-ink",
};

const SIZES: Record<Size, string> = {
  md: "px-5 py-3 text-[0.95rem]",
  lg: "px-6 py-4 text-[1.05rem]",
  xl: "px-7 py-5 text-[1.15rem]",
};

const BASE =
  "riso btn-press inline-flex w-full items-center justify-center gap-2.5 " +
  "rounded-2xl border-2 font-semibold tracking-[-0.01em] " +
  "disabled:pointer-events-none disabled:opacity-45";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: Size;
};

export function Button({
  tone = "ink",
  size = "lg",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(BASE, TONES[tone], SIZES[size], className)}
    />
  );
}

type ButtonLinkProps = React.ComponentProps<typeof Link> & {
  tone?: Tone;
  size?: Size;
};

export function ButtonLink({
  tone = "ink",
  size = "lg",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link {...props} className={cn(BASE, TONES[tone], SIZES[size], className)} />
  );
}
