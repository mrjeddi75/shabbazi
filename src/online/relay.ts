/**
 * Minimal MQTT 3.1.1 client over WebSocket + a multi-broker relay.
 * Messages are published to every reachable public broker and de-duplicated on receive,
 * so the game keeps working even if some brokers are blocked or down.
 */

export const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
  "wss://mqtt-dashboard.com:8884/mqtt",
  "wss://test.mosquitto.org:8081/mqtt",
];

export const TOPIC_PREFIX = "shabbazi/v2";

const te = new TextEncoder();
const td = new TextDecoder();

function encLen(n: number): number[] {
  const out: number[] = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n > 0) b |= 0x80;
    out.push(b);
  } while (n > 0);
  return out;
}

function lp(bytes: Uint8Array): Uint8Array {
  const o = new Uint8Array(bytes.length + 2);
  o[0] = bytes.length >> 8;
  o[1] = bytes.length & 255;
  o.set(bytes, 2);
  return o;
}
const str = (s: string) => lp(te.encode(s));

function packet(header: number, ...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const l = encLen(len);
  const o = new Uint8Array(1 + l.length + len);
  o[0] = header;
  o.set(l, 1);
  let off = 1 + l.length;
  for (const p of parts) {
    o.set(p, off);
    off += p.length;
  }
  return o;
}

function rid(n = 12) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => (x % 36).toString(36)).join("");
}

export interface Will {
  topic: string;
  payload: string;
  retain: boolean;
}

interface ConnHandlers {
  onMessage: (topic: string, payload: string, retained: boolean) => void;
  onConnect: () => void;
  onClose: () => void;
}

type WSCtor = new (url: string, protocols?: string | string[]) => WebSocket;

export class MqttConn {
  private ws: WebSocket | null = null;
  private buf = new Uint8Array(0);
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastRx = 0;
  private retry = 0;
  private pid = 1;
  private stopped = true;
  private subs = new Set<string>();
  connected = false;

  constructor(
    public url: string,
    private will: Will | null,
    private h: ConnHandlers,
    private WS: WSCtor = (globalThis as unknown as { WebSocket: WSCtor }).WebSocket,
  ) {}

  start() {
    this.stopped = false;
    this.open();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      try {
        if (ws.readyState === 1) ws.send(new Uint8Array([0xe0, 0x00]));
        ws.close();
      } catch {
        /* ignore */
      }
    }
    if (this.connected) {
      this.connected = false;
      this.h.onClose();
    }
  }

  reconnectNow() {
    if (this.stopped || this.connected) return;
    if (this.ws && this.ws.readyState <= 1) return;
    this.retry = 0;
    this.open();
  }

  subscribe(topic: string) {
    this.subs.add(topic);
    if (this.connected) this.sendSub(topic);
  }

  publish(topic: string, payload: string, retain = false): boolean {
    if (!this.connected || !this.ws) return false;
    try {
      this.ws.send(packet(0x30 | (retain ? 1 : 0), str(topic), te.encode(payload)));
      return true;
    } catch {
      return false;
    }
  }

  private sendSub(topic: string) {
    const id = this.pid++ & 0xffff || 1;
    this.ws?.send(packet(0x82, new Uint8Array([id >> 8, id & 255]), str(topic), new Uint8Array([0])));
  }

  private schedule() {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const delay = Math.min(20000, 1000 * 2 ** this.retry) + Math.random() * 800;
    this.retry = Math.min(this.retry + 1, 6);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private open() {
    if (this.stopped) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    let ws: WebSocket;
    try {
      ws = new this.WS(this.url, ["mqtt"]);
    } catch {
      this.schedule();
      return;
    }
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.buf = new Uint8Array(0);
    const connectTimeout = setTimeout(() => {
      if (this.ws === ws && !this.connected) {
        try {
          ws.close();
        } catch {
          /* ignore */
        }
      }
    }, 10000);

    ws.onopen = () => {
      if (this.ws !== ws) return;
      const w = this.will;
      const flags = 0x02 | (w ? 0x04 | (w.retain ? 0x20 : 0) : 0);
      const parts = [new Uint8Array([0, 4, 77, 81, 84, 84, 4, flags, 0, 30]), str("sb" + rid(14))];
      if (w) parts.push(str(w.topic), lp(te.encode(w.payload)));
      ws.send(packet(0x10, ...parts));
    };
    ws.onmessage = (e: MessageEvent) => {
      if (this.ws !== ws) return;
      this.lastRx = Date.now();
      const data = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : new Uint8Array(e.data as ArrayBufferLike);
      this.feed(data);
    };
    ws.onerror = () => {
      /* close follows */
    };
    ws.onclose = () => {
      clearTimeout(connectTimeout);
      if (this.ws !== ws) return;
      this.ws = null;
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.connected) {
        this.connected = false;
        this.h.onClose();
      }
      this.schedule();
    };
  }

  private feed(chunk: Uint8Array) {
    const merged = new Uint8Array(this.buf.length + chunk.length);
    merged.set(this.buf);
    merged.set(chunk, this.buf.length);
    let buf = merged;
    for (;;) {
      if (buf.length < 2) break;
      let mult = 1;
      let rem = 0;
      let i = 1;
      let ok = false;
      for (; i < Math.min(buf.length, 5); i++) {
        rem += (buf[i] & 127) * mult;
        mult *= 128;
        if ((buf[i] & 128) === 0) {
          ok = true;
          break;
        }
      }
      if (!ok) break;
      const total = i + 1 + rem;
      if (buf.length < total) break;
      this.handle(buf[0], buf.subarray(i + 1, total));
      buf = buf.slice(total);
    }
    this.buf = buf;
  }

  private handle(h: number, body: Uint8Array) {
    const type = h >> 4;
    if (type === 2) {
      if (body[1] === 0) {
        this.connected = true;
        this.retry = 0;
        this.subs.forEach((t) => this.sendSub(t));
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
          if (!this.ws) return;
          if (Date.now() - this.lastRx > 50000) {
            try {
              this.ws.close();
            } catch {
              /* ignore */
            }
            return;
          }
          try {
            this.ws.send(new Uint8Array([0xc0, 0x00]));
          } catch {
            /* ignore */
          }
        }, 20000);
        this.h.onConnect();
      } else {
        this.ws?.close();
      }
    } else if (type === 3) {
      const qos = (h >> 1) & 3;
      const retained = (h & 1) === 1;
      const tlen = (body[0] << 8) | body[1];
      const topic = td.decode(body.subarray(2, 2 + tlen));
      let off = 2 + tlen;
      if (qos > 0) {
        const id0 = body[off];
        const id1 = body[off + 1];
        off += 2;
        if (qos === 1) this.ws?.send(new Uint8Array([0x40, 0x02, id0, id1]));
      }
      const payload = td.decode(body.subarray(off));
      try {
        this.h.onMessage(topic, payload, retained);
      } catch (e) {
        console.error(e);
      }
    }
  }
}

