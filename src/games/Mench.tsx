import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, Chip, GameShell } from "@/components/ui";
import { usePlayers } from "@/lib/hooks";
import { beep, explosion, randInt, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-yellow-400 to-red-500";

/* ------------------------------ board data ------------------------------ */
const COLORS = [
  { name: "قرمز", hex: "#ef4444", light: "#fecaca" },
  { name: "سبز", hex: "#22c55e", light: "#bbf7d0" },
  { name: "زرد", hex: "#eab308", light: "#fef08a" },
  { name: "آبی", hex: "#3b82f6", light: "#bfdbfe" },
];

// ۵۲ خونه‌ی مسیر اصلی، ساعتگرد، از خونه‌ی شروع قرمز
const TRACK: [number, number][] = [
  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1], [6, 0],
  [7, 0], [8, 0],
  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6], [14, 6],
  [14, 7], [14, 8],
  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13], [8, 14],
  [7, 14], [6, 14],
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  [0, 7], [0, 6],
];
const START = [0, 13, 26, 39];
const HOME: [number, number][][] = [
  [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7]],
  [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]],
  [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]],
  [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
];
const BASE: [number, number][][] = [
  [[2, 2], [4, 2], [2, 4], [4, 4]],
  [[11, 2], [13, 2], [11, 4], [13, 4]],
  [[11, 11], [13, 11], [11, 13], [13, 13]],
  [[2, 11], [4, 11], [2, 13], [4, 13]],
];
const BASE_RECT: [number, number][] = [[0, 0], [9, 0], [9, 9], [0, 9]];
const DIRS: [number, number][] = [[-1, 0], [0, -1], [1, 0], [0, 1]];
const STARS = START.map((s) => s + 8);
const SAFE = new Set([...START, ...STARS]);
const FINISH = 56;

function piecePos(c: number, p: number, k: number): [number, number] {
  if (p < 0) return BASE[c][k];
  if (p <= 50) {
    const [x, y] = TRACK[(START[c] + p) % 52];
    return [x + 0.5, y + 0.5];
  }
  if (p < FINISH) {
    const [x, y] = HOME[c][p - 51];
    return [x + 0.5, y + 0.5];
  }
  const [dx, dy] = DIRS[c];
  const off = (k - 1.5) * 0.3;
  return [7.5 + dx * 0.85 + -dy * off, 7.5 + dy * 0.85 + dx * off];
}

/* ------------------------------ game logic ------------------------------ */
type Mode = "human" | "bot" | "off";

interface MG {
  seats: number[];
  pieces: number[][];
  turn: number; // index in seats
  dice: number | null;
  phase: "roll" | "move" | "over";
  sixes: number;
  finished: number[];
  log: string;
}

function legalMoves(g: MG): number[] {
  const c = g.seats[g.turn];
  const v = g.dice;
  if (!v) return [];
  const res: number[] = [];
  let baseAdded = false;
  g.pieces[c].forEach((p, k) => {
    if (p === -1) {
      if (v === 6 && !baseAdded) {
        res.push(k);
        baseAdded = true;
      }
    } else if (p < FINISH && p + v <= FINISH) res.push(k);
  });
  return res;
}

function nextTurn(g: MG): MG {
  let i = g.turn;
  for (let n = 0; n < g.seats.length; n++) {
    i = (i + 1) % g.seats.length;
    if (!g.finished.includes(g.seats[i])) break;
  }
  return { ...g, turn: i, phase: "roll", sixes: 0 };
}

function applyRoll(g: MG, v: number, nm: (c: number) => string): MG {
  const sixes = v === 6 ? g.sixes + 1 : 0;
  if (sixes >= 3) return nextTurn({ ...g, dice: v, log: `${nm(g.seats[g.turn])} سه شش پشت سر هم آورد، نوبتش می‌پره!` });
  return { ...g, dice: v, sixes, phase: "move", log: "" };
}

