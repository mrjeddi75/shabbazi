import { useEffect, useState } from "react";
import { Button, Card, GameShell, SectionTitle, Stepper } from "@/components/ui";
import { useLocalStorage } from "@/lib/hooks";
import { toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { OfflineDot } from "./common";
import { getUid, joinLink, normalizeCode, resetUid } from "./identity";
import { gameOpts, ONLINE_BY_ID, ONLINE_GAMES, roomReducer } from "./registry";
import { clearSavedRoom, useRoom } from "./room";

const ACCENT = "from-violet-500 to-fuchsia-600";

interface Session {
  role: "host" | "guest";
  code: string;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export default function OnlineHub({ onBack, joinCode }: { onBack: () => void; joinCode?: string }) {
  const [uid, setUid] = useState(getUid);
  const [name, setName] = useLocalStorage<string>("gamenight.name", "");
  const [code, setCode] = useState(normalizeCode(joinCode ?? ""));
  const [session, setSession] = useState<Session | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (joinCode) setCode(normalizeCode(joinCode));
  }, [joinCode]);

  const trimmed = name.trim();

  if (session) {
    return (
      <RoomScreen
        session={session}
        uid={uid}
        name={trimmed}
        onLeave={() => {
          if (session.role === "host") clearSavedRoom(session.code);
          setSession(null);
          if (window.location.hash.includes("join=")) window.location.hash = "/online";
        }}
      />
    );
  }

  const join = () => {
    const c = normalizeCode(code);
    if (!trimmed) return setErr("اول اسمت رو بنویس.");
    if (c.length !== 6) return setErr("کد اتاق باید ۶ حرف/عدد باشه.");
    if (c === uid) return setErr("این شناسه‌ی خودته! برای میزبانی دکمه‌ی «ساخت اتاق» رو بزن.");
    setErr("");
    setSession({ role: "guest", code: c });
  };

  return (
    <GameShell title="بازی آنلاین" emoji="🌐" accent={ACCENT} onBack={onBack}>
      <Card className="text-center">
        <div className="text-sm text-slate-400">شناسه‌ی منحصربه‌فرد تو</div>
        <button
          onClick={async () => {
            if (await copy(uid)) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }
          }}
          className="mx-auto mt-2 block rounded-2xl bg-white/10 px-6 py-3 font-mono text-4xl font-black tracking-[0.3em] hover:bg-white/15"
          dir="ltr"
        >
          {uid}
        </button>
        <div className="mt-2 text-xs text-slate-400">
          {copied ? "✅ کپی شد" : "روی شناسه بزن تا کپی بشه · این شناسه روی همین گوشی ذخیره می‌مونه"}
        </div>
        <button
          onClick={() => confirm("شناسه‌ی جدید ساخته بشه؟") && setUid(resetUid())}
          className="mt-1 text-xs text-slate-500 underline"
        >
          ساخت شناسه‌ی جدید
        </button>
      </Card>

      <Card>
        <SectionTitle>😎 اسم تو</SectionTitle>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 16))}
          placeholder="مثلاً: علی"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-violet-400"
        />
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>🏠 میزبان بشو</SectionTitle>
        <p className="text-sm leading-6 text-slate-300">اتاق با شناسه‌ی تو ساخته می‌شه. شناسه یا لینک رو برای دوستات بفرست.</p>
        <Button
          size="lg"
          className={cn("bg-gradient-to-br", ACCENT)}
          onClick={() => (trimmed ? (setErr(""), setSession({ role: "host", code: uid })) : setErr("اول اسمت رو بنویس."))}
        >
          ساخت اتاق ✨
        </Button>
      </Card>

      <Card className="flex flex-col gap-3">
        <SectionTitle>🚪 وارد اتاق دوستت شو</SectionTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            join();
          }}
          className="flex gap-2"
        >
          <input
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value))}
            placeholder="کد ۶ رقمی"
            dir="ltr"
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.3em] outline-none focus:border-violet-400"
          />
          <Button type="submit" size="lg" variant="success" disabled={code.length !== 6}>
            ورود
          </Button>
        </form>
      </Card>

      {err && <div className="rounded-2xl bg-rose-500/20 px-4 py-3 text-center text-sm text-rose-200">{err}</div>}

      <Card>
        <SectionTitle>💡 چطوری کار می‌کنه؟</SectionTitle>
        <ul className="list-inside list-disc space-y-1 text-sm leading-6 text-slate-300">
          <li>گوشی‌ها با WebRTC مستقیم به هم وصل می‌شن و سرور مخصوصی لازم نیست.</li>
          <li>میزبان باید صفحه رو تا آخر بازی باز نگه داره (صفحه‌ی گوشی خاموش نشه).</li>
          <li>اگه اینترنت کسی قطع و وصل بشه، خودکار دوباره به اتاق برمی‌گرده.</li>
          <li>بازی‌های آنلاین: {ONLINE_GAMES.map((g) => `${g.emoji} ${g.name}`).join("، ")}</li>
        </ul>
      </Card>
    </GameShell>
  );
}

