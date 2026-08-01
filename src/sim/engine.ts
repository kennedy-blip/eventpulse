import type {
  AckEntry,
  BrokerNode,
  ClusterState,
  ConsumerGroup,
  DLQEntry,
  LogEntry,
  Member,
  Message,
  Partition,
  PublishRequest,
  Topic,
  Level,
} from "./types";

export const TICK_MS = 900;

/* ─────────────────────────── helpers ─────────────────────────── */

let seq = 0;
const HEX = "0123456789abcdef";
export const hex = (n: number) => {
  let s = "";
  for (let i = 0; i < n; i++) s += HEX[Math.floor(Math.random() * 16)];
  return s;
};
export const uid = (p = "id") => `${p}_${(++seq).toString(36)}${hex(4)}`;
export const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
export const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
export const chance = (p: number) => Math.random() < p;
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const hashKey = (k: string) => {
  let h = 0;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
  return h;
};
export const fmtNum = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtBytes = (n: number) => {
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1048576).toFixed(2)} MB`;
  return `${(n / 1073741824).toFixed(2)} GB`;
};
export const fmtClock = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-GB", { hour12: false }) +
  "." +
  String(new Date(ts).getMilliseconds()).padStart(3, "0");
export const fmtUptime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
export const ago = (ts: number, now = Date.now()) => {
  const d = Math.max(0, now - ts) / 1000;
  if (d < 1) return "just now";
  if (d < 60) return `${Math.floor(d)}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
};

export const ACCENT: Record<
  string,
  { hex: string; text: string; bg: string; border: string; soft: string; dot: string }
> = {
  violet: {
    hex: "#8b5cf6",
    text: "text-violet-300",
    bg: "bg-violet-500/12",
    border: "border-violet-500/35",
    soft: "rgba(139,92,246,0.14)",
    dot: "bg-violet-400",
  },
  emerald: {
    hex: "#10b981",
    text: "text-emerald-300",
    bg: "bg-emerald-500/12",
    border: "border-emerald-500/35",
    soft: "rgba(16,185,129,0.14)",
    dot: "bg-emerald-400",
  },
  amber: {
    hex: "#f59e0b",
    text: "text-amber-300",
    bg: "bg-amber-500/12",
    border: "border-amber-500/35",
    soft: "rgba(245,158,11,0.14)",
    dot: "bg-amber-400",
  },
  rose: {
    hex: "#f43f5e",
    text: "text-rose-300",
    bg: "bg-rose-500/12",
    border: "border-rose-500/35",
    soft: "rgba(244,63,94,0.14)",
    dot: "bg-rose-400",
  },
  ice: {
    hex: "#38bdf8",
    text: "text-sky-300",
    bg: "bg-sky-500/12",
    border: "border-sky-500/35",
    soft: "rgba(56,189,248,0.14)",
    dot: "bg-sky-400",
  },
};

export const LEVEL_STYLE: Record<Level, { text: string; tag: string; bar: string }> = {
  info: { text: "text-slate-300", tag: "text-sky-300", bar: "bg-sky-400/70" },
  success: { text: "text-emerald-200/90", tag: "text-emerald-300", bar: "bg-emerald-400/70" },
  warn: { text: "text-amber-200/90", tag: "text-amber-300", bar: "bg-amber-400/70" },
  error: { text: "text-rose-200/90", tag: "text-rose-300", bar: "bg-rose-400/70" },
};

/* ─────────────────────── payload generators ──────────────────── */

const COUNTRIES = ["US", "DE", "GB", "JP", "BR", "IN", "FR", "CA", "AU", "NG", "SE", "MX"];
const PLANS = ["free", "pro", "enterprise"];
const METHODS = ["visa", "mastercard", "amex", "sepa_debit", "ach", "apple_pay", "klarna"];
const CHANNELS = ["web", "ios", "android", "pos-terminal", "partner-api"];
const DOMAINS = ["gmail.com", "proton.me", "fastmail.com", "outlook.com", "corp.io"];
const NAMES = ["a.novak", "k.ito", "m.silva", "j.okafor", "l.haddad", "s.larsen", "r.mehta", "t.kim"];
const WAREHOUSES = ["wh-fra1", "wh-iad4", "wh-nrt2", "wh-gru1", "wh-syd3"];

export function autoRequest(topic: Topic, now: number): Omit<PublishRequest, "strategy" | "partition" | "burst"> {
  const iso = new Date(now).toISOString();
  const trace = `${hex(8)}-${hex(4)}-${hex(4)}-${hex(12)}`;
  const base = {
    "content-type": "application/json",
    "trace-id": trace,
    "schema-version": "v1",
    producer: `svc-${topic.name.split(".")[0]}-producer`,
  };

  if (topic.id === "user.signup.v1") {
    const id = `usr_${hex(10)}`;
    return {
      topicId: topic.id,
      key: id,
      headers: { ...base, "event-type": "user.signup" },
      payload: {
        event: "user.signup",
        user_id: id,
        email: `${pick(NAMES)}@${pick(DOMAINS)}`,
        plan: pick(PLANS),
        country: pick(COUNTRIES),
        device: pick(["ios", "android", "web"]),
        trial_days: 14,
        referral: chance(0.3) ? `usr_${hex(6)}` : null,
        created_at: iso,
      },
      poison: chance(topic.poisonRate),
      origin: "auto",
    };
  }
  if (topic.id === "orders.processed") {
    const id = `ord_${hex(10)}`;
    return {
      topicId: topic.id,
      key: id,
      headers: { ...base, "event-type": "order.processed" },
      payload: {
        event: "order.processed",
        order_id: id,
        customer_id: `usr_${hex(8)}`,
        items: randInt(1, 7),
        subtotal_cents: randInt(1200, 148000),
        currency: pick(["USD", "EUR", "GBP", "JPY"]),
        channel: pick(CHANNELS),
        fulfillment: pick(["ship", "pickup", "digital"]),
        region: pick(COUNTRIES),
        processed_at: iso,
      },
      poison: chance(topic.poisonRate),
      origin: "auto",
    };
  }
  if (topic.id === "payments.charged") {
    const id = `pay_${hex(10)}`;
    const risk = Number(rand(0.01, 1).toFixed(3));
    return {
      topicId: topic.id,
      key: id,
      headers: { ...base, "event-type": "payment.charged", "risk-tier": risk > 0.85 ? "high" : "low" },
      payload: {
        event: "payment.charged",
        payment_id: id,
        order_id: `ord_${hex(8)}`,
        amount_cents: risk > 0.97 ? null : randInt(900, 220000),
        currency: pick(["USD", "EUR", "GBP"]),
        method: pick(METHODS),
        status: "captured",
        risk_score: risk,
        three_ds: chance(0.4),
        charged_at: iso,
      },
      poison: chance(topic.poisonRate) || risk > 0.97,
      origin: "auto",
    };
  }
  const sku = `SKU-${randInt(10000, 99999)}`;
  return {
    topicId: topic.id,
    key: sku,
    headers: { ...base, "event-type": "inventory.delta" },
    payload: {
      event: "inventory.delta",
      sku,
      warehouse: pick(WAREHOUSES),
      delta: randInt(-120, 400),
      on_hand: randInt(0, 5200),
      reserved: randInt(0, 340),
      synced_at: iso,
    },
    poison: chance(topic.poisonRate),
    origin: "auto",
  };
}

