import { useCallback, useEffect, useRef, useState } from "react";
import { Relay, TOPIC_PREFIX, type RelayOptions } from "./relay";
import type { Member, RoomAction, RoomInfo, RoomState } from "./types";

export type RoomStatus = "connecting" | "ready" | "reconnecting" | "notfound" | "hostaway" | "kicked" | "closed";

type Reducer = (s: RoomState, a: RoomAction, uid: string) => RoomState;
type WSCtor = RelayOptions["WS"];

export const topics = (code: string) => ({
  info: `${TOPIC_PREFIX}/rooms/${code}`,
  state: `${TOPIC_PREFIX}/r/${code}/s`,
  act: `${TOPIC_PREFIX}/r/${code}/a`,
});
export const ROOMS_WILDCARD = `${TOPIC_PREFIX}/rooms/+`;

const UID_RE = /^[A-Z0-9]{6}$/;
const SAVE_KEY = (code: string) => `gamenight.room.${code}`;
const SAVE_TTL = 6 * 60 * 60 * 1000;
const HOST_BEAT = 12000;
const GUEST_PING = 8000;
const MEMBER_TIMEOUT = 25000;
const HOST_TIMEOUT = 40000;
const FRESH_SKEW = 120000;

function rid(n = 8) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => (x % 36).toString(36)).join("");
}

function upsertMember(s: RoomState, uid: string, name: string, online: boolean): RoomState {
  const exists = s.members.find((m) => m.uid === uid);
  if (exists && exists.online === online && (!name || exists.name === name)) return s;
  const members: Member[] = exists
    ? s.members.map((m) => (m.uid === uid ? { ...m, name: name || m.name, online } : m))
    : [...s.members, { uid, name: name || "مهمان", online }];
  return { ...s, members };
}

