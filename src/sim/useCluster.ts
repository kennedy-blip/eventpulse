import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { TICK_MS, clusterHealth, createInitialState, groupLag, reducer, totalLag } from "./engine";
import type { Toast } from "./types";

export function useCluster() {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => dispatch({ type: "tick" }), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4200);
  }, []);

  const derived = useMemo(
    () => ({
      health: clusterHealth(state),
      lag: totalLag(state),
      groupLags: Object.fromEntries(state.groups.map((g) => [g.id, groupLag(state, g)])) as Record<string, number>,
      produceTps: state.produceHistory[state.produceHistory.length - 1] ?? 0,
      consumeTps: state.consumeHistory[state.consumeHistory.length - 1] ?? 0,
      openDLQ: state.dlq.filter((d) => d.status === "open").length,
    }),
    [state],
  );

  return { state, dispatch, derived, toasts, toast, now };
}

export type Cluster = ReturnType<typeof useCluster>;