function captureAt(g: MG, c: number, np: number): { o: number; j: number }[] {
  if (np > 50) return [];
  const cell = (START[c] + np) % 52;
  if (SAFE.has(cell)) return [];
  const hits: { o: number; j: number }[] = [];
  for (const o of g.seats) {
    if (o === c) continue;
    const list = g.pieces[o].map((p, j) => ({ p, j })).filter((x) => x.p >= 0 && x.p <= 50 && (START[o] + x.p) % 52 === cell);
    if (list.length === 1) hits.push({ o, j: list[0].j });
  }
  return hits;
}

function applyMove(g: MG, k: number, nm: (c: number) => string): MG {
  const c = g.seats[g.turn];
  const v = g.dice!;
  const pieces = g.pieces.map((a) => [...a]);
  const old = pieces[c][k];
  const np = old === -1 ? 0 : old + v;
  const hits = captureAt(g, c, np);
  hits.forEach((h) => (pieces[h.o][h.j] = -1));
  pieces[c][k] = np;

  const reachedHome = np === FINISH;
  const allHome = pieces[c].every((p) => p === FINISH);
  let finished = g.finished;
  if (allHome) finished = [...finished, c];

  let log = "";
  if (hits.length) log = `💥 ${nm(c)} مهره‌ی ${hits.map((h) => COLORS[h.o].name).join(" و ")} رو زد!`;
  else if (reachedHome) log = `🏁 یک مهره‌ی ${COLORS[c].name} به خونه رسید!`;
  else if (old === -1) log = `${nm(c)} یک مهره وارد بازی کرد.`;

  const ng: MG = { ...g, pieces, finished, log };
  const remaining = g.seats.filter((s) => !finished.includes(s));
  if (remaining.length <= 1) return { ...ng, finished: [...finished, ...remaining], phase: "over" };

  const extra = !allHome && (v === 6 || hits.length > 0 || reachedHome);
  if (extra) return { ...ng, phase: "roll", sixes: v === 6 ? g.sixes : 0, log: log + (log ? " " : "") + "🎁 دوباره تاس بنداز!" };
  return nextTurn(ng);
}

function bestMove(g: MG): number {
  const c = g.seats[g.turn];
  const v = g.dice!;
  const moves = legalMoves(g);
  let best = moves[0];
  let bestScore = -Infinity;
  for (const k of moves) {
    const old = g.pieces[c][k];
    const np = old === -1 ? 0 : old + v;
    let score = np * 0.1;
    if (captureAt(g, c, np).length) score += 100;
    if (np === FINISH) score += 80;
    if (old === -1) score += 50;
    else if (np > 50) score += 35;
    if (np <= 50 && SAFE.has((START[c] + np) % 52)) score += 15;
    if (old >= 0 && old <= 50 && SAFE.has((START[c] + old) % 52)) score -= 6;
    score += Math.random();
    if (score > bestScore) {
      bestScore = score;
      best = k;
    }
  }
  return best;
}

/* ------------------------------ dice ------------------------------ */
const DOTS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function Die({ value, rolling }: { value: number | null; rolling: boolean }) {
  const v = value ?? 1;
  return (
    <div className={cn("grid h-20 w-20 shrink-0 grid-cols-3 grid-rows-3 rounded-2xl bg-white p-2 shadow-xl", rolling && "animate-shake", value === null && !rolling && "opacity-50")}>
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className={cn("m-auto h-3.5 w-3.5 rounded-full", DOTS[v].includes(i) ? "bg-slate-900" : "bg-transparent")} />
      ))}
    </div>
  );
}

