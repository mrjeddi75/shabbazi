import { useMemo, useState } from "react";
import { Banner, Button, Card, GameShell, PassPhone, PlayersEditor, SectionTitle, Stepper, TimerBar } from "@/components/ui";
import { MAFIA_ROLES, ROLE_BY_ID, TEAM_LABEL, suggestRoles, type RoleDef, type Team } from "@/data/mafia";
import { useCountdown, usePlayers } from "@/lib/hooks";
import { alarm, shuffle, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-rose-500 to-red-800";
type Phase = "setup" | "reveal" | "panel" | "end";

interface MPlayer {
  name: string;
  role: RoleDef;
  alive: boolean;
}

const TEAM_STYLE: Record<Team, string> = {
  mafia: "bg-rose-500/20 text-rose-200 border-rose-500/30",
  city: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30",
  neutral: "bg-amber-500/20 text-amber-200 border-amber-500/30",
};

export default function Mafia({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = usePlayers();
  const [counts, setCounts] = useState<Record<string, number>>(() => suggestRoles(players.length));
  const [phase, setPhase] = useState<Phase>("setup");
  const [game, setGame] = useState<MPlayer[]>([]);
  const [revealIdx, setRevealIdx] = useState(0);
  const [stage, setStage] = useState(0);
  const [showRoles, setShowRoles] = useState(true);
  const [timerTotal, setTimerTotal] = useState(60);
  const timer = useCountdown(60, { onEnd: alarm });

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts]);
  const diff = players.length - total;

  const setCount = (id: string, v: number) => setCounts((c) => ({ ...c, [id]: v }));

  const start = () => {
    const pool: RoleDef[] = [];
    for (const [id, n] of Object.entries(counts)) for (let i = 0; i < n; i++) pool.push(ROLE_BY_ID[id]);
    const roles = shuffle(pool);
    setGame(players.map((name, i) => ({ name, role: roles[i], alive: true })));
    setRevealIdx(0);
    setStage(0);
    setPhase("reveal");
  };

  const alive = game.filter((p) => p.alive);
  const aliveMafia = alive.filter((p) => p.role.team === "mafia").length;
  const aliveOthers = alive.length - aliveMafia;
  const winner: "city" | "mafia" | null =
    game.length === 0 ? null : aliveMafia === 0 ? "city" : aliveMafia >= aliveOthers ? "mafia" : null;

  const stageLabel = stage === 0 ? "🌙 شب معارفه" : stage % 2 === 1 ? `☀️ روز ${toFa(Math.ceil(stage / 2))}` : `🌙 شب ${toFa(stage / 2)}`;

  const groups: Team[] = ["mafia", "city", "neutral"];

  return (
    <GameShell
      title="مافیا"
      emoji="🔫"
      accent={ACCENT}
      onBack={onBack}
      right={
        phase === "panel" ? (
          <button onClick={() => setShowRoles((s) => !s)} className="rounded-2xl bg-white/10 px-3 py-2 text-sm font-semibold">
            {showRoles ? "🙈 مخفی" : "👁️ نقش‌ها"}
          </button>
        ) : undefined
      }
    >
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              نقش‌ها رو تنظیم کن، گوشی دست‌به‌دست بچرخه تا هر کس نقشش رو ببینه، بعد گوشی می‌مونه دست <b>گرداننده</b> و پنل مدیریت شب و روز باز می‌شه.
            </p>
          </Card>
          <Card>
            <PlayersEditor players={players} onChange={setPlayers} min={4} />
          </Card>
          <Card>
            <SectionTitle hint={diff === 0 ? "✅ تعداد نقش‌ها درسته" : diff > 0 ? `${toFa(diff)} نقش کم داری` : `${toFa(-diff)} نقش اضافه داری`}>
              🎭 نقش‌ها ({toFa(total)}/{toFa(players.length)})
            </SectionTitle>
            <Button variant="secondary" size="sm" className="mb-3" onClick={() => setCounts(suggestRoles(players.length))}>
              ✨ چینش پیشنهادی برای {toFa(players.length)} نفر
            </Button>
            <div className="flex flex-col gap-4">
              {groups.map((team) => (
                <div key={team}>
                  <div className={cn("mb-2 inline-block rounded-full border px-3 py-1 text-xs font-bold", TEAM_STYLE[team])}>تیم {TEAM_LABEL[team]}</div>
                  <div className="flex flex-col gap-2">
                    {MAFIA_ROLES.filter((r) => r.team === team).map((r) => (
                      <Stepper
                        key={r.id}
                        label={`${r.emoji} ${r.name}`}
                        hint={r.desc}
                        value={counts[r.id] ?? 0}
                        onChange={(v) => setCount(r.id, v)}
                        min={0}
                        max={r.unique ? 1 : 10}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={diff !== 0 || players.length < 4} onClick={start}>
            پخش نقش‌ها 🃏
          </Button>
        </>
      )}

      {phase === "reveal" && game.length > 0 && (
        <PassPhone
          key={revealIdx}
          playerName={game[revealIdx].name}
          index={revealIdx}
          total={game.length}
          accent={ACCENT}
          nextLabel={revealIdx + 1 >= game.length ? "تمام! گوشی بره دست گرداننده" : "فهمیدم، نفر بعدی"}
          onNext={() => (revealIdx + 1 >= game.length ? setPhase("panel") : setRevealIdx(revealIdx + 1))}
        >
          <div className={cn("rounded-3xl border p-6", TEAM_STYLE[game[revealIdx].role.team])}>
            <div className="text-6xl">{game[revealIdx].role.emoji}</div>
            <div className="mt-2 text-xs opacity-80">تیم {TEAM_LABEL[game[revealIdx].role.team]}</div>
            <div className="text-3xl font-black">{game[revealIdx].role.name}</div>
            <p className="mt-3 text-sm leading-6 opacity-90">{game[revealIdx].role.desc}</p>
            {game[revealIdx].role.team === "mafia" && game.filter((p) => p.role.team === "mafia").length > 1 && (
              <p className="mt-3 text-xs opacity-80">هم‌تیمی‌هات رو در شب معارفه می‌شناسی.</p>
            )}
          </div>
        </PassPhone>
      )}

      {phase === "panel" && (
        <>
          {winner && (
            <Banner
              emoji={winner === "city" ? "🏙️" : "🔫"}
              title={winner === "city" ? "شهر برنده شد!" : "مافیا برنده شد!"}
              subtitle={winner === "city" ? "همه‌ی مافیاها حذف شدن." : "تعداد مافیا به شهروندها رسید."}
              className={winner === "city" ? "bg-emerald-500/20" : "bg-rose-500/20"}
            />
          )}
          <Card className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400">مرحله فعلی</div>
              <div className="text-2xl font-black">{stageLabel}</div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={stage === 0} onClick={() => setStage((s) => s - 1)}>
                قبلی
              </Button>
              <Button variant="secondary" onClick={() => setStage((s) => s + 1)}>
                مرحله بعد ⏭
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle>⏱️ تایمر صحبت</SectionTitle>
            <TimerBar seconds={timer.seconds} total={timerTotal} />
            <div className="mt-3 flex flex-wrap gap-2">
              {[30, 45, 60, 90, 120].map((s) => (
                <Button key={s} size="sm" variant={timerTotal === s ? "primary" : "secondary"} onClick={() => { setTimerTotal(s); timer.restart(s); }}>
                  {toFa(s)} ثانیه
                </Button>
              ))}
              <Button size="sm" variant="ghost" onClick={timer.toggle}>
                {timer.running ? "⏸" : "▶️"}
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle hint={`زنده: ${toFa(alive.length)} | مافیا: ${toFa(aliveMafia)} | بقیه: ${toFa(aliveOthers)}`}>👥 بازیکن‌ها</SectionTitle>
            <div className="flex flex-col gap-2">
              {game.map((p, i) => (
                <div
                  key={p.name}
                  className={cn("flex items-center justify-between gap-2 rounded-2xl px-3 py-2.5", p.alive ? "bg-white/5" : "bg-black/30 opacity-60")}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("text-lg font-bold", !p.alive && "line-through")}>{p.name}</span>
                    {showRoles && (
                      <span className={cn("rounded-full border px-2 py-0.5 text-xs", TEAM_STYLE[p.role.team])}>
                        {p.role.emoji} {p.role.name}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setGame((g) => g.map((x, j) => (j === i ? { ...x, alive: !x.alive } : x)))}
                    className={cn("rounded-xl px-3 py-1.5 text-sm font-bold", p.alive ? "bg-rose-500/20 text-rose-200 hover:bg-rose-500/40" : "bg-emerald-500/20 text-emerald-200")}
                  >
                    {p.alive ? "💀 حذف" : "↩️ برگردون"}
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Button variant="danger" size="lg" full onClick={() => setPhase("end")}>
            پایان بازی و نمایش همه‌ی نقش‌ها
          </Button>
        </>
      )}

      {phase === "end" && (
        <>
          <Banner emoji="🎉" title="بازی تمام شد" subtitle="نقش همه‌ی بازیکن‌ها:" className="bg-white/5" />
          <Card className="flex flex-col gap-2">
            {game.map((p) => (
              <div key={p.name} className={cn("flex items-center justify-between rounded-2xl border px-3 py-2", TEAM_STYLE[p.role.team])}>
                <span className="font-bold">{p.alive ? "" : "💀 "}{p.name}</span>
                <span className="text-sm">{p.role.emoji} {p.role.name}</span>
              </div>
            ))}
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className={cn("bg-gradient-to-br", ACCENT)} onClick={start}>
              دور جدید 🔁
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setPhase("setup")}>
              تنظیمات ⚙️
            </Button>
          </div>
        </>
      )}
    </GameShell>
  );
}