export function buildMessage(
  req: Omit<PublishRequest, "strategy" | "partition" | "burst">,
  partition: number,
  offset: number,
  now: number,
): Message {
  const body = JSON.stringify(req.payload);
  const headersBytes = Object.entries(req.headers).reduce((a, [k, v]) => a + k.length + v.length, 0);
  return {
    id: uid("msg"),
    offset,
    key: req.key,
    topicId: req.topicId,
    partition,
    headers: req.headers,
    payload: req.payload,
    ts: now,
    bytes: body.length + headersBytes + 64,
    poison: req.poison,
    status: "queued",
    origin: req.origin ?? "auto",
  };
}

const ERRORS: Array<{ code: string; error: string; detail: string }> = [
  {
    code: "SR-409",
    error: "IncompatibleSchemaException",
    detail:
      "io.confluent.kafka.schemaregistry.rest.exceptions.RestIncompatibleSchemaException: Incompatible schema change for subject payments.charged-value (v3 -> v5, compatibility=BACKWARD). Missing required field: amount_cents",
  },
  {
    code: "KFK-013",
    error: "SerializationException",
    detail:
      "org.apache.kafka.common.errors.SerializationException: Error deserializing Avro message for id 8f31ac : Cannot read field \"amount_cents\" because record is null",
  },
  {
    code: "NET-503",
    error: "DownstreamUnavailable",
    detail:
      "com.eventpulse.sink.DownstreamUnavailableException: HTTP 503 from fraud-scanner.internal:8443 after 3 retries (backoff=1500ms). Circuit breaker OPEN for 30s",
  },
  {
    code: "DB-235",
    error: "NullConstraintViolation",
    detail:
      "org.postgresql.util.PSQLException: ERROR: null value in column \"order_id\" of relation \"ledger_entries\" violates not-null constraint (23502)",
  },
  {
    code: "KFK-010",
    error: "RecordTooLargeException",
    detail:
      "org.apache.kafka.common.errors.RecordTooLargeException: The message is 1048612 bytes when serialized which is larger than 1048576, the value of max.request.size",
  },
  {
    code: "TMO-30s",
    error: "TimeoutException",
    detail:
      "org.apache.kafka.common.errors.TimeoutException: Expiring 1 record(s) for orders.processed-2:30032 ms has passed since batch creation (delivery.timeout.ms=30000)",
  },
  {
    code: "POISON",
    error: "PoisonPillRecord",
    detail:
      "com.eventpulse.consumer.FatalRecordException: Unhandled exception on record; retries exhausted (max.retries=3, retry.backoff.ms=2000). Routing to dead-letter topic.",
  },
];

function makeDLQError(topic: Topic): { code: string; error: string; detail: string } {
  if (topic.id === "payments.charged") return pick(ERRORS.slice(0, 4).concat(ERRORS[6]));
  if (topic.id === "inventory.sync.v2") return pick([ERRORS[3], ERRORS[5], ERRORS[6], ERRORS[1]]);
  return pick(ERRORS);
}

/* ───────────────────────── initial state ─────────────────────── */

const TOPIC_DEFS = [
  { id: "user.signup.v1", accent: "violet" as const, weight: 1.1, poisonRate: 0.022, retentionHrs: 168 },
  { id: "orders.processed", accent: "ice" as const, weight: 1.5, poisonRate: 0.018, retentionHrs: 72 },
  { id: "payments.charged", accent: "emerald" as const, weight: 1.25, poisonRate: 0.031, retentionHrs: 720 },
  { id: "inventory.sync.v2", accent: "amber" as const, weight: 0.8, poisonRate: 0.014, retentionHrs: 24 },
];

const GROUP_DEFS = [
  {
    id: "cg-checkout-service",
    name: "cg-checkout-service",
    owner: "team-payments",
    topics: ["orders.processed", "payments.charged"],
    members: 3,
    baseLag: 34,
  },
  {
    id: "cg-analytics-lake",
    name: "cg-analytics-lake",
    owner: "team-data-platform",
    topics: ["user.signup.v1", "orders.processed", "payments.charged", "inventory.sync.v2"],
    members: 4,
    baseLag: 140,
  },
  {
    id: "cg-notify-worker",
    name: "cg-notify-worker",
    owner: "team-growth",
    topics: ["user.signup.v1"],
    members: 2,
    baseLag: 5,
  },
  {
    id: "cg-fraud-scanner",
    name: "cg-fraud-scanner",
    owner: "team-risk",
    topics: ["payments.charged"],
    members: 1,
    baseLag: 58,
  },
];

function makeNode(id: number): BrokerNode {
  return {
    id,
    host: `kfk-broker-${id}.pulse.io`,
    rack: ["us-east-1a", "us-east-1b", "us-east-1c"][id],
    role: id === 0 ? "controller" : "replica",
    state: "healthy",
    cpu: rand(28, 52),
    disk: rand(38, 61),
    netIn: rand(14, 38),
    netOut: rand(18, 44),
    outFor: 0,
    leaders: 0,
  };
}

