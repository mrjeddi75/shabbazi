import { useEffect, useRef, useState } from "react";
import { Button, Card, GameShell, PlayersEditor, SectionTitle } from "@/components/ui";
import { DARES, TRUTHS } from "@/data/party";
import { usePlayers } from "@/lib/hooks";
import { beep, pick, randInt, toFa, vibrate } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-fuchsia-500 to-purple-700";
type Phase = "setup" | "spin" | "choose" | "card";
type Kind = "truth" | "dare";

export default function TruthOrDare({ onBack }: { onBack: () => void }) {
  const [players, setPlayers] = usePlayers();
  const [phase, setPhase] = useState<Phase>("setup");
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("truth");
  const [card, setCard] = useState("");
  const [stats, setStats] = useState<Record<string, { done: number; chicken: number }>>({});
  const used = useRef<Set<string>>(new Set());
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const n = players.length;

  const spin = () => {
    if (spinning || n < 2) return;
    let idx = randInt(0, n - 1);
    if (idx === chosen && n > 1) idx = (idx + 1) % n;
    const slice = 360 / n;
    const target = idx * slice + randInt(-Math.floor(slice / 3), Math.floor(slice / 3));
    const current = ((angle % 360) + 360) % 360;
    const delta = ((target - current) % 360 + 360) % 360;
    const next = angle + 360 * randInt(3, 5) + delta;
    setSpinning(true);
    setChosen(null);
    setAngle(next);
    beep(500, 0.08, "sine", 0.1);
    timeoutRef.current = window.setTimeout(() => {
      setSpinning(false);
      setChosen(idx);
      vibrate(150);
      beep(1000, 0.2, "sine", 0.2);
      setPhase("choose");
    }, 3100);
  };

  const draw = (k: Kind) => {
    const pool = k === "truth" ? TRUTHS : DARES;
    let available = pool.filter((x) => !used.current.has(x));
    if (available.length === 0) {
      pool.forEach((x) => used.current.delete(x));
      available = pool;
    }
    const c = pick(available);
    used.current.add(c);
    setKind(k);
    setCard(c);
    setPhase("card");
  };

  const resolve = (done: boolean) => {
    if (chosen !== null) {
      const name = players[chosen];
      setStats((s) => ({
        ...s,
        [name]: { done: (s[name]?.done ?? 0) + (done ? 1 : 0), chicken: (s[name]?.chicken ?? 0) + (done ? 0 : 1) },
      }));
    }
    setPhase("spin");
  };

  const radius = 125;

  return (
    <GameShell title="جرأت یا حقیقت" emoji="🍾" accent={ACCENT} onBack={onBack}>
      {phase === "setup" && (
        <>
          <Card>
            <p className="text-sm leading-7 text-slate-300">
              دور هم بشینید، گوشی رو وسط بذارید و بطری رو بچرخونید. هر کی که بطری سمتش ایستاد باید <b>حقیقت</b> یا <b>جرأت</b> رو انتخاب کنه!
            </p>
          </Card>
          <Card>
            <PlayersEditor players={players} onChange={setPlayers} min={2} max={12} />
          </Card>
          <Button size="xl" full className={cn("bg-gradient-to-br", ACCENT)} disabled={n < 2} onClick={() => { setStats({}); setPhase("spin"); }}>
            شروع 🍾
          </Button>
        </>
      )}

      {(phase === "spin" || phase === "choose") && (
        <>
          <Card className="flex flex-col items-center gap-4 py-6">
            <div className="relative h-80 w-80 max-w-full no-select">
              <div className="absolute inset-6 rounded-full border-2 border-dashed border-white/10" />
              {players.map((p, i) => {
                const theta = (i * 360) / n;
                const rad = (theta * Math.PI) / 180;
                const x = 160 + radius * Math.sin(rad);
                const y = 160 - radius * Math.cos(rad);
                return (
                  <div
                    key={p}
                    className={cn(
                      "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-sm font-bold transition-all duration-300",
                      chosen === i ? "scale-125 bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-900/50" : "bg-white/10 text-slate-200",
                    )}
                    style={{ left: x, top: y }}
                  >
                    {p}
                  </div>
                );
              })}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                <svg
                  viewBox="0 0 40 160"
                  className="h-44 w-11 drop-shadow-2xl"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    transition: spinning ? "transform 3s cubic-bezier(0.15, 0.85, 0.15, 1)" : "none",
                  }}
                >
                  <defs>
                    <linearGradient id="bottle" x1="0" x2="1">
                      <stop offset="0" stopColor="#34d399" />
                      <stop offset="0.5" stopColor="#059669" />
                      <stop offset="1" stopColor="#065f46" />
                    </linearGradient>
                  </defs>
                  <rect x="14" y="0" width="12" height="42" rx="4" fill="#6ee7b7" />
                  <rect x="12" y="2" width="16" height="8" rx="2" fill="#fbbf24" />
                  <rect x="5" y="36" width="30" height="122" rx="13" fill="url(#bottle)" />
                  <rect x="11" y="72" width="18" height="44" rx="3" fill="#fef3c7" opacity="0.9" />
                  <circle cx="20" cy="94" r="6" fill="#a855f7" opacity="0.8" />
                </svg>
              </div>
            </div>

            {phase === "spin" ? (
              <Button size="xl" className={cn("bg-gradient-to-br", ACCENT)} onClick={spin} disabled={spinning}>
                {spinning ? "داره می‌چرخه…" : "🌀 بچرخون!"}
              </Button>
            ) : (
              <div className="w-full animate-pop text-center">
                <div className="text-sm text-slate-400">نوبت</div>
                <div className="mb-4 text-3xl font-black">{players[chosen!]}</div>
                <div className="grid grid-cols-2 gap-3">
                  <Button size="xl" className="bg-gradient-to-br from-sky-500 to-blue-700" onClick={() => draw("truth")}>
                    🤐 حقیقت
                  </Button>
                  <Button size="xl" className="bg-gradient-to-br from-orange-500 to-red-600" onClick={() => draw("dare")}>
                    🔥 جرأت
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <Stats players={players} stats={stats} />
        </>
      )}

      {phase === "card" && chosen !== null && (
        <>
          <Card
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center animate-pop bg-gradient-to-br",
              kind === "truth" ? "from-sky-500/30 to-blue-900/30" : "from-orange-500/30 to-red-900/30",
            )}
          >
            <div className="text-6xl">{kind === "truth" ? "🤐" : "🔥"}</div>
            <div className="text-sm text-slate-300">
              {players[chosen]} — {kind === "truth" ? "حقیقت" : "جرأت"}
            </div>
            <p className="text-2xl font-black leading-relaxed">{card}</p>
          </Card>
          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" variant="success" onClick={() => resolve(true)}>
              ✅ انجام شد
            </Button>
            <Button size="lg" variant="danger" onClick={() => resolve(false)}>
              🐔 جا زد
            </Button>
          </div>
          <Button variant="ghost" onClick={() => draw(kind)}>
            🔄 یه کارت دیگه
          </Button>
        </>
      )}
    </GameShell>
  );
}

function Stats({ players, stats }: { players: string[]; stats: Record<string, { done: number; chicken: number }> }) {
  const has = Object.keys(stats).length > 0;
  if (!has) return null;
  return (
    <Card>
      <SectionTitle>📈 آمار</SectionTitle>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {players
          .filter((p) => stats[p])
          .map((p) => (
            <div key={p} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-1.5 text-sm">
              <span className="font-bold">{p}</span>
              <span className="text-slate-300">
                ✅ {toFa(stats[p].done)} · 🐔 {toFa(stats[p].chicken)}
              </span>
            </div>
          ))}
      </div>
    </Card>
  );
}
