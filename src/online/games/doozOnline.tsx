import { useEffect, useMemo, useRef } from "react";
import { Banner, Button, Card } from "@/components/ui";
import { click, count, DoozBoard, doozHighlights, initial, PCOL, type P, type S } from "@/games/Dooz12";
import { beep, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { isOnline, nameOf, OfflineDot } from "../common";
import type { Member, OnlineGame } from "../types";

interface G {
  s: S;
  seats: [string, string];
  wins: [number, number];
  starter: P;
}
type A = { type: "pt"; i: number } | { type: "resign" } | { type: "again" };

const names = (g: G, members: Member[]): [string, string] => [nameOf(members, g.seats[0]), nameOf(members, g.seats[1])];

function addWin(g: G, prev: S, next: S): [number, number] {
  if (prev.winner === null && (next.winner === 0 || next.winner === 1)) {
    return next.winner === 0 ? [g.wins[0] + 1, g.wins[1]] : [g.wins[0], g.wins[1] + 1];
  }
  return g.wins;
}

export const doozOnline: OnlineGame<G, A> = {
  id: "dooz",
  name: "دوز ۱۲ تایی",
  emoji: "⭕",
  desc: "دو نفره، هر کس روی گوشی خودش",
  min: 2,
  max: 2,
  accent: "from-lime-400 to-emerald-600",
  init: (players) => ({ s: initial(0), seats: [players[0].uid, players[1].uid], wins: [0, 0], starter: 0 }),
  reduce: (g, a, uid, members) => {
    const myP = g.seats.indexOf(uid);
    if (a.type === "pt") {
      if (myP !== g.s.turn) return g;
      const ns = click(g.s, a.i, false, names(g, members));
      if (ns === g.s) return g;
      return { ...g, s: ns, wins: addWin(g, g.s, ns) };
    }
    if (a.type === "resign") {
      if (myP < 0 || g.s.winner !== null) return g;
      const w = (1 - myP) as P;
      const ns: S = { ...g.s, winner: w, removing: false, selected: null, msg: `${nameOf(members, uid)} تسلیم شد.` };
      return { ...g, s: ns, wins: addWin(g, g.s, ns) };
    }
    if (a.type === "again") {
      if (g.s.winner === null || myP < 0) return g;
      const starter = (1 - g.starter) as P;
      return { ...g, starter, s: initial(starter) };
    }
    return g;
  },
  View: ({ g, me, members, send }) => {
    const s = g.s;
    const myP = g.seats.indexOf(me);
    const myTurn = myP === s.turn && s.winner === null;
    const nm = names(g, members);
    const { targets, removableSet } = useMemo(() => doozHighlights(s, false), [s]);

    const prev = useRef(s);
    useEffect(() => {
      const p = prev.current;
      prev.current = s;
      if (p === s) return;
      if (s.winner !== null && p.winner === null) {
        vibrate([100, 50, 300]);
        beep(s.winner === myP ? 1300 : 300, 0.3, "sine", 0.2);
      } else if (s.removing && !p.removing) beep(1200, 0.18, "sine", 0.2);
      else if (s.board !== p.board) beep(660, 0.06, "sine", 0.12);
      if (s.turn !== p.turn && s.turn === myP) vibrate(60);
    }, [s, myP]);

    const status = s.removing
      ? myTurn
        ? "🗡️ دوز کردی! یکی از مهره‌های حریف رو حذف کن"
        : `🗡️ ${nm[s.turn]} دوز کرد و داره مهره حذف می‌کنه…`
      : myTurn
        ? s.hand[s.turn] > 0
          ? "نوبت توئه: یک مهره بذار"
          : s.selected === null
            ? "نوبت توئه: یکی از مهره‌هات رو انتخاب کن"
            : "مقصد رو انتخاب کن"
        : myP < 0
          ? `👀 تماشاگری · نوبت ${nm[s.turn]}`
          : `⏳ منتظر ${nm[s.turn]}…`;

    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          {([0, 1] as const).map((i) => (
            <div key={i} className={cn("rounded-2xl border p-3", s.turn === i && s.winner === null ? "border-white/40 bg-white/15" : "border-white/10 bg-white/5")}>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full" style={{ background: PCOL[i] }} />
                <span className="truncate font-bold">{nm[i]}</span>
                {g.seats[i] === me && <span className="text-xs text-lime-300">(تو)</span>}
                <OfflineDot online={isOnline(members, g.seats[i])} />
                <span className="ms-auto rounded-full bg-white/10 px-2 text-xs">🏆 {toFa(g.wins[i])}</span>
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-300">
                <span>در دست: <b className="text-white">{toFa(s.hand[i])}</b></span>
                <span>روی تخته: <b className="text-white">{toFa(count(s.board, i))}</b></span>
              </div>
            </div>
          ))}
        </div>

        {s.winner === null ? (
          <div className={cn("rounded-2xl px-4 py-3 text-center font-semibold", myTurn ? "bg-lime-500/20" : "bg-white/5")} style={{ borderBottom: `3px solid ${PCOL[s.turn]}` }}>
            {status}
            {s.msg && myTurn && <div className="mt-1 text-sm text-amber-300">{s.msg}</div>}
          </div>
        ) : (
          <Banner
            emoji={s.winner === "draw" ? "🤝" : s.winner === myP ? "🏆" : myP < 0 ? "🏁" : "😢"}
            title={s.winner === "draw" ? "مساوی شد!" : s.winner === myP ? "تو بردی!" : `${nm[s.winner]} برنده شد!`}
            subtitle={s.msg}
            className="bg-emerald-500/20"
          />
        )}

        <Card className="p-2 sm:p-4">
          <DoozBoard
            s={s}
            targets={myTurn ? targets : new Set()}
            removableSet={myTurn ? removableSet : new Set()}
            onPoint={(i) => myTurn && send({ type: "pt", i })}
          />
        </Card>

        {myP >= 0 && (
          <div className="grid grid-cols-1 gap-2">
            {s.winner === null ? (
              <Button variant="secondary" onClick={() => confirm("مطمئنی می‌خوای تسلیم بشی؟") && send({ type: "resign" })}>🏳️ تسلیم</Button>
            ) : (
              <Button size="lg" className="bg-gradient-to-br from-lime-400 to-emerald-600" onClick={() => send({ type: "again" })}>بازی دوباره 🔁</Button>
            )}
          </div>
        )}
      </>
    );
  },
};