function makePartition(p: number, seed: number, leader: number): Partition {
  const isr = [leader, ...[0, 1, 2].filter((n) => n !== leader).slice(0, 1)].sort();
  return {
    id: p,
    leader,
    isr,
    headOffset: seed + p * randInt(20, 90),
    messages: [],
    tps: 0,
    tpsHistory: Array.from({ length: 32 }, () => rand(0, 6)),
  };
}

function makeMembers(g: (typeof GROUP_DEFS)[number]): Member[] {
  return Array.from({ length: g.members }, (_, i) => ({
    id: `consumer-${i + 1}`,
    host: `${g.name.replace("cg-", "")}-${hex(4)}-${i}`,
    generation: randInt(18, 40),
    state: "stable" as const,
    assigned: [],
    processed: randInt(4000, 90000),
    latencyMs: rand(4, 40),
  }));
}

export function assignPartitions(groups: ConsumerGroup[], topics: Topic[]): ConsumerGroup[] {
  return groups.map((g) => {
    const slots: string[] = [];
    g.topics.forEach((tid) => {
      const t = topics.find((x) => x.id === tid);
      if (!t) return;
      t.partitions.forEach((p) => slots.push(`${tid}:${p.id}`));
    });
    const members = g.members.map((m) => ({ ...m, assigned: [] as string[] }));
    slots.forEach((slot, i) => {
      const m = members[i % Math.max(1, members.length)];
      if (m) m.assigned.push(slot);
    });
    return { ...g, members };
  });
}

export function createInitialState(): ClusterState {
  const nodes = [makeNode(0), makeNode(1), makeNode(2)];
  const now = Date.now();

  const topics: Topic[] = TOPIC_DEFS.map((def, ti) => ({
    id: def.id,
    name: def.id,
    accent: def.accent,
    weight: def.weight,
    poisonRate: def.poisonRate,
    retentionHrs: def.retentionHrs,
    replicationFactor: 3,
    minInsync: 2,
    partitions: Array.from({ length: 3 }, (_, p) =>
      makePartition(p, randInt(1_200_000, 4_900_000) + ti * 400, (ti + p) % 3),
    ),
  }));

  const groups: ConsumerGroup[] = GROUP_DEFS.map((g) => {
    const committed: Record<string, number[]> = {};
    g.topics.forEach((tid) => {
      const t = topics.find((x) => x.id === tid)!;
      committed[tid] = t.partitions.map((p) => Math.max(0, p.headOffset - randInt(0, g.baseLag)));
    });
    return {
      id: g.id,
      name: g.name,
      owner: g.owner,
      topics: g.topics,
      members: makeMembers(g),
      committed,
      state: "stable",
      rebalanceTimer: 0,
      rebalances: randInt(1, 6),
      tps: 0,
      lagHistory: Array.from({ length: 40 }, () => rand(0, g.baseLag)),
      tpsHistory: Array.from({ length: 40 }, () => rand(0, 8)),
      committedAcks: randInt(900, 40000),
    };
  });

  const withAssignments = assignPartitions(groups, topics);

  // Seed each partition buffer with a believable backlog tail.
  withAssignments.forEach(() => {});
  topics.forEach((topic) => {
    topic.partitions.forEach((p) => {
      const backlog: Message[] = [];
      for (let i = 12; i >= 1; i--) {
        const req = autoRequest(topic, now - i * 1200);
        backlog.push(buildMessage(req, p.id, p.headOffset - i, now - i * 1200));
      }
      p.messages = backlog;
    });
  });

  // Mark already-consumed backlog as delivered for the busiest group.
  const busiest = withAssignments[1];
  topics.forEach((topic) => {
    topic.partitions.forEach((p) => {
      const c = busiest?.committed[topic.id]?.[p.id] ?? 0;
      p.messages = p.messages.map((m) => (m.offset <= c ? { ...m, status: "delivered" } : m));
    });
  });

  nodes.forEach((n) => {
    n.leaders = topics.reduce((a, t) => a + t.partitions.filter((p) => p.leader === n.id).length, 0);
  });

  const logs: LogEntry[] = [
    log("success", "controller", "Controller elected: kfk-broker-0.pulse.io (epoch 41)", now - 9000),
    log("info", "cluster", `Metadata refreshed — ${topics.length} topics, ${topics.length * 3} partitions, replication.factor=3`, now - 7200),
    log("info", "cg-analytics-lake", "Group coordinator assigned generation 34 (protocol=range, 4 members)", now - 5400),
    log("warn", "cg-fraud-scanner", "Consumer lag exceeded watermark 24 on payments.charged-1 — autoscaler notified", now - 3100),
    log("success", "broker-2", "ISR expanded to [1,2] for orders.processed-0", now - 1200),
  ];

  return {
    tick: 0,
    running: true,
    rate: 1,
    failureBias: 0.35,
    nodes,
    topics,
    groups: withAssignments,
    dlq: [],
    logs,
    acks: [],
    flights: [],
    produceHistory: Array.from({ length: 48 }, () => rand(2, 9)),
    consumeHistory: Array.from({ length: 48 }, () => rand(2, 8)),
    lagHistory: Array.from({ length: 48 }, () => rand(30, 90)),
    stats: {
      produced: 8_412_903,
      consumed: 8_412_610,
      failed: 293,
      bytes: 4_812_990_120,
      rebalances: 12,
      purges: 0,
      startedAt: now - 1000 * 60 * 60 * 7.4,
    },
  };
}

/* ─────────────────────── derived selectors ───────────────────── */

export const topicById = (s: ClusterState, id: string) => s.topics.find((t) => t.id === id);

export function groupLag(s: ClusterState, g: ConsumerGroup): number {
  let lag = 0;
  g.topics.forEach((tid) => {
    const t = topicById(s, tid);
    if (!t) return;
    t.partitions.forEach((p) => {
      lag += Math.max(0, p.headOffset - (g.committed[tid]?.[p.id] ?? p.headOffset));
    });
  });
  return lag;
}

