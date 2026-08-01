import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Braces,
  CheckCircle2,
  Dice5,
  Gauge,
  Hash,
  Plus,
  Radio,
  Send,
  Skull,
  Terminal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { ACCENT, autoRequest, fmtBytes, fmtNum, groupLag, hashKey, hex } from "../sim/engine";
import type { PartitionStrategy } from "../sim/types";
import { Badge, Btn, Panel, Segmented, Sparkline, StatTile, TONE } from "./ui";

type Row = { k: string; v: string; id: string };
type Packet = { id: string; lane: number; kind: "produce" | "consume"; poison: boolean };

const STRATEGIES: { value: PartitionStrategy; label: string; icon: ReactNode }[] = [
  { value: "round-robin", label: "round-robin", icon: <Radio className="h-3 w-3" /> },
  { value: "key-hash", label: "key-hash", icon: <Hash className="h-3 w-3" /> },
  { value: "sticky", label: "sticky", icon: <Braces className="h-3 w-3" /> },
  { value: "manual", label: "manual", icon: <Terminal className="h-3 w-3" /> },
];

export default function EventProducer({ cluster }: { cluster: Cluster }) {
  const { state, dispatch, toast } = cluster;
  const [topicId, setTopicId] = useState(state.topics[0]?.id ?? "");
  const topic = state.topics.find((t) => t.id === topicId) ?? state.topics[0];
  const accent = ACCENT[topic?.accent ?? "violet"];

  const [key, setKey] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [payloadText, setPayloadText] = useState("");
  const [strategy, setStrategy] = useState<PartitionStrategy>("key-hash");
  const [manualPartition, setManualPartition] = useState(0);
  const [burst, setBurst] = useState(1);
  const [poison, setPoison] = useState(false);
  const [packets, setPackets] = useState<Packet[]>([]);
  const [feed, setFeed] = useState<"topic" | "all" | "mine">("topic");
  const [published, setPublished] = useState(0);
  const laneRef = useRef(0);
  const timers = useRef<number[]>([]);

  /* seed the studio from a realistic generated event whenever topic changes */
  const reseed = useCallback(
    (tid: string) => {
      const t = state.topics.find((x) => x.id === tid);
      if (!t) return;
      const sample = autoRequest(t, Date.now());
      setKey(sample.key);
      setPayloadText(JSON.stringify(sample.payload, null, 2));
      setRows(
        Object.entries(sample.headers).map(([k, v]) => ({
          id: `${k}-${Math.random().toString(36).slice(2, 7)}`,
          k,
          v,
        })),
      );
      setManualPartition(0);
    },
    [state.topics],
  );

  useEffect(() => {
    reseed(topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  /* ⌘/ctrl + enter publishes */
  const parse = useMemo(() => {
    try {
      return { ok: true as const, value: JSON.parse(payloadText) as Record<string, unknown> };
    } catch (e) {
      return { ok: false as const, error: (e as Error).message };
    }
  }, [payloadText]);

  const spawnPackets = (lanes: number[], isPoison: boolean) => {
    lanes.forEach((lane, i) => {
      const id = `pk_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`;
      const t1 = window.setTimeout(() => {
        setPackets((prev) => [...prev.slice(-20), { id, lane, kind: "produce", poison: isPoison && i === lanes.length - 1 }]);
      }, i * 90);
      const t2 = window.setTimeout(() => setPackets((prev) => prev.filter((p) => p.id !== id)), 1400 + i * 90);
      timers.current.push(t1, t2);
    });
  };

  const publish = () => {
    if (!topic || !parse.ok) {
      toast({
        title: "Publish rejected",
        body: parse.ok ? "no topic selected" : `invalid JSON payload — ${parse.error}`,
        tone: "rose",
      });
      return;
    }
    const parts = topic.partitions.length;
    const lanes: number[] = [];
    for (let i = 0; i < burst; i++) {
      const k = burst > 1 ? `${key}-${i}` : key;
      let lane = 0;
      if (strategy === "manual") lane = Math.min(manualPartition, parts - 1);
      else if (strategy === "key-hash" && k) lane = hashKey(k) % parts;
      else {
        laneRef.current = (laneRef.current + 1) % parts;
        lane = laneRef.current;
      }
      lanes.push(lane);
    }
    spawnPackets(lanes, poison);
    dispatch({
      type: "publish",
      req: {
        topicId: topic.id,
        key,
        headers: Object.fromEntries(rows.filter((r) => r.k.trim()).map((r) => [r.k.trim(), r.v])),
        payload: parse.value,
        strategy,
        partition: manualPartition,
        burst,
        poison,
        origin: "manual",
      },
    });
    setPublished((p) => p + burst);
    toast({
      title: `${burst} record${burst > 1 ? "s" : ""} published`,
      body: `${topic.name} · acks=all · isr=3${poison ? " · poison flag set — expect DLQ route" : ""}`,
      tone: poison ? "rose" : "violet",
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        publish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const acks = state.acks.filter((a) => {
    if (feed === "all") return true;
    if (feed === "mine") return a.origin === "manual";
    return a.topicId === topic?.id;
  });
  const acked = acks.filter((a) => a.status === "acked");
  const avgLatency = acks.length ? acks.reduce((a, x) => a + x.latencyMs, 0) / acks.length : 0;

  return (
    <div className="stagger-in space-y-4">
      {/* ── lane canvas ─────────────────────────────── */}
      <Panel
        title="Producer → Partition Lanes → Consumer Groups"
        sub={
          topic
            ? `${topic.name} · strategy=${strategy}${strategy === "manual" ? `:P${manualPartition}` : ""} · acks=all · linger.ms=5`
            : "no topic selected"
        }
        icon={<Send className="h-3.5 w-3.5" />}
        accent={topic?.accent ?? "violet"}
        bodyClass="p-3 sm:p-4"
        actions={
          <Badge tone={poison ? "rose" : state.running ? "violet" : "slate"} pulse={state.running && !poison}>
            {poison ? "poison armed" : state.running ? "accepting writes" : "paused"}
          </Badge>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[132px_minmax(0,1fr)_150px]">
          <div className="flex items-center justify-center">
            <div
              className={cn(
                "w-full rounded-lg border px-3 py-3 text-center transition-all duration-300",
                accent.border,
                accent.bg,
              )}
            >
              <Send className={cn("mx-auto h-4 w-4", accent.text)} />
              <p className="mt-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-200">producer</p>
              <p className="font-mono text-[9px] text-dim">svc-pulse-studio</p>
              <p className="mt-1.5 font-mono text-[9px] text-slate-500">
                sent <span className={accent.text}>{fmtNum(published)}</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            {(topic?.partitions ?? []).map((p) => {
              const lanePackets = packets.filter((pk) => pk.lane === p.id);
              const lag = Math.max(
                0,
                ...state.groups.filter((g) => g.topics.includes(topic.id)).map((g) => p.headOffset - (g.committed[topic.id]?.[p.id] ?? p.headOffset)),
              );
              const lt = TONE[lag > 90 ? "rose" : lag > 24 ? "amber" : "emerald"];
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <span
                    className={cn(
                      "w-7 shrink-0 font-mono text-[10px] font-semibold",
                      lanePackets.length ? accent.text : "text-slate-500",
                    )}
                  >
                    P{p.id}
                  </span>
                  <div className="relative h-7 flex-1 overflow-hidden rounded border border-edge/70 bg-black/40">
                    <div
                      className={cn("absolute inset-0 opacity-70", state.running && p.tps > 0 && "lane-flow")}
                      style={{ opacity: state.running && p.tps > 0 ? 0.7 : 0.12 }}
                    />
                    <div className="absolute inset-y-0 right-0 w-px bg-edge-2" />
                    {lanePackets.map((pk) => (
                      <span
                        key={pk.id}
                        className={cn("lane-packet h-2.5 w-2.5 rounded-full", pk.poison && "lane-packet-slow")}
                        style={{
                          background: pk.poison ? TONE.rose.hex : accent.hex,
                          boxShadow: `0 0 10px 2px ${pk.poison ? "rgba(244,63,94,.6)" : `${accent.hex}66`}`,
                        }}
                      />
                    ))}
                    <span className="absolute inset-y-0 left-2 flex items-center font-mono text-[9px] text-slate-600">
                      L{p.leader} · isr[{p.isr.join(",")}]
                    </span>
                    <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[9.5px] tabular text-slate-400">
                      {fmtNum(p.headOffset)}
                    </span>
                  </div>
                  <span className={cn("w-11 shrink-0 text-right font-mono text-[9.5px] tabular", lt.text)}>Δ{lag}</span>
                </div>
              );
            })}
          </div>

          <div className="space-y-1.5">
            {state.groups
              .filter((g) => g.topics.includes(topic?.id ?? ""))
              .map((g) => {
                const lag = groupLag(state, g);
                const gt = TONE[g.state === "rebalancing" ? "amber" : lag > 90 ? "rose" : lag > 24 ? "amber" : "emerald"];
                return (
                  <div
                    key={g.id}
                    className={cn("rounded-lg border px-2.5 py-1.5 transition-all duration-300", gt.border, "bg-panel-2/70")}
                  >
                    <p className="truncate font-mono text-[10px] font-semibold text-slate-200">{g.name}</p>
                    <p className="mt-0.5 flex items-center justify-between font-mono text-[9px] text-dim">
                      <span>{g.state === "rebalancing" ? "rebalancing" : `${g.members.length} members`}</span>
                      <span className={cn("tabular", gt.text)}>Δ{fmtNum(lag)}</span>
                    </p>
                  </div>
                );
              })}
            {state.groups.filter((g) => g.topics.includes(topic?.id ?? "")).length === 0 && (
              <p className="rounded border border-dashed border-edge px-2 py-3 text-center font-mono text-[9.5px] text-slate-600">
                no subscribed groups
              </p>
            )}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
        {/* ── payload studio ────────────────────────── */}
        <Panel
          title="Payload Studio"
          sub="monospace JSON builder · headers · partitioner"
          icon={<Braces className="h-3.5 w-3.5" />}
          accent="violet"
          bodyClass="p-3 sm:p-4"
          actions={
            <>
              <Btn
                size="sm"
                tone="ice"
                variant="ghost"
                title="Generate a fresh realistic event for this topic"
                onClick={() => reseed(topicId)}
              >
                <Dice5 className="h-3 w-3" />
                sample
              </Btn>
              <Btn
                size="sm"
                tone="slate"
                variant="ghost"
                title="Re-format payload"
                disabled={!parse.ok}
                onClick={() => parse.ok && setPayloadText(JSON.stringify(parse.value, null, 2))}
              >
                prettify
              </Btn>
            </>
          }
        >
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">target topic</p>
              <div className="flex flex-wrap gap-1.5">
                {state.topics.map((t) => {
                  const on = t.id === topicId;
                  const ta = ACCENT[t.accent];
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTopicId(t.id)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 font-mono text-[10.5px] transition-all duration-200",
                        on ? cn(ta.border, ta.bg, ta.text, "shadow-[0_0_18px_-6px_currentColor]") : "border-edge bg-black/25 text-slate-500 hover:border-edge-2 hover:text-slate-300",
                      )}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                  message key <Hash className="h-3 w-3" />
                </span>
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  spellCheck={false}
                  className="w-full rounded-md border border-edge bg-black/45 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 outline-none transition-colors focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                  placeholder="partitioning key"
                />
                {strategy === "key-hash" && (
                  <span className="mt-1 block font-mono text-[9px] text-slate-600">
                    murmur2("{key || "∅"}") % {topic?.partitions.length ?? 3} → P
                    {key ? hashKey(key) % (topic?.partitions.length ?? 1) : 0}
                  </span>
                )}
              </label>

              <div>
                <span className="mb-1 block font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">partitioner</span>
                <Segmented options={STRATEGIES} value={strategy} onChange={setStrategy} tone="violet" className="flex-wrap" />
                {strategy === "manual" && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {(topic?.partitions ?? []).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setManualPartition(p.id)}
                        className={cn(
                          "rounded border px-2 py-0.5 font-mono text-[10px] transition-colors",
                          manualPartition === p.id ? cn(accent.border, accent.bg, accent.text) : "border-edge text-slate-500 hover:text-slate-300",
                        )}
                      >
                        P{p.id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                record headers
                <Btn
                  size="sm"
                  tone="slate"
                  variant="ghost"
                  onClick={() => setRows((r) => [...r, { id: hex(5), k: "x-", v: "" }])}
                >
                  <Plus className="h-3 w-3" />
                  header
                </Btn>
              </p>
              <div className="space-y-1.5">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <input
                      value={r.k}
                      spellCheck={false}
                      onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, k: e.target.value } : x)))}
                      className="w-[34%] rounded border border-edge bg-black/45 px-2 py-1 font-mono text-[10.5px] text-sky-300 outline-none focus:border-sky-500/50"
                    />
                    <span className="font-mono text-[10px] text-slate-700">:</span>
                    <input
                      value={r.v}
                      spellCheck={false}
                      onChange={(e) => setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, v: e.target.value } : x)))}
                      className="min-w-0 flex-1 rounded border border-edge bg-black/45 px-2 py-1 font-mono text-[10.5px] text-slate-300 outline-none focus:border-sky-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => setRows((prev) => prev.filter((x) => x.id !== r.id))}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded border border-transparent text-slate-600 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
                      title="remove header"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {rows.length === 0 && (
                  <p className="rounded border border-dashed border-edge px-2 py-2 text-center font-mono text-[10px] text-slate-600">
                    no headers attached
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-1.5 flex items-center justify-between font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
                value payload (json)
                <span className="flex items-center gap-2">
                  <span className={cn("flex items-center gap-1", parse.ok ? "text-emerald-400" : "text-rose-400")}>
                    {parse.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {parse.ok ? `${fmtBytes(new Blob([payloadText]).size)} · valid` : parse.error.slice(0, 44)}
                  </span>
                </span>
              </p>
              <textarea
                value={payloadText}
                spellCheck={false}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={11}
                className={cn(
                  "w-full resize-y rounded-md border bg-black/55 p-2.5 font-mono text-[11px] leading-[1.6] text-slate-200 outline-none transition-colors",
                  parse.ok ? "border-edge focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/25" : "border-rose-500/50 focus:ring-1 focus:ring-rose-500/30",
                )}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-edge/60 pt-3">
              <label className="flex items-center gap-2">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">burst</span>
                <input
                  type="range"
                  min={1}
                  max={12}
                  value={burst}
                  onChange={(e) => setBurst(Number(e.target.value))}
                  className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-edge accent-violet-500 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-400"
                />
                <span className="w-5 font-mono text-[11px] tabular text-slate-300">{burst}</span>
              </label>

              <button
                type="button"
                onClick={() => setPoison((p) => !p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-all duration-200",
                  poison
                    ? cn("hatch border-rose-500/50 text-rose-300")
                    : "border-edge bg-white/[0.02] text-slate-500 hover:border-rose-500/30 hover:text-rose-300/80",
                )}
                title="Mark the last record of the batch as a poison pill — consumers will route it to the DLQ"
              >
                <Skull className="h-3.5 w-3.5" />
                poison pill
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span className="hidden font-mono text-[9.5px] text-slate-600 sm:inline">⌘/ctrl + ↵</span>
                <Btn
                  tone={poison ? "rose" : "violet"}
                  variant="solid"
                  onClick={publish}
                  disabled={!parse.ok}
                  className="px-4 py-2 text-[12.5px]"
                >
                  <Send className="h-4 w-4" />
                  Publish Event{burst > 1 ? ` ×${burst}` : ""}
                </Btn>
              </div>
            </div>
          </div>
        </Panel>

        {/* ── delivery confirmations ────────────────── */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <StatTile label="session published" value={fmtNum(published)} unit="rec" tone="violet" />
            <StatTile
              label="avg delivery"
              value={avgLatency.toFixed(0)}
              unit="ms"
              tone={avgLatency > 400 ? "amber" : "emerald"}
            />
            <StatTile label="acked" value={fmtNum(acked.length)} unit={`/ ${acks.length}`} tone="emerald" />
            <StatTile
              label="nacked → dlq"
              value={fmtNum(acks.length - acked.length)}
              tone="rose"
            />
          </div>

          <Panel
            title="Consumer Delivery Confirmations"
            sub="live acknowledgement feed from subscribed groups"
            icon={<Gauge className="h-3.5 w-3.5" />}
            accent="emerald"
            bodyClass="p-0"
            actions={<Segmented
              tone="emerald"
              value={feed}
              onChange={setFeed}
              options={[
                { value: "topic", label: "topic" },
                { value: "mine", label: "mine" },
                { value: "all", label: "all" },
              ]}
            />}
          >
            <div className="max-h-[430px] overflow-y-auto">
              {acks.length === 0 ? (
                <div className="p-4">
                  <p className="rounded-lg border border-dashed border-edge px-3 py-8 text-center font-mono text-[11px] text-slate-500">
                    awaiting consumer polls — publish an event to see acknowledgements
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-edge/40">
                  {acks.map((a) => {
                    const t = state.topics.find((x) => x.id === a.topicId);
                    const ok = a.status === "acked";
                    const tone = ok ? TONE.emerald : TONE.rose;
                    return (
                      <li
                        key={a.id}
                        className={cn(
                          "pop-in flex items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-white/[0.025]",
                          a.origin === "manual" && "bg-violet-500/[0.05]",
                        )}
                      >
                        <span className="h-6 w-[2px] shrink-0 rounded-full" style={{ background: tone.hex }} />
                        {ok ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />}
                        <span className="w-[132px] shrink-0 font-mono text-[9.5px] text-slate-500">
                          {new Date(a.ts).toLocaleTimeString("en-GB", { hour12: false })}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-slate-300">
                          <span style={{ color: t ? ACCENT[t.accent].hex : undefined }}>{a.topicId}</span>
                          <span className="text-slate-600">-</span>
                          {a.partition}
                          <span className="text-slate-600">@</span>
                          <span className="tabular">{fmtNum(a.offset)}</span>
                          <span className="text-slate-600"> → </span>
                          <span className="text-slate-400">{a.group}</span>
                          <span className="text-slate-700">/{a.member}</span>
                        </span>
                        <span
                          className={cn(
                            "w-14 shrink-0 text-right font-mono text-[10px] tabular",
                            a.latencyMs > 500 ? "text-amber-300" : a.latencyMs > 150 ? "text-slate-400" : "text-emerald-300",
                          )}
                        >
                          {a.latencyMs}ms
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className="border-t border-edge/60 px-3 py-2">
              <Sparkline data={state.consumeHistory.slice(-32)} color="#10b981" height={26} />
              <p className="mt-1 flex items-center justify-between font-mono text-[9px] text-slate-600">
                <span>cluster consume rate (last 32 ticks)</span>
                <span className="text-emerald-400">{state.consumeHistory[state.consumeHistory.length - 1]?.toFixed(1) ?? "0.0"} msg/s</span>
              </p>
            </div>
          </Panel>

          <Panel
            title="Producer Console"
            sub="last events from the studio & broker acks"
            icon={<Terminal className="h-3.5 w-3.5" />}
            accent="slate"
            bodyClass="p-0"
            actions={
              <Btn size="sm" tone="amber" variant="ghost" onClick={() => dispatch({ type: "purge", topicId: topic?.id ?? "all" })}>
                <Trash2 className="h-3 w-3" />
                purge buffer
              </Btn>
            }
          >
            <div className="max-h-[190px] overflow-y-auto bg-black/35 p-2.5 font-mono text-[10.5px] leading-relaxed">
              {state.logs
                .filter((l) => l.channel === "producer-studio" || l.channel === "log-cleaner" || l.level === "error")
                .slice(0, 24)
                .map((l) => (
                  <p key={l.id} className="rise-in flex gap-2">
                    <span className="shrink-0 text-slate-700">{new Date(l.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>
                    <span
                      className={cn(
                        "shrink-0 uppercase",
                        l.level === "error" ? "text-rose-400" : l.level === "warn" ? "text-amber-400" : l.level === "success" ? "text-emerald-400" : "text-sky-400",
                      )}
                    >
                      {l.level}
                    </span>
                    <span className="min-w-0 break-words text-slate-400">{l.text}</span>
                  </p>
                ))}
              <p className="flex gap-2 text-slate-600">
                <span className="shrink-0 text-slate-700">{new Date().toLocaleTimeString("en-GB", { hour12: false })}</span>
                <span className="text-violet-400">await</span>
                <span className="caret">▌</span>
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