/* ------------------------------ component ------------------------------ */
export default function Mench({ onBack }: { onBack: () => void }) {
  const [saved] = usePlayers();
  const [modes, setModes] = useState<Mode[]>(["human", "human", "human", "human"]);
  const [names, setNames] = useState<string[]>(() => COLORS.map((c, i) => saved[i] ?? c.name));
  const [g, setG] = useState<MG | null>(null);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const ivRef = useRef<number | null>(null);

  useEffect(() => () => { if (ivRef.current) clearInterval(ivRef.current); }, []);

  const nm = (c: number) => names[c].trim() || COLORS[c].name;
  const activeCount = modes.filter((m) => m !== "off").length;

  const start = () => {
    const seats = [0, 1, 2, 3].filter((c) => modes[c] !== "off");
    setFace(null);
    setG({ seats, pieces: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), turn: 0, dice: null, phase: "roll", sixes: 0, finished: [], log: "" });
  };

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let n = 0;
    ivRef.current = window.setInterval(() => {
      n++;
      setFace(randInt(1, 6));
      beep(300 + n * 40, 0.03, "triangle", 0.07);
      if (n >= 9) {
        if (ivRef.current) clearInterval(ivRef.current);
        const v = randInt(1, 6);
        setFace(v);
        setRolling(false);
        setG((gg) => (gg ? applyRoll(gg, v, nm) : gg));
      }
    }, 70);
  };

  const play = (k: number) => {
    setG((gg) => {
      if (!gg) return gg;
      const ng = applyMove(gg, k, nm);
      if (ng.log.startsWith("💥")) {
        explosion();
      } else beep(700, 0.07, "sine", 0.15);
      if (ng.log.startsWith("🏁")) vibrate(120);
      return ng;
    });
  };

  const curColor = g ? g.seats[g.turn] : 0;
  const isBot = g ? modes[curColor] === "bot" : false;
  const moves = g && g.phase === "move" ? legalMoves(g) : [];

  // autopilot: bots, forced moves, and passes
  useEffect(() => {
    if (!g || g.phase === "over" || rolling) return;
    let t: number | undefined;
    if (g.phase === "roll" && isBot) {
      t = window.setTimeout(roll, 800);
    } else if (g.phase === "move") {
      const m = legalMoves(g);
      if (m.length === 0) {
        t = window.setTimeout(() => setG((gg) => (gg ? nextTurn({ ...gg, log: `${nm(gg.seats[gg.turn])} حرکتی نداشت.` }) : gg)), 1100);
      } else if (isBot) {
        t = window.setTimeout(() => play(bestMove(g)), 900);
      } else if (m.length === 1) {
        t = window.setTimeout(() => play(m[0]), 650);
      }
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g, rolling]);

  const onPiece = (c: number, k: number) => {
    if (!g || g.phase !== "move" || c !== curColor || isBot) return;
    let kk = k;
    if (g.pieces[c][k] === -1) kk = moves.find((m) => g.pieces[c][m] === -1) ?? -1;
    if (!moves.includes(kk)) return;
    play(kk);
  };

  /* ---------- board pieces ---------- */
  const items: { c: number; k: number; x: number; y: number; p: number }[] = [];
  if (g) {
    const order = [...g.seats.filter((s) => s !== curColor), ...(g.seats.includes(curColor) ? [curColor] : [])];
    for (const c of order) for (let k = 0; k < 4; k++) {
      const p = g.pieces[c][k];
      const [x, y] = piecePos(c, p, k);
      items.push({ c, k, x, y, p });
    }
  }
  const groups = new Map<string, number>();
  items.forEach((it) => {
    const key = `${it.x.toFixed(2)},${it.y.toFixed(2)}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  });
  const seen = new Map<string, number>();
  const OFFS: [number, number][] = [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]];

  const legalSet = new Set<number>();
  if (g && g.phase === "move" && !isBot) {
    moves.forEach((m) => {
      if (g.pieces[curColor][m] === -1) g.pieces[curColor].forEach((p, k) => p === -1 && legalSet.add(k));
      else legalSet.add(m);
    });
  }

  return (
    <GameShell title="منچ" emoji="🎲" accent={ACCENT} onBack={onBack}>
      {!g && (
        <>
          <Card>
            <div className="space-y-2 text-sm leading-7 text-slate-300">
              <p>مثل منچ واقعی! هر نفر ۴ مهره داره. برای وارد کردن مهره باید <b>۶</b> بیاری و هر ۶ یک تاس دوباره می‌ده.</p>
              <p>اگه روی مهره‌ی حریف بیفتی اونو <b>می‌زنی</b> و برمی‌گرده به خونه (به جز خونه‌های امن ★). اولین کسی که هر ۴ مهره‌اش با تاس دقیق به مرکز برسه برنده‌ست.</p>
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            {COLORS.map((col, c) => (
              <div key={c} className={cn("flex items-center gap-2 rounded-2xl bg-white/5 p-2", modes[c] === "off" && "opacity-50")}>
                <span className="h-7 w-7 shrink-0 rounded-full border-2 border-white/70" style={{ background: col.hex }} />
                <input
                  value={names[c]}
                  onChange={(e) => setNames((n) => n.map((x, i) => (i === c ? e.target.value : x)))}
                  maxLength={12}
                  disabled={modes[c] === "off"}
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-yellow-400"
                />
                <div className="flex shrink-0 gap-1">
                  <Chip active={modes[c] === "human"} onClick={() => setModes((m) => m.map((x, i) => (i === c ? "human" : x)))}>👤</Chip>
                  <Chip active={modes[c] === "bot"} onClick={() => setModes((m) => m.map((x, i) => (i === c ? "bot" : x)))}>🤖</Chip>
                  <Chip active={modes[c] === "off"} onClick={() => setModes((m) => m.map((x, i) => (i === c ? "off" : x)))}>✕</Chip>
                </div>
              </div>
            ))}
            <p className="text-xs text-slate-400">👤 بازیکن واقعی · 🤖 ربات · ✕ بدون بازیکن</p>
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={activeCount < 2} onClick={start}>
            شروع بازی 🎲
          </Button>
          {activeCount < 2 && <p className="text-center text-sm text-rose-300">حداقل ۲ بازیکن لازمه.</p>}
        </>
      )}

      {g && (
        <>
          {g.phase !== "over" ? (
            <Card className="flex items-center gap-4 p-4">
              <Die value={rolling ? face : g.dice} rolling={rolling} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: COLORS[curColor].hex }} />
                  <span className="text-lg font-black">نوبت {nm(curColor)} {isBot && "🤖"}</span>
                </div>
                {g.phase === "roll" && !isBot && (
                  <Button size="md" onClick={roll} disabled={rolling} style={{ background: COLORS[curColor].hex, color: curColor === 2 ? "#111" : "#fff" }}>
                    🎲 تاس بنداز
                  </Button>
                )}
                {g.phase === "move" && !isBot && moves.length > 1 && <div className="text-sm text-amber-300">یکی از مهره‌های چشمک‌زن رو انتخاب کن 👆</div>}
                {g.phase === "move" && moves.length === 0 && <div className="text-sm text-slate-300">حرکتی ممکن نیست…</div>}
                {isBot && <div className="text-sm text-slate-400">ربات داره فکر می‌کنه…</div>}
              </div>
            </Card>
          ) : (
            <Banner emoji="🏆" title={`${nm(g.finished[0])} برنده شد!`} subtitle="بازی تموم شد" className="bg-emerald-500/20" />
          )}
          {g.log && <div className="rounded-2xl bg-white/5 px-4 py-2 text-center text-sm">{g.log}</div>}

          <Card className="p-2 sm:p-3">
            <svg viewBox="0 0 15 15" className="mx-auto w-full max-w-xl touch-manipulation select-none">
              <rect x="0" y="0" width="15" height="15" rx="0.5" fill="#0f172a" />
              {/* bases */}
              {BASE_RECT.map(([bx, by], c) => (
                <g key={c} opacity={g.seats.includes(c) ? 1 : 0.35}>
                  <rect x={bx + 0.1} y={by + 0.1} width="5.8" height="5.8" rx="0.7" fill={COLORS[c].hex} />
                  <rect x={bx + 0.9} y={by + 0.9} width="4.2" height="4.2" rx="0.7" fill="#0f172a" opacity="0.35" />
                  {BASE[c].map(([x, y], k) => (
                    <circle key={k} cx={x} cy={y} r="0.5" fill={COLORS[c].light} opacity="0.55" />
                  ))}
                </g>
              ))}
              {/* track */}
              {TRACK.map(([x, y], i) => {
                const sc = START.indexOf(i);
                return (
                  <g key={i}>
                    <rect x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" rx="0.12" fill={sc >= 0 ? COLORS[sc].hex : "#e2e8f0"} />
                    {STARS.includes(i) && (
                      <text x={x + 0.5} y={y + 0.52} textAnchor="middle" dominantBaseline="central" fontSize="0.7" fill="#64748b">★</text>
                    )}
                    {sc >= 0 && (
                      <text x={x + 0.5} y={y + 0.52} textAnchor="middle" dominantBaseline="central" fontSize="0.55" fill="#fff">▶</text>
                    )}
                  </g>
                );
              })}
              {/* home columns */}
              {HOME.map((cells, c) =>
                cells.map(([x, y], i) => (
                  <rect key={`${c}-${i}`} x={x + 0.04} y={y + 0.04} width="0.92" height="0.92" rx="0.12" fill={COLORS[c].hex} opacity="0.85" />
                )),
              )}
              {/* center */}
              <polygon points="6,6 6,9 7.5,7.5" fill={COLORS[0].hex} />
              <polygon points="6,6 9,6 7.5,7.5" fill={COLORS[1].hex} />
              <polygon points="9,6 9,9 7.5,7.5" fill={COLORS[2].hex} />
              <polygon points="6,9 9,9 7.5,7.5" fill={COLORS[3].hex} />

              {/* pieces */}
              {items.map((it) => {
                const key = `${it.x.toFixed(2)},${it.y.toFixed(2)}`;
                const total = groups.get(key) ?? 1;
                const n = seen.get(key) ?? 0;
                seen.set(key, n + 1);
                const [ox, oy] = total > 1 ? OFFS[n % 4] : [0, 0];
                const r = it.p === FINISH ? 0.16 : total > 1 ? 0.27 : 0.38;
                const legal = it.c === curColor && legalSet.has(it.k);
                return (
                  <g key={`${it.c}-${it.k}`} onClick={() => onPiece(it.c, it.k)} className={legal ? "cursor-pointer" : ""}>
                    {legal && <circle cx={it.x + ox} cy={it.y + oy} r={r + 0.22} fill="none" stroke="#fff" strokeWidth="0.09" className="animate-pulse" />}
                    <circle cx={it.x + ox} cy={it.y + oy} r={r} fill={COLORS[it.c].hex} stroke="#fff" strokeWidth="0.08" />
                    <circle cx={it.x + ox - r * 0.3} cy={it.y + oy - r * 0.3} r={r * 0.3} fill="#fff" opacity="0.45" />
                    {legal && <circle cx={it.x + ox} cy={it.y + oy} r={r + 0.3} fill="transparent" />}
                  </g>
                );
              })}
            </svg>
          </Card>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {g.seats.map((c) => {
              const done = g.pieces[c].filter((p) => p === FINISH).length;
              const rank = g.finished.indexOf(c);
              return (
                <div key={c} className={cn("rounded-2xl border p-2 text-center text-sm", c === curColor && g.phase !== "over" ? "border-white/40 bg-white/15" : "border-white/10 bg-white/5")}>
                  <div className="flex items-center justify-center gap-1.5 font-bold">
                    <span className="h-3 w-3 rounded-full" style={{ background: COLORS[c].hex }} />
                    <span className="truncate">{nm(c)}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-300">
                    {rank >= 0 ? ["🥇", "🥈", "🥉", "4️⃣"][rank] : `${toFa(done)}/۴ در خونه`}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={start}>🔁 شروع دوباره</Button>
            <Button variant="ghost" onClick={() => setG(null)}>⚙️ تنظیمات</Button>
          </div>
        </>
      )}
    </GameShell>
  );
}