export function partitionLag(s: ClusterState, topicId: string, pid: number): { group: string; lag: number }[] {
  const t = topicById(s, topicId);
  const p = t?.partitions[pid];
  if (!p) return [];
  return s.groups
    .filter((g) => g.topics.includes(topicId))
    .map((g) => ({
      group: g.name,
      lag: Math.max(0, p.headOffset - (g.committed[topicId]?.[pid] ?? p.headOffset)),
    }));
}

export function totalLag(s: ClusterState) {
  return s.groups.reduce((a, g) => a + groupLag(s, g), 0);
}

export function clusterHealth(s: ClusterState) {
  const down = s.nodes.filter((n) => n.state === "down").length;
  const degraded = s.nodes.filter((n) => n.state === "degraded").length;
  const errRate = s.dlq.filter((d) => d.status === "open" && Date.now() - d.ts < 60_000).length;
  const rebalancing = s.groups.some((g) => g.state === "rebalancing");
  if (down > 0)
    return {
      label: `Broker Cluster: Degraded (${s.nodes.length - down}/${s.nodes.length} Nodes)`,
      tone: "rose" as const,
      detail: `${down} broker(s) out of service — leaders reassigned`,
    };
  if (errRate > 6)
    return {
      label: `Broker Cluster: Error Spike (${s.nodes.length} Nodes)`,
      tone: "amber" as const,
      detail: `${errRate} records routed to DLQ in last 60s`,
    };
  if (rebalancing || degraded > 0)
    return {
      label: `Broker Cluster: Rebalancing (${s.nodes.length} Nodes)`,
      tone: "amber" as const,
      detail: "consumer group membership churn detected",
    };
  return {
    label: `Broker Cluster: Healthy (${s.nodes.length} Nodes)`,
    tone: "emerald" as const,
    detail: "all ISR replicas in sync",
  };
}

/* ─────────────────────────── actions ─────────────────────────── */

export type Action =
  | { type: "tick" }
  | { type: "toggle-run" }
  | { type: "set-rate"; rate: number }
  | { type: "set-failure-bias"; value: number }
  | { type: "publish"; req: PublishRequest; toast?: boolean }
  | { type: "purge"; topicId: string | "all" }
  | { type: "replay"; id: string }
  | { type: "discard"; id: string }
  | { type: "purge-dlq" }
  | { type: "rebalance"; groupId: string | "random" }
  | { type: "failover"; nodeId: number | "random" }
  | { type: "scale-partitions"; topicId: string; delta: number }
  | { type: "reset-offsets"; groupId: string; to: "earliest" | "latest" }
  | { type: "reset" };

const log = (level: Level, channel: string, text: string, ts = Date.now()): LogEntry => ({
  id: uid("log"),
  ts,
  level,
  channel,
  text,
});

export type ProduceReq = Omit<PublishRequest, "burst">;

function selectPartition(topic: Topic, req: Pick<PublishRequest, "strategy" | "partition" | "key">, rr: number): number {
  const n = topic.partitions.length;
  switch (req.strategy) {
    case "manual":
      return clamp(req.partition, 0, n - 1);
    case "key-hash":
      return req.key ? hashKey(req.key) % n : rr % n;
    case "sticky":
      return rr % n;
    default:
      return rr % n;
  }
}

function appendMessages(
  topics: Topic[],
  reqs: ProduceReq[],
  now: number,
): { topics: Topic[]; created: Message[]; rr: Record<string, number> } {
  const created: Message[] = [];
  const rr: Record<string, number> = {};
  const next = topics.map((t) => ({ ...t, partitions: t.partitions.map((p) => ({ ...p, messages: p.messages.slice() })) }));

  reqs.forEach((req) => {
    const topic = next.find((t) => t.id === req.topicId);
    if (!topic) return;
    rr[topic.id] = (rr[topic.id] ?? topic.partitions.reduce((a, p) => a + p.headOffset, 0)) + 1;
    const pid = selectPartition(topic, req, rr[topic.id]);
    const part = topic.partitions[pid];
    const msg = buildMessage(req, pid, part.headOffset, now);
    part.messages = [...part.messages.slice(-39), msg];
    part.headOffset += 1;
    created.push(msg);
  });
  return { topics: next, created, rr };
}

/* ───────────────────────── tick / advance ────────────────────── */

