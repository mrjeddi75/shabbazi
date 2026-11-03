import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card } from "@/components/ui";
import { applyMove, applyRoll, COLORS, Die, FINISH, legalMoves, MenchBoard, menchLegalSet, nextTurn, type MG } from "@/games/Mench";
import { beep, explosion, randInt, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { isOnline, OfflineDot } from "../common";
import type { OnlineGame } from "../types";

interface G extends MG {
  owners: Record<number, string>;
  names: Record<number, string>;
  rollSeq: number;
}
type A = { type: "roll" } | { type: "move"; k: number } | { type: "pass" } | { type: "skip" } | { type: "again" };

const COLOR_SETS: Record<number, number[]> = { 2: [0, 2], 3: [0, 1, 2], 4: [0, 1, 2, 3] };

function fresh(seats: number[], owners: Record<number, string>, names: Record<number, string>): G {
  return { seats, owners, names, pieces: [0, 1, 2, 3].map(() => [-1, -1, -1, -1]), turn: 0, dice: null, phase: "roll", sixes: 0, finished: [], log: "", rollSeq: 0 };
}

export const menchOnline: OnlineGame<G, A> = {
  id: "mench",
  name: "منچ",
  emoji: "🎲",
  desc: "۲ تا ۴ نفر، تاس روی گوشی هر نفر",
  min: 2,
  max: 4,
  accent: "from-yellow-400 to-red-500",
  init: (players) => {
    const seats = COLOR_SETS[players.length];
    const owners: Record<number, string> = {};
    const names: Record<number, string> = {};
    seats.forEach((c, i) => {
      owners[c] = players[i].uid;
      names[c] = players[i].name;
    });
    return fresh(seats, owners, names);
  },
  reduce: (g, a, uid, _members, hostId) => {
    const cur = g.seats[g.turn];
    const nm = (c: number) => g.names[c] ?? COLORS[c].name;
    const mine = g.owners[cur] === uid;
    switch (a.type) {
      case "roll": {
        if (!mine || g.phase !== "roll") return g;
        const ng = applyRoll(g, randInt(1, 6), nm) as G;
        return { ...ng, rollSeq: g.rollSeq + 1 };
      }
      case "move":
        if (!mine || g.phase !== "move" || !legalMoves(g).includes(a.k)) return g;
        return applyMove(g, a.k, nm) as G;
      case "pass":
        if (g.phase !== "move" || legalMoves(g).length > 0) return g;
        return nextTurn({ ...g, log: `${nm(cur)} حرکتی نداشت.` }) as G;
      case "skip":
        if (uid !== hostId || g.phase === "over") return g;
        return nextTurn({ ...g, log: `میزبان نوبت ${nm(cur)} رو رد کرد.` }) as G;
      case "again":
        if (g.phase !== "over" && uid !== hostId) return g;
        return fresh(g.seats, g.owners, g.names);
    }
    return g;
  },
  View: ({ g, me, hostId, members, send }) => {
    const cur = g.seats[g.turn];
    const myColors = g.seats.filter((c) => g.owners[c] === me);
    const myTurn = g.owners[cur] === me && g.phase !== "over";
    const isHost = me === hostId;
    const moves = g.phase === "move" ? legalMoves(g) : [];

    const [rolling, setRolling] = useState(false);
    const [face, setFace] = useState<number | null>(null);
    const seqRef = useRef(g.rollSeq);
    useEffect(() => {
      if (g.rollSeq === seqRef.current) return;
      seqRef.current = g.rollSeq;
      setRolling(true);
      let n = 0;
      const iv = window.setInterval(() => {
        n++;
        setFace(randInt(1, 6));
        beep(300 + n * 40, 0.03, "triangle", 0.06);
        if (n >= 7) {
          clearInterval(iv);
          setRolling(false);
        }
      }, 70);
      return () => clearInterval(iv);
    }, [g.rollSeq]);

    const logRef = useRef(g.log);
    useEffect(() => {
      if (g.log === logRef.current) return;
      logRef.current = g.log;
      if (g.log.startsWith("💥")) explosion();
      else if (g.log.startsWith("🏁")) vibrate(120);
    }, [g.log]);

    const turnRef = useRef(cur);
    useEffect(() => {
      if (turnRef.current !== cur && myTurn) {
        vibrate(80);
        beep(880, 0.1, "sine", 0.15);
      }
      turnRef.current = cur;
    }, [cur, myTurn]);

    // auto actions: single legal move (owner) / no move (host)
    useEffect(() => {
      if (rolling || g.phase !== "move") return;
      let t: number | undefined;
      if (moves.length === 0 && isHost) t = window.setTimeout(() => send({ type: "pass" }), 1200);
      else if (moves.length === 1 && myTurn) t = window.setTimeout(() => send({ type: "move", k: moves[0] }), 700);
      return () => clearTimeout(t);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [g, rolling]);

    const legalSet = myTurn && !rolling ? menchLegalSet(g, cur) : new Set<number>();
    const onPiece = (c: number, k: number) => {
      if (!myTurn || c !== cur || g.phase !== "move") return;
      const kk = g.pieces[c][k] === -1 ? moves.find((m) => g.pieces[c][m] === -1) ?? -1 : k;
      if (moves.includes(kk)) send({ type: "move", k: kk });
    };

    return (
      <>
        {g.phase !== "over" ? (
          <Card className={cn("flex items-center gap-4 p-4", myTurn && "ring-2 ring-yellow-400/60")}>
            <Die value={rolling ? face : g.dice} rolling={rolling} />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full border-2 border-white" style={{ background: COLORS[cur].hex }} />
                <span className="text-lg font-black">{myTurn ? "نوبت توئه!" : `نوبت ${g.names[cur]}`}</span>
              </div>
              {myTurn && g.phase === "roll" && (
                <Button onClick={() => send({ type: "roll" })} disabled={rolling} style={{ background: COLORS[cur].hex, color: cur === 2 ? "#111" : "#fff" }}>
                  🎲 تاس بنداز
                </Button>
              )}
              {myTurn && g.phase === "move" && !rolling && moves.length > 1 && <div className="text-sm text-amber-300">یکی از مهره‌های چشمک‌زن رو انتخاب کن 👆</div>}
              {g.phase === "move" && !rolling && moves.length === 0 && <div className="text-sm text-slate-300">حرکتی ممکن نیست…</div>}
              {!myTurn && <div className="text-sm text-slate-400">⏳ منتظر {g.names[cur]}…</div>}
            </div>
          </Card>
        ) : (
          <Banner
            emoji={myColors.includes(g.finished[0]) ? "🏆" : "🏁"}
            title={myColors.includes(g.finished[0]) ? "تو بردی!" : `${g.names[g.finished[0]]} برنده شد!`}
            className="bg-emerald-500/20"
          />
        )}
        {g.log && !rolling && <div className="rounded-2xl bg-white/5 px-4 py-2 text-center text-sm">{g.log}</div>}

        <Card className="p-2 sm:p-3">
          <MenchBoard g={g} curColor={cur} legalSet={legalSet} onPiece={onPiece} />
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {g.seats.map((c) => {
            const done = g.pieces[c].filter((p) => p === FINISH).length;
            const rank = g.finished.indexOf(c);
            return (
              <div key={c} className={cn("rounded-2xl border p-2 text-center text-sm", c === cur && g.phase !== "over" ? "border-white/40 bg-white/15" : "border-white/10 bg-white/5")}>
                <div className="flex items-center justify-center gap-1.5 font-bold">
                  <span className="h-3 w-3 rounded-full" style={{ background: COLORS[c].hex }} />
                  <span className="truncate">{g.names[c]}</span>
                  {g.owners[c] === me && <span className="text-xs text-yellow-300">(تو)</span>}
                  <OfflineDot online={isOnline(members, g.owners[c])} />
                </div>
                <div className="mt-1 text-xs text-slate-300">{rank >= 0 ? ["🥇", "🥈", "🥉", "4️⃣"][rank] : `${toFa(done)}/۴ در خونه`}</div>
              </div>
            );
          })}
        </div>

        {isHost && (
          <div className="grid grid-cols-2 gap-2">
            {g.phase !== "over" && (
              <Button variant="ghost" size="sm" onClick={() => send({ type: "skip" })}>⏭ رد کردن نوبت (اگه کسی قطع شد)</Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => (g.phase === "over" || confirm("بازی از اول شروع بشه؟")) && send({ type: "again" })}>🔁 شروع دوباره</Button>
          </div>
        )}
      </>
    );
  },
};