/* ============================ multi-broker relay ============================ */

export interface RelayOptions {
  will?: { topic: string; data: Record<string, unknown> | null; retain: boolean };
  onMessage: (topic: string, data: Record<string, unknown> | null, retained: boolean, broker: number) => void;
  onStatus?: (connected: number) => void;
  onBrokerConnect?: (broker: number) => void;
  brokers?: string[];
  WS?: WSCtor;
}

export class Relay {
  private conns: MqttConn[];
  private seen = new Map<string, number>();
  private onVis = () => {
    if (document.visibilityState === "visible") this.conns.forEach((c) => c.reconnectNow());
  };
  private onOnline = () => this.conns.forEach((c) => c.reconnectNow());

  constructor(private o: RelayOptions) {
    const willPayload = o.will ? (o.will.data === null ? "" : JSON.stringify({ ...o.will.data, i: rid() })) : "";
    const will: Will | null = o.will ? { topic: o.will.topic, payload: willPayload, retain: o.will.retain } : null;
    this.conns = (o.brokers ?? BROKERS).map(
      (url, b) =>
        new MqttConn(
          url,
          will,
          {
            onConnect: () => {
              this.emitStatus();
              o.onBrokerConnect?.(b);
            },
            onClose: () => this.emitStatus(),
            onMessage: (topic, payload, retained) => this.receive(topic, payload, retained, b),
          },
          o.WS,
        ),
    );
  }

  get connectedCount() {
    return this.conns.filter((c) => c.connected).length;
  }
  get total() {
    return this.conns.length;
  }

  start() {
    this.conns.forEach((c) => c.start());
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.onVis);
      window.addEventListener("online", this.onOnline);
    }
  }

  stop() {
    this.conns.forEach((c) => c.stop());
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.onVis);
      window.removeEventListener("online", this.onOnline);
    }
  }

  subscribe(topic: string) {
    this.conns.forEach((c) => c.subscribe(topic));
  }

  publish(topic: string, data: Record<string, unknown> | null, retain = false) {
    const payload = data === null ? "" : JSON.stringify({ ...data, i: rid() });
    let sent = 0;
    this.conns.forEach((c) => c.publish(topic, payload, retain) && sent++);
    return sent;
  }

  private emitStatus() {
    this.o.onStatus?.(this.connectedCount);
  }

  private receive(topic: string, payload: string, retained: boolean, b: number) {
    if (payload === "") {
      this.o.onMessage(topic, null, retained, b);
      return;
    }
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(payload);
    } catch {
      return;
    }
    if (!data || typeof data !== "object") return;
    const id = typeof data.i === "string" ? data.i : "";
    if (id) {
      if (this.seen.has(id)) return;
      this.seen.set(id, Date.now());
      if (this.seen.size > 3000) {
        const it = this.seen.keys();
        for (let k = 0; k < 1000; k++) this.seen.delete(it.next().value as string);
      }
    }
    this.o.onMessage(topic, data, retained, b);
  }
}