function advance(state: ClusterState): ClusterState {
  const now = Date.now();
  const tick = state.tick + 1;
  const newLogs: LogEntry[] = [];
  const newAcks: AckEntry[] = [];
  const newDLQ: DLQEntry[] = [];
  const newFlights: { topicId: string; partition: number; kind: "produce" | "consume" }[] = [];

  const alive = state.nodes.filter((n) => n.state !== "down");
  const capacityFactor = alive.length / state.nodes.length;

  /* — nodes — */
  let nodes = state.nodes.map((n) => {
    if (n.state === "down") {
      const outFor = n.outFor - 1;
      if (outFor <= 0) {
        newLogs.push(log("success", n.host, `Broker ${n.id} rejoined the cluster — ISR sync complete (${randInt(2, 9)}s)`));
        return { ...n, state: "healthy" as const, outFor: 0, cpu: rand(45, 62), netIn: rand(20, 40), netOut: rand(22, 46) };
      }
      return { ...n, outFor, cpu: 0, netIn: 0, netOut: 0 };
    }
    return {
      ...n,
      cpu: clamp(n.cpu + rand(-7, 7) * (state.running ? 1 : 0.4) + (capacityFactor < 1 ? 4 : 0), 12, 97),
      disk: clamp(n.disk + rand(-0.4, 0.7), 20, 94),
      netIn: clamp(n.netIn + rand(-5, 5) * state.rate * capacityFactor, 2, 96),
      netOut: clamp(n.netOut + rand(-5, 5) * state.rate * capacityFactor, 2, 96),
      state: n.cpu > 93 ? ("degraded" as const) : ("healthy" as const),
    };
  });

  /* — spontaneous broker failure — */
  if (state.running && alive.length > 1 && chance(0.012 + state.failureBias * 0.02)) {
    const victim = pick(alive);
    if (victim) {
      nodes = nodes.map((n) => (n.id === victim.id ? { ...n, state: "down" as const, outFor: randInt(6, 12), cpu: 0 } : n));
      newLogs.push(
        log("error", victim.host, `Broker ${victim.id} unresponsive — socket disconnected, marking OUT_OF_SERVICE`),
      );
    }
  }

  /* — produce — */
  let topics = state.topics.map((t) => ({
    ...t,
    partitions: t.partitions.map((p) => ({ ...p, messages: p.messages.slice() })),
  }));

  let producedCount = 0;
  let producedBytes = 0;
  const producedMap: Record<string, number> = {};

  if (state.running) {
    const reqs: ProduceReq[] = [];
    topics.forEach((topic) => {
      const base = topic.weight * state.rate * capacityFactor * (alive.length > 0 ? 1 : 0);
      let n = Math.floor(base) + (chance(base % 1) ? 1 : 0);
      n = clamp(n, 0, 6);
      for (let i = 0; i < n; i++) {
        const req = autoRequest(topic, now);
        reqs.push({ ...req, strategy: "round-robin", partition: 0 });
      }
    });
    const res = appendMessages(topics, reqs, now);
    topics = res.topics;
    producedCount = res.created.length;
    producedBytes = res.created.reduce((a, m) => a + m.bytes, 0);
    res.created.forEach((m) => {
      newFlights.push({ topicId: m.topicId, partition: m.partition, kind: "produce" });
      const k = `${m.topicId}:${m.partition}`;
      producedMap[k] = (producedMap[k] ?? 0) + 1;
    });
  }

  /* — leader reassignment after failure (least-loaded survivor wins) — */
  const load: Record<number, number> = {};
  nodes.forEach((n) => (load[n.id] = 0));
  topics.forEach((t) => t.partitions.forEach((p) => (load[p.leader] = (load[p.leader] ?? 0) + 1)));
  topics = topics.map((t) => ({
    ...t,
    partitions: t.partitions.map((p) => {
      const leaderNode = nodes.find((n) => n.id === p.leader);
      if (!leaderNode || leaderNode.state !== "down") return p;
      const candidate = nodes
        .filter((n) => n.state !== "down" && n.id !== p.leader)
        .sort((a, b) => (load[a.id] ?? 0) - (load[b.id] ?? 0))[0];
      if (!candidate) return p;
      load[candidate.id] = (load[candidate.id] ?? 0) + 1;
      load[p.leader] = Math.max(0, (load[p.leader] ?? 1) - 1);
      newLogs.push(
        log("warn", `controller`, `Leader election for ${t.name}-${p.id}: broker ${p.leader} -> broker ${candidate.id} (ISR ${p.isr.join(",")})`),
      );
      return { ...p, leader: candidate.id, isr: p.isr.filter((i) => i !== p.leader).concat(candidate.id).filter((v, i, a) => a.indexOf(v) === i).sort() };
    }),
  }));

  /* — ISR shrink / re-expansion as replicas recover — */
  const healthyIds = nodes.filter((n) => n.state !== "down").map((n) => n.id);
  let isrLogs = 0;
  topics = topics.map((t) => ({
    ...t,
    partitions: t.partitions.map((p) => {
      const shrunk = Array.from(
        new Set([...p.isr.filter((i) => nodes.find((n) => n.id === i)?.state !== "down"), p.leader]),
      ).sort((a, b) => a - b);
      const target = Math.min(t.replicationFactor, healthyIds.length);
      if (shrunk.length >= target || !chance(0.09)) {
        return shrunk.length === p.isr.length && shrunk.every((v, i) => v === p.isr[i]) ? p : { ...p, isr: shrunk };
      }
      const add = healthyIds.find((i) => !shrunk.includes(i));
      if (add === undefined) return { ...p, isr: shrunk };
      const next = [...shrunk, add].sort((a, b) => a - b);
      if (isrLogs < 2) {
        newLogs.push(log("success", "controller", `ISR expanded to [${next.join(",")}] for ${t.name}-${p.id} (replica caught up)`));
        isrLogs++;
      }
      return { ...p, isr: next };
    }),
  }));

  /* — preferred-replica election keeps leadership balanced (auto.leader.rebalance) — */
  if (nodes.every((n) => n.state !== "down") && chance(0.16)) {
    const counts = nodes
      .map((n) => ({ id: n.id, c: topics.reduce((a, t) => a + t.partitions.filter((p) => p.leader === n.id).length, 0) }))
      .sort((a, b) => b.c - a.c);
    const from = counts[0];
    const to = counts[counts.length - 1];
    if (from && to && from.c - to.c >= 2) {
      let found: { tid: string; pid: number } | null = null;
      for (const t of topics) {
        for (const p of t.partitions) {
          if (p.leader === from.id && p.isr.includes(to.id)) {
            found = { tid: t.id, pid: p.id };
            break;
          }
        }
        if (found) break;
      }
      if (found) {
        const f = found;
        topics = topics.map((t) =>
          t.id !== f.tid ? t : { ...t, partitions: t.partitions.map((p) => (p.id !== f.pid ? p : { ...p, leader: to.id })) },
        );
        newLogs.push(
          log("info", "controller", `Preferred-replica election: ${f.tid}-${f.pid} leadership broker ${from.id} -> broker ${to.id}`),
        );
      }
    }
  }

  nodes = nodes.map((n) => ({
    ...n,
    leaders: topics.reduce((a, t) => a + t.partitions.filter((p) => p.leader === n.id).length, 0),
  }));

  /* — partition throughput — */
  topics = topics.map((t) => ({
    ...t,
    partitions: t.partitions.map((p) => {
      const produced = producedMap[`${t.id}:${p.id}`] ?? 0;
      const tps = p.tps * 0.55 + ((produced * 1000) / TICK_MS) * 0.45;
      return { ...p, tps, tpsHistory: [...p.tpsHistory.slice(-31), tps] };
    }),
  }));

  /* — consume — */
  let consumedTotal = 0;
  let failedCount = 0;
  const perSecond = 1000 / TICK_MS;

  const groups = state.groups.map((g) => {
    if (g.state === "rebalancing") {
      const timer = g.rebalanceTimer - 1;
      if (timer <= 0) {
        const members = g.members.map((m, i) => ({
          ...m,
          state: "stable" as const,
          generation: m.generation + 1,
          latencyMs: rand(6, 44),
          host: i === g.members.length - 1 && chance(0.5) ? `${g.name.replace("cg-", "")}-${hex(4)}-${i}` : m.host,
        }));
        newLogs.push(
          log("success", g.name, `Rebalance complete — generation ${members[0]?.generation ?? 1}, ${members.length} members, ${g.topics.length * 3} partitions assigned`),
        );
        return { ...g, state: "stable" as const, rebalanceTimer: 0, members, tps: 0, tpsHistory: [...g.tpsHistory.slice(-39), 0] };
      }
      return { ...g, rebalanceTimer: timer, tps: 0, tpsHistory: [...g.tpsHistory.slice(-39), 0] };
    }

    if (!state.running) return { ...g, tps: 0 };

    const committed: Record<string, number[]> = {};
    let groupConsumed = 0;
    const memberHits = new Map<string, number>();

    g.topics.forEach((tid) => {
      const topic = topics.find((t) => t.id === tid);
      if (!topic) {
        committed[tid] = g.committed[tid] ?? [];
        return;
      }
      // proportional-drain model: consumption tracks inflow with a group-specific
      // efficiency, plus a backlog term — so lag settles in a band and spikes on
      // rebalance / broker loss / rate increases instead of pinning to zero.
      const inflow = (topic.weight * state.rate * capacityFactor) / Math.max(1, topic.partitions.length);
      const efficiency = clamp(0.4 + 0.15 * g.members.length, 0.2, 0.97);
      committed[tid] = topic.partitions.map((p) => {
        const cur = g.committed[tid]?.[p.id] ?? p.headOffset;
        const lag = Math.max(0, p.headOffset - cur);
        if (lag === 0) return cur;
        const drain = inflow * efficiency + lag * 0.03;
        let take = Math.round(drain * rand(0.55, 1.5));
        if (take === 0 && lag <= 6 && chance(0.7)) take = 1;
        const cap = clamp(take, 0, lag);
        const nextOff = cur + cap;
        if (cap > 0) {
          groupConsumed += cap;
          consumedTotal += cap;
          newFlights.push({ topicId: tid, partition: p.id, kind: "consume" });
        }
        const inWindow = p.messages.filter((m) => m.offset > cur && m.offset <= nextOff);
        const ackFloor = nextOff;
        inWindow.forEach((m) => {
          const member = g.members[Math.abs(hashKey(m.id)) % Math.max(1, g.members.length)];
          if (m.poison) {
            failedCount++;
            const err = makeDLQError(topic);
            newDLQ.push({
              id: uid("dlq"),
              ts: now,
              topicId: tid,
              partition: p.id,
              offset: m.offset,
              key: m.key,
              code: err.code,
              error: err.error,
              detail: err.detail,
              group: g.name,
              retries: randInt(1, 3),
              payload: m.payload,
              status: "open",
            });
            newLogs.push(
              log("error", g.name, `${err.error} [${err.code}] on ${tid}-${p.id}@${m.offset} -> dlq.${tid}`),
            );
            newAcks.push({
              id: uid("ack"),
              ts: now,
              msgId: m.id,
              topicId: tid,
              partition: p.id,
              offset: m.offset,
              group: g.name,
              member: member?.host ?? "consumer-0",
              latencyMs: Math.round(rand(120, 2400)),
              status: "nacked",
              origin: m.origin,
            });
          } else {
            memberHits.set(member?.id ?? "", (memberHits.get(member?.id ?? "") ?? 0) + 1);
            if (m.offset >= ackFloor) {
              newAcks.push({
                id: uid("ack"),
                ts: now,
                msgId: m.id,
                topicId: tid,
                partition: p.id,
                offset: m.offset,
                group: g.name,
                member: member?.host ?? "consumer-0",
                latencyMs: Math.round(member ? member.latencyMs + rand(-2, 12) : rand(4, 40)),
                status: "acked",
                origin: m.origin,
              });
            }
          }
        });
        return nextOff;
      });
    });

    /* mark messages delivered for the fastest group only once (status is topic-scoped) */
    const members = g.members.map((m) => ({
      ...m,
      processed: m.processed + (memberHits.get(m.id) ?? 0),
      latencyMs: clamp(m.latencyMs + rand(-3, 3), 3, 220),
      state: "stable" as const,
    }));

    const tps = g.tps * 0.45 + groupConsumed * perSecond * 0.55;
    const lagNow = g.topics.reduce((a, tid) => {
      const t = topics.find((x) => x.id === tid);
      if (!t) return a;
      return a + t.partitions.reduce((b, p) => b + Math.max(0, p.headOffset - (committed[tid]?.[p.id] ?? p.headOffset)), 0);
    }, 0);

    return {
      ...g,
      committed,
      members,
      tps,
      committedAcks: g.committedAcks + groupConsumed,
      lagHistory: [...g.lagHistory.slice(-39), lagNow],
      tpsHistory: [...g.tpsHistory.slice(-39), tps],
    };
  });

  const consumedCount = consumedTotal;

  /* message statuses follow the most advanced committed offset per topic-partition */
  topics = topics.map((t) => ({
    ...t,
    partitions: t.partitions.map((p) => {
      let anyChange = false;
      const msgs = p.messages.map((m) => {
        if (m.status !== "queued") return m;
        const consumedBySome = groups.some((g) => g.topics.includes(t.id) && (g.committed[t.id]?.[p.id] ?? 0) >= m.offset);
        if (!consumedBySome) return m;
        anyChange = true;
        return { ...m, status: m.poison ? ("dlq" as const) : ("delivered" as const) };
      });
      return anyChange ? { ...p, messages: msgs } : p;
    }),
  }));

  /* — spontaneous rebalance — */
  let nextGroups = groups;
  if (state.running && chance(0.035 + state.failureBias * 0.03)) {
    const candidates = nextGroups.filter((g) => g.state === "stable");
    const victim = pick(candidates);
    if (victim) {
      const leaver = pick(victim.members);
      nextGroups = nextGroups.map((g) =>
        g.id === victim.id
          ? {
              ...g,
              state: "rebalancing" as const,
              rebalanceTimer: randInt(2, 4),
              rebalances: g.rebalances + 1,
              members: g.members.map((m) => (m.id === leaver?.id ? { ...m, state: "joining" as const } : m)),
            }
          : g,
      );
      newLogs.push(
        log("warn", victim.name, `${leaver?.host ?? "member"} heartbeat missed (session.timeout.ms=10000) — group is rebalancing`),
      );
    }
  }

  /* — lag alarm — */
  if (tick % 12 === 0) {
    nextGroups.forEach((g) => {
      const lag = g.lagHistory[g.lagHistory.length - 1] ?? 0;
      if (lag > 120) newLogs.push(log("warn", g.name, `Lag watermark breached: ${Math.round(lag)} messages behind HEAD across ${g.topics.length} topic(s)`));
    });
  }

  const lagTotal = nextGroups.reduce((a, g) => a + (g.lagHistory[g.lagHistory.length - 1] ?? 0), 0);

  return {
    ...state,
    tick,
    nodes,
    topics,
    groups: nextGroups,
    dlq: [...newDLQ.reverse(), ...state.dlq].slice(0, 80),
    logs: [...newLogs.reverse(), ...state.logs].slice(0, 140),
    acks: [...newAcks.reverse(), ...state.acks].slice(0, 90),
    flights: [
      ...state.flights.filter((f) => tick - f.born < 2),
      ...newFlights.slice(-10).map((f) => ({ ...f, id: uid("fl"), born: tick })),
    ].slice(-24),
    produceHistory: [...state.produceHistory.slice(-47), producedCount * perSecond],
    consumeHistory: [...state.consumeHistory.slice(-47), consumedCount * perSecond],
    lagHistory: [...state.lagHistory.slice(-47), lagTotal],
    stats: {
      ...state.stats,
      produced: state.stats.produced + producedCount,
      consumed: state.stats.consumed + consumedCount,
      failed: state.stats.failed + failedCount,
      bytes: state.stats.bytes + producedBytes,
    },
  };
}

