import { useMemo, useRef, useState } from "react";
import { Banner, Button, Card, Chip, GameShell, SectionTitle, Stepper, TimerBar } from "@/components/ui";
import { CHARADES_CATEGORIES } from "@/data/charades";
import { useCountdown } from "@/lib/hooks";
import { alarm, beep, pick, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-amber-400 to-orange-600";
type Phase = "setup" | "ready" | "play" | "turnEnd" | "end";

const TEAM_PRESETS = [
  { name: "تیم قرمز", color: "from-rose-500 to-red-600" },
  { name: "تیم آبی", color: "from-sky-500 to-blue-600" },
  { name: "تیم سبز", color: "from-emerald-500 to-green-600" },
  { name: "تیم زرد", color: "from-amber-400 to-yellow-500" },
];

interface WordItem {
  word: string;
  category: string;
  emoji: string;
}

export default function Charades({ onBack }: { onBack: () => void }) {
  const [teamCount, setTeamCount] = useState(2);
  const [seconds, setSeconds] = useState(60);
  const [rounds, setRounds] = useState(3);
  const [cats, setCats] = useState<string[]>(CHARADES_CATEGORIES.map((c) => c.id));
  const [phase, setPhase] = useState<Phase>("setup");
  const [scores, setScores] = useState<number[]>([]);
  const [turn, setTurn] = useState(0);
  const [current, setCurrent] = useState<WordItem | null>(null);
  const [turnLog, setTurnLog] = useState<{ word: string; ok: boolean }[]>([]);
  const used = useRef<Set<string>>(new Set());

  const timer = useCountdown(seconds, {
    onEnd: () => {
      alarm();
      setPhase("turnEnd");
    },
  });

  const pool = useMemo<WordItem[]>(
    () => CHARADES_CATEGORIES.filter((c) => cats.includes(c.id)).flatMap((c) => c.words.map((w) => ({ word: w, category: c.name, emoji: c.emoji }))),
    [cats],
  );

  const nextWord = () => {
    let available = pool.filter((w) => !used.current.has(w.word));
    if (available.length === 0) {
      used.current.clear();
      available = pool;
    }
    const w = pick(available);
    used.current.add(w.word);
    setCurrent(w);
  };

  const teamIdx = turn % teamCount;
  const roundNum = Math.floor(turn / teamCount) + 1;
  const totalTurns = teamCount * rounds;

  const startGame = () => {
    setScores(Array(teamCount).fill(0));
    setTurn(0);
    used.current.clear();
    setPhase("ready");
  };

  const startTurn = () => {
    setTurnLog([]);
    nextWord();
    timer.restart(seconds);
    setPhase("play");
  };

  const mark = (ok: boolean) => {
    if (!current) return;
    setTurnLog((l) => [...l, { word: current.word, ok }]);
    if (ok) {
      beep(1046, 0.1, "sine", 0.2);
      setScores((s) => s.map((v, i) => (i === teamIdx ? v + 1 : v)));
    } else beep(220, 0.1, "triangle", 0.15);
    nextWord();
  };

  const endTurn = () => {
    timer.pause();
    setPhase("turnEnd");
  };

  const nextTurn = () => {
    if (turn + 1 >= totalTurns) setPhase("end");
    else {
      setTurn(turn + 1);
      setPhase("ready");
    }
  };

  const ranking = scores.map((s, i) => ({ i, s })).sort((a, b) => b.s - a.s);

  return (
    <GameShell title="پانتومیم" emoji="🎭" accent={ACCENT} onBack={onBack}>
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              یک نفر از تیم کلمه رو می‌بینه و <b>بدون حرف زدن</b> اجراش می‌کنه؛ هم‌تیمی‌ها باید حدس بزنن. هر حدس درست یک امتیاز.
            </p>
          </Card>
          <Card className="flex flex-col gap-3">
            <Stepper label="تعداد تیم‌ها" value={teamCount} onChange={setTeamCount} min={2} max={4} />
            <Stepper label="زمان هر نوبت" value={seconds} onChange={setSeconds} min={30} max={180} step={15} suffix="ثانیه" />
            <Stepper label="تعداد دور" value={rounds} onChange={setRounds} min={1} max={6} hint="هر تیم در هر دور یک نوبت داره" />
          </Card>
          <Card>
            <SectionTitle hint={`${toFa(pool.length)} کلمه`}>🗂️ دسته‌بندی‌ها</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {CHARADES_CATEGORIES.map((c) => (
                <Chip
                  key={c.id}
                  active={cats.includes(c.id)}
                  onClick={() => setCats((cs) => (cs.includes(c.id) ? cs.filter((x) => x !== c.id) : [...cs, c.id]))}
                >
                  {c.emoji} {c.name}
                </Chip>
              ))}
            </div>
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={cats.length === 0} onClick={startGame}>
            شروع بازی 🎬
          </Button>
        </>
      )}

      {phase === "ready" && (
        <>
          <ScoreBoard scores={scores} teamCount={teamCount} active={teamIdx} />
          <Card className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="text-sm text-slate-400">
              دور {toFa(roundNum)} از {toFa(rounds)}
            </div>
            <div className={cn("rounded-3xl bg-gradient-to-br px-8 py-4 text-3xl font-black shadow-lg", TEAM_PRESETS[teamIdx].color)}>
              نوبت {TEAM_PRESETS[teamIdx].name}
            </div>
            <p className="text-slate-300">مجری تیم گوشی رو بگیره و وقتی آماده بود شروع کنه.</p>
            <Button size="xl" className={cn("bg-gradient-to-br", ACCENT)} onClick={startTurn}>
              آماده‌ام، شروع! ⏱️
            </Button>
          </Card>
        </>
      )}

      {phase === "play" && current && (
        <>
          <Card>
            <TimerBar seconds={timer.seconds} total={seconds} />
          </Card>
          <Card className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center no-select">
            <div className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
              {current.emoji} {current.category}
            </div>
            <div key={current.word} className="animate-pop text-3xl font-black leading-snug sm:text-4xl">{current.word}</div>
            <div className="text-sm text-slate-400">
              امتیاز این نوبت: <b className="text-white">{toFa(turnLog.filter((t) => t.ok).length)}</b>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Button size="xl" variant="secondary" onClick={() => mark(false)}>
              ⏭ رد
            </Button>
            <Button size="xl" variant="success" onClick={() => mark(true)}>
              ✅ درست
            </Button>
          </div>
          <Button variant="ghost" onClick={endTurn}>
            پایان زودتر نوبت
          </Button>
        </>
      )}

      {phase === "turnEnd" && (
        <>
          <Banner
            emoji="⏰"
            title={`نوبت ${TEAM_PRESETS[teamIdx].name} تمام شد`}
            subtitle={`${toFa(turnLog.filter((t) => t.ok).length)} حدس درست`}
            className="bg-white/5"
          />
          <Card>
            <SectionTitle>کلمات این نوبت</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {turnLog.map((t, i) => (
                <span key={i} className={cn("rounded-full px-3 py-1 text-sm", t.ok ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200 line-through")}>
                  {t.word}
                </span>
              ))}
              {current && <span className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-300">{current.word} (نیمه‌کاره)</span>}
            </div>
          </Card>
          <ScoreBoard scores={scores} teamCount={teamCount} active={teamIdx} />
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} onClick={nextTurn}>
            {turn + 1 >= totalTurns ? "نمایش نتیجه نهایی 🏆" : "تیم بعدی ⏭"}
          </Button>
        </>
      )}

      {phase === "end" && (
        <>
          <Banner
            emoji="🏆"
            title={ranking[0].s === ranking[1]?.s ? "مساوی شد!" : `${TEAM_PRESETS[ranking[0].i].name} برنده شد!`}
            subtitle={`با ${toFa(ranking[0].s)} امتیاز`}
            className={cn("bg-gradient-to-br text-white", TEAM_PRESETS[ranking[0].i].color)}
          />
          <ScoreBoard scores={scores} teamCount={teamCount} />
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className={cn("bg-gradient-to-br", ACCENT)} onClick={startGame}>
              بازی دوباره 🔁
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

function ScoreBoard({ scores, teamCount, active }: { scores: number[]; teamCount: number; active?: number }) {
  return (
    <div className={cn("grid gap-2", teamCount <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-4")}>
      {Array.from({ length: teamCount }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl border p-3 text-center transition",
            active === i ? "border-white/40 bg-white/15 scale-[1.03]" : "border-white/10 bg-white/5",
          )}
        >
          <div className="text-xs text-slate-300">{TEAM_PRESETS[i].name}</div>
          <div className="text-3xl font-black">{toFa(scores[i] ?? 0)}</div>
        </div>
      ))}
    </div>
  );
}
