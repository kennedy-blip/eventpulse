import { Fragment, type ReactNode } from "react";
import { cn } from "../utils/cn";

const TOKEN =
  /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])|(\s+)/g;

const CLS: Record<string, string> = {
  key: "text-violet-300",
  str: "text-emerald-300/90",
  num: "text-amber-300",
  lit: "text-rose-300",
  punc: "text-slate-600",
};

export function highlight(value: unknown): ReactNode[] {
  const src = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  let i = 0;
  while ((m = TOKEN.exec(src)) !== null) {
    if (m.index > last) out.push(<Fragment key={`t${i++}`}>{src.slice(last, m.index)}</Fragment>);
    const [full, key, str, num, lit, punc] = m;
    const cls = key ? CLS.key : str ? CLS.str : num ? CLS.num : lit ? CLS.lit : punc ? CLS.punc : "";
    out.push(
      <span key={`k${i++}`} className={cls}>
        {full}
      </span>,
    );
    last = m.index + full.length;
  }
  if (last < src.length) out.push(<Fragment key={`e${i++}`}>{src.slice(last)}</Fragment>);
  return out;
}

export default function JsonView({
  value,
  className,
  maxHeight,
  compact,
}: {
  value: unknown;
  className?: string;
  maxHeight?: number;
  compact?: boolean;
}) {
  return (
    <pre
      className={cn(
        "no-scrollbar overflow-auto rounded-md border border-edge/70 bg-black/45 p-2.5 font-mono text-[10.5px] leading-[1.55]",
        className,
      )}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <code>{compact ? highlight(JSON.stringify(value)) : highlight(value)}</code>
    </pre>
  );
}
