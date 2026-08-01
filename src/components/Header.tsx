import {
  AlertOctagon,
  Eraser,
  LayoutGrid,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Send,
  Users,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { fmtNum } from "../sim/engine";
import { Badge, Btn, TONE } from "./ui";

export type TabId = "topology" | "producer" | "consumers" | "dlq";

const TABS: { id: TabId; label: string; short: string; icon: typeof LayoutGrid }[] = [
  { id: "topology", label: "Topic Topology", short: "Topology", icon: LayoutGrid },
  { id: "producer", label: "Producer Stream", short: "Producer", icon: Send },
  { id: "consumers", label: "Consumer Groups", short: "Consumers", icon: Users },
  { id: "dlq", label: "Dead Letter Queue", short: "DLQ", icon: AlertOctagon },
];

export default function Header({
  cluster,
  tab,
  onTab,
  onPublishTest,
  onPurge,
}: {
  cluster: Cluster;
  tab: TabId;
  onTab: (t: TabId) => void;
  onPublishTest: () => void;
  onPurge: () => void;
}) {
  const { state, derived, dispatch } = cluster;
  const health = derived.health;
  const ht = TONE[health.tone];
  const dlqOpen = derived.openDLQ;

  const partitionCount = state.topics.reduce((a, t) => a + t.partitions.length, 0);
  const counts: Record<TabId, string> = {
    topology: `${partitionCount}p`,
    producer: `${fmtNum(derived.produceTps)}/s`,
    consumers: `${state.groups.length}g`,
    dlq: dlqOpen ? `${dlqOpen}` : "0",
  };

  return (
    <header className="sticky top-0 z-40 border-b border-edge/70 bg-void/88 backdrop-blur-xl">
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px opacity-60"
        style={{ background: "linear-gradient(90deg, transparent, rgba(139,92,246,0.6), rgba(16,185,129,0.4), transparent)" }}
      />
      <div className="mx-auto max-w-[1600px] px-3 sm:px-5">
        {/* top row */}
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <span className="absolute inset-0 rounded-xl bg-violet-500/30 blur-lg" aria-hidden />
              <div className="relative grid h-10 w-10 place-items-center rounded-xl border border-violet-400/40 bg-gradient-to-b from-violet-500/25 to-violet-900/20 text-violet-300">
                <Radio className="h-5 w-5 glow-pulse" strokeWidth={2} />
              </div>
            </div>
            <div>
              <h1 className="font-display text-[19px] font-bold leading-none tracking-tight text-slate-50">
                Event<span className="text-violet-400 text-glow-violet">Pulse</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] leading-none text-dim">
                kafka://pulse-cluster-01:9092 <span className="text-edge-2">·</span> broker-sim v2.4.1
              </p>
            </div>

            <div className="ml-2 hidden items-center md:flex">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10.5px] tracking-wide transition-colors duration-500",
                  ht.border,
                  ht.bg,
                  ht.text,
                )}
                title={health.detail}
              >
                <span
                  className={cn("h-1.5 w-1.5 rounded-full pulse-ring", state.running && "blink")}
                  style={{ background: ht.hex, ["--ring" as string]: `${ht.hex}66` }}
                />
                {health.label}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn tone="violet" variant="solid" onClick={onPublishTest} className="text-[12px]">
              <Send className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Publish Test Event</span>
              <span className="sm:hidden">Publish</span>
            </Btn>
            <Btn tone="amber" variant="outline" onClick={onPurge}>
              <Eraser className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Purge Topic Buffer</span>
              <span className="sm:hidden">Purge</span>
            </Btn>
            <span className="mx-0.5 hidden h-6 w-px bg-edge sm:block" />
            <Btn
              tone={state.running ? "emerald" : "slate"}
              variant="ghost"
              size="sm"
              title={state.running ? "Pause cluster stream" : "Resume cluster stream"}
              onClick={() => dispatch({ type: "toggle-run" })}
            >
              {state.running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span className="hidden lg:inline">{state.running ? "Live" : "Paused"}</span>
            </Btn>
            <Btn
              tone="slate"
              variant="ghost"
              size="sm"
              title="Reset cluster simulation"
              onClick={() => dispatch({ type: "reset" })}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Btn>
          </div>
        </div>

        {/* nav row */}
        <nav className="no-scrollbar -mb-px flex items-end gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const on = tab === t.id;
            const Icon = t.icon;
            const tone = t.id === "dlq" && dlqOpen > 0 ? TONE.rose : on ? TONE.violet : TONE.slate;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onTab(t.id)}
                className={cn(
                  "group relative flex shrink-0 items-center gap-2 rounded-t-lg border border-b-0 px-3 py-2 transition-all duration-200",
                  on
                    ? "border-edge bg-panel text-slate-100"
                    : "border-transparent text-slate-500 hover:bg-white/[0.03] hover:text-slate-300",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 transition-colors", on ? "text-violet-400" : "text-slate-600 group-hover:text-slate-400")} />
                <span className="font-display text-[12.5px] font-medium tracking-wide">
                  <span className="hidden sm:inline">{t.label}</span>
                  <span className="sm:hidden">{t.short}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-px font-mono text-[9px] tabular transition-colors",
                    on ? cn(tone.border, tone.bg, tone.text) : "border-edge/70 bg-black/30 text-slate-500",
                  )}
                >
                  {counts[t.id]}
                </span>
                {on && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-violet-400 shadow-[0_0_10px_2px_rgba(139,92,246,0.7)]"
                  />
                )}
              </button>
            );
          })}
          <div className="ml-auto hidden items-center gap-2 pb-2 pl-4 lg:flex">
            <Badge tone={state.running ? "emerald" : "amber"} pulse={state.running}>
              {state.running ? "stream live" : "stream paused"}
            </Badge>
            <span className="font-mono text-[10px] text-dim">tick #{fmtNum(state.tick)}</span>
          </div>
        </nav>
      </div>
    </header>
  );
}