function setOnline(s: RoomState, uid: string, online: boolean): RoomState {
  const m = s.members.find((x) => x.uid === uid);
  if (!m || m.online === online) return s;
  return { ...s, members: s.members.map((x) => (x.uid === uid ? { ...x, online } : x)) };
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

function save(code: string, s: RoomState) {
  try {
    localStorage.setItem(SAVE_KEY(code), JSON.stringify({ at: Date.now(), s }));
  } catch {
    /* ignore */
  }
}

export function clearSavedRoom(code: string) {
  try {
    localStorage.removeItem(SAVE_KEY(code));
  } catch {
    /* ignore */
  }
}

interface Listener {
  onState: (s: RoomState) => void;
  onStatus: (st: RoomStatus, relays: number) => void;
}

/* ================================ HOST ================================ */
export class HostRoom {
  private relay: Relay;
  private state: RoomState;
  private sid = rid();
  private lastSeen = new Map<string, number>();
  private timers: ReturnType<typeof setInterval>[] = [];
  private infoKey = "";
  private T: ReturnType<typeof topics>;
  private relays = 0;

  constructor(
    private code: string,
    private name: string,
    private pub: boolean,
    private reducer: Reducer,
    private l: Listener,
    WS?: WSCtor,
    persist = true,
  ) {
    this.T = topics(code);
    const base: RoomState = (persist && loadSaved(code)) || { code, members: [], game: null, g: null, opts: {}, v: 0 };
    this.state = upsertMember(base, code, name, true);
    this.persist = persist;
    this.relay = new Relay({
      WS,
      will: { topic: this.T.info, data: null, retain: true },
      onStatus: (n) => {
        this.relays = n;
        this.l.onStatus(n > 0 ? "ready" : "reconnecting", n);
      },
      onBrokerConnect: () => {
        // republish everything to (re)connected broker(s)
        this.relay.publish(this.T.state, { sid: this.sid, s: this.state }, true);
        this.publishInfo(true);
      },
      onMessage: (topic, data) => topic === this.T.act && data && this.onAct(data),
    });
  }
  private persist: boolean;

  start() {
    this.l.onState(this.state);
    this.l.onStatus("connecting", 0);
    this.relay.subscribe(this.T.act);
    this.relay.start();
    this.timers.push(setInterval(() => this.publishInfo(true), HOST_BEAT));
    this.timers.push(
      setInterval(() => {
        const now = Date.now();
        let s = this.state;
        for (const m of s.members) {
          if (m.uid === this.code || !m.online) continue;
          if (now - (this.lastSeen.get(m.uid) ?? 0) > MEMBER_TIMEOUT) s = setOnline(s, m.uid, false);
        }
        if (s !== this.state) this.commit(s);
      }, 4000),
    );
  }

  /** Close the room for everyone (explicit leave). */
  stop(closeRoom = true) {
    this.timers.forEach(clearInterval);
    if (closeRoom) {
      this.relay.publish(this.T.info, null, true);
      this.relay.publish(this.T.state, { sid: this.sid, closed: true }, true);
    }
    this.relay.stop();
  }

  setName(name: string) {
    this.name = name;
    this.commit(upsertMember(this.state, this.code, name, true));
  }

  setPublic(pub: boolean) {
    this.pub = pub;
    this.publishInfo(true);
  }

  dispatch(a: RoomAction, from = this.code) {
    let next: RoomState;
    try {
      next = this.reducer(this.state, a, from);
    } catch (e) {
      console.error(e);
      return;
    }
    if (next !== this.state) this.commit(next);
  }

  get relayCount() {
    return this.relays;
  }

  private onAct(d: Record<string, unknown>) {
    const u = String(d.uid ?? "");
    if (!UID_RE.test(u) || u === this.code) return;
    if (this.state.kicked?.includes(u)) return;
    const name = String(d.name ?? "").slice(0, 20);
    this.lastSeen.set(u, Date.now());
    switch (d.k) {
      case "hello":
      case "ping":
        this.commitIfChanged(upsertMember(this.state, u, name, true));
        if (d.k === "hello") this.relay.publish(this.T.state, { sid: this.sid, s: this.state }, true);
        break;
      case "bye":
        this.lastSeen.delete(u);
        this.commitIfChanged(setOnline(this.state, u, false));
        break;
      case "act": {
        const s = upsertMember(this.state, u, name, true);
        if (s !== this.state) this.commit(s);
        if (d.a && typeof d.a === "object") this.dispatch(d.a as RoomAction, u);
        break;
      }
    }
  }

  private commitIfChanged(s: RoomState) {
    if (s !== this.state) this.commit(s);
  }

  private commit(s: RoomState) {
    this.state = { ...s, v: s.v + 1 };
    this.l.onState(this.state);
    this.relay.publish(this.T.state, { sid: this.sid, s: this.state }, true);
    this.publishInfo(false);
    if (this.persist) save(this.code, this.state);
  }

  private publishInfo(force: boolean) {
    const s = this.state;
    const info: RoomInfo = {
      code: this.code,
      host: this.name,
      game: s.game,
      playing: !!s.g,
      count: s.members.filter((m) => m.online).length,
      pub: this.pub,
      at: Date.now(),
    };
    const key = `${info.host}|${info.game}|${info.playing}|${info.count}|${info.pub}`;
    if (!force && key === this.infoKey) return;
    this.infoKey = key;
    this.relay.publish(this.T.info, info as unknown as Record<string, unknown>, true);
  }
}

/* ================================ GUEST ================================ */
export class GuestRoom {
  private relay: Relay;
  private T: ReturnType<typeof topics>;
  private state: RoomState | null = null;
  private sid = "";
  private hostSeen = 0;
  private startedAt = Date.now();
  private relays = 0;
  private kicked = false;
  private closed = false;
  private timers: ReturnType<typeof setInterval>[] = [];
  private lastStatus: RoomStatus | null = null;

  constructor(
    private code: string,
    private uid: string,
    private name: string,
    private l: Listener,
    WS?: WSCtor,
  ) {
    this.T = topics(code);
    this.relay = new Relay({
      WS,
      will: { topic: this.T.act, data: { k: "bye", uid }, retain: false },
      onStatus: (n) => {
        this.relays = n;
        this.evaluate();
      },
      onBrokerConnect: () => this.hello(),
      onMessage: (topic, data, retained) => this.onMsg(topic, data, retained),
    });
  }

  start() {
    this.l.onStatus("connecting", 0);
    this.relay.subscribe(this.T.state);
    this.relay.subscribe(this.T.info);
    this.relay.start();
    this.timers.push(setInterval(() => this.send("ping"), GUEST_PING));
    this.timers.push(setInterval(() => this.evaluate(), 2000));
  }

  stop() {
    this.timers.forEach(clearInterval);
    if (!this.kicked) this.relay.publish(this.T.act, { k: "bye", uid: this.uid }, false);
    this.relay.stop();
  }

  setName(name: string) {
    this.name = name;
    this.hello();
  }

  dispatch(a: RoomAction) {
    this.send("act", { a });
  }

  retry() {
    this.startedAt = Date.now();
    this.closed = false;
    this.hello();
    this.evaluate();
  }

  private hello() {
    this.send("hello");
  }

  private send(k: string, extra: Record<string, unknown> = {}) {
    if (this.kicked) return;
    this.relay.publish(this.T.act, { k, uid: this.uid, name: this.name, ...extra }, false);
  }

  private onMsg(topic: string, data: Record<string, unknown> | null, retained: boolean) {
    if (topic === this.T.info) {
      if (data && typeof data.at === "number" && (!retained || Math.abs(Date.now() - data.at) < FRESH_SKEW)) {
        this.hostSeen = Date.now();
        this.closed = false;
      }
      this.evaluate();
      return;
    }
    if (topic !== this.T.state || !data) return;
    if (data.closed) {
      if (!retained || (this.state && data.sid === this.sid)) this.closed = true;
      this.evaluate();
      return;
    }
    const s = data.s as RoomState | undefined;
    const sid = String(data.sid ?? "");
    if (!s || s.code !== this.code) return;
    if (this.state && sid === this.sid && s.v <= this.state.v) return;
    this.sid = sid;
    this.state = s;
    this.closed = false;
    if (!retained) this.hostSeen = Date.now();
    if (s.kicked?.includes(this.uid) && !s.members.some((m) => m.uid === this.uid)) this.kicked = true;
    this.l.onState(s);
    this.evaluate();
  }

  private evaluate() {
    let st: RoomStatus;
    const now = Date.now();
    if (this.kicked) st = "kicked";
    else if (this.closed) st = "closed";
    else if (this.relays === 0) st = this.state ? "reconnecting" : "connecting";
    else if (!this.state || now - this.hostSeen > HOST_TIMEOUT) {
      if (!this.state) st = now - this.startedAt > 12000 ? "notfound" : "connecting";
      else if (!this.hostSeen && now - this.startedAt < 10000) st = "connecting";
      else st = "hostaway";
    } else st = "ready";
    if (st !== this.lastStatus) {
      this.lastStatus = st;
      this.l.onStatus(st, this.relays);
    } else this.l.onStatus(st, this.relays);
  }
}

/* ================================ hooks ================================ */
interface UseRoomOptions {
  role: "host" | "guest";
  code: string;
  uid: string;
  name: string;
  pub: boolean;
  reducer: Reducer;
}

export function useRoom({ role, code, uid, name, pub, reducer }: UseRoomOptions) {
  const [status, setStatus] = useState<RoomStatus>("connecting");
  const [relays, setRelays] = useState(0);
  const [state, setState] = useState<RoomState | null>(null);
  const roomRef = useRef<HostRoom | GuestRoom | null>(null);
  const reducerRef = useRef(reducer);
  reducerRef.current = reducer;
  const nameRef = useRef(name);
  nameRef.current = name;
  const pubRef = useRef(pub);
  pubRef.current = pub;

  useEffect(() => {
    if (!code) return;
    setState(null);
    setStatus("connecting");
    const l: Listener = {
      onState: setState,
      onStatus: (st, n) => {
        setStatus(st);
        setRelays(n);
      },
    };
    const room =
      role === "host"
        ? new HostRoom(code, nameRef.current, pubRef.current, (s, a, u) => reducerRef.current(s, a, u), l)
        : new GuestRoom(code, uid, nameRef.current, l);
    roomRef.current = room;
    room.start();
    return () => {
      room.stop();
      roomRef.current = null;
    };
  }, [role, code, uid]);

  useEffect(() => {
    roomRef.current?.setName(name);
  }, [name]);

  useEffect(() => {
    const r = roomRef.current;
    if (r instanceof HostRoom) r.setPublic(pub);
  }, [pub]);

  const send = useCallback((a: RoomAction) => roomRef.current?.dispatch(a), []);
  const retry = useCallback(() => {
    const r = roomRef.current;
    if (r instanceof GuestRoom) r.retry();
  }, []);

  return { status, relays, state, send, retry };
}

/** Live list of public rooms. */
export function useRoomList(enabled: boolean, excludeCode?: string) {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [relays, setRelays] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const map = new Map<string, { info: RoomInfo; seen: number }>();
    const flush = () =>
      setRooms(
        [...map.values()]
          .map((e) => e.info)
          .filter((r) => r.code !== excludeCode)
          .sort((a, b) => Number(a.playing) - Number(b.playing) || b.count - a.count || b.at - a.at),
      );
    const relay = new Relay({
      onStatus: (n) => {
        setRelays(n);
        if (n > 0) setTimeout(() => setReady(true), 2500);
      },
      onMessage: (topic, data, retained) => {
        const code = topic.split("/").pop() ?? "";
        if (!UID_RE.test(code)) return;
        if (!data) {
          map.delete(code);
          flush();
          return;
        }
        const info = data as unknown as RoomInfo;
        if (!info.pub || typeof info.at !== "number") {
          map.delete(code);
          flush();
          return;
        }
        if (retained && Math.abs(Date.now() - info.at) > FRESH_SKEW) return;
        const prev = map.get(code);
        if (!prev || info.at >= prev.info.at) map.set(code, { info: { ...info, code }, seen: Date.now() });
        else prev.seen = Date.now();
        flush();
      },
    });
    relay.subscribe(ROOMS_WILDCARD);
    relay.start();
    const iv = setInterval(() => {
      const now = Date.now();
      let changed = false;
      map.forEach((e, k) => {
        if (now - e.seen > HOST_TIMEOUT + 5000) {
          map.delete(k);
          changed = true;
        }
      });
      if (changed) flush();
    }, 4000);
    return () => {
      clearInterval(iv);
      relay.stop();
      setReady(false);
    };
  }, [enabled, excludeCode]);

  return { rooms, relays, ready };
}
