import { useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  ChevronDown,
  Eraser,
  Layers,
  Minus,
  Plus,
  Waypoints,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { ACCENT, ago, fmtBytes, fmtNum, groupLag, partitionLag } from "../sim/engine";
import type { Message, Topic } from "../sim/types";
import { Badge, Btn, EmptyNote, Meter, Panel, Sparkline, StatTile, TONE } from "./ui";
import JsonView from "./JsonView";

const TOPIC = { x: 14, w: 170, h: 58 };
const PART = { x: 380, w: 176, h: 30 };
const GROUP = { x: 812, w: 176, h: 64 };
const PAD = 30;
const COL_GAP = 26;

const lagTone = (lag: number) => (lag > 90 ? "rose" : lag > 24 ? "amber" : "emerald");

export default function TopicTopology({
  cluster,
  onInspectGroup,
}: {
  cluster: Cluster;
  onInspectGroup: (id: string) => void;
}) {
  const { state, dispatch, now } = cluster;
  const [selected, setSelected] = useState<{ topicId: string; partition: number }>({
    topicId: state.topics[0]?.id ?? "",
    partition: 0,
  });
  const [hover, setHover] = useState<{ kind: "topic" | "group" | "partition"; id: string } | null>(null);
  const [openMsg, setOpenMsg] = useState<string | null>(null);

  const layout = useMemo(() => {
    const topics = state.topics;
    const maxParts = Math.max(...topics.map((t) => t.partitions.length), 1);
    const step = maxParts > 4 ? 32 : 46;
    const rowH = Math.max(TOPIC.h, (maxParts - 1) * step + PART.h + 16);
    const h = PAD * 2 + topics.length * rowH + (topics.length - 1) * COL_GAP;
    const rows = topics.map((t, i) => {
      const top = PAD + i * (rowH + COL_GAP);
      const cy = top + rowH / 2;
      const count = t.partitions.length;
      return {
        topic: t,
        ty: cy - TOPIC.h / 2,
        cy,
        parts: t.partitions.map((p, pi) => ({
          p,
          y: cy - ((count - 1) * step) / 2 + pi * step - PART.h / 2,
          cy: cy - ((count - 1) * step) / 2 + pi * step,
        })),
      };
    });
    const groups = state.groups.map((g, i) => {
      const span = h - PAD * 2 - GROUP.h;
      const y = PAD + (state.groups.length > 1 ? (i * span) / (state.groups.length - 1) : span / 2);
      return { g, y, cy: y + GROUP.h / 2 };
    });
    return { h, rows, groups, step };
  }, [state.topics, state.groups]);

  const topicEdge = (t: string, p: number) => `te-${t}-${p}`;
  const groupEdge = (t: string, p: number, g: string) => `ge-${t}-${p}-${g}`;

  const selectedTopic = state.topics.find((t) => t.id === selected.topicId) ?? state.topics[0];
  const selectedPartition = selectedTopic?.partitions[selected.partition] ?? selectedTopic?.partitions[0];
  const messages: Message[] = selectedPartition ? [...selectedPartition.messages].reverse() : [];

  const isDim = (kind: "topic" | "group" | "partition", id: string, topicId?: string) => {
    if (!hover) return false;
    if (hover.kind === "topic") {
      if (kind === "topic") return hover.id !== id;
      if (kind === "partition") return hover.id !== topicId;
      return !state.groups.find((g) => g.id === id)?.topics.includes(hover.id);
    }
    if (hover.kind === "group") {
      const g = state.groups.find((x) => x.id === hover.id);
      if (kind === "group") return hover.id !== id;
      return !g?.topics.includes(topicId ?? id);
    }
    if (kind === "partition") return hover.id !== id;
    if (kind === "topic") return hover.id.split(":")[0] !== id;
    return false;
  };

  return (
    <div className="stagger-in space-y-4">
      <Panel
        title="Broker Graph — Topic / Partition / Consumer Mesh"
        sub="click a partition tile to inspect its log segment · hover a node to isolate its edges"
        icon={<Waypoints className="h-3.5 w-3.5" />}
        accent="violet"
        bodyClass="p-2 sm:p-3"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="violet">{state.topics.length} topics</Badge>
            <Badge tone="ice">
              {state.topics.reduce((a, t) => a + t.partitions.length, 0)} partitions
            </Badge>
            <Badge tone={state.nodes.some((n) => n.state === "down") ? "rose" : "emerald"}>rf=3 · min.isr=2</Badge>
          </div>
        }
      >
        <div className="no-scrollbar overflow-x-auto">
          <svg
            viewBox={`0 0 1000 ${layout.h}`}
            className="h-auto max-h-[70vh] w-full min-w-[820px]"
            role="img"
            aria-label="Topic partition consumer group topology graph"
          >
            <defs>
              <filter id="packet-glow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur stdDeviation="2.4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <linearGradient id="lane-fade" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.35" />
              </linearGradient>
            </defs>

            {/* column headers */}
            {[
              { x: TOPIC.x, label: "TOPICS" },
              { x: PART.x, label: "PARTITIONS · LOG SEGMENTS" },
              { x: GROUP.x, label: "CONSUMER GROUPS" },
            ].map((c) => (
              <text key={c.label} x={c.x} y={16} className="font-mono" fontSize="8.5" letterSpacing="1.6" fill="#475569">
                {c.label}
              </text>
            ))}
            <line x1="0" y1="22" x2="1000" y2="22" stroke="#1c2739" strokeWidth="1" />

            {/* partition -> group edges */}
            {layout.rows.map((row) =>
              row.parts.map(({ p, cy }) =>
                layout.groups
                  .filter((gn) => gn.g.topics.includes(row.topic.id))
                  .map((gn) => {
                    const committed = gn.g.committed[row.topic.id]?.[p.id] ?? p.headOffset;
                    const lag = Math.max(0, p.headOffset - committed);
                    const tone = TONE[lagTone(lag)];
                    const dim = hover
                      ? hover.kind === "group"
                        ? hover.id !== gn.g.id
                        : hover.kind === "topic"
                          ? hover.id !== row.topic.id
                          : !(hover.id === `${row.topic.id}:${p.id}`)
                      : false;
                    const rebalancing = gn.g.state === "rebalancing";
                    return (
                      <path
                        key={groupEdge(row.topic.id, p.id, gn.g.id)}
                        id={groupEdge(row.topic.id, p.id, gn.g.id)}
                        d={`M ${PART.x + PART.w} ${cy} C ${PART.x + PART.w + 90} ${cy}, ${GROUP.x - 90} ${gn.cy}, ${GROUP.x} ${gn.cy}`}
                        fill="none"
                        stroke={rebalancing ? TONE.amber.hex : tone.hex}
                        strokeWidth={lag > 40 ? 1.5 : 1}
                        strokeOpacity={dim ? 0.05 : hover ? 0.85 : 0.28}
                        className={cn(!dim && state.running && (lag > 0 ? "dash-flow" : "dash-flow-slow"))}
                        style={{ transition: "stroke-opacity 250ms ease" }}
                      />
                    );
                  }),
              ),
            )}

            {/* topic -> partition edges */}
            {layout.rows.map((row) =>
              row.parts.map(({ p, cy }) => {
                const accent = ACCENT[row.topic.accent];
                const dim = hover
                  ? hover.kind === "topic"
                    ? hover.id !== row.topic.id
                    : hover.kind === "partition"
                      ? hover.id !== `${row.topic.id}:${p.id}`
                      : !state.groups.find((g) => g.id === hover.id)?.topics.includes(row.topic.id)
                  : false;
                return (
                  <path
                    key={topicEdge(row.topic.id, p.id)}
                    id={topicEdge(row.topic.id, p.id)}
                    d={`M ${TOPIC.x + TOPIC.w} ${row.cy} C ${TOPIC.x + TOPIC.w + 60} ${row.cy}, ${PART.x - 60} ${cy}, ${PART.x} ${cy}`}
                    fill="none"
                    stroke={accent.hex}
                    strokeWidth="1.1"
                    strokeOpacity={dim ? 0.06 : hover ? 0.9 : 0.4}
                    className={cn(!dim && state.running && "dash-flow")}
                    style={{ transition: "stroke-opacity 250ms ease" }}
                  />
                );
              }),
            )}

            {/* flying packets */}
            <g filter="url(#packet-glow)">
              {state.flights.slice(-14).map((f) => {
                const topic = state.topics.find((t) => t.id === f.topicId);
                if (!topic || !topic.partitions.some((p) => p.id === f.partition)) return null;
                const accent = ACCENT[topic.accent];
                if (f.kind === "produce") {
                  return (
                    <circle key={f.id} r="2.8" fill={accent.hex}>
                      <animateMotion dur="0.9s" fill="freeze" begin="0s">
                        <mpath xlinkHref={`#${topicEdge(f.topicId, f.partition)}`} />
                      </animateMotion>
                    </circle>
                  );
                }
                return layout.groups
                  .filter((gn) => gn.g.topics.includes(f.topicId))
                  .slice(0, 2)
                  .map((gn) => (
                    <circle key={`${f.id}-${gn.g.id}`} r="2.4" fill={TONE.emerald.hex}>
                      <animateMotion dur="1.05s" fill="freeze" begin="0.1s">
                        <mpath xlinkHref={`#${groupEdge(f.topicId, f.partition, gn.g.id)}`} />
                      </animateMotion>
                    </circle>
                  ));
              })}
            </g>

            {/* topic nodes */}
            {layout.rows.map((row) => {
              const accent = ACCENT[row.topic.accent];
              const tps = row.parts.reduce((a, x) => a + x.p.tps, 0);
              const dim = isDim("topic", row.topic.id);
              const head = row.topic.partitions.reduce((a, p) => a + p.headOffset, 0);
              return (
                <g
                  key={row.topic.id}
                  className="cursor-pointer"
                  opacity={dim ? 0.28 : 1}
                  style={{ transition: "opacity 250ms ease" }}
                  onMouseEnter={() => setHover({ kind: "topic", id: row.topic.id })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => setSelected({ topicId: row.topic.id, partition: selected.partition })}
                >
                  <rect
                    x={TOPIC.x}
                    y={row.ty}
                    width={TOPIC.w}
                    height={TOPIC.h}
                    rx="8"
                    fill="#111827"
                    stroke={hover?.kind === "topic" && hover.id === row.topic.id ? accent.hex : "#1c2739"}
                    strokeWidth="1"
                  />
                  <rect x={TOPIC.x} y={row.ty} width="3" height={TOPIC.h} rx="1.5" fill={accent.hex} />
                  <text x={TOPIC.x + 12} y={row.ty + 20} className="font-mono" fontSize="11" fontWeight="600" fill="#e2e8f0">
                    {row.topic.name}
                  </text>
                  <text x={TOPIC.x + 12} y={row.ty + 34} className="font-mono" fontSize="8.5" fill="#64748b">
                    {row.topic.partitions.length}p · rf{row.topic.replicationFactor} · {row.topic.retentionHrs}h
                  </text>
                  <text x={TOPIC.x + 12} y={row.ty + 48} className="font-mono" fontSize="8.5" fill={accent.hex}>
                    {tps.toFixed(1)} msg/s
                  </text>
                  <text
                    x={TOPIC.x + TOPIC.w - 10}
                    y={row.ty + 48}
                    textAnchor="end"
                    className="font-mono"
                    fontSize="8.5"
                    fill="#475569"
                  >
                    Σ {fmtNum(head)}
                  </text>
                </g>
              );
            })}

            {/* partition tiles */}
            {layout.rows.map((row) =>
              row.parts.map(({ p, y }) => {
                const accent = ACCENT[row.topic.accent];
                const key = `${row.topic.id}:${p.id}`;
                const isSel = selected.topicId === row.topic.id && selected.partition === p.id;
                const dim = isDim("partition", key, row.topic.id);
                const leaderDown = state.nodes.find((n) => n.id === p.leader)?.state === "down";
                const maxTps = Math.max(...state.topics.flatMap((t) => t.partitions.map((q) => q.tps)), 1);
                return (
                  <g
                    key={key}
                    className="cursor-pointer"
                    opacity={dim ? 0.3 : 1}
                    style={{ transition: "opacity 250ms ease" }}
                    onMouseEnter={() => setHover({ kind: "partition", id: key })}
                    onMouseLeave={() => setHover(null)}
                    onClick={() => setSelected({ topicId: row.topic.id, partition: p.id })}
                  >
                    <rect
                      x={PART.x}
                      y={y}
                      width={PART.w}
                      height={PART.h}
                      rx="5"
                      fill={isSel ? "#16202f" : "#0d1420"}
                      stroke={isSel ? accent.hex : hover?.id === key ? "#334155" : "#1c2739"}
                      strokeWidth={isSel ? 1.4 : 1}
                    />
                    <text x={PART.x + 9} y={y + 13} className="font-mono" fontSize="9" fontWeight="700" fill={isSel ? accent.hex : "#94a3b8"}>
                      P{p.id}
                    </text>
                    <text x={PART.x + 9} y={y + 24} className="font-mono" fontSize="8" fill="#475569">
                      leader b{p.leader} · isr {p.isr.length}/{row.topic.replicationFactor}
                    </text>
                    <text x={PART.x + PART.w - 9} y={y + 13} textAnchor="end" className="font-mono" fontSize="9.5" fontWeight="600" fill="#e2e8f0">
                      {fmtNum(p.headOffset)}
                    </text>
                    <text x={PART.x + PART.w - 9} y={y + 24} textAnchor="end" className="font-mono" fontSize="8" fill={p.tps > 0 ? accent.hex : "#334155"}>
                      {p.tps.toFixed(1)}/s
                    </text>
                    <rect
                      x={PART.x + 1}
                      y={y + PART.h - 3}
                      width={PART.w - 2}
                      height="2"
                      rx="1"
                      fill="#1c2739"
                    />
                    <rect
                      x={PART.x + 1}
                      y={y + PART.h - 3}
                      width={Math.max(2, (p.tps / maxTps) * (PART.w - 2))}
                      height="2"
                      rx="1"
                      fill={leaderDown ? TONE.rose.hex : accent.hex}
                      opacity="0.9"
                    />
                    {leaderDown && (
                      <circle cx={PART.x + PART.w - 3} cy={y + 3} r="2.5" fill={TONE.rose.hex} className="blink" />
                    )}
                  </g>
                );
              }),
            )}

            {/* consumer group nodes */}
            {layout.groups.map(({ g, y }) => {
              const lag = groupLag(state, g);
              const tone = TONE[g.state === "rebalancing" ? "amber" : lagTone(lag)];
              const dim = isDim("group", g.id);
              return (
                <g
                  key={g.id}
                  className="cursor-pointer"
                  opacity={dim ? 0.3 : 1}
                  style={{ transition: "opacity 250ms ease" }}
                  onMouseEnter={() => setHover({ kind: "group", id: g.id })}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onInspectGroup(g.id)}
                >
                  <rect
                    x={GROUP.x}
                    y={y}
                    width={GROUP.w}
                    height={GROUP.h}
                    rx="8"
                    fill="#111827"
                    stroke={hover?.kind === "group" && hover.id === g.id ? tone.hex : "#1c2739"}
                    strokeWidth="1"
                  />
                  <rect x={GROUP.x} y={y} width="3" height={GROUP.h} rx="1.5" fill={tone.hex} />
                  <text x={GROUP.x + 12} y={y + 19} className="font-mono" fontSize="10.5" fontWeight="600" fill="#e2e8f0">
                    {g.name.length > 22 ? `${g.name.slice(0, 21)}…` : g.name}
                  </text>
                  <text x={GROUP.x + 12} y={y + 32} className="font-mono" fontSize="8.5" fill="#64748b">
                    {g.members.length} members · gen {g.members[0]?.generation ?? 0}
                  </text>
                  <text x={GROUP.x + 12} y={y + 47} className="font-mono" fontSize="8.5" fill="#475569">
                    {g.state === "rebalancing" ? "REBALANCING…" : `${g.topics.length} subscribed topic(s)`}
                  </text>
                  <text x={GROUP.x + GROUP.w - 11} y={y + 34} textAnchor="end" className="font-mono" fontSize="15" fontWeight="700" fill={tone.hex}>
                    {fmtNum(lag)}
                  </text>
                  <text x={GROUP.x + GROUP.w - 11} y={y + 45} textAnchor="end" className="font-mono" fontSize="7.5" fill="#475569">
                    lag
                  </text>
                  <rect x={GROUP.x + 12} y={y + GROUP.h - 8} width={GROUP.w - 24} height="2.5" rx="1.25" fill="#1c2739" />
                  <rect
                    x={GROUP.x + 12}
                    y={y + GROUP.h - 8}
                    width={Math.max(2, Math.min(1, lag / 220) * (GROUP.w - 24))}
                    height="2.5"
                    rx="1.25"
                    fill={tone.hex}
                  />
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-edge/60 px-1 pt-2.5 font-mono text-[9.5px] text-dim">
          {[
            ["#8b5cf6", "event stream"],
            ["#10b981", "in-sync / lag ≤ 24"],
            ["#f59e0b", "consumer lag / rebalance"],
            ["#f43f5e", "lag critical / broker down"],
          ].map(([c, label]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className="h-[2px] w-5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
              {label}
            </span>
          ))}
          <span className="ml-auto hidden sm:inline">edge density ∝ committed lag</span>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* ledger */}
        <Panel
          title="Topic Ledger"
          sub="per-topic configuration & live write pressure"
          icon={<Layers className="h-3.5 w-3.5" />}
          accent="ice"
          bodyClass="p-0"
        >
          <div className="divide-y divide-edge/50">
            {state.topics.map((t: Topic) => {
              const accent = ACCENT[t.accent];
              const tps = t.partitions.reduce((a, p) => a + p.tps, 0);
              const head = t.partitions.reduce((a, p) => a + p.headOffset, 0);
              const bytes = t.partitions.reduce((a, p) => a + p.messages.reduce((b, m) => b + m.bytes, 0), 0);
              const subs = state.groups.filter((g) => g.topics.includes(t.id));
              const on = selectedTopic?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "group cursor-pointer px-3.5 py-3 transition-colors duration-200",
                    on ? "bg-white/[0.035]" : "hover:bg-white/[0.02]",
                  )}
                  onClick={() => setSelected({ topicId: t.id, partition: Math.min(selected.partition, t.partitions.length - 1) })}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: accent.hex, boxShadow: `0 0 10px ${accent.hex}66` }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[12px] font-semibold text-slate-100">{t.name}</p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-dim">
                        {t.partitions.length} partitions · rf={t.replicationFactor} · min.isr={t.minInsync} · retention {t.retentionHrs}h ·{" "}
                        {fmtBytes(bytes)} buffered
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Btn
                        size="sm"
                        tone="ice"
                        variant="ghost"
                        title="Remove a partition (triggers rebalance)"
                        disabled={t.partitions.length <= 1}
                        onClick={() => dispatch({ type: "scale-partitions", topicId: t.id, delta: -1 })}
                      >
                        <Minus className="h-3 w-3" />
                      </Btn>
                      <span className="font-mono text-[10px] tabular text-slate-400">{t.partitions.length}</span>
                      <Btn
                        size="sm"
                        tone="ice"
                        variant="ghost"
                        title="Add a partition (triggers rebalance)"
                        disabled={t.partitions.length >= 6}
                        onClick={() => dispatch({ type: "scale-partitions", topicId: t.id, delta: 1 })}
                      >
                        <Plus className="h-3 w-3" />
                      </Btn>
                      <Btn
                        size="sm"
                        tone="amber"
                        variant="ghost"
                        title="Purge this topic's buffered segments"
                        onClick={() => dispatch({ type: "purge", topicId: t.id })}
                      >
                        <Eraser className="h-3 w-3" />
                      </Btn>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 pl-[15px]">
                    <div className="w-28">
                      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-600">write {tps.toFixed(1)}/s</p>
                      <Sparkline
                        data={Array.from({ length: t.partitions[0]?.tpsHistory.length ?? 0 }, (_, i) =>
                          t.partitions.reduce((a, p) => a + (p.tpsHistory[i] ?? 0), 0),
                        )}
                        color={accent.hex}
                        height={16}
                        strokeWidth={1.2}
                      />
                    </div>
                    <div className="font-mono text-[10px] text-dim">
                      head <span className="tabular text-slate-300">{fmtNum(head)}</span>
                    </div>
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      {subs.map((g) => {
                        const lag = groupLag(state, g);
                        const gt = TONE[lagTone(lag)];
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onInspectGroup(g.id);
                            }}
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[9px] transition-all duration-200 hover:brightness-125",
                              gt.border,
                              gt.bg,
                              gt.text,
                            )}
                            title={`Inspect ${g.name}`}
                          >
                            {g.name}
                            <span className="tabular opacity-80">Δ{fmtNum(lag)}</span>
                          </button>
                        );
                      })}
                      {subs.length === 0 && <span className="font-mono text-[9.5px] text-slate-600">no subscribers</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* inspector */}
        <div className="space-y-4">
          {selectedTopic && selectedPartition ? (
            <Panel
              title={`${selectedTopic.name} — Partition ${selectedPartition.id}`}
              sub={`leader broker-${selectedPartition.leader} · isr [${selectedPartition.isr.join(", ")}] · ${selectedPartition.messages.length} buffered records`}
              icon={<Boxes className="h-3.5 w-3.5" />}
              accent={selectedTopic.accent}
              bodyClass="p-3"
              actions={
                <div className="flex items-center gap-1.5">
                  {selectedTopic.partitions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected({ topicId: selectedTopic.id, partition: p.id })}
                      className={cn(
                        "rounded border px-1.5 py-0.5 font-mono text-[10px] transition-all duration-200",
                        selected.partition === p.id
                          ? cn(TONE[selectedTopic.accent].border, TONE[selectedTopic.accent].bg, TONE[selectedTopic.accent].text)
                          : "border-edge text-slate-500 hover:border-edge-2 hover:text-slate-300",
                      )}
                    >
                      P{p.id}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <StatTile label="head offset" value={fmtNum(selectedPartition.headOffset)} tone={selectedTopic.accent} />
                <StatTile
                  label="throughput"
                  value={selectedPartition.tps.toFixed(1)}
                  unit="msg/s"
                  tone="ice"
                />
                <StatTile
                  label="max lag"
                  value={fmtNum(Math.max(0, ...partitionLag(state, selectedTopic.id, selectedPartition.id).map((l) => l.lag)))}
                  tone="amber"
                />
                <StatTile
                  label="buffered"
                  value={fmtBytes(selectedPartition.messages.reduce((a, m) => a + m.bytes, 0))}
                  tone="slate"
                />
              </div>

              <div className="mt-3 space-y-1.5">
                {partitionLag(state, selectedTopic.id, selectedPartition.id).map((l) => (
                  <div key={l.group} className="flex items-center gap-2">
                    <span className="w-40 shrink-0 truncate font-mono text-[10px] text-slate-400">{l.group}</span>
                    <Meter value={l.lag} max={220} tone={lagTone(l.lag)} height={4} className="flex-1" />
                    <span className={cn("w-12 shrink-0 text-right font-mono text-[10px] tabular", TONE[lagTone(l.lag)].text)}>
                      Δ{l.lag}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 border-t border-edge/60 pt-2.5">
                <p className="mb-1.5 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                  <Activity className="h-3 w-3" /> log segment tail (newest first)
                </p>
                {messages.length === 0 ? (
                  <EmptyNote icon={<Boxes className="h-4 w-4" />}>
                    Segment empty — buffer purged or no records produced yet.
                  </EmptyNote>
                ) : (
                  <div className="max-h-[330px] overflow-y-auto pr-1">
                    {messages.map((m) => {
                      const open = openMsg === m.id;
                      const st = m.status === "delivered" ? TONE.emerald : m.status === "dlq" ? TONE.rose : TONE.violet;
                      return (
                        <div key={m.id} className={cn("border-b border-edge/40 last:border-0", m.origin === "manual" && "bg-violet-500/[0.05]")}>
                          <button
                            type="button"
                            onClick={() => setOpenMsg(open ? null : m.id)}
                            className="flex w-full items-center gap-2 px-1 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
                          >
                            <ChevronDown className={cn("h-3 w-3 shrink-0 text-slate-600 transition-transform duration-200", open && "rotate-180")} />
                            <span className="w-16 shrink-0 font-mono text-[10px] tabular text-slate-400">
                              {fmtNum(m.offset)}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-slate-300">{m.key}</span>
                            <span className={cn("hidden shrink-0 font-mono text-[9px] sm:inline", st.text)}>
                              {m.status === "dlq" ? "→ dlq" : m.status}
                            </span>
                            <span className="w-14 shrink-0 text-right font-mono text-[9px] text-slate-600">{fmtBytes(m.bytes)}</span>
                            <span className="w-14 shrink-0 text-right font-mono text-[9px] text-slate-600">{ago(m.ts, now)}</span>
                          </button>
                          {open && (
                            <div className="pop-in space-y-2 px-1 pb-2.5 pl-6">
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(m.headers).map(([k, v]) => (
                                  <span key={k} className="rounded border border-edge bg-black/30 px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
                                    <span className="text-slate-600">{k}:</span> {v}
                                  </span>
                                ))}
                              </div>
                              <JsonView value={m.payload} maxHeight={190} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Panel>
          ) : (
            <Panel title="Partition Inspector" icon={<Boxes className="h-3.5 w-3.5" />}>
              <EmptyNote>Select a partition tile in the broker graph.</EmptyNote>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
