import { useMemo, useState } from "react";
import {
  AlertOctagon,
  ArchiveRestore,
  ChevronDown,
  Eraser,
  Inbox,
  Play,
  Search,
  Skull,
  Trash2,
} from "lucide-react";
import { cn } from "../utils/cn";
import type { Cluster } from "../sim/useCluster";
import { ACCENT, ago, autoRequest, fmtNum, hex } from "../sim/engine";
import { Badge, Btn, EmptyNote, Meter, Panel, Segmented, Sparkline, StatTile, TONE } from "./ui";
import JsonView from "./JsonView";

type StatusFilter = "open" | "replayed" | "discarded" | "all";

export default function DeadLetterQueue({ cluster }: { cluster: Cluster }) {
  const { state, dispatch, toast, now } = cluster;
  const [status, setStatus] = useState<StatusFilter>("open");
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return state.dlq.filter((d) => {
      if (status !== "all" && d.status !== status) return false;
      if (topicFilter !== "all" && d.topicId !== topicFilter) return false;
      if (!needle) return true;
      return (
        d.key.toLowerCase().includes(needle) ||
        d.error.toLowerCase().includes(needle) ||
        d.code.toLowerCase().includes(needle) ||
        d.group.toLowerCase().includes(needle) ||
        String(d.offset).includes(needle)
      );
    });
  }, [state.dlq, status, topicFilter, q]);

  const counts = useMemo(() => {
    const open = state.dlq.filter((d) => d.status === "open").length;
    const replayed = state.dlq.filter((d) => d.status === "replayed").length;
    const discarded = state.dlq.filter((d) => d.status === "discarded").length;
    const byCode = new Map<string, number>();
    state.dlq.forEach((d) => byCode.set(d.error, (byCode.get(d.error) ?? 0) + 1));
    return { open, replayed, discarded, byCode: [...byCode.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  }, [state.dlq]);

  /* failure rate bucketed over the last ~40 windows of 5s */
  const failSeries = useMemo(() => {
    const buckets = new Array(40).fill(0) as number[];
    const t = Date.now();
    state.dlq.forEach((d) => {
      const idx = 39 - Math.floor((t - d.ts) / 5000);
      if (idx >= 0 && idx < 40) buckets[idx] += 1;
    });
    return buckets;
  }, [state.dlq, now]);

  const failRate = state.stats.produced ? (state.stats.failed / state.stats.produced) * 100 : 0;

  const injectPoison = () => {
    const topic = state.topics.find((t) => t.id === "payments.charged") ?? state.topics[0];
    const sample = autoRequest(topic, Date.now());
    dispatch({
      type: "publish",
      req: {
        topicId: topic.id,
        key: sample.key,
        headers: { ...sample.headers, "trace-id": hex(16), "fault-injection": "true" },
        payload: { ...sample.payload, amount_cents: null, fault_injected: true },
        strategy: "round-robin",
        partition: 0,
        burst: 1,
        poison: true,
        origin: "manual",
      },
    });
    toast({
      title: "Poison record injected",
      body: `${topic.name} — consumers will route it to dlq.${topic.name} on next poll`,
      tone: "rose",
    });
  };

  return (
    <div className="stagger-in space-y-4">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <StatTile label="open records" value={fmtNum(counts.open)} tone={counts.open > 0 ? "rose" : "emerald"} hint="awaiting triage" />
        <StatTile label="replayed" value={fmtNum(counts.replayed)} tone="emerald" hint="re-published to source topic" />
        <StatTile label="discarded" value={fmtNum(counts.discarded)} tone="slate" hint="tombstoned after 7d" />
        <StatTile label="failure rate" value={failRate.toFixed(3)} unit="%" tone={failRate > 0.5 ? "rose" : failRate > 0.15 ? "amber" : "emerald"} hint={`${fmtNum(state.stats.failed)} total faults`} />
        <div className="panel-flat col-span-2 overflow-hidden rounded-lg px-3 py-2.5 lg:col-span-1">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">fault rate / 5s</p>
          <Sparkline data={failSeries} color="#f43f5e" height={30} className="mt-1" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Panel
          title="dlq.* — Dead Letter Records"
          sub={`${entries.length} of ${state.dlq.length} record(s) shown · retention 7d · max.retries=3`}
          icon={<AlertOctagon className="h-3.5 w-3.5" />}
          accent="rose"
          bodyClass="p-0"
          actions={
            <>
              <Btn size="sm" tone="rose" variant="ghost" onClick={injectPoison} title="Inject a poison record">
                <Skull className="h-3 w-3" />
                inject
              </Btn>
              <Btn
                size="sm"
                tone="emerald"
                variant="ghost"
                disabled={counts.open === 0}
                onClick={() => {
                  state.dlq.filter((d) => d.status === "open").forEach((d) => dispatch({ type: "replay", id: d.id }));
                  toast({ title: "Bulk replay dispatched", body: `${counts.open} record(s) re-published to source topics`, tone: "emerald" });
                }}
              >
                <Play className="h-3 w-3" />
                replay all
              </Btn>
              <Btn
                size="sm"
                tone="amber"
                variant="ghost"
                disabled={state.dlq.length === 0}
                onClick={() => {
                  dispatch({ type: "purge-dlq" });
                  toast({ title: "DLQ truncated", body: `${state.dlq.length} record(s) dropped`, tone: "amber" });
                }}
              >
                <Eraser className="h-3 w-3" />
                truncate
              </Btn>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-edge/60 bg-black/20 px-3 py-2">
            <Segmented
              tone="rose"
              value={status}
              onChange={setStatus}
              options={[
                { value: "open", label: "open" },
                { value: "replayed", label: "replayed" },
                { value: "discarded", label: "dropped" },
                { value: "all", label: "all" },
              ]}
            />
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-600" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="filter by key, error, code, group, offset…"
                spellCheck={false}
                className="w-full rounded-md border border-edge bg-black/45 py-1 pl-7 pr-2 font-mono text-[10.5px] text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/25"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setTopicFilter("all")}
                className={cn(
                  "rounded border px-1.5 py-0.5 font-mono text-[9.5px] transition-colors",
                  topicFilter === "all" ? "border-slate-500/40 bg-white/10 text-slate-200" : "border-edge text-slate-500 hover:text-slate-300",
                )}
              >
                all topics
              </button>
              {state.topics.map((t) => {
                const n = state.dlq.filter((d) => d.topicId === t.id && d.status === "open").length;
                const on = topicFilter === t.id;
                const ta = ACCENT[t.accent];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTopicFilter(on ? "all" : t.id)}
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[9.5px] transition-colors",
                      on ? cn(ta.border, ta.bg, ta.text) : "border-edge text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {t.name}
                    {n > 0 && <span className={cn("ml-1 tabular", on ? "" : "text-rose-400")}>{n}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-h-[560px] overflow-y-auto">
            {entries.length === 0 ? (
              <div className="p-4">
                <EmptyNote icon={<Inbox className="h-5 w-5" />}>
                  {state.dlq.length === 0
                    ? "No dead-letter records yet. Faults appear here as soon as a consumer rejects a record — or inject one manually."
                    : "No records match the current filters."}
                </EmptyNote>
              </div>
            ) : (
              <ul className="divide-y divide-edge/40">
                {entries.map((d) => {
                  const t = state.topics.find((x) => x.id === d.topicId);
                  const ta = ACCENT[t?.accent ?? "rose"];
                  const open = openId === d.id;
                  const st = d.status === "open" ? TONE.rose : d.status === "replayed" ? TONE.emerald : TONE.slate;
                  return (
                    <li key={d.id} className={cn("pop-in relative", d.status === "open" && "hatch")}>
                      <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: st.hex }} />
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 bg-panel/80 px-3 py-2.5">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? null : d.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        >
                          <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-200", open && "rotate-180")} />
                          <span className={cn("shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold", st.border, st.bg, st.text)}>
                            {d.code}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-mono text-[11.5px] font-semibold text-slate-100">{d.error}</span>
                            <span className="mt-0.5 block truncate font-mono text-[9.5px] text-dim">
                              <span style={{ color: ta.hex }}>{d.topicId}</span>-{d.partition}@{fmtNum(d.offset)} · key={d.key} ·{" "}
                              {d.group} · retries={d.retries}
                            </span>
                          </span>
                        </button>
                        <span className="shrink-0 font-mono text-[9.5px] text-slate-500">{ago(d.ts, now)}</span>
                        {d.status === "open" ? (
                          <span className="flex shrink-0 gap-1.5">
                            <Btn size="sm" tone="emerald" variant="outline" onClick={() => dispatch({ type: "replay", id: d.id })}>
                              <ArchiveRestore className="h-3 w-3" />
                              replay
                            </Btn>
                            <Btn size="sm" tone="slate" variant="ghost" onClick={() => dispatch({ type: "discard", id: d.id })}>
                              <Trash2 className="h-3 w-3" />
                              discard
                            </Btn>
                          </span>
                        ) : (
                          <Badge tone={d.status === "replayed" ? "emerald" : "slate"} pulse={false}>
                            {d.status}
                          </Badge>
                        )}
                      </div>
                      {open && (
                        <div className="pop-in space-y-2.5 border-t border-edge/50 bg-black/45 px-4 py-3">
                          <div className="grid gap-2 sm:grid-cols-3">
                            {[
                              ["source", `${d.topicId}-${d.partition}`],
                              ["offset", fmtNum(d.offset)],
                              ["consumer group", d.group],
                              ["retries", `${d.retries}/3`],
                              ["record key", d.key],
                              ["captured", new Date(d.ts).toLocaleString("en-GB", { hour12: false })],
                            ].map(([k, v]) => (
                              <div key={k} className="rounded border border-edge/70 bg-panel-2/60 px-2 py-1.5">
                                <p className="font-mono text-[8.5px] uppercase tracking-wider text-slate-600">{k}</p>
                                <p className="truncate font-mono text-[10.5px] text-slate-300">{v}</p>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">stack trace</p>
                            <pre className="overflow-x-auto rounded-md border border-rose-500/25 bg-rose-950/15 p-2.5 font-mono text-[10px] leading-relaxed text-rose-200/80">
                              {d.detail}
                            </pre>
                          </div>
                          <div>
                            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">offending payload</p>
                            <JsonView value={d.payload} maxHeight={200} />
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title="Failure Breakdown"
            sub="records by exception class"
            icon={<AlertOctagon className="h-3.5 w-3.5" />}
            accent="rose"
            bodyClass="p-3"
          >
            {counts.byCode.length === 0 ? (
              <EmptyNote icon={<Inbox className="h-4 w-4" />}>No failures recorded in this session.</EmptyNote>
            ) : (
              <div className="space-y-2.5">
                {counts.byCode.map(([error, n]) => {
                  const max = counts.byCode[0][1] || 1;
                  const tone = error.includes("Timeout") ? TONE.amber : error.includes("Downstream") ? TONE.amber : TONE.rose;
                  return (
                    <div key={error}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-mono text-[10.5px] text-slate-300">{error}</span>
                        <span className={cn("shrink-0 font-mono text-[10.5px] tabular", tone.text)}>{n}</span>
                      </div>
                      <Meter value={n} max={max} tone={error.includes("Timeout") || error.includes("Downstream") ? "amber" : "rose"} height={5} className="mt-1" striped />
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>

          <Panel
            title="Routing Rules"
            sub="error.handler = DeadLetterTopicRouter"
            icon={<Skull className="h-3.5 w-3.5" />}
            accent="amber"
            bodyClass="p-3"
          >
            <ul className="space-y-2 font-mono text-[10px] leading-relaxed text-slate-400">
              {[
                ["errors.deadletterqueue.topic.name", "dlq.{topic}"],
                ["errors.deadletterqueue.topic.enable", "true"],
                ["errors.tolerance", "error"],
                ["errors.log.enable", "true"],
                ["errors.log.include.messages", "true"],
                ["errors.retry.max", "3"],
                ["errors.retry.backoff.ms", "2000"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-2 border-b border-edge/40 pb-1.5 last:border-0">
                  <span className="min-w-0 break-all text-slate-500">{k}</span>
                  <span className="shrink-0 text-amber-300">{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-md border border-amber-500/25 bg-amber-500/[0.07] px-2.5 py-2 font-mono text-[9.5px] leading-relaxed text-amber-200/80">
              Records exceeding retry budget are forwarded with headers <span className="text-amber-300">kafka_error_cause</span>,{" "}
              <span className="text-amber-300">kafka_error_topic</span> and <span className="text-amber-300">kafka_error_offset</span> for
              downstream triage.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
