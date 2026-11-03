import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { formatTime, toFa } from "@/lib/utils";

/* ---------------- Button ---------------- */
type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
type Size = "sm" | "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-indigo-900/40 hover:brightness-110",
  secondary: "bg-white/10 text-white border border-white/10 hover:bg-white/15",
  ghost: "bg-transparent text-slate-300 hover:bg-white/10",
  danger: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-rose-900/40 hover:brightness-110",
  success: "bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-900/40 hover:brightness-110",
  warning: "bg-gradient-to-br from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-orange-900/40 hover:brightness-110",
};
const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-sm rounded-xl",
  md: "px-4 py-2.5 text-base rounded-2xl",
  lg: "px-6 py-3.5 text-lg rounded-2xl",
  xl: "px-8 py-5 text-xl rounded-3xl",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
}
export function Button({ variant = "primary", size = "md", full, className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition active:scale-95 disabled:opacity-40 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        full && "w-full",
        className,
      )}
      {...rest}
    />
  );
}

/* ---------------- Card ---------------- */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-5", className)}>{children}</div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h3 className="text-base font-bold text-slate-200">{children}</h3>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
  );
}

/* ---------------- Stepper ---------------- */
interface StepperProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  hint?: string;
}
export function Stepper({ label, value, onChange, min = 0, max = 99, step = 1, suffix, hint }: StepperProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3">
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          disabled={value >= max}
          aria-label="افزایش"
          className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 disabled:opacity-30 active:scale-95"
        >
          +
        </button>
        <div className="min-w-14 text-center text-lg font-black tabular-nums">
          {toFa(value)}
          {suffix && <span className="text-xs font-normal text-slate-400"> {suffix}</span>}
        </div>
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          disabled={value <= min}
          aria-label="کاهش"
          className="h-10 w-10 rounded-xl bg-white/10 text-xl font-bold hover:bg-white/20 disabled:opacity-30 active:scale-95"
        >
          −
        </button>
      </div>
    </div>
  );
}

/* ---------------- Toggle ---------------- */
export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-2xl bg-white/5 px-4 py-3 text-start"
    >
      <div>
        <div className="font-semibold">{label}</div>
        {hint && <div className="text-xs text-slate-400">{hint}</div>}
      </div>
      <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-emerald-500" : "bg-white/15")}>
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "end-1" : "start-1",
          )}
        />
      </span>
    </button>
  );
}

/* ---------------- Chip select ---------------- */
export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm font-semibold transition active:scale-95",
        active ? "border-violet-400 bg-violet-500/30 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

/* ---------------- Game shell ---------------- */
interface ShellProps {
  title: string;
  emoji: string;
  accent: string; // tailwind gradient classes
  onBack: () => void;
  children: ReactNode;
  right?: ReactNode;
}
export function GameShell({ title, emoji, accent, onBack, children, right }: ShellProps) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-4 pb-10 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <button
          onClick={onBack}
          aria-label="بازگشت"
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-xl hover:bg-white/20 active:scale-95"
        >
          →
        </button>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl shadow-lg", accent)}>
          {emoji}
        </div>
        <h1 className="flex-1 text-xl font-black">{title}</h1>
        {right}
      </header>
      <main className="flex flex-1 flex-col gap-4 animate-fade-up">{children}</main>
    </div>
  );
}

/* ---------------- Pass the phone ---------------- */
interface PassPhoneProps {
  playerName: string;
  index: number;
  total: number;
  accent: string;
  revealLabel?: string;
  nextLabel?: string;
  onNext: () => void;
  children: ReactNode; // secret content
}
export function PassPhone({ playerName, index, total, accent, revealLabel = "نمایش نقش من", nextLabel = "فهمیدم، نفر بعدی", onNext, children }: PassPhoneProps) {
  const [shown, setShown] = useState(false);
  return (
    <Card className="flex flex-1 flex-col items-center justify-center gap-6 text-center no-select">
      <div className="text-xs font-semibold tracking-wide text-slate-400">
        بازیکن {toFa(index + 1)} از {toFa(total)}
      </div>
      {!shown ? (
        <>
          <div className="text-slate-300">گوشی رو بده به</div>
          <div className="text-4xl font-black">{playerName}</div>
          <div className="text-sm text-slate-400">بقیه نگاه نکنن! 🙈</div>
          <Button size="xl" className={cn("mt-4 bg-gradient-to-br", accent)} onClick={() => setShown(true)}>
            {revealLabel}
          </Button>
        </>
      ) : (
        <>
          <div className="w-full animate-pop">{children}</div>
          <Button
            size="lg"
            variant="secondary"
            full
            onClick={() => {
              setShown(false);
              onNext();
            }}
          >
            {nextLabel}
          </Button>
        </>
      )}
    </Card>
  );
}

/* ---------------- Players editor ---------------- */
interface PlayersEditorProps {
  players: string[];
  onChange: (p: string[]) => void;
  min?: number;
  max?: number;
}
export function PlayersEditor({ players, onChange, min = 2, max = 20 }: PlayersEditorProps) {
  const [name, setName] = useState("");
  const add = () => {
    const n = name.trim();
    if (!n || players.includes(n) || players.length >= max) return;
    onChange([...players, n]);
    setName("");
  };
  return (
    <div>
      <SectionTitle hint={`حداقل ${toFa(min)} نفر`}>👥 بازیکن‌ها ({toFa(players.length)})</SectionTitle>
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <span key={p} className="flex items-center gap-1 rounded-full bg-white/10 py-1.5 pe-2 ps-3 text-sm font-semibold">
            {p}
            <button
              onClick={() => onChange(players.filter((x) => x !== p))}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-xs hover:bg-rose-500"
              aria-label={`حذف ${p}`}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="اسم بازیکن جدید…"
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 outline-none placeholder:text-slate-500 focus:border-violet-400"
        />
        <Button type="submit" variant="secondary" disabled={!name.trim()}>
          افزودن
        </Button>
      </form>
    </div>
  );
}

/* ---------------- Timer bar ---------------- */
export function TimerBar({ seconds, total, danger = 10, className }: { seconds: number; total: number; danger?: number; className?: string }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0;
  const isDanger = seconds <= danger;
  return (
    <div className={cn("w-full", className)}>
      <div className={cn("text-center text-6xl font-black tabular-nums tracking-tight", isDanger ? "text-rose-400 animate-pulse" : "text-white")}>
        {formatTime(seconds)}
      </div>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-1000 ease-linear", isDanger ? "bg-rose-500" : "bg-gradient-to-l from-emerald-400 to-cyan-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ---------------- Result banner ---------------- */
export function Banner({ emoji, title, subtitle, className }: { emoji: string; title: string; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl p-6 text-center animate-pop", className)}>
      <div className="text-6xl animate-float">{emoji}</div>
      <div className="mt-3 text-2xl font-black">{title}</div>
      {subtitle && <div className="mt-2 text-slate-200">{subtitle}</div>}
    </div>
  );
}
