import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { LEVEL_STYLE, fmtBytes, fmtNum, fmtUptime } from "../sim/engine";

export default function StatusBar({ cluster }: { cluster: Cluster }) {
  const { state, derived, now } = cluster;
  const latest = state.logs[0];
  const cells: Array<[string, string, string?]> = [
    ["produced", fmtNum(state.stats.produced), "text-violet-300"],
    ["consumed", fmtNum(state.stats.consumed), "text-emerald-300"],
    ["failed", fmtNum(state.stats.failed), "text-rose-300"],
    ["lag", fmtNum(derived.lag), derived.lag > 200 ? "text-amber-300" : "text-slate-300"],
    ["ingest", fmtBytes(state.stats.bytes), "text-sky-300"],
    ["uptime", fmtUptime(now - state.stats.startedAt), "text-slate-300"],
  ];

  return (
    <footer className="sticky bottom-0 z-30 mt-4 border-t border-edge/70 bg-void/92 backdrop-blur-xl">
      <div className="mx-auto flex h-9 max-w-[1600px] items-center gap-4 px-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn("h-1.5 w-1.5 rounded-full", state.running ? "blink bg-emerald-400" : "bg-amber-400")}
            style={{ boxShadow: state.running ? "0 0 8px #10b981" : "0 0 8px #f59e0b" }}
          />
          <span className="hidden font-mono text-[10px] text-dim sm:inline">
            zk://pulse-zk-0:2181 <span className="text-edge-2">·</span> epoch 41
          </span>
        </div>

        <div className="no-scrollbar flex flex-1 items-center gap-3 overflow-x-auto">
          {cells.map(([k, v, tone]) => (
            <span key={k} className="flex shrink-0 items-baseline gap-1 font-mono text-[10px]">
              <span className="text-slate-600">{k}</span>
              <span className={cn("tabular", tone)}>{v}</span>
            </span>
          ))}
        </div>

        {latest && (
          <div className="hidden min-w-0 max-w-[42%] items-center gap-2 md:flex">
            <span className={cn("h-3 w-[2px] shrink-0 rounded-full", LEVEL_STYLE[latest.level].bar)} />
            <span className={cn("shrink-0 font-mono text-[10px]", LEVEL_STYLE[latest.level].tag)}>{latest.channel}</span>
            <span
              key={latest.id}
              className={cn("rise-in truncate font-mono text-[10px] text-slate-500")}
              title={latest.text}
            >
              {latest.text}
            </span>
          </div>
        )}
      </div>
    </footer>
  );
}
