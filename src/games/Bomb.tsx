import { useEffect, useRef, useState } from "react";
import { Banner, Button, Card, GameShell, PlayersEditor, SectionTitle, Stepper, Toggle } from "@/components/ui";
import { BOMB_TOPICS } from "@/data/party";
import { usePlayers } from "@/lib/hooks";
import { beep, explosion, pick, randInt, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-orange-500 to-red-600";
type Phase = "setup" | "ready" | "ticking" | "boom" | "end";

export default function Bomb({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = usePlayers();
  const [withPlayers, setWithPlayers] = useState(true);
  const [minS, setMinS] = useState(20);
  const [maxS, setMaxS] = useState(60);
  const [livesInit, setLivesInit] = useState(3);
  const [phase, setPhase] = useState<Phase>("setup");
  const [topic, setTopic] = useState("");
  const [lives, setLives] = useState<Record<string, number>>({});
  const [roundNo, setRoundNo] = useState(0);
  const usedTopics = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const durRef = useRef(0);
  const lastTick = useRef(0);

  const clearTimers = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
  };
  useEffect(() => clearTimers, []);

  const newTopic = () => {
    let available = BOMB_TOPICS.filter((t) => !usedTopics.current.has(t));
    if (available.length === 0) {
      usedTopics.current.clear();
      available = BOMB_TOPICS;
    }
    const t = pick(available);
    usedTopics.current.add(t);
    setTopic(t);
  };

  const startGame = () => {
    setLives(Object.fromEntries(players.map((p) => [p, livesInit])));
    setRoundNo(0);
    newTopic();
    setPhase("ready");
  };

  const light = () => {
    const lo = Math.min(minS, maxS);
    const hi = Math.max(minS, maxS);
    durRef.current = randInt(lo * 1000, hi * 1000);
    startRef.current = Date.now();
    lastTick.current = 0;
    setRoundNo((r) => r + 1);
    setPhase("ticking");
    timeoutRef.current = window.setTimeout(() => {
      clearTimers();
      explosion();
      setPhase("boom");
    }, durRef.current);
    intervalRef.current = window.setInterval(() => {
      const frac = (Date.now() - startRef.current) / durRef.current;
      const period = frac < 0.5 ? 1000 : frac < 0.8 ? 600 : 300;
      if (Date.now() - lastTick.current >= period) {
        lastTick.current = Date.now();
        beep(frac < 0.8 ? 600 : 900, 0.05, "square", 0.08);
      }
    }, 50);
  };

  const cancel = () => {
    clearTimers();
    setPhase("ready");
  };

  const alive = players.filter((p) => (lives[p] ?? 0) > 0);

  const blame = (name: string) => {
    const next = { ...lives, [name]: Math.max(0, (lives[name] ?? 0) - 1) };
    setLives(next);
    const stillAlive = players.filter((p) => (next[p] ?? 0) > 0);
    newTopic();
    setPhase(stillAlive.length <= 1 ? "end" : "ready");
  };

  const winner = alive.length === 1 ? alive[0] : null;

  return (
    <GameShell title="بمب کلمات" emoji="💣" accent={ACCENT} onBack={onBack}>
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              یک موضوع نشون داده می‌شه. هر نفر باید یک کلمه از اون موضوع بگه و <b>سریع گوشی رو به نفر بعدی بده</b>. بمب با زمان مخفی می‌ترکه؛ هر کی گوشی دستش بود یک جان از دست می‌ده!
            </p>
          </Card>
          <Card className="flex flex-col gap-3">
            <Stepper label="حداقل زمان بمب" value={minS} onChange={setMinS} min={5} max={120} step={5} suffix="ثانیه" />
            <Stepper label="حداکثر زمان بمب" value={maxS} onChange={setMaxS} min={10} max={180} step={5} suffix="ثانیه" />
            <Toggle label="حالت حذفی با جان" hint="بازیکن‌ها جان دارن و آخرین نفر برنده‌ست" checked={withPlayers} onChange={setWithPlayers} />
            {withPlayers && <Stepper label="تعداد جان هر نفر" value={livesInit} onChange={setLivesInit} min={1} max={5} />}
          </Card>
          {withPlayers && (
            <Card>
              <PlayersEditor players={players} onChange={setPlayers} min={2} />
            </Card>
          )}
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={withPlayers && players.length < 2} onClick={startGame}>
            شروع 💣
          </Button>
        </>
      )}

      {phase === "ready" && (
        <>
          {withPlayers && <Lives players={players} lives={lives} />}
          <Card className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
            <div className="text-sm text-slate-400">موضوع دور {toFa(roundNo + 1)}</div>
            <div className="animate-pop text-3xl font-black leading-snug">{topic}</div>
            <Button variant="ghost" size="sm" onClick={newTopic}>
              🔀 موضوع دیگه
            </Button>
            <Button size="xl" className={cn("mt-2 bg-gradient-to-br", ACCENT)} onClick={light}>
              🔥 فتیله رو روشن کن!
            </Button>
          </Card>
        </>
      )}

      {phase === "ticking" && (
        <>
          <Card className="flex flex-1 flex-col items-center justify-center gap-6 py-12 text-center no-select">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-orange-500/40 animate-pulse-ring" />
              <div className="relative text-9xl animate-shake">💣</div>
            </div>
            <div className="text-sm text-slate-400">موضوع</div>
            <div className="text-3xl font-black leading-snug">{topic}</div>
            <p className="text-slate-300">یه کلمه بگو و گوشی رو رد کن!</p>
          </Card>
          <Button variant="ghost" onClick={cancel}>
            لغو این دور
          </Button>
        </>
      )}

      {phase === "boom" && (
        <>
          <Banner emoji="💥" title="بوووم!" subtitle="بمب ترکید!" className="bg-gradient-to-br from-orange-500/40 to-red-700/40" />
          {withPlayers ? (
            <Card>
              <SectionTitle>بمب دست کی بود؟ 😬</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {alive.map((p) => (
                  <Button key={p} variant="secondary" size="lg" onClick={() => blame(p)}>
                    {p} <span className="text-xs text-slate-400">({"❤️".repeat(lives[p] ?? 0)})</span>
                  </Button>
                ))}
              </div>
            </Card>
          ) : (
            <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} onClick={() => { newTopic(); setPhase("ready"); }}>
              دور بعد 🔁
            </Button>
          )}
        </>
      )}

      {phase === "end" && (
        <>
          <Banner emoji="🏆" title={winner ? `${winner} برنده شد!` : "همه ترکیدن!"} subtitle={`بعد از ${toFa(roundNo)} دور`} className="bg-emerald-500/20" />
          <Lives players={players} lives={lives} />
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

function Lives({ players, lives }: { players: string[]; lives: Record<string, number> }) {
  return (
    <Card>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {players.map((p) => {
          const l = lives[p] ?? 0;
          return (
            <div key={p} className={cn("flex items-center justify-between rounded-xl px-3 py-1.5 text-sm", l > 0 ? "bg-white/5" : "bg-black/30 opacity-50")}>
              <span className={cn("font-bold", l === 0 && "line-through")}>{p}</span>
              <span>{l > 0 ? "❤️".repeat(l) : "💀"}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
