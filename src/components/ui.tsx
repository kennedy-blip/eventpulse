import { useId, type ReactNode } from "react";
import { cn } from "../utils/cn";
import type { Accent } from "../sim/types";

export const TONE: Record<
  Accent | "slate",
  { text: string; hex: string; bg: string; border: string; ring: string; shadow: string }
> = {
  violet: {
    text: "text-violet-300",
    hex: "#8b5cf6",
    bg: "bg-violet-500/12",
    border: "border-violet-500/35",
    ring: "ring-violet-500/40",
    shadow: "shadow-[0_0_28px_-8px_rgba(139,92,246,0.65)]",
  },
  ice: {
    text: "text-sky-300",
    hex: "#38bdf8",
    bg: "bg-sky-500/12",
    border: "border-sky-500/35",
    ring: "ring-sky-500/40",
    shadow: "shadow-[0_0_28px_-8px_rgba(56,189,248,0.6)]",
  },
  emerald: {
    text: "text-emerald-300",
    hex: "#10b981",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/35",
    ring: "ring-emerald-500/40",
    shadow: "shadow-[0_0_28px_-8px_rgba(16,185,129,0.6)]",
  },
  amber: {
    text: "text-amber-300",
    hex: "#f59e0b",
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
    ring: "ring-amber-500/40",
    shadow: "shadow-[0_0_28px_-8px_rgba(245,158,11,0.6)]",
  },
  rose: {
    text: "text-rose-300",
    hex: "#f43f5e",
    bg: "bg-rose-500/12",
    border: "border-rose-500/35",
    ring: "ring-rose-500/40",
    shadow: "shadow-[0_0_28px_-8px_rgba(244,63,94,0.6)]",
  },
  slate: {
    text: "text-slate-300",
    hex: "#94a3b8",
    bg: "bg-slate-500/10",
    border: "border-slate-500/25",
    ring: "ring-slate-500/30",
    shadow: "shadow-none",
  },
};

export function Panel({
  title,
  sub,
  icon,
  accent = "slate",
  actions,
  children,
  className,
  bodyClass,
}: {
  title?: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  accent?: Accent | "slate";
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  const tone = TONE[accent];
  return (
    <section
      className={cn(
        "panel inset-line relative overflow-hidden rounded-xl transition-colors duration-300",
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{ background: `linear-gradient(90deg, transparent, ${tone.hex}, transparent)` }}
      />
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-edge/80 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md border", tone.border, tone.bg, tone.text)}>
                {icon}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-display text-[13.5px] font-semibold tracking-wide text-slate-100">{title}</h2>
              {sub && <p className="truncate font-mono text-[10.5px] leading-tight text-dim">{sub}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("p-4", bodyClass)}>{children}</div>
    </section>
  );
}

export function Badge({
  children,
  tone = "slate",
  pulse,
  className,
}: {
  children: ReactNode;
  tone?: Accent | "slate";
  pulse?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider",
        t.border,
        t.bg,
        t.text,
        className,
      )}
    >
      {pulse !== false && (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", pulse && "blink")}
          style={{ background: t.hex, boxShadow: `0 0 8px ${t.hex}` }}
        />
      )}
      {children}
    </span>
  );
}

export function Btn({
  children,
  onClick,
  tone = "slate",
  variant = "ghost",
  size = "md",
  className,
  title,
  disabled,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: Accent | "slate";
  variant?: "solid" | "ghost" | "outline";
  size?: "sm" | "md";
  className?: string;
  title?: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/btn relative inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]",
        variant === "solid" && cn("text-white border-transparent", t.shadow),
        variant === "outline" && cn(t.border, t.text, "hover:bg-white/5"),
        variant === "ghost" && "border-edge bg-white/[0.02] text-slate-300 hover:border-edge-2 hover:bg-white/[0.06] hover:text-slate-100",
        active && cn(t.border, t.bg, t.text),
        className,
      )}
      style={variant === "solid" ? { background: `linear-gradient(180deg, ${t.hex}e6, ${t.hex}b3)` } : undefined}
    >
      {children}
    </button>
  );
}

export function Meter({
  value,
  max = 100,
  tone = "violet",
  height = 4,
  className,
  striped,
}: {
  value: number;
  max?: number;
  tone?: Accent | "slate";
  height?: number;
  className?: string;
  striped?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  const t = TONE[tone];
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-white/[0.06]", className)} style={{ height }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{
          width: `${pct}%`,
          background: striped
            ? `repeating-linear-gradient(115deg, ${t.hex} 0 6px, ${t.hex}99 6px 12px)`
            : `linear-gradient(90deg, ${t.hex}88, ${t.hex})`,
          boxShadow: `0 0 10px ${t.hex}66`,
        }}
      />
    </div>
  );
}

export function Sparkline({
  data,
  color = "#8b5cf6",
  height = 34,
  className,
  fill = true,
  strokeWidth = 1.4,
  max: fixedMax,
}: {
  data: number[];
  color?: string;
  height?: number;
  className?: string;
  fill?: boolean;
  strokeWidth?: number;
  max?: number;
}) {
  const gid = useId().replace(/:/g, "");
  const pts = data.length > 1 ? data : [0, 0];
  const max = Math.max(fixedMax ?? 0, ...pts, 0.001);
  const step = 100 / (pts.length - 1);
  const line = pts.map((v, i) => `${(i * step).toFixed(2)},${(100 - (v / max) * 92 - 4).toFixed(2)}`).join(" ");
  const area = `0,100 ${line} 100,100`;
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <defs>
        <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.38" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <polygon points={area} fill={`url(#g${gid})`} />}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function StatTile({
  label,
  value,
  unit,
  tone = "slate",
  hint,
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  tone?: Accent | "slate";
  hint?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("panel-flat relative overflow-hidden rounded-lg px-3 py-2.5", className)}>
      <span aria-hidden className="absolute left-0 top-0 h-full w-[2px]" style={{ background: t.hex, opacity: 0.75 }} />
      <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className={cn("tabular font-mono text-[17px] font-semibold leading-none", t.text)}>{value}</span>
        {unit && <span className="font-mono text-[10px] text-dim">{unit}</span>}
      </p>
      {hint && <p className="mt-1 font-mono text-[10px] leading-tight text-slate-500">{hint}</p>}
      {children}
    </div>
  );
}

export function KeyVal({ k, v, tone }: { k: string; v: ReactNode; tone?: Accent }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-edge/50 py-1 last:border-0">
      <span className="font-mono text-[10.5px] text-dim">{k}</span>
      <span className={cn("truncate font-mono text-[11px] text-slate-300", tone && TONE[tone].text)}>{v}</span>
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = "violet",
  className,
}: {
  options: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  tone?: Accent;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div className={cn("inline-flex rounded-md border border-edge bg-black/30 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-wider transition-all duration-200",
              on ? cn(t.bg, t.text, "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]") : "text-slate-500 hover:text-slate-300",
            )}
            style={on ? { boxShadow: `inset 0 0 0 1px ${t.hex}55` } : undefined}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyNote({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-edge/80 bg-black/20 px-4 py-8 text-center">
      {icon && <span className="text-slate-600">{icon}</span>}
      <p className="font-mono text-[11px] leading-relaxed text-slate-500">{children}</p>
    </div>
  );
}
