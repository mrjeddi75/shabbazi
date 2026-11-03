import { useMemo, useState } from "react";
import { Banner, Button, Card, GameShell, Toggle } from "@/components/ui";
import { usePlayers } from "@/lib/hooks";
import { beep, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-lime-400 to-emerald-600";
export const PCOL = ["#f43f5e", "#38bdf8"];

export type P = 0 | 1;
export type Cell = P | null;

/* ------------------------------ board geometry ------------------------------ */
const COORDS: [number, number][] = [];
const IDX = new Map<string, number>();
for (const r of [0, 1, 2]) {
  const a = r;
  const b = 3;
  const c = 6 - r;
  const pts: [number, number][] = [[a, a], [b, a], [c, a], [c, b], [c, c], [b, c], [a, c], [a, b]];
  for (const [x, y] of pts) {
    IDX.set(`${x},${y}`, COORDS.length);
    COORDS.push([x, y]);
  }
}
const id = (x: number, y: number) => IDX.get(`${x},${y}`)!;

const LINES: number[][] = [];
for (const r of [0, 1, 2]) {
  const a = r;
  const c = 6 - r;
  LINES.push([id(a, a), id(3, a), id(c, a)]);
  LINES.push([id(a, c), id(3, c), id(c, c)]);
  LINES.push([id(a, a), id(a, 3), id(a, c)]);
  LINES.push([id(c, a), id(c, 3), id(c, c)]);
}
LINES.push([id(3, 0), id(3, 1), id(3, 2)], [id(3, 4), id(3, 5), id(3, 6)], [id(0, 3), id(1, 3), id(2, 3)], [id(4, 3), id(5, 3), id(6, 3)]);
// قطرها (در دوز ۱۲ تایی از گوشه‌ها)
LINES.push([id(0, 0), id(1, 1), id(2, 2)], [id(6, 0), id(5, 1), id(4, 2)], [id(0, 6), id(1, 5), id(2, 4)], [id(6, 6), id(5, 5), id(4, 4)]);

const ADJ: number[][] = COORDS.map(() => []);
for (const l of LINES) {
  for (let i = 0; i < l.length - 1; i++) {
    ADJ[l[i]].push(l[i + 1]);
    ADJ[l[i + 1]].push(l[i]);
  }
}
const LINES_OF: number[][][] = COORDS.map((_, i) => LINES.filter((l) => l.includes(i)));

/* ------------------------------ game logic ------------------------------ */
export interface S {
  board: Cell[];
  hand: [number, number];
  turn: P;
  selected: number | null;
  removing: boolean;
  winner: P | "draw" | null;
  msg: string;
}

export const initial = (turn: P = 0): S => ({
  board: Array<Cell>(24).fill(null),
  hand: [12, 12],
  turn,
  selected: null,
  removing: false,
  winner: null,
  msg: "",
});

export const count = (board: Cell[], p: P) => board.filter((c) => c === p).length;
const inMill = (board: Cell[], i: number, p: P) => LINES_OF[i].some((l) => l.every((j) => board[j] === p));

export function removable(board: Cell[], o: P): number[] {
  const all = board.map((c, i) => (c === o ? i : -1)).filter((i) => i >= 0);
  const free = all.filter((i) => !inMill(board, i, o));
  return free.length ? free : all;
}

export function moveTargets(board: Cell[], hand: [number, number], p: P, i: number, flying: boolean): number[] {
  if (board[i] !== p) return [];
  if (flying && hand[p] === 0 && count(board, p) === 3) return board.map((c, j) => (c === null ? j : -1)).filter((j) => j >= 0);
  return ADJ[i].filter((j) => board[j] === null);
}

function hasMove(board: Cell[], hand: [number, number], p: P, flying: boolean) {
  return board.some((c, i) => c === p && moveTargets(board, hand, p, i, flying).length > 0);
}

function finish(s: S, flying: boolean, names: [string, string]): S {
  const p = s.turn;
  const o = (1 - p) as P;
  const oTotal = count(s.board, o) + s.hand[o];
  if (oTotal < 3) return { ...s, selected: null, winner: p, msg: `${names[o]} کمتر از ۳ مهره داره!` };
  if (s.board.every((c) => c !== null)) return { ...s, selected: null, winner: "draw", msg: "تخته پر شد و حرکتی نمونده." };
  if (s.hand[o] === 0 && !hasMove(s.board, s.hand, o, flying)) return { ...s, selected: null, winner: p, msg: `${names[o]} هیچ حرکتی نداره (بن‌بست)!` };
  return { ...s, turn: o, selected: null, msg: "" };
}

export function click(s: S, i: number, flying: boolean, names: [string, string]): S {
  if (s.winner !== null) return s;
  const p = s.turn;
  const o = (1 - p) as P;

  if (s.removing) {
    if (s.board[i] !== o) return s;
    if (!removable(s.board, o).includes(i)) return { ...s, msg: "این مهره داخل دوزه و قابل حذف نیست!" };
    const board = [...s.board];
    board[i] = null;
    return finish({ ...s, board, removing: false }, flying, names);
  }

  if (s.hand[p] > 0) {
    if (s.board[i] !== null) return s;
    const board = [...s.board];
    board[i] = p;
    const hand: [number, number] = [...s.hand];
    hand[p]--;
    const ns: S = { ...s, board, hand, selected: null, msg: "" };
    if (inMill(board, i, p)) return { ...ns, removing: true };
    return finish(ns, flying, names);
  }

  if (s.board[i] === p) return { ...s, selected: i, msg: "" };
  if (s.selected !== null && s.board[i] === null) {
    if (!moveTargets(s.board, s.hand, p, s.selected, flying).includes(i)) return s;
    const board = [...s.board];
    board[s.selected] = null;
    board[i] = p;
    const ns: S = { ...s, board, selected: null, msg: "" };
    if (inMill(board, i, p)) return { ...ns, removing: true };
    return finish(ns, flying, names);
  }
  return s;
}

/* ------------------------------ UI ------------------------------ */
const SCALE = 50;
const OFF = 25;
const px = (v: number) => v * SCALE + OFF;

export function doozHighlights(s: S, flying: boolean) {
  const p = s.turn;
  let targets = new Set<number>();
  if (s.winner === null && !s.removing) {
    if (s.hand[p] > 0) targets = new Set(s.board.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0));
    else if (s.selected !== null) targets = new Set(moveTargets(s.board, s.hand, p, s.selected, flying));
  }
  const removableSet = s.removing ? new Set(removable(s.board, (1 - p) as P)) : new Set<number>();
  return { targets, removableSet };
}

