import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, Chip, GameShell, PlayersEditor, SectionTitle, Stepper, TimerBar, Toggle } from "@/components/ui";
import { EASY_LETTERS, ESM_FAMIL_CATEGORIES, ESM_FAMIL_DEFAULT, HARD_LETTERS } from "@/data/party";
import { useCountdown, usePlayers } from "@/lib/hooks";
import { alarm, beep, pick, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-sky-400 to-indigo-600";
type Phase = "setup" | "letter" | "round" | "score" | "end";

const SCORE_STEPS = [0, 5, 10, 15];
const SCORE_STYLE: Record<number, string> = {
  0: "bg-white/5 text-slate-500",
  5: "bg-amber-500/25 text-amber-100",
  10: "bg-emerald-500/25 text-emerald-100",
  15: "bg-violet-500/35 text-violet-100",
};

export default function EsmFamil({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = usePlayers();
  const [cats, setCats] = useState<string[]>(ESM_FAMIL_DEFAULT);
  const [hard, setHard] = useState(false);
  const [useTimer, setUseTimer] = useState(true);
  const [seconds, setSeconds] = useState(90);
  const [phase, setPhase] = useState<Phase>("setup");
  const [letter, setLetter] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [used, setUsed] = useState<string[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [roundScores, setRoundScores] = useState<number[][]>([]);
  const [roundNo, setRoundNo] = useState(0);
  const spinRef = useRef<number | null>(null);

  const timer = useCountdown(seconds, {
    onEnd: () => {
      alarm();
      goScore();
    },
  });

  useEffect(() => () => { if (spinRef.current) clearInterval(spinRef.current); }, []);

  const letters = hard ? [...EASY_LETTERS, ...HARD_LETTERS] : EASY_LETTERS;

  const startGame = () => {
    setTotals(Object.fromEntries(players.map((p) => [p, 0])));
    setUsed([]);
    setRoundNo(0);
    setLetter(null);
    setPhase("letter");
  };

  const spin = () => {
    if (spinning) return;
    let available = letters.filter((l) => !used.includes(l));
    if (available.length === 0) {
      available = letters;
      setUsed([]);
    }
    const final = pick(available);
    setSpinning(true);
    let ticks = 0;
    spinRef.current = window.setInterval(() => {
      ticks++;
      setLetter(pick(letters));
      beep(400 + ticks * 20, 0.04, "sine", 0.08);
      if (ticks >= 22) {
        if (spinRef.current) clearInterval(spinRef.current);
        setLetter(final);
        setUsed((u) => [...u, final]);
        setSpinning(false);
        beep(1200, 0.2, "sine", 0.2);
      }
    }, 70);
  };

  const startRound = () => {
    setRoundNo((r) => r + 1);
    setRoundScores(players.map(() => cats.map(() => 0)));
    if (useTimer) timer.restart(seconds);
    setPhase("round");
  };

  const goScore = () => {
    timer.pause();
    setPhase("score");
  };

  const cycle = (pi: number, ci: number) =>
    setRoundScores((rs) =>
      rs.map((row, i) => (i === pi ? row.map((v, j) => (j === ci ? SCORE_STEPS[(SCORE_STEPS.indexOf(v) + 1) % SCORE_STEPS.length] : v)) : row)),
    );

  const setRow = (pi: number, val: number) => setRoundScores((rs) => rs.map((row, i) => (i === pi ? row.map(() => val) : row)));

  const commitRound = (next: Phase) => {
    setTotals((t) => {
      const n = { ...t };
      players.forEach((p, i) => (n[p] = (n[p] ?? 0) + roundScores[i].reduce((a, b) => a + b, 0)));
      return n;
    });
    setLetter(null);
    setPhase(next);
  };

  const ranking = [...players].sort((a, b) => (totals[b] ?? 0) - (totals[a] ?? 0));

  return (
    <GameShell title="اسم فامیل" emoji="✍️" accent={ACCENT} onBack={onBack}>
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              کاغذ و خودکار آماده! گوشی حرف رو انتخاب می‌کنه و زمان می‌گیره؛ آخر هر دور امتیازها رو با یک لمس ثبت کنید (۱۰ برای جواب یکتا، ۵ برای تکراری، ۱۵ اگر فقط تو نوشتی).
            </p>
          </Card>
          <Card>
            <PlayersEditor players={players} onChange={setPlayers} min={2} />
          </Card>
          <Card>
            <SectionTitle>📋 ستون‌ها</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {ESM_FAMIL_CATEGORIES.map((c) => (
                <Chip key={c} active={cats.includes(c)} onClick={() => setCats((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]))}>
                  {c}
                </Chip>
              ))}
            </div>
          </Card>
          <Card className="flex flex-col gap-3">
            <Toggle label="حروف سخت" hint="ث ذ ژ ض ط ظ ع غ" checked={hard} onChange={setHard} />
            <Toggle label="تایمر" hint="اگر خاموش باشه، فقط با دکمه‌ی استپ دور تموم می‌شه" checked={useTimer} onChange={setUseTimer} />
            {useTimer && <Stepper label="زمان هر دور" value={seconds} onChange={setSeconds} min={30} max={300} step={15} suffix="ثانیه" />}
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={players.length < 2 || cats.length === 0} onClick={startGame}>
            شروع بازی ✏️
          </Button>
        </>
      )}

      {phase === "letter" && (
        <>
          <Leaderboard ranking={ranking} totals={totals} />
          <Card className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
            <div className="text-sm text-slate-400">دور {toFa(roundNo + 1)}</div>
            <div
              className={cn(
                "flex h-40 w-40 items-center justify-center rounded-[2.5rem] bg-gradient-to-br text-8xl font-black shadow-2xl",
                ACCENT,
                spinning && "animate-shake",
              )}
            >
              {letter ?? "؟"}
            </div>
            {!letter || spinning ? (
              <Button size="xl" variant="warning" onClick={spin} disabled={spinning}>
                {spinning ? "در حال چرخش…" : "🎰 انتخاب حرف"}
              </Button>
            ) : (
              <div className="flex w-full flex-col gap-2">
                <Button size="xl" className={cn("bg-gradient-to-br", ACCENT)} onClick={startRound}>
                  شروع دور با حرف «{letter}» ▶️
                </Button>
                <Button variant="ghost" onClick={spin}>
                  حرف دیگه‌ای بده
                </Button>
              </div>
            )}
            {used.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1 text-xs text-slate-400">
                <span>حروف استفاده‌شده:</span>
                {used.map((l) => (
                  <span key={l} className="rounded bg-white/10 px-1.5">{l}</span>
                ))}
              </div>
            )}
          </Card>
          {roundNo > 0 && (
            <Button variant="danger" onClick={() => setPhase("end")}>
              پایان بازی 🏁
            </Button>
          )}
        </>
      )}

      {phase === "round" && (
        <>
          <Card className="flex flex-col items-center gap-4 py-6">
            <div className="text-sm text-slate-400">با حرف</div>
            <div className={cn("flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br text-7xl font-black shadow-2xl", ACCENT)}>{letter}</div>
            {useTimer && <TimerBar seconds={timer.seconds} total={seconds} danger={15} className="mt-2" />}
            <div className="flex flex-wrap justify-center gap-1.5">
              {cats.map((c) => (
                <span key={c} className="rounded-full bg-white/10 px-3 py-1 text-sm">{c}</span>
              ))}
            </div>
          </Card>
          <Button size="xl" full variant="danger" className="py-8 text-3xl" onClick={goScore}>
            ✋ استپ!
          </Button>
        </>
      )}

      {phase === "score" && (
        <>
          <Card>
            <SectionTitle hint="روی هر خونه بزن: ۰ → ۵ → ۱۰ → ۱۵">
              🧮 امتیاز دور «{letter}»
            </SectionTitle>
            <div className="-mx-2 overflow-x-auto px-2">
              <table className="w-full min-w-max border-separate border-spacing-1 text-center text-sm">
                <thead>
                  <tr>
                    <th className="sticky right-0 bg-slate-900/90 px-2 py-1 text-start text-xs text-slate-400">بازیکن</th>
                    {cats.map((c) => (
                      <th key={c} className="px-1 py-1 text-xs font-semibold text-slate-300">{c}</th>
                    ))}
                    <th className="px-2 py-1 text-xs text-slate-400">جمع</th>
                    <th className="px-1 py-1 text-xs text-slate-400">همه</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p, pi) => (
                    <tr key={p}>
                      <td className="sticky right-0 bg-slate-900/90 px-2 py-1 text-start font-bold">{p}</td>
                      {cats.map((c, ci) => (
                        <td key={c}>
                          <button
                            onClick={() => cycle(pi, ci)}
                            className={cn("h-10 w-11 rounded-xl font-black tabular-nums transition active:scale-90", SCORE_STYLE[roundScores[pi]?.[ci] ?? 0])}
                          >
                            {toFa(roundScores[pi]?.[ci] ?? 0)}
                          </button>
                        </td>
                      ))}
                      <td className="px-2 font-black text-sky-200">{toFa(roundScores[pi]?.reduce((a, b) => a + b, 0) ?? 0)}</td>
                      <td>
                        <div className="flex gap-0.5">
                          <button onClick={() => setRow(pi, 10)} className="rounded-lg bg-emerald-500/20 px-1.5 py-1 text-[10px]">۱۰</button>
                          <button onClick={() => setRow(pi, 0)} className="rounded-lg bg-white/10 px-1.5 py-1 text-[10px]">۰</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" className={cn("bg-gradient-to-br", ACCENT)} onClick={() => commitRound("letter")}>
              ثبت و حرف بعدی ⏭
            </Button>
            <Button size="lg" variant="danger" onClick={() => commitRound("end")}>
              ثبت و پایان 🏁
            </Button>
          </div>
        </>
      )}

      {phase === "end" && (
        <>
          <Banner emoji="🏆" title={`${ranking[0]} برنده شد!`} subtitle={`با ${toFa(totals[ranking[0]] ?? 0)} امتیاز در ${toFa(roundNo)} دور`} className="bg-sky-500/20" />
          <Leaderboard ranking={ranking} totals={totals} />
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

function Leaderboard({ ranking, totals }: { ranking: string[]; totals: Record<string, number> }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <Card>
      <SectionTitle>📊 جدول امتیازات</SectionTitle>
      <div className="flex flex-col gap-1.5">
        {ranking.map((p, i) => (
          <div key={p} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
            <span className="font-bold">
              <span className="me-2">{medals[i] ?? "•"}</span>
              {p}
            </span>
            <span className="text-lg font-black tabular-nums text-sky-200">{toFa(totals[p] ?? 0)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
