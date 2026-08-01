import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, CheckCircle2, Info } from "lucide-react";
import Header, { type TabId } from "./components/Header";
import ClusterRibbon from "./components/ClusterRibbon";
import TopicTopology from "./components/TopicTopology";
import EventProducer from "./components/EventProducer";
import ConsumerGroupMonitor from "./components/ConsumerGroupMonitor";
import DeadLetterQueue from "./components/DeadLetterQueue";
import StatusBar from "./components/StatusBar";
import { TONE } from "./components/ui";
import { useCluster } from "./sim/useCluster";
import { autoRequest, hex } from "./sim/engine";
import { cn } from "./utils/cn";
import type { Accent } from "./sim/types";

const TAB_ORDER: TabId[] = ["topology", "producer", "consumers", "dlq"];

function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-mesh" />
      <div className="absolute inset-0 bg-grid" />
      <div className="scanline absolute inset-0 overflow-hidden" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-void via-void/70 to-transparent" />
    </div>
  );
}

function Toasts({ cluster }: { cluster: ReturnType<typeof useCluster> }) {
  const { toasts } = cluster;
  return (
    <div className="pointer-events-none fixed right-3 top-[76px] z-50 flex w-[min(360px,calc(100vw-1.5rem))] flex-col gap-2 sm:right-5">
      {toasts.map((t) => {
        const tone = TONE[t.tone as Accent];
        const Icon = t.tone === "rose" ? AlertOctagon : t.tone === "amber" ? AlertOctagon : CheckCircle2;
        return (
          <div
            key={t.id}
            className={cn("toast-in panel pointer-events-auto relative overflow-hidden rounded-lg border p-3 pr-7", tone.border)}
            style={{ boxShadow: `0 12px 40px -18px ${tone.hex}, 0 0 0 1px rgba(0,0,0,.4)` }}
          >
            <span className="absolute inset-y-0 left-0 w-[2px]" style={{ background: tone.hex }} />
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-px h-4 w-4 shrink-0", tone.text)} />
              <div className="min-w-0">
                <p className="font-display text-[12.5px] font-semibold leading-tight text-slate-100">{t.title}</p>
                <p className="mt-0.5 font-mono text-[10px] leading-snug text-slate-400">{t.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const cluster = useCluster();
  const { state, dispatch, toast } = cluster;
  const [tab, setTab] = useState<TabId>("topology");
  const [focusGroup, setFocusGroup] = useState<string | null>(null);
  const [renderKey, setRenderKey] = useState(0);

  const go = useCallback((t: TabId) => {
    setTab(t);
    setRenderKey((k) => k + 1);
  }, []);

  const publishTestEvent = useCallback(() => {
    const topic = state.topics[Math.floor(Math.random() * state.topics.length)];
    if (!topic) return;
    const sample = autoRequest(topic, Date.now());
    dispatch({
      type: "publish",
      req: {
        topicId: topic.id,
        key: sample.key,
        headers: { ...sample.headers, "trace-id": hex(16), "x-source": "quick-action" },
        payload: { ...sample.payload, test_event: true },
        strategy: Math.random() > 0.5 ? "key-hash" : "round-robin",
        partition: 0,
        burst: Math.random() > 0.7 ? 3 : 1,
        poison: false,
        origin: "manual",
      },
    });
    toast({ title: "Test event published", body: `${topic.name} · key=${sample.key} · acks=all`, tone: topic.accent });
  }, [state.topics, dispatch, toast]);

  const purgeBuffers = useCallback(() => {
    const bytes = state.topics.reduce(
      (a, t) => a + t.partitions.reduce((b, p) => b + p.messages.reduce((c, m) => c + m.bytes, 0), 0),
      0,
    );
    dispatch({ type: "purge", topicId: "all" });
    toast({
      title: "Topic buffers purged",
      body: `${state.topics.length} topics truncated · ~${Math.max(1, Math.round(bytes / 1024))} KB reclaimed · offsets reset to LOG_END`,
      tone: "amber",
    });
  }, [state.topics, dispatch, toast]);

  /* keyboard: 1-4 switch tabs, space toggles the stream */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      const idx = ["1", "2", "3", "4"].indexOf(e.key);
      if (idx >= 0) {
        e.preventDefault();
        go(TAB_ORDER[idx]);
      }
      if (e.code === "Space") {
        e.preventDefault();
        dispatch({ type: "toggle-run" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, dispatch]);

  const openGroup = (id: string) => {
    setFocusGroup(id);
    go("consumers");
  };

  return (
    <div className="relative flex min-h-screen flex-col">
      <Ambient />

      <Header
        cluster={cluster}
        tab={tab}
        onTab={(t) => {
          if (t !== "consumers") setFocusGroup(null);
          go(t);
        }}
        onPublishTest={publishTestEvent}
        onPurge={purgeBuffers}
      />

      <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 pb-2 pt-4 sm:px-5">
        <div className="space-y-4">
          <ClusterRibbon cluster={cluster} />

          <div key={`${tab}-${renderKey}`}>
            {tab === "topology" && <TopicTopology cluster={cluster} onInspectGroup={openGroup} />}
            {tab === "producer" && <EventProducer cluster={cluster} />}
            {tab === "consumers" && <ConsumerGroupMonitor cluster={cluster} focusId={focusGroup} />}
            {tab === "dlq" && <DeadLetterQueue cluster={cluster} />}
          </div>

          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pb-2 pt-1 text-center font-mono text-[9.5px] text-slate-700">
            <span className="inline-flex items-center gap-1">
              <Info className="h-3 w-3" /> EventPulse is an in-browser simulator — no real brokers were harmed
            </span>
            <span className="hidden text-edge-2 sm:inline">·</span>
            <span>
              shortcuts <span className="text-slate-500">1–4</span> switch views · <span className="text-slate-500">space</span>{" "}
              pause stream · <span className="text-slate-500">⌘↵</span> publish
            </span>
          </p>
        </div>
      </main>

      <Toasts cluster={cluster} />
      <StatusBar cluster={cluster} />
    </div>
  );
}