export function DoozBoard({ s, targets, removableSet, onPoint }: { s: S; targets: Set<number>; removableSet: Set<number>; onPoint: (i: number) => void }) {
  return (
    <svg viewBox="0 0 350 350" className="mx-auto w-full max-w-md touch-manipulation select-none">
      <rect x="2" y="2" width="346" height="346" rx="28" fill="#1e293b" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
      {LINES.map((l, k) => (
        <path
          key={k}
          d={`M${px(COORDS[l[0]][0])} ${px(COORDS[l[0]][1])} L${px(COORDS[l[1]][0])} ${px(COORDS[l[1]][1])} L${px(COORDS[l[2]][0])} ${px(COORDS[l[2]][1])}`}
          stroke="rgba(226,232,240,0.4)"
          strokeWidth="3"
          fill="none"
          strokeLinejoin="round"
        />
      ))}
      {COORDS.map(([x, y], i) => {
        const c = s.board[i];
        const cx = px(x);
        const cy = px(y);
        const isTarget = targets.has(i);
        const isRem = removableSet.has(i);
        const isSel = s.selected === i;
        return (
          <g key={i} onClick={() => onPoint(i)} className="cursor-pointer">
            <circle cx={cx} cy={cy} r={24} fill="transparent" />
            {c === null ? (
              <circle cx={cx} cy={cy} r={isTarget ? 8 : 5} fill={isTarget ? "#34d399" : "rgba(226,232,240,0.6)"} className={isTarget ? "animate-pulse" : ""} />
            ) : (
              <>
                <circle cx={cx} cy={cy} r={18} fill={PCOL[c]} stroke={isSel ? "#fff" : "rgba(0,0,0,0.4)"} strokeWidth={isSel ? 4 : 2} />
                <circle cx={cx - 5} cy={cy - 6} r={5} fill="rgba(255,255,255,0.35)" />
                {isRem && <circle cx={cx} cy={cy} r={24} fill="none" stroke="#fde047" strokeWidth="3" strokeDasharray="5 4" className="animate-pulse" />}
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function Dooz12({ onBack }: { onBack: () => void }) {
  const [saved] = usePlayers();
  const [names, setNames] = useState<[string, string]>([saved[0] ?? "بازیکن ۱", saved[1] ?? "بازیکن ۲"]);
  const [flying, setFlying] = useState(false);
  const [started, setStarted] = useState(false);
  const [s, setS] = useState<S>(() => initial());
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [starter, setStarter] = useState<P>(0);

  const nm = (p: P) => names[p].trim() || `بازیکن ${toFa(p + 1)}`;
  const safeNames: [string, string] = [nm(0), nm(1)];

  const newGame = (first: P) => {
    setStarter(first);
    setS(initial(first));
    setStarted(true);
  };

  const onPoint = (i: number) => {
    const ns = click(s, i, flying, safeNames);
    if (ns === s) return;
    if (ns.msg && ns.board === s.board) beep(200, 0.1, "triangle", 0.12);
    else if (ns.removing && !s.removing) {
      beep(1200, 0.18, "sine", 0.2);
      vibrate(120);
    } else if (s.removing) {
      beep(300, 0.15, "sawtooth", 0.15);
      vibrate(80);
    } else beep(660, 0.06, "sine", 0.12);
    if (s.winner === null && ns.winner !== null && ns.winner !== "draw") {
      const w = ns.winner;
      setWins((x) => (w === 0 ? [x[0] + 1, x[1]] : [x[0], x[1] + 1]));
    }
    setS(ns);
  };

  const resign = () => {
    const w = (1 - s.turn) as P;
    setWins((x) => (w === 0 ? [x[0] + 1, x[1]] : [x[0], x[1] + 1]));
    setS({ ...s, winner: w, removing: false, selected: null, msg: `${nm(s.turn)} تسلیم شد.` });
  };

  const p = s.turn;
  const placing = s.hand[p] > 0;

  const { targets, removableSet } = useMemo(() => doozHighlights(s, flying), [s, flying]);

  const status = s.winner !== null
    ? ""
    : s.removing
      ? `🗡️ ${nm(p)}: دوز شد! یکی از مهره‌های ${nm((1 - p) as P)} رو حذف کن`
      : placing
        ? `${nm(p)}: یک مهره روی تخته بذار`
        : s.selected === null
          ? `${nm(p)}: یکی از مهره‌هات رو انتخاب کن`
          : `${nm(p)}: مقصد رو انتخاب کن`;

  return (
    <GameShell title="دوز ۱۲ تایی" emoji="⭕" accent={ACCENT} onBack={onBack}>
      {!started ? (
        <>
          <Card>
            <div className="space-y-2 text-sm leading-7 text-slate-300">
              <p>هر بازیکن ۱۲ مهره داره. اول به نوبت مهره‌ها رو روی تخته می‌ذارید، بعد با حرکت دادن مهره‌ها به خونه‌ی کناری ادامه می‌دید.</p>
              <p>هر وقت <b>سه مهره‌ات</b> روی یک خط (ضلع، خط وسط یا قطر) قرار گرفت، <b>دوز</b> کردی و یکی از مهره‌های حریف رو برمی‌داری (مهره‌های داخل دوز فقط وقتی حذف می‌شن که چیز دیگه‌ای نمونده باشه).</p>
              <p>اگه حریف کمتر از ۳ مهره داشته باشه یا نتونه حرکت کنه، برنده‌ای!</p>
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            {([0, 1] as const).map((i) => (
              <label key={i} className="flex items-center gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: PCOL[i] }} />
                <input
                  value={names[i]}
                  onChange={(e) => setNames((n) => (i === 0 ? [e.target.value, n[1]] : [n[0], e.target.value]))}
                  placeholder={`اسم بازیکن ${toFa(i + 1)}`}
                  maxLength={14}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 outline-none focus:border-lime-400"
                />
              </label>
            ))}
            <Toggle label="پرواز با ۳ مهره" hint="وقتی فقط ۳ مهره برات مونده، می‌تونی به هر خونه‌ی خالی بپری" checked={flying} onChange={setFlying} />
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} onClick={() => newGame(0)}>
            شروع بازی ⭕
          </Button>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {([0, 1] as const).map((i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl border p-3 transition",
                  s.turn === i && s.winner === null ? "border-white/40 bg-white/15" : "border-white/10 bg-white/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full" style={{ background: PCOL[i] }} />
                  <span className="truncate font-bold">{nm(i)}</span>
                  <span className="ms-auto rounded-full bg-white/10 px-2 text-xs">🏆 {toFa(wins[i])}</span>
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-300">
                  <span>در دست: <b className="text-white">{toFa(s.hand[i])}</b></span>
                  <span>روی تخته: <b className="text-white">{toFa(count(s.board, i))}</b></span>
                </div>
              </div>
            ))}
          </div>

          {s.winner === null ? (
            <div className="rounded-2xl bg-white/5 px-4 py-3 text-center font-semibold" style={{ borderBottom: `3px solid ${PCOL[p]}` }}>
              {status}
              {s.msg && <div className="mt-1 text-sm text-amber-300">{s.msg}</div>}
            </div>
          ) : (
            <Banner
              emoji={s.winner === "draw" ? "🤝" : "🏆"}
              title={s.winner === "draw" ? "مساوی شد!" : `${nm(s.winner)} برنده شد!`}
              subtitle={s.msg}
              className="bg-emerald-500/20"
            />
          )}

          <Card className="p-2 sm:p-4">
            <DoozBoard s={s} targets={targets} removableSet={removableSet} onPoint={onPoint} />
          </Card>

          <div className="grid grid-cols-2 gap-2">
            {s.winner === null ? (
              <>
                <Button variant="secondary" onClick={resign}>🏳️ تسلیم ({nm(p)})</Button>
                <Button variant="ghost" onClick={() => setStarted(false)}>⚙️ تنظیمات</Button>
              </>
            ) : (
              <>
                <Button className={cn("bg-gradient-to-br", ACCENT)} size="lg" onClick={() => newGame((1 - starter) as P)}>
                  بازی دوباره 🔁
                </Button>
                <Button variant="secondary" size="lg" onClick={() => setStarted(false)}>⚙️ تنظیمات</Button>
              </>
            )}
          </div>
        </>
      )}
    </GameShell>
  );
}
