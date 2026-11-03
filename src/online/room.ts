import { useCallback, useEffect, useRef, useState } from "react";
import Peer, { type DataConnection } from "peerjs";
import { PEER_PREFIX } from "./identity";
import type { Member, Msg, RoomAction, RoomState } from "./types";

export type RoomStatus = "connecting" | "ready" | "reconnecting" | "error" | "kicked";

interface Options {
  enabled: boolean;
  role: "host" | "guest";
  code: string;
  uid: string;
  name: string;
  reducer: (s: RoomState, a: RoomAction, uid: string) => RoomState;
}

const SAVE_KEY = (code: string) => `gamenight.room.${code}`;
const SAVE_TTL = 6 * 60 * 60 * 1000;

function upsertMember(s: RoomState, uid: string, name: string, online: boolean): RoomState {
  const exists = s.members.some((m) => m.uid === uid);
  const members: Member[] = exists
    ? s.members.map((m) => (m.uid === uid ? { ...m, name: name || m.name, online } : m))
    : [...s.members, { uid, name: name || "مهمان", online }];
  return { ...s, members };
}

function setOnline(s: RoomState, uid: string, online: boolean): RoomState {
  return { ...s, members: s.members.map((m) => (m.uid === uid ? { ...m, online } : m)) };
}

function loadSaved(code: string): RoomState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY(code));
    if (!raw) return null;
    const { at, s } = JSON.parse(raw) as { at: number; s: RoomState };
    if (Date.now() - at > SAVE_TTL || s.code !== code) return null;
    return { ...s, members: s.members.map((m) => ({ ...m, online: m.uid === code })) };
  } catch {
    return null;
  }
}

export function clearSavedRoom(code: string) {
  try {
    localStorage.removeItem(SAVE_KEY(code));
  } catch {
    /* ignore */
  }
}

