import { useEffect, useState, type ComponentType } from "react";
import { Card, PlayersEditor } from "@/components/ui";
import Bomb from "@/games/Bomb";
import Charades from "@/games/Charades";
import EsmFamil from "@/games/EsmFamil";
import Mafia from "@/games/Mafia";
import Spyfall from "@/games/Spyfall";
import TruthOrDare from "@/games/TruthOrDare";
import WouldYouRather from "@/games/WouldYouRather";
import { usePlayers } from "@/lib/hooks";
import { primeAudio, toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";

interface GameMeta {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  players: string;
  time: string;
  accent: string;
  component: ComponentType<{ onBack: () => void }>;
  tag?: string;
}

const GAMES: GameMeta[] = [
  { id: "spy", name: "جاسوس", emoji: "🕵️", desc: "همه مکان رو می‌دونن جز جاسوس. با سؤال‌های زیرکانه پیداش کنید!", players: "۳ تا ۱۲", time: "۸ دقیقه", accent: "from-emerald-400 to-teal-600", component: Spyfall, tag: "محبوب" },
  { id: "mafia", name: "مافیا", emoji: "🔫", desc: "پخش نقش‌ها گوشی‌به‌گوشی + پنل گرداننده برای شب و روز.", players: "۴ تا ۲۰", time: "۳۰+ دقیقه", accent: "from-rose-500 to-red-800", component: Mafia, tag: "کلاسیک" },
  { id: "charades", name: "پانتومیم", emoji: "🎭", desc: "تیمی! فیلم، ضرب‌المثل، حیوان… بدون حرف زدن اجرا کن.", players: "۴+", time: "۱۵ دقیقه", accent: "from-amber-400 to-orange-600", component: Charades },
  { id: "esmfamil", name: "اسم فامیل", emoji: "✍️", desc: "گردونه‌ی حروف، تایمر و جدول امتیاز؛ فقط کاغذ و خودکار بیارید.", players: "۲ تا ۱۰", time: "۲۰ دقیقه", accent: "from-sky-400 to-indigo-600", component: EsmFamil, tag: "نوستالژی" },
  { id: "tod", name: "جرأت یا حقیقت", emoji: "🍾", desc: "بطری بچرخون! کارت‌های حقیقت و جرأت بامزه.", players: "۲ تا ۱۲", time: "آزاد", accent: "from-fuchsia-500 to-purple-700", component: TruthOrDare },
  { id: "wyr", name: "کدوم رو ترجیح می‌دی؟", emoji: "⚖️", desc: "دو گزینه‌ی سخت، رأی بدید و نتیجه رو ببینید.", players: "۲+", time: "آزاد", accent: "from-cyan-400 to-blue-600", component: WouldYouRather },
  { id: "bomb", name: "بمب کلمات", emoji: "💣", desc: "یه کلمه بگو و گوشی رو رد کن، قبل از اینکه بترکه!", players: "۲ تا ۱۰", time: "۱۰ دقیقه", accent: "from-orange-500 to-red-600", component: Bomb, tag: "هیجانی" },
];

function useHashRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, "");
  const [route, setRoute] = useState<string>(read);
  useEffect(() => {
    const onHash = () => {
      setRoute(read());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (r: string) => {
    window.location.hash = r ? `/${r}` : "";
  };
  return [route, navigate] as const;
}

export default function App() {
  const [route, navigate] = useHashRoute();
  useEffect(() => {
    const unlock = () => primeAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const game = GAMES.find((g) => g.id === route);
  if (game) {
    const G = game.component;
    return <G key={game.id} onBack={() => navigate("")} />;
  }
  return <Home onOpen={(id) => navigate(id)} />;
}

function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [players, setPlayers] = usePlayers();
  const [showPlayers, setShowPlayers] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10">
      <header className="mb-8 text-center animate-fade-up">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-violet-500 via-fuchsia-500 to-orange-400 text-5xl shadow-2xl shadow-fuchsia-900/40 animate-float">
          🎲
        </div>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">شب بازی</h1>
        <p className="mx-auto mt-3 max-w-md leading-7 text-slate-300">
          مجموعه بازی‌های گروهی دورهمی با یک گوشی. بدون سرور، بدون نصب، بدون اینترنت — فقط باز کن و بازی کن!
        </p>
      </header>

      <Card className="mb-6 animate-fade-up">
        <button onClick={() => setShowPlayers((s) => !s)} className="flex w-full items-center justify-between text-start">
          <div>
            <div className="font-bold">👥 بازیکن‌های امشب ({toFa(players.length)} نفر)</div>
            <div className="mt-0.5 text-xs text-slate-400">{players.join("، ") || "هنوز کسی اضافه نشده"}</div>
          </div>
          <span className={cn("text-xl transition", showPlayers && "rotate-180")}>⌄</span>
        </button>
        {showPlayers && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <PlayersEditor players={players} onChange={setPlayers} />
            <p className="mt-3 text-xs text-slate-400">این لیست برای همه‌ی بازی‌ها استفاده می‌شه و روی همین دستگاه ذخیره می‌مونه.</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {GAMES.map((g, i) => (
          <button
            key={g.id}
            onClick={() => onOpen(g.id)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-5 text-start transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/10 active:scale-[0.98] animate-fade-up"
          >
            <div className={cn("absolute -left-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition group-hover:opacity-40", g.accent)} />
            <div className="relative flex items-start gap-4">
              <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl shadow-lg", g.accent)}>{g.emoji}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black">{g.name}</h2>
                  {g.tag && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-slate-300">{g.tag}</span>}
                </div>
                <p className="mt-1 text-sm leading-6 text-slate-300">{g.desc}</p>
                <div className="mt-3 flex gap-3 text-xs text-slate-400">
                  <span>👥 {g.players}</span>
                  <span>⏱️ {g.time}</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <footer className="mt-12 text-center text-xs leading-6 text-slate-500">
        <p>ساخته‌شده با React + Vite + Tailwind · یک فایل HTML مستقل، آماده‌ی انتشار روی GitHub Pages</p>
        <p>برای بهترین تجربه، صدای گوشی رو روشن کنید 🔊</p>
      </footer>
    </div>
  );
}
