import { useCallback, useEffect, useRef, useState } from "react";

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);
  return [value, setValue] as const;
}

export const DEFAULT_PLAYERS = ["علی", "سارا", "رضا", "مریم", "امیر"];

export function usePlayers() {
  return useLocalStorage<string[]>("gamenight.players", DEFAULT_PLAYERS);
}

interface CountdownOptions {
  onEnd?: () => void;
}

export function useCountdown(initialSeconds: number, opts: CountdownOptions = {}) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const onEndRef = useRef(opts.onEnd);
  onEndRef.current = opts.onEnd;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (running && seconds === 0) {
      setRunning(false);
      onEndRef.current?.();
    }
  }, [seconds, running]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const toggle = useCallback(() => setRunning((r) => !r), []);
  const reset = useCallback((to?: number) => {
    setRunning(false);
    setSeconds(to ?? initialSeconds);
  }, [initialSeconds]);
  const restart = useCallback((to?: number) => {
    setSeconds(to ?? initialSeconds);
    setRunning(true);
  }, [initialSeconds]);

  return { seconds, running, start, pause, toggle, reset, restart, setSeconds };
}
