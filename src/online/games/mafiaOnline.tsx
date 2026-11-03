import { useEffect, useRef } from "react";
import { Banner, Button, Card, SectionTitle } from "@/components/ui";
import { ROLE_BY_ID, TEAM_LABEL, suggestRoles, type RoleDef, type Team } from "@/data/mafia";
import { beep, shuffle, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { nameOf, OfflineDot, isOnline, SecretCard } from "../common";
import type { OnlineGame } from "../types";

interface G {
  narrator: string;
  players: string[];
  roles: Record<string, string>;
  alive: Record<string, boolean>;
  stage: number;
  over: boolean;
}
type A = { type: "toggle"; uid: string } | { type: "stage"; d: 1 | -1 } | { type: "end" } | { type: "again" };

const TEAM_STYLE: Record<Team, string> = {
  mafia: "bg-rose-500/20 text-rose-200 border-rose-500/30",
  city: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  neutral: "bg-amber-500/20 text-amber-200 border-amber-500/30",
};

function deal(players: string[]): Pick<G, "roles" | "alive"> {
  const counts = suggestRoles(players.length);
  const pool: string[] = [];
  Object.entries(counts).forEach(([id, n]) => {
    for (let i = 0; i < n; i++) pool.push(id);
  });
  const roles: Record<string, string> = {};
  const alive: Record<string, boolean> = {};
  shuffle(pool).forEach((r, i) => {
    roles[players[i]] = r;
    alive[players[i]] = true;
  });
  return { roles, alive };
}

const stageLabel = (s: number) => (s === 0 ? "🌙 شب معارفه" : s % 2 === 1 ? `☀️ روز ${toFa(Math.ceil(s / 2))}` : `🌙 شب ${toFa(s / 2)}`);

export const mafiaOnline: OnlineGame<G, A> = {
  id: "mafia",
  name: "مافیا",
  emoji: "🔫",
  desc: "میزبان گرداننده‌ست، نقش‌ها روی گوشی هر نفر",
  min: 4,
  max: 20,
  accent: "from-rose-500 to-red-800",
  init: (players, _opts, hostId) => {
    const ps = players.map((p) => p.uid).filter((u) => u !== hostId);
    return { narrator: hostId, players: ps, ...deal(ps), stage: 0, over: false };
  },
  reduce: (g, a, uid) => {
    if (uid !== g.narrator) return g;
    switch (a.type) {
      case "toggle":
        if (!(a.uid in g.alive)) return g;
        return { ...g, alive: { ...g.alive, [a.uid]: !g.alive[a.uid] } };
      case "stage":
        return { ...g, stage: Math.max(0, g.stage + a.d) };
      case "end":
        return { ...g, over: true };
      case "again":
        return { ...g, ...deal(g.players), stage: 0, over: false };
    }
    return g;
  },
  View: ({ g, me, members, send }) => {
    const isNarrator = me === g.narrator;
    const myRole: RoleDef | undefined = ROLE_BY_ID[g.roles[me]];
    const role = (u: string) => ROLE_BY_ID[g.roles[u]];
    const alive = g.players.filter((u) => g.alive[u]);
    const aliveMafia = alive.filter((u) => role(u).team === "mafia").length;
    const winner = aliveMafia === 0 ? "city" : aliveMafia >= alive.length - aliveMafia ? "mafia" : null;
    const mates = myRole?.team === "mafia" ? g.players.filter((u) => u !== me && role(u).team === "mafia") : [];

    const aliveRef = useRef(g.alive[me]);
    useEffect(() => {
      if (aliveRef.current && g.alive[me] === false) {
        vibrate([200, 100, 200]);
        beep(200, 0.4, "sawtooth", 0.15);
      }
      aliveRef.current = g.alive[me];
    }, [g.alive, me]);

    const stageRef = useRef(g.stage);
    useEffect(() => {
      if (stageRef.current !== g.stage) beep(g.stage % 2 ? 1000 : 400, 0.2, "sine", 0.15);
      stageRef.current = g.stage;
    }, [g.stage]);

    if (g.over) {
      return (
        <>
          <Banner emoji="🎭" title="بازی تموم شد" subtitle="نقش همه:" className="bg-white/5" />
          <Card className="flex flex-col gap-2">
            {g.players.map((u) => (
              <div key={u} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2", TEAM_STYLE[role(u).team])}>
                <span className="font-bold">{g.alive[u] ? "" : "💀 "}{nameOf(members, u)}</span>
                <span className="text-sm">{role(u).emoji} {role(u).name}</span>
              </div>
            ))}
          </Card>
          {isNarrator && <Button size="xl" full className="bg-gradient-to-br from-rose-500 to-red-800" onClick={() => send({ type: "again" })}>پخش دوباره‌ی نقش‌ها 🔁</Button>}
        </>
      );
    }

    return (
      <>
        <Card className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-400">مرحله</div>
            <div className="text-2xl font-black">{stageLabel(g.stage)}</div>
          </div>
          {isNarrator && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={g.stage === 0} onClick={() => send({ type: "stage", d: -1 })}>قبلی</Button>
              <Button variant="secondary" onClick={() => send({ type: "stage", d: 1 })}>بعدی ⏭</Button>
            </div>
          )}
        </Card>

        {isNarrator ? (
          <>
            <Card className="text-center text-sm text-slate-300">🎙️ تو گرداننده‌ای. نقش همه رو می‌بینی؛ گوشیت رو به کسی نشون نده!</Card>
            {winner && (
              <Banner emoji={winner === "city" ? "🏙️" : "🔫"} title={winner === "city" ? "شهر برنده شد!" : "مافیا برنده شد!"} className={winner === "city" ? "bg-emerald-500/20" : "bg-rose-500/20"} />
            )}
          </>
        ) : myRole ? (
          <SecretCard className={cn("border", TEAM_STYLE[myRole.team])}>
            <div className="text-6xl">{myRole.emoji}</div>
            <div className="mt-1 text-xs opacity-80">تیم {TEAM_LABEL[myRole.team]}</div>
            <div className="text-3xl font-black">{myRole.name}</div>
            <p className="mt-2 text-sm leading-6 opacity-90">{myRole.desc}</p>
            {mates.length > 0 && <p className="mt-3 text-sm font-bold">🤝 هم‌تیمی‌ها: {mates.map((u) => `${nameOf(members, u)} (${role(u).name})`).join("، ")}</p>}
            {g.alive[me] === false && <p className="mt-3 text-lg font-black text-rose-300">💀 تو از بازی حذف شدی</p>}
          </SecretCard>
        ) : (
          <Card className="text-center text-slate-300">👀 تو این دور تماشاگری</Card>
        )}

        <Card>
          <SectionTitle hint={`زنده: ${toFa(alive.length)} از ${toFa(g.players.length)}`}>👥 بازیکن‌ها</SectionTitle>
          <div className="flex flex-col gap-2">
            {g.players.map((u) => (
              <div key={u} className={cn("flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5", g.alive[u] ? "bg-white/5" : "bg-black/30 opacity-60")}>
                <div className="flex items-center gap-2">
                  <OfflineDot online={isOnline(members, u)} />
                  <span className={cn("font-bold", !g.alive[u] && "line-through")}>{nameOf(members, u)}</span>
                  {u === me && <span className="text-xs text-rose-300">(تو)</span>}
                  {isNarrator && <span className={cn("rounded-full border px-2 py-0.5 text-xs", TEAM_STYLE[role(u).team])}>{role(u).emoji} {role(u).name}</span>}
                </div>
                {isNarrator ? (
                  <button
                    onClick={() => send({ type: "toggle", uid: u })}
                    className={cn("rounded-xl px-3 py-1.5 text-sm font-bold", g.alive[u] ? "bg-rose-500/20 text-rose-200" : "bg-emerald-500/20 text-emerald-200")}
                  >
                    {g.alive[u] ? "💀 حذف" : "↩️ برگردون"}
                  </button>
                ) : (
                  !g.alive[u] && <span>💀</span>
                )}
              </div>
            ))}
          </div>
        </Card>

        {isNarrator && <Button variant="danger" full onClick={() => confirm("بازی تموم بشه و نقش‌ها برای همه نمایش داده بشه؟") && send({ type: "end" })}>پایان بازی و نمایش نقش‌ها</Button>}
      </>
    );
  },
};
