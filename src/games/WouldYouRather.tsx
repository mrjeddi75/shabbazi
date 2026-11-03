import { useMemo, useState } from "react";
import { Button, Card, GameShell } from "@/components/ui";
import { WYR } from "@/data/party";
import { beep, shuffle, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

const ACCENT = "from-cyan-400 to-blue-600";

export default function WouldYouRather({ onBack }: { onBack: () => void }) {
  const order = useMemo(() => shuffle(WYR.map((_, i) => i)), []);
  const [idx, setIdx] = useState(0);
  const [votes, setVotes] = useState<[number, number]>([0, 0]);
  const [revealed, setRevealed] = useState(false);
  const [history, setHistory] = useState<{ q: [string, string]; votes: [number, number] }[]>([]);

  const q = WYR[order[idx % order.length]];
  const total = votes[0] + votes[1];
  const pct = (i: 0 | 1) => (total === 0 ? 50 : Math.round((votes[i] / total) * 100));

  const vote = (i: 0 | 1) => {
    if (revealed) return;
    beep(i === 0 ? 700 : 900, 0.07, "sine", 0.12);
    setVotes((v) => (i === 0 ? [v[0] + 1, v[1]] : [v[0], v[1] + 1]));
  };

  const next = () => {
    if (total > 0) setHistory((h) => [{ q, votes }, ...h].slice(0, 5));
    setIdx((i) => i + 1);
    setVotes([0, 0]);
    setRevealed(false);
  };

  return (
    <GameShell title="کدوم رو ترجیح می‌دی؟" emoji="⚖️" accent={ACCENT} onBack={onBack}>
      <Card className="text-center">
        <div className="text-xs text-slate-400">
          سؤال {toFa(idx + 1)} · هر نفر یک بار روی گزینه‌اش بزنه، بعد نتیجه رو ببینید و بحث کنید!
        </div>
      </Card>

      <div className="flex flex-1 flex-col gap-3">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            onClick={() => vote(i)}
            className={cn(
              "relative flex min-h-36 flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border p-6 text-center text-2xl font-black leading-relaxed transition active:scale-[0.98]",
              i === 0 ? "border-cyan-400/40 bg-cyan-500/15" : "border-fuchsia-400/40 bg-fuchsia-500/15",
              revealed && "cursor-default",
            )}
          >
            {revealed && (
              <div
                className={cn("absolute inset-y-0 right-0 transition-all duration-700", i === 0 ? "bg-cyan-500/30" : "bg-fuchsia-500/30")}
                style={{ width: `${pct(i)}%` }}
              />
            )}
            <span className="relative z-10">{q[i]}</span>
            <span className="relative z-10 mt-3 rounded-full bg-black/30 px-3 py-1 text-sm font-bold tabular-nums">
              {revealed ? `${toFa(pct(i))}٪ (${toFa(votes[i])} رأی)` : `${toFa(votes[i])} رأی`}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {!revealed ? (
          <Button size="lg" variant="warning" onClick={() => setRevealed(true)} disabled={total === 0}>
            📊 نمایش نتیجه
          </Button>
        ) : (
          <Button size="lg" variant="secondary" onClick={() => setVotes([0, 0])}>
            🔄 رأی‌گیری دوباره
          </Button>
        )}
        <Button size="lg" className={cn("bg-gradient-to-br", ACCENT)} onClick={next}>
          سؤال بعدی ⏭
        </Button>
      </div>

      {history.length > 0 && (
        <Card>
          <div className="mb-2 text-xs text-slate-400">سؤال‌های قبلی</div>
          <div className="flex flex-col gap-1.5 text-sm">
            {history.map((h, i) => {
              const t = h.votes[0] + h.votes[1];
              const win = h.votes[0] >= h.votes[1] ? 0 : 1;
              return (
                <div key={i} className="rounded-xl bg-white/5 px-3 py-2">
                  <span className="font-bold">{h.q[win]}</span>
                  <span className="text-slate-400"> — {toFa(Math.round((h.votes[win] / t) * 100))}٪</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </GameShell>
  );
}
