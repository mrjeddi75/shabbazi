import { useMemo, useState } from "react";
import { Banner, Button, Card, GameShell, PassPhone, PlayersEditor, SectionTitle, Stepper, TimerBar, Toggle } from "@/components/ui";
import { SPY_LOCATIONS, type SpyLocation } from "@/data/spyfall";
import { useCountdown, usePlayers } from "@/lib/hooks";
import { alarm, pick, shuffle, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-emerald-400 to-teal-600";

type Phase = "setup" | "reveal" | "play" | "guess" | "end";

interface Assignment {
  name: string;
  isSpy: boolean;
  role?: string;
}

interface Round {
  location: SpyLocation;
  assignments: Assignment[];
}

export default function Spyfall({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = usePlayers();
  const [spyCount, setSpyCount] = useState(1);
  const [minutes, setMinutes] = useState(8);
  const [useRoles, setUseRoles] = useState(true);
  const [phase, setPhase] = useState<Phase>("setup");
  const [round, setRound] = useState<Round | null>(null);
  const [revealIdx, setRevealIdx] = useState(0);
  const [result, setResult] = useState<{ winner: "spy" | "city"; reason: string } | null>(null);
  const [timeUp, setTimeUp] = useState(false);

  const timer = useCountdown(minutes * 60, { onEnd: () => { alarm(); setTimeUp(true); } });

  const locationList = useMemo(() => [...SPY_LOCATIONS].sort((a, b) => a.name.localeCompare(b.name, "fa")), []);

  const startRound = () => {
    const location = pick(SPY_LOCATIONS);
    const order = shuffle(players);
    const roles = shuffle(location.roles);
    const assignments: Assignment[] = order.map((name, i) => ({
      name,
      isSpy: i < spyCount,
      role: useRoles ? roles[i % roles.length] : undefined,
    }));
    setRound({ location, assignments: shuffle(assignments) });
    setRevealIdx(0);
    setResult(null);
    setTimeUp(false);
    timer.reset(minutes * 60);
    setPhase("reveal");
  };

  const finish = (winner: "spy" | "city", reason: string) => {
    timer.pause();
    setResult({ winner, reason });
    setPhase("end");
  };

  const spies = round?.assignments.filter((a) => a.isSpy).map((a) => a.name) ?? [];

  return (
    <GameShell title="جاسوس" emoji="🕵️" accent={ACCENT} onBack={onBack}>
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              همه یک <b>مکان</b> مشترک می‌بینن، به جز <b>جاسوس</b>! با سؤال و جواب جاسوس رو پیدا کنید؛ جاسوس هم سعی می‌کنه مکان رو حدس بزنه.
            </p>
          </Card>
          <Card>
            <PlayersEditor players={players} onChange={setPlayers} min={3} />
          </Card>
          <Card className="flex flex-col gap-3">
            <Stepper label="تعداد جاسوس" value={spyCount} onChange={setSpyCount} min={1} max={Math.max(1, Math.floor(players.length / 3))} />
            <Stepper label="زمان بازی" value={minutes} onChange={setMinutes} min={2} max={20} suffix="دقیقه" />
            <Toggle label="نقش برای هر نفر" hint="به غیر جاسوس‌ها یک نقش در مکان داده می‌شه" checked={useRoles} onChange={setUseRoles} />
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={players.length < 3} onClick={startRound}>
            شروع بازی 🎲
          </Button>
          {players.length < 3 && <p className="text-center text-sm text-rose-300">حداقل ۳ بازیکن لازمه.</p>}
        </>
      )}

      {phase === "reveal" && round && (
        <PassPhone
          key={revealIdx}
          playerName={round.assignments[revealIdx].name}
          index={revealIdx}
          total={round.assignments.length}
          accent={ACCENT}
          onNext={() => {
            if (revealIdx + 1 >= round.assignments.length) {
              setPhase("play");
              timer.restart(minutes * 60);
            } else setRevealIdx(revealIdx + 1);
          }}
        >
          {round.assignments[revealIdx].isSpy ? (
            <div className="rounded-3xl bg-gradient-to-br from-rose-500/30 to-red-900/30 p-6">
              <div className="text-6xl">🕵️</div>
              <div className="mt-3 text-3xl font-black text-rose-300">تو جاسوسی!</div>
              <p className="mt-2 text-sm text-slate-300">مکان رو نمی‌دونی. با دقت گوش بده و لو نرو!</p>
            </div>
          ) : (
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/30 to-teal-900/30 p-6">
              <div className="text-6xl">{round.location.emoji}</div>
              <div className="mt-2 text-sm text-slate-300">مکان</div>
              <div className="text-3xl font-black">{round.location.name}</div>
              {round.assignments[revealIdx].role && (
                <>
                  <div className="mt-4 text-sm text-slate-300">نقش تو</div>
                  <div className="text-xl font-bold text-emerald-200">{round.assignments[revealIdx].role}</div>
                </>
              )}
            </div>
          )}
        </PassPhone>
      )}

      {phase === "play" && round && (
        <>
          <Card className="text-center">
            <TimerBar seconds={timer.seconds} total={minutes * 60} danger={30} />
            {timeUp && <div className="mt-3 font-bold text-rose-300 animate-pulse">⏰ زمان تمام شد! رأی بدید.</div>}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" full onClick={timer.toggle} disabled={timer.seconds === 0}>
                {timer.running ? "⏸ توقف" : "▶️ ادامه"}
              </Button>
              <Button variant="secondary" full onClick={() => timer.restart(minutes * 60)}>
                🔄 ریست
              </Button>
            </div>
          </Card>

          <Card>
            <SectionTitle hint={`${toFa(locationList.length)} مکان`}>🗺️ مکان‌های ممکن</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {locationList.map((l) => (
                <span key={l.name} className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-slate-300">
                  {l.emoji} {l.name}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="warning" size="lg" onClick={() => { timer.pause(); setPhase("guess"); }}>
              🕵️ جاسوس می‌خواد حدس بزنه
            </Button>
            <Button variant="danger" size="lg" onClick={() => setPhase("end")}>
              🗳️ رأی‌گیری تموم شد
            </Button>
          </div>
        </>
      )}

      {phase === "guess" && round && (
        <>
          <Card>
            <SectionTitle>جاسوس، مکان رو انتخاب کن:</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {locationList.map((l) => (
                <button
                  key={l.name}
                  onClick={() =>
                    l.name === round.location.name
                      ? finish("spy", "جاسوس مکان رو درست حدس زد!")
                      : finish("city", `جاسوس اشتباه حدس زد (${l.name})`)
                  }
                  className="rounded-2xl bg-white/5 px-3 py-3 text-sm font-semibold hover:bg-white/15 active:scale-95"
                >
                  {l.emoji} {l.name}
                </button>
              ))}
            </div>
          </Card>
          <Button variant="ghost" onClick={() => { setPhase("play"); timer.start(); }}>
            ← برگرد به بازی
          </Button>
        </>
      )}

      {phase === "end" && round && (
        <>
          {result ? (
            <Banner
              emoji={result.winner === "spy" ? "🕵️" : "🏙️"}
              title={result.winner === "spy" ? "جاسوس برنده شد!" : "شهروندها برنده شدن!"}
              subtitle={result.reason}
              className={result.winner === "spy" ? "bg-rose-500/20" : "bg-emerald-500/20"}
            />
          ) : (
            <Card className="text-center">
              <div className="text-sm text-slate-300">کی رو متهم کردید؟ نتیجه رو خودتون اعلام کنید:</div>
              <div className="mt-3 flex gap-2">
                <Button variant="success" full onClick={() => finish("city", "جاسوس شناسایی شد!")}>
                  جاسوس پیدا شد ✅
                </Button>
                <Button variant="danger" full onClick={() => finish("spy", "اشتباه متهم کردید!")}>
                  اشتباه بود ❌
                </Button>
              </div>
            </Card>
          )}
          <Card className="text-center">
            <div className="text-sm text-slate-400">مکان</div>
            <div className="text-2xl font-black">
              {round.location.emoji} {round.location.name}
            </div>
            <div className="mt-4 text-sm text-slate-400">{spies.length > 1 ? "جاسوس‌ها" : "جاسوس"}</div>
            <div className="text-2xl font-black text-rose-300">{spies.join("، ")}</div>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className={cn("bg-gradient-to-br", ACCENT)} onClick={startRound}>
              دور بعد 🔁
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
