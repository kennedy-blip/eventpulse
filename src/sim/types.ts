export type Accent = "violet" | "emerald" | "amber" | "rose" | "ice";
export type Level = "info" | "success" | "warn" | "error";

export interface BrokerNode {
  id: number;
  host: string;
  rack: string;
  role: "controller" | "replica";
  state: "healthy" | "degraded" | "down";
  cpu: number;
  disk: number;
  netIn: number;
  netOut: number;
  outFor: number;
  leaders: number;
}

export interface Message {
  id: string;
  offset: number;
  key: string;
  topicId: string;
  partition: number;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  ts: number;
  bytes: number;
  poison: boolean;
  status: "queued" | "delivered" | "dlq";
  origin: "auto" | "manual";
}

export interface Partition {
  id: number;
  leader: number;
  isr: number[];
  headOffset: number;
  messages: Message[];
  tps: number;
  tpsHistory: number[];
}

export interface Topic {
  id: string;
  name: string;
  accent: Accent;
  weight: number;
  retentionHrs: number;
  replicationFactor: number;
  minInsync: number;
  partitions: Partition[];
  poisonRate: number;
}

export interface Member {
  id: string;
  host: string;
  generation: number;
  state: "stable" | "joining" | "left";
  assigned: string[];
  processed: number;
  latencyMs: number;
}

export interface ConsumerGroup {
  id: string;
  name: string;
  owner: string;
  topics: string[];
  members: Member[];
  /** topicId -> committed offset per partition index */
  committed: Record<string, number[]>;
  state: "stable" | "rebalancing";
  rebalanceTimer: number;
  rebalances: number;
  tps: number;
  lagHistory: number[];
  tpsHistory: number[];
  committedAcks: number;
}

export interface DLQEntry {
  id: string;
  ts: number;
  topicId: string;
  partition: number;
  offset: number;
  key: string;
  code: string;
  error: string;
  detail: string;
  group: string;
  retries: number;
  payload: Record<string, unknown>;
  status: "open" | "replayed" | "discarded";
}

export interface LogEntry {
  id: string;
  ts: number;
  level: Level;
  channel: string;
  text: string;
}

export interface AckEntry {
  id: string;
  ts: number;
  msgId: string;
  origin?: "auto" | "manual";
  topicId: string;
  partition: number;
  offset: number;
  group: string;
  member: string;
  latencyMs: number;
  status: "acked" | "nacked";
}

export interface Flight {
  id: string;
  topicId: string;
  partition: number;
  kind: "produce" | "consume";
  born: number;
}

export interface Toast {
  id: string;
  title: string;
  body: string;
  tone: Accent;
}

export interface ClusterState {
  tick: number;
  running: boolean;
  rate: number;
  failureBias: number;
  nodes: BrokerNode[];
  topics: Topic[];
  groups: ConsumerGroup[];
  dlq: DLQEntry[];
  logs: LogEntry[];
  acks: AckEntry[];
  flights: Flight[];
  produceHistory: number[];
  consumeHistory: number[];
  lagHistory: number[];
  stats: {
    produced: number;
    consumed: number;
    failed: number;
    bytes: number;
    rebalances: number;
    purges: number;
    startedAt: number;
  };
}

export type PartitionStrategy = "round-robin" | "key-hash" | "sticky" | "manual";

export interface PublishRequest {
  topicId: string;
  key: string;
  headers: Record<string, string>;
  payload: Record<string, unknown>;
  strategy: PartitionStrategy;
  partition: number;
  burst: number;
  poison: boolean;
  origin?: "auto" | "manual";
}