export function useRoom({ enabled, role, code, uid, name, reducer }: Options) {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [error, setError] = useState("");
  const [state, setState] = useState<RoomState | null>(null);
  const [peers, setPeers] = useState(0);

  const stateRef = useRef<RoomState | null>(null);
  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;
  const nameRef = useRef(name);
  nameRef.current = name;
  const sendRef = useRef<(a: RoomAction) => void>(() => {});
  const helloRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled || !code) return;
    let destroyed = false;
    let peer: Peer | null = null;
    let cleanupVis: (() => void) | null = null;
    const timers = new Set<number>();
    const later = (fn: () => void, ms: number) => {
      const t = window.setTimeout(() => {
        timers.delete(t);
        if (!destroyed) fn();
      }, ms);
      timers.add(t);
    };

    setStatus("connecting");
    setError("");
    setState(null);
    stateRef.current = null;

    /* ============================ HOST ============================ */
    if (role === "host") {
      const conns = new Map<DataConnection, string | null>();

      const broadcast = (s: RoomState) => {
        const msg: Msg = { t: "state", s };
        conns.forEach((u, c) => {
          if (u && c.open) {
            try {
              c.send(msg);
            } catch {
              /* ignore */
            }
          }
        });
      };

      const commit = (s: RoomState) => {
        const next = { ...s, v: s.v + 1 };
        stateRef.current = next;
        setState(next);
        broadcast(next);
        try {
          localStorage.setItem(SAVE_KEY(code), JSON.stringify({ at: Date.now(), s: next }));
        } catch {
          /* ignore */
        }
      };

      const apply = (from: string, a: RoomAction) => {
        const cur = stateRef.current;
        if (!cur) return;
        let next: RoomState;
        try {
          next = reducerRef.current(cur, a, from);
        } catch (e) {
          console.error(e);
          return;
        }
        if (a.type === "kick" && from === code) {
          conns.forEach((u, c) => {
            if (u === a.uid) {
              try {
                c.send({ t: "kicked" } satisfies Msg);
              } catch {
                /* ignore */
              }
              later(() => c.close(), 300);
            }
          });
        }
        if (next !== cur) commit(next);
      };

      sendRef.current = (a) => apply(code, a);
      helloRef.current = () => {
        if (stateRef.current) commit(upsertMember(stateRef.current, code, nameRef.current, true));
      };

      let idRetries = 0;
      const start = () => {
        peer = new Peer(PEER_PREFIX + code, { debug: 0 });

        peer.on("open", () => {
          const base: RoomState = stateRef.current ?? loadSaved(code) ?? { code, members: [], game: null, g: null, opts: {}, v: 0 };
          commit(upsertMember(base, code, nameRef.current, true));
          setStatus("ready");
        });

        peer.on("connection", (conn) => {
          conns.set(conn, null);
          setPeers(conns.size);
          const drop = () => {
            const u = conns.get(conn);
            conns.delete(conn);
            setPeers(conns.size);
            if (u && ![...conns.values()].includes(u) && stateRef.current) commit(setOnline(stateRef.current, u, false));
          };
          conn.on("data", (raw) => {
            const msg = raw as Msg;
            if (!msg || typeof msg !== "object") return;
            if (msg.t === "hello" && typeof msg.uid === "string") {
              conns.set(conn, msg.uid);
              if (stateRef.current) commit(upsertMember(stateRef.current, msg.uid, String(msg.name ?? "").slice(0, 20), true));
            } else if (msg.t === "act") {
              const u = conns.get(conn);
              if (u) apply(u, msg.a);
            }
          });
          conn.on("close", drop);
          conn.on("error", drop);
        });

        peer.on("disconnected", () => {
          if (!destroyed && peer && !peer.destroyed) peer.reconnect();
        });

        peer.on("error", (e: { type?: string }) => {
          if (destroyed) return;
          if (e.type === "unavailable-id") {
            peer?.destroy();
            if (idRetries++ < 4) later(start, 2000);
            else {
              setError("این شناسه همین الان در یک صفحه یا گوشی دیگه به عنوان میزبان بازه. اون صفحه رو ببند و دوباره امتحان کن.");
              setStatus("error");
            }
          } else if (e.type === "network" || e.type === "server-error" || e.type === "socket-error" || e.type === "socket-closed") {
            setStatus("reconnecting");
            later(() => {
              if (peer && !peer.destroyed && peer.disconnected) peer.reconnect();
            }, 3000);
          } else if (e.type === "browser-incompatible") {
            setError("مرورگر شما از اتصال آنلاین (WebRTC) پشتیبانی نمی‌کنه.");
            setStatus("error");
          }
        });
      };
      start();
    }

    /* ============================ GUEST ============================ */
    if (role === "guest") {
      let conn: DataConnection | null = null;
      let failures = 0;
      let kicked = false;

      const connect = () => {
        if (destroyed || !peer || peer.destroyed || kicked) return;
        if (peer.disconnected) {
          peer.reconnect();
          return;
        }
        if (conn?.open) return;
        try {
          conn?.close();
        } catch {
          /* ignore */
        }
        const c = peer.connect(PEER_PREFIX + code, { reliable: true });
        conn = c;
        let opened = false;
        const fail = () => {
          if (conn !== c || destroyed || kicked) return;
          conn = null;
          failures++;
          if (!stateRef.current && failures >= 4) {
            setError("اتصال برقرار نشد. مطمئن شو میزبان صفحه رو باز نگه داشته و هر دو به اینترنت وصلید.");
            setStatus("error");
            return;
          }
          setStatus(stateRef.current ? "reconnecting" : "connecting");
          later(connect, 2500);
        };
        c.on("open", () => {
          opened = true;
          failures = 0;
          c.send({ t: "hello", uid, name: nameRef.current } satisfies Msg);
          setStatus("ready");
          setError("");
        });
        c.on("data", (raw) => {
          const msg = raw as Msg;
          if (msg?.t === "state") {
            stateRef.current = msg.s;
            setState(msg.s);
          } else if (msg?.t === "kicked") {
            kicked = true;
            setStatus("kicked");
          }
        });
        c.on("close", fail);
        c.on("error", fail);
        later(() => {
          if (!opened && conn === c) {
            try {
              c.close();
            } catch {
              /* ignore */
            }
            fail();
          }
        }, 12000);
      };

      sendRef.current = (a) => {
        if (conn?.open) conn.send({ t: "act", a } satisfies Msg);
      };
      helloRef.current = () => {
        if (conn?.open) conn.send({ t: "hello", uid, name: nameRef.current } satisfies Msg);
      };

      peer = new Peer({ debug: 0 });
      peer.on("open", connect);
      peer.on("disconnected", () => {
        if (!destroyed && peer && !peer.destroyed) later(() => peer && !peer.destroyed && peer.reconnect(), 1500);
      });
      peer.on("error", (e: { type?: string }) => {
        if (destroyed) return;
        if (e.type === "peer-unavailable") {
          conn = null;
          if (!stateRef.current) {
            failures++;
            if (failures >= 3) {
              setError(`اتاقی با کد ${code} پیدا نشد. کد رو چک کن و مطمئن شو میزبان صفحه‌ی اتاق رو باز کرده.`);
              setStatus("error");
            } else later(connect, 2000);
          } else {
            setStatus("reconnecting");
            later(connect, 3000);
          }
        } else if (e.type === "browser-incompatible") {
          setError("مرورگر شما از اتصال آنلاین (WebRTC) پشتیبانی نمی‌کنه.");
          setStatus("error");
        } else {
          setStatus(stateRef.current ? "reconnecting" : "connecting");
          later(connect, 3000);
        }
      });

      const onVis = () => {
        if (document.visibilityState === "visible" && !conn?.open) connect();
      };
      document.addEventListener("visibilitychange", onVis);
      cleanupVis = () => document.removeEventListener("visibilitychange", onVis);
    }

    return () => {
      destroyed = true;
      timers.forEach((t) => clearTimeout(t));
      cleanupVis?.();
      peer?.destroy();
      sendRef.current = () => {};
      helloRef.current = () => {};
    };
  }, [enabled, role, code, uid]);

  // re-announce name changes
  useEffect(() => {
    if (status === "ready") helloRef.current();
  }, [name, status]);

  const send = useCallback((a: RoomAction) => sendRef.current(a), []);

  return { status, error, state, send, peers };
}
