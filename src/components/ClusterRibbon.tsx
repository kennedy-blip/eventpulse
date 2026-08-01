import { Cpu, HardDrive, Network, ShieldAlert, Shuffle, Zap } from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { fmtNum } from "../sim/engine";
import { Meter, Sparkline, TONE } from "./ui";

function NodeCard({
  node,
  onFence,
  underReplicated,
}: {
  node: Cluster["state"]["nodes"][number];
  onFence: () => void;
  underReplicated: boolean;
}) {
  const down = node.state === "down";
  const tone = down ? TONE.rose : node.state === "degraded" ? TONE.amber : TONE.emerald;
  return (
    <div
      className={cn(
        "panel-flat group relative overflow-hidden rounded-lg p-3 transition-all duration-300",
        down ? "border-rose-500/30" : "hover:border-edge-2",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg,transparent,${tone.hex},transparent)`, opacity: down ? 0.9 : 0.45 }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", !down && "pulse-ring", down && "opacity-40")}
            style={{ background: tone.hex, boxShadow: `0 0 10px ${tone.hex}`, ["--ring" as string]: `${tone.hex}55` }}
          />
          <div>
            <p className="font-mono text-[11.5px] font-semibold leading-none text-slate-200">{node.host}</p>
            <p className="mt-1 font-mono text-[9.5px] leading-none text-dim">
              broker-{node.id} <span className="text-edge-2">·</span> {node.rack}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {node.role === "controller" && (
            <span className="rounded border border-violet-500/35 bg-violet-500/10 px-1.5 py-px font-mono text-[8.5px] uppercase tracking-wider text-violet-300">
              controller
            </span>
          )}
          {down && (
            <span className="blink rounded border border-rose-500/40 bg-rose-500/10 px-1.5 py-px font-mono text-[8.5px] uppercase tracking-wider text-rose-300">
              out of service
            </span>
          )}
          {node.state === "degraded" && (
            <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-px font-mono text-[8.5px] uppercase tracking-wider text-amber-300">
              degraded
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {[
          { icon: Cpu, label: "cpu", v: node.cpu, unit: "%", max: 100, t: node.cpu > 85 ? "rose" : node.cpu > 70 ? "amber" : "ice" },
          { icon: HardDrive, label: "disk", v: node.disk, unit: "%", max: 100, t: node.disk > 85 ? "rose" : "emerald" },
          { icon: Network, label: "net", v: node.netIn + node.netOut, unit: " MB/s", max: 180, t: "violet" },
        ].map((m) => (
          <div key={m.label} className="flex items-center gap-2">
            <m.icon className="h-3 w-3 shrink-0 text-slate-600" />
            <span className="w-8 shrink-0 font-mono text-[9px] uppercase tracking-wider text-dim">{m.label}</span>
            <Meter value={m.v} max={m.max} tone={m.t as never} className="flex-1" height={3} />
            <span className="w-14 shrink-0 text-right font-mono text-[9.5px] tabular text-slate-400">
              {down ? "—" : `${m.v.toFixed(0)}${m.unit}`}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-edge/60 pt-2 font-mono text-[9.5px] text-dim">
        <span>
          leaders <span className="text-slate-300 tabular">{node.leaders}</span>
        </span>
        <span className={cn(underReplicated && !down && "text-amber-300")}>
          isr {down ? "0/3" : underReplicated ? "2/3" : "3/3"}
        </span>
        <button
          type="button"
          onClick={onFence}
          disabled={down}
          title={down ? "Broker already fenced" : `Fence broker-${node.id} (controlled failover)`}
          className="inline-flex items-center gap-1 rounded border border-transparent px-1.5 py-0.5 text-slate-500 opacity-0 transition-all duration-200 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-0"
        >
          <ShieldAlert className="h-3 w-3" />
          fence
        </button>
      </div>
    </div>
  );
}

export default function ClusterRibbon({ cluster }: { cluster: Cluster }) {
  const { state, dispatch, derived } = cluster;
  const downIds = new Set(state.nodes.filter((n) => n.state === "down").map((n) => n.id));
  const underReplicated = state.topics.some((t) => t.partitions.some((p) => downIds.has(p.leader) || p.isr.length < 3));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {state.nodes.map((n) => (
        <NodeCard
          key={n.id}
          node={n}
          underReplicated={underReplicated}
          onFence={() => dispatch({ type: "failover", nodeId: n.id })}
        />
      ))}

      <div className="panel-flat relative overflow-hidden rounded-lg p-3">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-dim">cluster throughput</p>
          <Zap className={cn("h-3.5 w-3.5", state.running ? "text-violet-400" : "text-slate-600")} />
        </div>

        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[20px] font-semibold leading-none tabular text-violet-300">
              {derived.produceTps.toFixed(1)}
              <span className="ml-1 text-[10px] text-dim">msg/s in</span>
            </p>
            <p className="mt-1 font-mono text-[11px] leading-none tabular text-emerald-300">
              {derived.consumeTps.toFixed(1)}
              <span className="ml-1 text-[10px] text-dim">msg/s out</span>
            </p>
          </div>
          <div className="w-[45%]">
            <Sparkline data={state.produceHistory.slice(-24)} color="#8b5cf6" height={22} />
            <Sparkline data={state.consumeHistory.slice(-24)} color="#10b981" height={22} className="mt-0.5" />
          </div>
        </div>

        <div className="mt-3 space-y-2 border-t border-edge/60 pt-2.5">
          <label className="block">
            <span className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-dim">
              producer rate
              <span className="text-slate-300 tabular">{state.rate.toFixed(2)}x</span>
            </span>
            <input
              type="range"
              min={0}
              max={3}
              step={0.05}
              value={state.rate}
              onChange={(e) => dispatch({ type: "set-rate", rate: Number(e.target.value) })}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-edge accent-violet-500 outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(139,92,246,0.9)]"
            />
          </label>
          <label className="block">
            <span className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-wider text-dim">
              fault injection
              <span className="text-slate-300 tabular">{(state.failureBias * 100).toFixed(0)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={state.failureBias}
              onChange={(e) => dispatch({ type: "set-failure-bias", value: Number(e.target.value) })}
              className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-edge accent-rose-500 outline-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(244,63,94,0.9)]"
            />
          </label>
          <div className="flex gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => dispatch({ type: "rebalance", groupId: "random" })}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-edge bg-white/[0.02] px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-slate-400 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-300"
            >
              <Shuffle className="h-3 w-3" />
              rebalance
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: "failover", nodeId: "random" })}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded border border-edge bg-white/[0.02] px-2 py-1 font-mono text-[9.5px] uppercase tracking-wider text-slate-400 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
            >
              <ShieldAlert className="h-3 w-3" />
              failover
            </button>
          </div>
        </div>
        <p className="mt-2 font-mono text-[9px] text-slate-600">
          rebalances <span className="text-slate-400 tabular">{fmtNum(state.stats.rebalances)}</span> · purges{" "}
          <span className="text-slate-400 tabular">{state.stats.purges}</span>
        </p>
      </div>
    </div>
  );
}
