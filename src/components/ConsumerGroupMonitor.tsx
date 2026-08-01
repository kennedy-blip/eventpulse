import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpToLine,
  Gauge,
  Power,
  RefreshCw,
  ServerCog,
  Shuffle,
  Users,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { ACCENT, fmtNum, groupLag } from "../sim/engine";
import type { Accent } from "../sim/types";
import { Badge, Btn, Meter, Panel, Sparkline, StatTile, TONE } from "./ui";

const lagTone = (lag: number): Accent => (lag > 90 ? "rose" : lag > 24 ? "amber" : "emerald");

export default function ConsumerGroupMonitor({
  cluster,
  focusId,
}: {
  cluster: Cluster;
  focusId: string | null;
}) {
  const { state, dispatch, now } = cluster;
  const [sel, setSel] = useState<string>(focusId ?? state.groups[0]?.id ?? "");

  useEffect(() => {
    if (focusId) setSel(focusId);
  }, [focusId]);

  const group = state.groups.find((g) => g.id === sel) ?? state.groups[0];

  const totals = useMemo(() => {
    const lag = state.groups.reduce((a, g) => a + groupLag(state, g), 0);
    const members = state.groups.reduce((a, g) => a + g.members.length, 0);
    const tps = state.groups.reduce((a, g) => a + g.tps, 0);
    const avgLatency =
      state.groups.reduce((a, g) => a + g.members.reduce((b, m) => b + m.latencyMs, 0), 0) / Math.max(1, members);
    return { lag, members, tps, avgLatency };
  }, [state]);

  if (!group) return null;

  const glag = groupLag(state, group);
  const gtone = TONE[group.state === "rebalancing" ? "amber" : lagTone(glag)];
  const assignments = group.topics.flatMap((tid) => {
    const t = state.topics.find((x) => x.id === tid);
    if (!t) return [];
    return t.partitions.map((p) => {
      const committed = group.committed[tid]?.[p.id] ?? p.headOffset;
      const lag = Math.max(0, p.headOffset - committed);
      const owner = group.members.find((m) => m.assigned.includes(`${tid}:${p.id}`));
      return { tid, topic: t, p, committed, lag, owner };
    });
  });
  const groupLogs = state.logs.filter((l) => l.channel === group.name).slice(0, 14);

  return (
    <div className="stagger-in space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
        <StatTile
          label="cluster lag"
          value={fmtNum(totals.lag)}
          unit="msgs"
          tone={lagTone(totals.lag / state.groups.length)}
          hint={`across ${state.groups.length} groups`}
        />
        <StatTile label="aggregate consume" value={totals.tps.toFixed(1)} unit="msg/s" tone="emerald" />
        <StatTile label="live members" value={fmtNum(totals.members)} unit="consumers" tone="violet" />
        <StatTile
          label="mean poll latency"
          value={totals.avgLatency.toFixed(0)}
          unit="ms"
          tone={totals.avgLatency > 90 ? "amber" : "ice"}
        />
        <StatTile label="rebalances" value={fmtNum(state.stats.rebalances)} unit="total" tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        {/* group roster */}
        <Panel
          title="Consumer Groups"
          sub="coordinator: broker-0 · protocol=range"
          icon={<Users className="h-3.5 w-3.5" />}
          accent="violet"
          bodyClass="p-2"
        >
          <div className="space-y-1.5">
            {state.groups.map((g) => {
              const lag = groupLag(state, g);
              const tone = TONE[g.state === "rebalancing" ? "amber" : lagTone(lag)];
              const on = g.id === group.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSel(g.id)}
                  className={cn(
                    "group relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-200",
                    on ? cn(tone.border, "bg-white/[0.05]") : "border-edge/70 bg-black/20 hover:border-edge-2 hover:bg-white/[0.03]",
                  )}
                >
                  {on && <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: tone.hex }} />}
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-mono text-[11.5px] font-semibold text-slate-100">{g.name}</p>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        g.state === "rebalancing" && "blink",
                      )}
                      style={{ background: tone.hex, boxShadow: `0 0 8px ${tone.hex}` }}
                    />
                  </div>
                  <p className="mt-0.5 font-mono text-[9px] text-dim">
                    {g.owner} · {g.members.length} members · gen {g.members[0]?.generation ?? 0}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Meter value={lag} max={220} tone={g.state === "rebalancing" ? "amber" : lagTone(lag)} height={3} className="flex-1" />
                    <span className={cn("w-12 shrink-0 text-right font-mono text-[10px] tabular", tone.text)}>Δ{fmtNum(lag)}</span>
                  </div>
                  <div className="mt-1.5 h-4 opacity-80">
                    <Sparkline data={g.lagHistory.slice(-24)} color={tone.hex} height={16} strokeWidth={1.1} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-edge/60 pt-2">
            <p className="mb-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">group activity</p>
            <div className="max-h-[190px] space-y-1 overflow-y-auto px-1">
              {groupLogs.length === 0 && <p className="font-mono text-[10px] text-slate-600">no events for selected group yet</p>}
              {groupLogs.map((l) => (
                <p key={l.id} className="font-mono text-[9.5px] leading-snug">
                  <span className="text-slate-700">{new Date(l.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>{" "}
                  <span
                    className={cn(
                      l.level === "error"
                        ? "text-rose-400"
                        : l.level === "warn"
                          ? "text-amber-400"
                          : l.level === "success"
                            ? "text-emerald-400"
                            : "text-sky-400",
                    )}
                  >
                    {l.level.toUpperCase().padEnd(7)}
                  </span>{" "}
                  <span className="text-slate-400">{l.text}</span>
                </p>
              ))}
            </div>
          </div>
        </Panel>

        {/* detail */}
        <div className="space-y-4">
          <Panel
            title={group.name}
            sub={`${group.owner} · subscribed: ${group.topics.join(", ")}`}
            icon={<ServerCog className="h-3.5 w-3.5" />}
            accent={group.state === "rebalancing" ? "amber" : lagTone(glag)}
            bodyClass="p-3 sm:p-4"
            actions={
              <>
                <Badge tone={group.state === "rebalancing" ? "amber" : "emerald"} pulse={group.state === "rebalancing"}>
                  {group.state === "rebalancing" ? `rebalancing (${group.rebalanceTimer})` : "stable"}
                </Badge>
                <Btn size="sm" tone="amber" variant="ghost" title="Force a group rebalance" onClick={() => dispatch({ type: "rebalance", groupId: group.id })}>
                  <Shuffle className="h-3 w-3" />
                  rebalance
                </Btn>
                <Btn size="sm" tone="ice" variant="ghost" title="auto.offset.reset=latest" onClick={() => dispatch({ type: "reset-offsets", groupId: group.id, to: "latest" })}>
                  <ArrowUpToLine className="h-3 w-3" />
                  to latest
                </Btn>
                <Btn size="sm" tone="violet" variant="ghost" title="auto.offset.reset=earliest (rewind 250/partition)" onClick={() => dispatch({ type: "reset-offsets", groupId: group.id, to: "earliest" })}>
                  <ArrowDownToLine className="h-3 w-3" />
                  to earliest
                </Btn>
              </>
            }
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-lg border border-edge/70 bg-black/25 p-3">
                <p className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> offset lag
                  </span>
                  <span className={cn("tabular text-[13px] font-semibold", gtone.text)}>Δ {fmtNum(glag)}</span>
                </p>
                <Sparkline data={group.lagHistory} color={gtone.hex} height={62} className="mt-2" />
                <div className="mt-1 flex justify-between font-mono text-[8.5px] text-slate-600">
                  <span>-40 ticks</span>
                  <span>peak {fmtNum(Math.max(...group.lagHistory, 0))}</span>
                  <span>now</span>
                </div>
              </div>
              <div className="rounded-lg border border-edge/70 bg-black/25 p-3">
                <p className="flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="h-3 w-3" /> throughput
                  </span>
                  <span className="tabular text-[13px] font-semibold text-emerald-300">{group.tps.toFixed(1)} msg/s</span>
                </p>
                <Sparkline data={group.tpsHistory} color="#10b981" height={62} className="mt-2" />
                <div className="mt-1 flex justify-between font-mono text-[8.5px] text-slate-600">
                  <span>committed {fmtNum(group.committedAcks)}</span>
                  <span>peak {Math.max(...group.tpsHistory, 0).toFixed(1)}/s</span>
                  <span>now</span>
                </div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile label="members" value={group.members.length} tone="violet" hint={`${group.members.filter((m) => m.state === "joining").length} joining`} />
              <StatTile label="generation" value={group.members[0]?.generation ?? 0} tone="ice" hint={`rebalances ${group.rebalances}`} />
              <StatTile label="assigned parts" value={group.members.reduce((a, m) => a + m.assigned.length, 0)} tone="slate" hint={`${group.topics.length} topic(s)`} />
              <StatTile
                label="p99 poll"
                value={Math.round(Math.max(...group.members.map((m) => m.latencyMs), 0))}
                unit="ms"
                tone={Math.max(...group.members.map((m) => m.latencyMs), 0) > 120 ? "rose" : "emerald"}
              />
            </div>
          </Panel>

          {/* commit matrix */}
          <Panel
            title="Partition Commit Matrix"
            sub="head vs committed offset per assigned topic-partition"
            icon={<Activity className="h-3.5 w-3.5" />}
            accent="emerald"
            bodyClass="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse">
                <thead>
                  <tr className="border-b border-edge/70 bg-black/25 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
                    <th className="px-3 py-2 text-left font-normal">topic-partition</th>
                    <th className="px-2 py-2 text-right font-normal">head</th>
                    <th className="px-2 py-2 text-right font-normal">committed</th>
                    <th className="px-2 py-2 text-left font-normal">lag</th>
                    <th className="px-2 py-2 text-right font-normal">leader</th>
                    <th className="px-3 py-2 text-left font-normal">assigned member</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(({ tid, topic: t, p, committed, lag, owner }) => {
                    const tone = TONE[lagTone(lag)];
                    const ta = ACCENT[t.accent];
                    return (
                      <tr
                        key={`${tid}-${p.id}`}
                        className="border-b border-edge/40 font-mono text-[10.5px] transition-colors last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className="px-3 py-1.5">
                          <span className="flex items-center gap-2">
                            <span className="h-3 w-[2px] rounded-full" style={{ background: ta.hex }} />
                            <span className="text-slate-300">{tid}</span>
                            <span className={cn("rounded border px-1 text-[9px]", ta.border, ta.bg, ta.text)}>P{p.id}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right tabular text-slate-400">{fmtNum(p.headOffset)}</td>
                        <td className="px-2 py-1.5 text-right tabular text-slate-400">{fmtNum(committed)}</td>
                        <td className="px-2 py-1.5">
                          <span className="flex items-center gap-2">
                            <Meter value={lag} max={220} tone={lagTone(lag)} height={3} className="w-20" />
                            <span className={cn("w-10 text-right tabular", tone.text)}>{lag}</span>
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right text-slate-500">
                          {state.nodes.find((n) => n.id === p.leader)?.state === "down" ? (
                            <span className="text-rose-400">b{p.leader}⨯</span>
                          ) : (
                            `b${p.leader}`
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-slate-400">{owner ? owner.host : <span className="text-amber-400">unassigned</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* members */}
          <Panel
            title="Group Members"
            sub="live membership, assignment & poll latency"
            icon={<Users className="h-3.5 w-3.5" />}
            accent="violet"
            bodyClass="p-0"
          >
            <div className="divide-y divide-edge/40">
              {group.members.map((m) => {
                const busy = m.assigned.length;
                const tone = m.state === "joining" ? TONE.amber : TONE.emerald;
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 transition-colors hover:bg-white/[0.025]">
                    <span
                      className={cn("h-2 w-2 shrink-0 rounded-full", m.state === "joining" && "blink")}
                      style={{ background: tone.hex, boxShadow: `0 0 8px ${tone.hex}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] font-semibold text-slate-200">
                        {m.id} <span className="font-normal text-slate-500">@{m.host}</span>
                      </p>
                      <p className="mt-0.5 font-mono text-[9px] text-dim">
                        gen {m.generation} · processed {fmtNum(m.processed)} · poll {m.latencyMs.toFixed(0)}ms ·{" "}
                        <span className={busy === 0 ? "text-amber-400" : "text-slate-400"}>{busy} assignment(s)</span>
                      </p>
                    </div>
                    <div className="flex max-w-full flex-wrap gap-1">
                      {m.assigned.slice(0, 6).map((a) => (
                        <span key={a} className="rounded border border-edge bg-black/30 px-1.5 py-0.5 font-mono text-[8.5px] text-slate-500">
                          {a}
                        </span>
                      ))}
                      {m.assigned.length > 6 && (
                        <span className="rounded border border-edge bg-black/30 px-1.5 py-0.5 font-mono text-[8.5px] text-slate-500">
                          +{m.assigned.length - 6}
                        </span>
                      )}
                    </div>
                    <Btn
                      size="sm"
                      tone="rose"
                      variant="ghost"
                      title={`Kill ${m.host} — triggers group rebalance`}
                      onClick={() => dispatch({ type: "rebalance", groupId: group.id })}
                    >
                      <Power className="h-3 w-3" />
                      kill
                    </Btn>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-edge/60 bg-black/20 px-3 py-2">
              <p className="font-mono text-[9.5px] text-slate-600">
                session.timeout.ms=10000 · max.poll.interval.ms=300000 · heartbeat.interval.ms=3000 ·{" "}
                <span className="text-slate-500">last tick {Math.round(now / 1000) % 1000}s</span>
              </p>
              <Btn size="sm" tone="amber" variant="outline" onClick={() => dispatch({ type: "rebalance", groupId: "random" })}>
                <RefreshCw className="h-3 w-3" />
                simulate failover rebalance
              </Btn>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
