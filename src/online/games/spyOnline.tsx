import { useEffect, useMemo, useRef, useState } from "react";
import { Banner, Button, Card, SectionTitle, TimerBar } from "@/components/ui";
import { SPY_LOCATIONS } from "@/data/spyfall";
import { alarm, beep, shuffle, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { nameOf, SecretCard } from "../common";
import type { OnlineGame } from "../types";

interface G {
  players: string[];
  loc: number;
  spies: string[];
  roles: Record<string, string>;
  endsAt: number;
  minutes: number;
  spyCount: number;
  votes: Record<string, string>;
  result: null | { winner: "spy" | "city"; reason: string };
  round: number;
}
type A = { type: "vote"; target: string } | { type: "guess"; loc: number } | { type: "reveal" } | { type: "again" };

function newRound(players: string[], minutes: number, spyCount: number, round: number): G {
  const loc = Math.floor(Math.random() * SPY_LOCATIONS.length);
  const order = shuffle(players);
  const n = Math.max(1, Math.min(spyCount, Math.floor(players.length / 3) || 1));
  const spies = order.slice(0, n);
  const roleList = shuffle(SPY_LOCATIONS[loc].roles);
  const roles: Record<string, string> = {};
  order.slice(n).forEach((u, i) => (roles[u] = roleList[i % roleList.length]));
  return { players, loc, spies, roles, endsAt: Date.now() + minutes * 60000, minutes, spyCount, votes: {}, result: null, round };
}

function tally(votes: Record<string, string>) {
  const t: Record<string, number> = {};
  Object.values(votes).forEach((v) => (t[v] = (t[v] ?? 0) + 1));
  return t;
}

function resolve(g: G, names: (u: string) => string): G {
  const t = tally(g.votes);
  const entries = Object.entries(t).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return { ...g, result: { winner: "spy", reason: "هیچ‌کس رأی نداد!" } };
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return { ...g, result: { winner: "spy", reason: "رأی‌ها مساوی شد و جاسوس فرار کرد!" } };
  const top = entries[0][0];
  return g.spies.includes(top)
    ? { ...g, result: { winner: "city", reason: `${names(top)} شناسایی شد!` } }
    : { ...g, result: { winner: "spy", reason: `${names(top)} متهم شد ولی جاسوس نبود!` } };
}

export const spyOnline: OnlineGame<G, A> = {
  id: "spy",
  name: "جاسوس",
  emoji: "🕵️",
  desc: "هر کس نقشش رو روی گوشی خودش می‌بینه",
  min: 3,
  max: 12,
  accent: "from-emerald-400 to-teal-600",
  options: [
    { key: "minutes", label: "زمان بازی", min: 2, max: 20, def: 8, suffix: "دقیقه" },
    { key: "spies", label: "تعداد جاسوس", min: 1, max: 3, def: 1 },
  ],
  init: (players, opts) => newRound(players.map((p) => p.uid), opts.minutes ?? 8, opts.spies ?? 1, 1),
  reduce: (g, a, uid, members, hostId) => {
    const names = (u: string) => nameOf(members, u);
    switch (a.type) {
      case "vote": {
        if (g.result || !g.players.includes(uid) || !g.players.includes(a.target) || a.target === uid) return g;
        const votes = { ...g.votes };
        if (votes[uid] === a.target) delete votes[uid];
        else votes[uid] = a.target;
        const ng = { ...g, votes };
        return Object.keys(votes).length >= g.players.length ? resolve(ng, names) : ng;
      }
      case "guess":
        if (g.result || !g.spies.includes(uid)) return g;
        return a.loc === g.loc
          ? { ...g, result: { winner: "spy", reason: `${names(uid)} مکان رو درست حدس زد!` } }
          : { ...g, result: { winner: "city", reason: `${names(uid)} اشتباه حدس زد (${SPY_LOCATIONS[a.loc]?.name})` } };
      case "reveal":
        if (uid !== hostId || g.result) return g;
        return resolve(g, names);
      case "again":
        if (uid !== hostId) return g;
        return newRound(g.players, g.minutes, g.spyCount, g.round + 1);
    }
    return g;
  },
  View: ({ g, me, hostId, members, send }) => {
    const isSpy = g.spies.includes(me);
    const playing = g.players.includes(me);
    const loc = SPY_LOCATIONS[g.loc];
    const [now, setNow] = useState(Date.now());
    const [guessing, setGuessing] = useState(false);
    const alarmed = useRef(false);
    const locList = useMemo(() => SPY_LOCATIONS.map((l, i) => ({ ...l, i })).sort((a, b) => a.name.localeCompare(b.name, "fa")), []);

    useEffect(() => {
      alarmed.current = false;
      setGuessing(false);
    }, [g.round]);
    useEffect(() => {
      if (g.result) return;
      const iv = setInterval(() => setNow(Date.now()), 500);
      return () => clearInterval(iv);
    }, [g.result]);

    const remaining = Math.max(0, Math.ceil((g.endsAt - now) / 1000));
    useEffect(() => {
      if (remaining === 0 && !alarmed.current && !g.result) {
        alarmed.current = true;
        alarm();
      }
    }, [remaining, g.result]);

    const resultRef = useRef(g.result);
    useEffect(() => {
      if (g.result && !resultRef.current) beep(g.result.winner === "spy" ? 300 : 1200, 0.35, "sine", 0.2);
      resultRef.current = g.result;
    }, [g.result]);

    const votedCount = Object.keys(g.votes).length;
    const t = tally(g.votes);

    return (
      <>
        {g.result ? (
          <>
            <Banner
              emoji={g.result.winner === "spy" ? "🕵️" : "🏙️"}
              title={g.result.winner === "spy" ? "جاسوس برنده شد!" : "شهروندها برنده شدن!"}
              subtitle={g.result.reason}
              className={g.result.winner === "spy" ? "bg-rose-500/20" : "bg-emerald-500/20"}
            />
            <Card className="text-center">
              <div className="text-sm text-slate-400">مکان</div>
              <div className="text-2xl font-black">{loc.emoji} {loc.name}</div>
              <div className="mt-3 text-sm text-slate-400">{g.spies.length > 1 ? "جاسوس‌ها" : "جاسوس"}</div>
              <div className="text-2xl font-black text-rose-300">{g.spies.map((u) => nameOf(members, u)).join("، ")}</div>
            </Card>
            {votedCount > 0 && (
              <Card>
                <SectionTitle>🗳️ رأی‌ها</SectionTitle>
                <div className="flex flex-col gap-1 text-sm">
                  {Object.entries(g.votes).map(([v, target]) => (
                    <div key={v} className="flex justify-between rounded-xl bg-white/5 px-3 py-1.5">
                      <span>{nameOf(members, v)}</span>
                      <span className={g.spies.includes(target) ? "text-emerald-300" : "text-slate-300"}>← {nameOf(members, target)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {me === hostId ? (
              <Button size="xl" full className="bg-gradient-to-br from-emerald-400 to-teal-600" onClick={() => send({ type: "again" })}>دور بعد 🔁</Button>
            ) : (
              <p className="text-center text-sm text-slate-400">منتظر میزبان برای دور بعد…</p>
            )}
          </>
        ) : (
          <>
            {playing ? (
              isSpy ? (
                <SecretCard className="bg-gradient-to-br from-rose-500/30 to-red-900/30">
                  <div className="text-6xl">🕵️</div>
                  <div className="mt-2 text-3xl font-black text-rose-300">تو جاسوسی!</div>
                  <p className="mt-2 text-sm text-slate-300">مکان رو نمی‌دونی. لو نرو!</p>
                  {g.spies.length > 1 && <p className="mt-2 text-xs text-slate-300">هم‌تیمی: {g.spies.filter((u) => u !== me).map((u) => nameOf(members, u)).join("، ")}</p>}
                </SecretCard>
              ) : (
                <SecretCard className="bg-gradient-to-br from-emerald-500/30 to-teal-900/30">
                  <div className="text-6xl">{loc.emoji}</div>
                  <div className="text-sm text-slate-300">مکان</div>
                  <div className="text-3xl font-black">{loc.name}</div>
                  <div className="mt-3 text-sm text-slate-300">نقش تو: <b className="text-emerald-200">{g.roles[me]}</b></div>
                </SecretCard>
              )
            ) : (
              <Card className="text-center text-slate-300">👀 تو این دور تماشاگری</Card>
            )}

            <Card className="text-center">
              <TimerBar seconds={remaining} total={g.minutes * 60} danger={30} />
              {remaining === 0 && <div className="mt-2 font-bold text-rose-300">⏰ زمان تموم شد! رأی بدید.</div>}
            </Card>

            {playing && (
              <Card>
                <SectionTitle hint={`${toFa(votedCount)} از ${toFa(g.players.length)} نفر رأی دادن`}>🗳️ به نظرت جاسوس کیه؟</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {g.players.filter((u) => u !== me).map((u) => (
                    <button
                      key={u}
                      onClick={() => send({ type: "vote", target: u })}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-sm font-bold transition active:scale-95",
                        g.votes[me] === u ? "border-rose-400 bg-rose-500/30" : "border-white/10 bg-white/5 hover:bg-white/10",
                      )}
                    >
                      {nameOf(members, u)}
                      {(t[u] ?? 0) > 0 && <span className="ms-1 text-xs text-slate-400">({toFa(t[u])})</span>}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">وقتی همه رأی بدن نتیجه خودکار اعلام می‌شه. برای پس گرفتن رأی دوباره بزن.</p>
              </Card>
            )}

            {isSpy && (
              <Card>
                {!guessing ? (
                  <Button variant="warning" full onClick={() => setGuessing(true)}>🕵️ می‌خوام مکان رو حدس بزنم</Button>
                ) : (
                  <>
                    <SectionTitle hint="فقط یک فرصت داری!">مکان کجاست؟</SectionTitle>
                    <div className="grid grid-cols-2 gap-1.5">
                      {locList.map((l) => (
                        <button key={l.i} onClick={() => confirm(`مطمئنی «${l.name}»؟`) && send({ type: "guess", loc: l.i })} className="rounded-xl bg-white/5 px-2 py-2 text-sm hover:bg-white/15">
                          {l.emoji} {l.name}
                        </button>
                      ))}
                    </div>
                    <Button variant="ghost" full className="mt-2" onClick={() => setGuessing(false)}>انصراف</Button>
                  </>
                )}
              </Card>
            )}

            {!isSpy && (
              <Card>
                <SectionTitle>🗺️ مکان‌های ممکن</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {locList.map((l) => (
                    <span key={l.i} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">{l.emoji} {l.name}</span>
                  ))}
                </div>
              </Card>
            )}

            {me === hostId && (
              <Button variant="danger" onClick={() => confirm("رأی‌گیری بسته بشه و نتیجه اعلام بشه؟") && send({ type: "reveal" })}>🏁 پایان و اعلام نتیجه</Button>
            )}
          </>
        )}
      </>
    );
  },
};