/* ─────────────────────────── reducer ─────────────────────────── */

export function reducer(state: ClusterState, action: Action): ClusterState {
  const now = Date.now();
  switch (action.type) {
    case "tick":
      return state.running || state.groups.some((g) => g.state === "rebalancing") ? advance(state) : state;

    case "toggle-run": {
      return {
        ...state,
        running: !state.running,
        logs: [
          log(
            !state.running ? "success" : "warn",
            "controller",
            !state.running
              ? "Producer throughput resumed — cluster accepting writes"
              : "Producer throughput paused — consumers will drain to HEAD then idle",
            now,
          ),
          ...state.logs,
        ].slice(0, 140),
      };
    }

    case "set-rate":
      return { ...state, rate: action.rate };

    case "set-failure-bias":
      return { ...state, failureBias: action.value };

    case "publish": {
      const reqs = Array.from({ length: Math.max(1, action.req.burst) }, (_, i) => ({
        topicId: action.req.topicId,
        key: action.req.burst > 1 ? `${action.req.key}-${i}` : action.req.key,
        headers: action.req.headers,
        payload:
          action.req.burst > 1
            ? { ...action.req.payload, seq: i + 1, of: action.req.burst, published_at: new Date(now + i).toISOString() }
            : action.req.payload,
        poison: action.req.poison && i === action.req.burst - 1,
        origin: action.req.origin ?? ("manual" as const),
        strategy: action.req.strategy,
        partition: action.req.partition,
      }));
      const res = appendMessages(state.topics, reqs, now);
      const topic = res.topics.find((t) => t.id === action.req.topicId);
      const logs = [
        ...res.created
          .slice(0, 6)
          .map((m) =>
            log(
              "info",
              "producer-studio",
              `PUBLISH ${action.req.topicId}-${m.partition} offset=${m.offset} key=${m.key} (${fmtBytes(m.bytes)}) acks=all`,
              now,
            ),
          ),
        log(
          "success",
          "producer-studio",
          `Batch of ${res.created.length} record(s) acknowledged by ISR in ${randInt(3, 41)}ms -> ${topic?.name ?? ""}`,
          now,
        ),
        ...state.logs,
      ].slice(0, 140);

      return {
        ...state,
        topics: res.topics,
        logs,
        flights: [
          ...state.flights.filter((f) => state.tick - f.born < 2),
          ...res.created.map((m) => ({
            id: uid("fl"),
            topicId: m.topicId,
            partition: m.partition,
            kind: "produce" as const,
            born: state.tick,
          })),
        ].slice(-30),
        stats: {
          ...state.stats,
          produced: state.stats.produced + res.created.length,
          bytes: state.stats.bytes + res.created.reduce((a, m) => a + m.bytes, 0),
        },
      };
    }

    case "purge": {
      const targets = action.topicId === "all" ? state.topics : state.topics.filter((t) => t.id === action.topicId);
      const ids = new Set(targets.map((t) => t.id));
      let freed = 0;
      const topics = state.topics.map((t) => {
        if (!ids.has(t.id)) return t;
        freed += t.partitions.reduce((a, p) => a + p.messages.reduce((b, m) => b + m.bytes, 0), 0);
        return { ...t, partitions: t.partitions.map((p) => ({ ...p, messages: [] })) };
      });
      const groups = state.groups.map((g) => {
        const committed = { ...g.committed };
        ids.forEach((tid) => {
          const t = topics.find((x) => x.id === tid);
          if (t && committed[tid]) committed[tid] = t.partitions.map((p) => p.headOffset);
        });
        return { ...g, committed };
      });
      return {
        ...state,
        topics,
        groups,
        stats: { ...state.stats, purges: state.stats.purges + 1 },
        logs: [
          log("warn", "log-cleaner", `Buffer purged for ${[...ids].join(", ")} — ${fmtBytes(freed)} reclaimed, offsets reset to LOG_END`),
          ...state.logs,
        ].slice(0, 140),
      };
    }

    case "replay": {
      const entry = state.dlq.find((d) => d.id === action.id);
      if (!entry || entry.status !== "open") return state;
      const res = appendMessages(
        state.topics,
        [
          {
            topicId: entry.topicId,
            key: entry.key,
            headers: { "content-type": "application/json", "trace-id": hex(16), "replayed-from": `dlq.${entry.topicId}`, "schema-version": "v2" },
            payload: entry.payload,
            poison: false,
            origin: "manual" as const,
            strategy: "key-hash",
            partition: 0,
          },
        ],
        now,
      );
      const m = res.created[0];
      return {
        ...state,
        topics: res.topics,
        dlq: state.dlq.map((d) => (d.id === entry.id ? { ...d, status: "replayed" as const } : d)),
        flights: [...state.flights, { id: uid("fl"), topicId: entry.topicId, partition: m?.partition ?? 0, kind: "produce", born: state.tick }],
        logs: [
          log("success", "dlq-ops", `Replayed ${entry.topicId}-${entry.partition}@${entry.offset} -> ${entry.topicId}-${m?.partition}@${m?.offset} (${entry.code} resolved)`),
          ...state.logs,
        ].slice(0, 140),
      };
    }

    case "discard": {
      const entry = state.dlq.find((d) => d.id === action.id);
      if (!entry) return state;
      return {
        ...state,
        dlq: state.dlq.map((d) => (d.id === entry.id ? { ...d, status: "discarded" as const } : d)),
        logs: [log("warn", "dlq-ops", `Discarded ${entry.topicId}-${entry.partition}@${entry.offset} (${entry.error}) — tombstone written`), ...state.logs].slice(0, 140),
      };
    }

    case "purge-dlq": {
      const open = state.dlq.filter((d) => d.status === "open").length;
      return {
        ...state,
        dlq: [],
        logs: [log("warn", "dlq-ops", `dlq.* truncated — ${open} unresolved record(s) dropped after 7d retention`), ...state.logs].slice(0, 140),
      };
    }

    case "rebalance": {
      const target =
        action.groupId === "random" ? pick(state.groups.filter((g) => g.state === "stable")) : state.groups.find((g) => g.id === action.groupId);
      if (!target) return state;
      return {
        ...state,
        groups: state.groups.map((g) =>
          g.id === target.id
            ? {
                ...g,
                state: "rebalancing" as const,
                rebalanceTimer: 3,
                rebalances: g.rebalances + 1,
                members: g.members.map((m) => ({ ...m, state: "joining" as const })),
              }
            : g,
        ),
        stats: { ...state.stats, rebalances: state.stats.rebalances + 1 },
        logs: [log("warn", target.name, `Manual rebalance triggered — all ${target.members.length} members rejoining group (generation bump pending)`), ...state.logs].slice(0, 140),
      };
    }

    case "failover": {
      const alive = state.nodes.filter((n) => n.state !== "down");
      if (alive.length <= 1) return state;
      const target = action.nodeId === "random" ? pick(alive) : alive.find((n) => n.id === action.nodeId) ?? pick(alive);
      return {
        ...state,
        nodes: state.nodes.map((n) => (n.id === target.id ? { ...n, state: "down" as const, outFor: randInt(7, 13), cpu: 0 } : n)),
        logs: [log("error", target.host, `Controlled failover initiated — broker ${target.id} fenced, partition leadership migrating`), ...state.logs].slice(0, 140),
      };
    }

    case "scale-partitions": {
      const topic = state.topics.find((t) => t.id === action.topicId);
      if (!topic) return state;
      const count = clamp(topic.partitions.length + action.delta, 1, 6);
      if (count === topic.partitions.length) return state;
      const adding = count > topic.partitions.length;
      const partitions = adding
        ? [
            ...topic.partitions,
            ...Array.from({ length: count - topic.partitions.length }, (_, i) => {
              const p = topic.partitions.length + i;
              const leader = state.nodes.find((n) => n.state !== "down")?.id ?? 0;
              return {
                ...makePartition(p, topic.partitions[0]?.headOffset ?? 1000, (leader + p) % state.nodes.length),
                headOffset: 0,
              };
            }),
          ]
        : topic.partitions.slice(0, count);
      const topics = state.topics.map((t) => (t.id === topic.id ? { ...t, partitions } : t));
      const groups = assignPartitions(
        state.groups.map((g) => {
          if (!g.topics.includes(topic.id)) return g;
          const committed = { ...g.committed, [topic.id]: partitions.map((p) => g.committed[topic.id]?.[p.id] ?? p.headOffset) };
          return { ...g, committed, state: "rebalancing" as const, rebalanceTimer: 2, rebalances: g.rebalances + 1 };
        }),
        topics,
      );
      return {
        ...state,
        topics,
        groups,
        stats: { ...state.stats, rebalances: state.stats.rebalances + (adding ? groups.length : 0) },
        logs: [
          log(
            adding ? "info" : "warn",
            "controller",
            `${topic.name} scaled ${topic.partitions.length} -> ${count} partitions — ${groups.length} consumer group(s) rebalancing`,
          ),
          ...state.logs,
        ].slice(0, 140),
      };
    }

    case "reset-offsets": {
      const group = state.groups.find((g) => g.id === action.groupId);
      if (!group) return state;
      const committed: Record<string, number[]> = {};
      group.topics.forEach((tid) => {
        const t = state.topics.find((x) => x.id === tid);
        if (!t) return;
        committed[tid] = t.partitions.map((p) => (action.to === "latest" ? p.headOffset : Math.max(0, p.headOffset - 250)));
      });
      return {
        ...state,
        groups: state.groups.map((g) => (g.id === group.id ? { ...g, committed } : g)),
        logs: [
          log(
            action.to === "latest" ? "warn" : "info",
            group.name,
            `auto.offset.reset=${action.to} applied — committed offsets ${action.to === "latest" ? "fast-forwarded to LOG_END" : "rewound 250 records per partition"}`,
          ),
          ...state.logs,
        ].slice(0, 140),
      };
    }

    case "reset":
      return createInitialState();

    default:
      return state;
  }
}