/* ================================ ROOM ================================ */
function RoomScreen({ session, uid, name, onLeave }: { session: Session; uid: string; name: string; onLeave: () => void }) {
  const { status, error, state, send } = useRoom({ enabled: true, role: session.role, code: session.code, uid, name, reducer: roomReducer });
  const [copied, setCopied] = useState(false);
  const isHost = session.role === "host";
  const link = joinLink(session.code);

  const leave = () => {
    if (confirm(isHost ? "با خروج میزبان، اتاق برای همه بسته می‌شه. خارج می‌شی؟" : "از اتاق خارج می‌شی؟")) onLeave();
  };

  const share = async () => {
    const text = `بیا با هم بازی کنیم! 🎲\nکد اتاق: ${session.code}\n${link}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "شب بازی", text, url: link });
        return;
      } catch {
        /* fallthrough */
      }
    }
    if (await copy(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const def = state?.game ? ONLINE_BY_ID[state.game] : null;
  const inGame = !!(state?.g && def);
  const online = state?.members.filter((m) => m.online) ?? [];

  const statusBadge = (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-bold",
        status === "ready" ? "bg-emerald-500/20 text-emerald-300" : status === "error" || status === "kicked" ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-200 animate-pulse",
      )}
    >
      {status === "ready" ? "● متصل" : status === "connecting" ? "در حال اتصال…" : status === "reconnecting" ? "اتصال مجدد…" : "قطع"}
    </span>
  );

  return (
    <GameShell title={inGame ? def!.name : "اتاق بازی"} emoji={inGame ? def!.emoji : "🌐"} accent={inGame ? def!.accent : ACCENT} onBack={leave} right={statusBadge}>
      {(status === "error" || status === "kicked") && (
        <Card className="text-center">
          <div className="text-5xl">{status === "kicked" ? "🚫" : "😕"}</div>
          <p className="mt-3 leading-7 text-rose-200">{status === "kicked" ? "میزبان تو رو از اتاق خارج کرد." : error}</p>
          <Button className="mt-4" variant="secondary" onClick={onLeave}>بازگشت</Button>
        </Card>
      )}

      {!state && status !== "error" && status !== "kicked" && (
        <Card className="flex flex-col items-center gap-4 py-12 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-violet-400" />
          <div className="font-bold">{isHost ? "در حال ساخت اتاق…" : `در حال اتصال به اتاق ${session.code}…`}</div>
          <p className="text-sm text-slate-400">ممکنه چند ثانیه طول بکشه.</p>
        </Card>
      )}

      {state && status !== "kicked" && (
        <>
          {status === "reconnecting" && <div className="rounded-2xl bg-amber-500/20 px-4 py-2 text-center text-sm text-amber-100">⚠️ اتصال قطع شد، در حال اتصال دوباره…</div>}

          {inGame && def ? (
            <>
              <def.View g={state.g} me={uid} hostId={state.code} members={state.members} send={(a: unknown) => send({ type: "g", a })} />
              {isHost && (
                <Button variant="ghost" onClick={() => confirm("بازی تموم بشه و برگردید به لابی؟") && send({ type: "lobby" })}>
                  🏠 بازگشت همه به لابی
                </Button>
              )}
            </>
          ) : (
            <>
              <Card className="text-center">
                <div className="text-sm text-slate-400">کد اتاق</div>
                <div dir="ltr" className="font-mono text-4xl font-black tracking-[0.3em]">{state.code}</div>
                <div className="mt-3 flex justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={share}>{copied ? "✅ لینک کپی شد" : "📤 اشتراک لینک دعوت"}</Button>
                  <Button size="sm" variant="ghost" onClick={async () => { if (await copy(state.code)) { setCopied(true); setTimeout(() => setCopied(false), 1500); } }}>📋 کپی کد</Button>
                </div>
              </Card>

              <Card>
                <SectionTitle hint={`${toFa(online.length)} نفر آنلاین`}>👥 اعضای اتاق</SectionTitle>
                <div className="flex flex-col gap-1.5">
                  {state.members.map((m) => (
                    <div key={m.uid} className={cn("flex items-center gap-2 rounded-xl px-3 py-2", m.online ? "bg-white/5" : "bg-black/20 opacity-60")}>
                      <OfflineDot online={m.online} />
                      <span className="font-bold">{m.name}</span>
                      {m.uid === state.code && <span title="میزبان">👑</span>}
                      {m.uid === uid && <span className="text-xs text-violet-300">(تو)</span>}
                      <span dir="ltr" className="ms-auto font-mono text-xs text-slate-500">{m.uid}</span>
                      {isHost && m.uid !== uid && (
                        <button onClick={() => confirm(`${m.name} از اتاق خارج بشه؟`) && send({ type: "kick", uid: m.uid })} className="rounded-lg bg-white/5 px-2 py-0.5 text-xs hover:bg-rose-500/40">
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <SectionTitle>{isHost ? "🎮 انتخاب بازی" : "🎮 بازی انتخاب‌شده"}</SectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  {ONLINE_GAMES.map((g) => {
                    const active = state.game === g.id;
                    const enough = online.length >= g.min;
                    return (
                      <button
                        key={g.id}
                        disabled={!isHost}
                        onClick={() => send({ type: "select", game: g.id })}
                        className={cn(
                          "rounded-2xl border p-3 text-start transition",
                          active ? "border-violet-400 bg-violet-500/25" : "border-white/10 bg-white/5",
                          isHost && "hover:bg-white/10 active:scale-95",
                          !isHost && !active && "opacity-50",
                        )}
                      >
                        <div className="text-2xl">{g.emoji}</div>
                        <div className="font-black">{g.name}</div>
                        <div className="text-xs text-slate-400">{g.desc}</div>
                        <div className={cn("mt-1 text-xs", enough ? "text-emerald-300" : "text-amber-300")}>
                          👥 {g.min === g.max ? toFa(g.min) : `${toFa(g.min)} تا ${toFa(g.max)}`} نفر
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              {def && isHost && def.options && (
                <Card className="flex flex-col gap-2">
                  {def.options.map((o) => (
                    <Stepper
                      key={o.key}
                      label={o.label}
                      value={gameOpts(def, state.opts)[o.key]}
                      min={o.min}
                      max={o.max}
                      step={o.step}
                      suffix={o.suffix}
                      onChange={(v) => send({ type: "opts", opts: { [`${def.id}.${o.key}`]: v } })}
                    />
                  ))}
                </Card>
              )}

              {def?.id === "mafia" && <p className="text-center text-xs text-slate-400">در مافیای آنلاین، میزبان گرداننده‌ست و نقش نمی‌گیره.</p>}

              {isHost ? (
                <>
                  <Button size="xl" full className={cn("bg-gradient-to-br", def?.accent ?? ACCENT)} disabled={!def || online.length < def.min} onClick={() => send({ type: "start" })}>
                    {!def ? "یک بازی انتخاب کن" : online.length < def.min ? `حداقل ${toFa(def.min)} نفر لازمه` : `شروع ${def.name} 🚀`}
                  </Button>
                  {def && online.length > def.max && (
                    <p className="text-center text-xs text-amber-300">فقط {toFa(def.max)} نفر اول بازی می‌کنن و بقیه تماشاگرن.</p>
                  )}
                </>
              ) : (
                <Card className="text-center text-slate-300">⏳ منتظر میزبان برای شروع بازی…</Card>
              )}
            </>
          )}
        </>
      )}
    </GameShell>
  );
}
