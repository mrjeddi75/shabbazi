import { useEffect, useState } from "react";
import { Button, Card, GameShell, SectionTitle, Stepper, Toggle } from "@/components/ui";
import { useLocalStorage } from "@/lib/hooks";
import { toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";
import { OfflineDot } from "./common";
import { getUid, joinLink, normalizeCode, resetUid } from "./identity";
import { gameOpts, ONLINE_BY_ID, ONLINE_GAMES, roomReducer } from "./registry";
import { BROKERS } from "./relay";
import { clearSavedRoom, useRoom, useRoomList, type RoomStatus } from "./room";
import type { RoomInfo } from "./types";

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

function RelayBadge({ relays }: { relays: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
        relays > 0 ? "bg-emerald-500/20 text-emerald-300" : "animate-pulse bg-amber-500/20 text-amber-200",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", relays > 0 ? "bg-emerald-400" : "bg-amber-300")} />
      {relays > 0 ? `متصل (${toFa(relays)}/${toFa(BROKERS.length)})` : "در حال اتصال…"}
    </span>
  );
}

export default function OnlineHub({ onBack, joinCode }: { onBack: () => void; joinCode?: string }) {
  const [uid, setUid] = useState(getUid);
  const [name, setName] = useLocalStorage<string>("gamenight.name", "");
  const [pub, setPub] = useLocalStorage<boolean>("gamenight.publicRoom", true);
  const [code, setCode] = useState(normalizeCode(joinCode ?? ""));
  const [session, setSession] = useState<Session | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const { rooms, relays, ready } = useRoomList(!session, uid);

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
        pub={pub}
        setPub={setPub}
        onLeave={() => {
          if (session.role === "host") clearSavedRoom(session.code);
          setSession(null);
          if (window.location.hash.includes("join=")) window.location.hash = "/online";
        }}
      />
    );
  }

  const joinCodeNow = (raw: string) => {
    const c = normalizeCode(raw);
    if (!trimmed) {
      setErr("اول اسمت رو بنویس 👆");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (c.length !== 6) return setErr("کد اتاق باید ۶ حرف/عدد باشه.");
    if (c === uid) return setErr("این شناسه‌ی خودته! برای میزبانی دکمه‌ی «ساخت اتاق» رو بزن.");
    setErr("");
    setSession({ role: "guest", code: c });
  };

  return (
    <GameShell title="بازی آنلاین" emoji="🌐" accent={ACCENT} onBack={onBack} right={<RelayBadge relays={relays} />}>
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1 text-xs text-slate-400">😎 اسم تو</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              placeholder="مثلاً: علی"
              className={cn(
                "w-full rounded-2xl border bg-white/5 px-4 py-2.5 text-lg outline-none focus:border-violet-400",
                err && !trimmed ? "border-rose-400" : "border-white/10",
              )}
            />
          </div>
          <div className="text-center">
            <div className="mb-1 text-xs text-slate-400">شناسه‌ی تو</div>
            <button
              onClick={async () => {
                if (await copy(uid)) {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }
              }}
              onDoubleClick={() => confirm("شناسه‌ی جدید ساخته بشه؟") && setUid(resetUid())}
              title="کپی (دابل‌کلیک برای شناسه‌ی جدید)"
              dir="ltr"
              className="rounded-2xl bg-white/10 px-3 py-2.5 font-mono text-lg font-black tracking-widest hover:bg-white/15"
            >
              {copied ? "✅" : uid}
            </button>
          </div>
        </div>
      </Card>

      {/* ---------------- active rooms ---------------- */}
      <Card>
        <SectionTitle hint={relays > 0 ? "به‌روزرسانی زنده" : undefined}>🟢 اتاق‌های فعال ({toFa(rooms.length)})</SectionTitle>
        {relays === 0 ? (
          <div className="flex items-center justify-center gap-3 py-6 text-sm text-slate-400">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
            در حال اتصال به سرورها…
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">
            {ready ? (
              <>
                <div className="mb-2 text-3xl">🏜️</div>
                فعلاً اتاق عمومی فعالی نیست. خودت یکی بساز!
              </>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/10 border-t-violet-400" />
                در حال جستجوی اتاق‌ها…
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rooms.map((r) => (
              <RoomRow key={r.code} r={r} onJoin={() => joinCodeNow(r.code)} />
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card className="flex flex-col gap-3">
          <SectionTitle>🏠 ساخت اتاق</SectionTitle>
          <Toggle label="اتاق عمومی" hint={pub ? "در لیست اتاق‌های فعال دیده می‌شه" : "فقط با کد یا لینک"} checked={pub} onChange={setPub} />
          <Button
            size="lg"
            className={cn("bg-gradient-to-br", ACCENT)}
            onClick={() => {
              if (!trimmed) {
                setErr("اول اسمت رو بنویس 👆");
                window.scrollTo({ top: 0, behavior: "smooth" });
                return;
              }
              setErr("");
              setSession({ role: "host", code: uid });
            }}
          >
            ساخت اتاق ✨
          </Button>
        </Card>

        <Card className="flex flex-col gap-3">
          <SectionTitle>🔑 ورود با کد</SectionTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinCodeNow(code);
            }}
            className="flex flex-col gap-2"
          >
            <input
              value={code}
              onChange={(e) => setCode(normalizeCode(e.target.value))}
              placeholder="کد ۶ رقمی"
              dir="ltr"
              autoCapitalize="characters"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-center font-mono text-2xl font-black tracking-[0.3em] outline-none focus:border-violet-400"
            />
            <Button type="submit" size="lg" variant="success" disabled={code.length !== 6}>
              ورود 🚪
            </Button>
          </form>
        </Card>
      </div>

      {err && <div className="rounded-2xl bg-rose-500/20 px-4 py-3 text-center text-sm text-rose-200">{err}</div>}

      <Card>
        <SectionTitle>💡 راهنما</SectionTitle>
        <ul className="list-inside list-disc space-y-1 text-sm leading-6 text-slate-300">
          <li>یک نفر «ساخت اتاق» رو بزنه؛ بقیه اتاقش رو توی لیست بالا می‌بینن و «عضویت» رو می‌زنن.</li>
          <li>ارتباط از طریق چند سرور عمومی برقرار می‌شه؛ اگه یکی فیلتر باشه، بقیه کار می‌کنن.</li>
          <li>میزبان باید صفحه رو باز نگه داره. اگه قطع و وصل بشی، خودکار برمی‌گردی به اتاق.</li>
          <li>بازی‌ها: {ONLINE_GAMES.map((g) => `${g.emoji} ${g.name}`).join("، ")}</li>
        </ul>
      </Card>
    </GameShell>
  );
}

function RoomRow({ r, onJoin }: { r: RoomInfo; onJoin: () => void }) {
  const def = r.game ? ONLINE_BY_ID[r.game] : null;
  const full = def ? r.count >= def.max && r.playing : false;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 animate-fade-up">
      <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-2xl", def?.accent ?? "from-slate-600 to-slate-700")}>
        {def?.emoji ?? "🎲"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-black">اتاق {r.host || "بی‌نام"}</span>
          <span dir="ltr" className="font-mono text-[10px] text-slate-500">{r.code}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {toFa(r.count)} نفر آنلاین
          </span>
          <span>{def ? def.name : "در حال انتخاب بازی"}</span>
          <span className={r.playing ? "text-amber-300" : "text-emerald-300"}>{r.playing ? "▶ در حال بازی" : "⏳ در لابی"}</span>
        </div>
      </div>
      <Button size="sm" variant={r.playing ? "secondary" : "success"} onClick={onJoin} className="shrink-0">
        {r.playing ? (full ? "👀 تماشا" : "ورود") : "عضویت"}
      </Button>
    </div>
  );
}

/* ================================ ROOM ================================ */
const STATUS_TEXT: Record<RoomStatus, string> = {
  connecting: "در حال اتصال…",
  ready: "● متصل",
  reconnecting: "اتصال مجدد…",
  notfound: "اتاق پیدا نشد",
  hostaway: "میزبان آفلاین",
  kicked: "اخراج شدی",
  closed: "اتاق بسته شد",
};

function RoomScreen({
  session,
  uid,
  name,
  pub,
  setPub,
  onLeave,
}: {
  session: Session;
  uid: string;
  name: string;
  pub: boolean;
  setPub: (v: boolean) => void;
  onLeave: () => void;
}) {
  const { status, relays, state, send, retry } = useRoom({ role: session.role, code: session.code, uid, name, pub, reducer: roomReducer });
  const [copied, setCopied] = useState(false);
  const isHost = session.role === "host";
  const link = joinLink(session.code);

  const leave = () => {
    if (status === "kicked" || status === "closed" || status === "notfound") return onLeave();
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
  const fatal = status === "kicked" || status === "closed";

  const statusBadge = (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-bold",
        status === "ready"
          ? "bg-emerald-500/20 text-emerald-300"
          : fatal || status === "notfound"
            ? "bg-rose-500/20 text-rose-300"
            : "animate-pulse bg-amber-500/20 text-amber-200",
      )}
    >
      {STATUS_TEXT[status]}
    </span>
  );

  return (
    <GameShell title={inGame ? def!.name : "اتاق بازی"} emoji={inGame ? def!.emoji : "🌐"} accent={inGame ? def!.accent : ACCENT} onBack={leave} right={statusBadge}>
      {fatal && (
        <Card className="text-center">
          <div className="text-5xl">{status === "kicked" ? "🚫" : "🚪"}</div>
          <p className="mt-3 leading-7 text-rose-200">{status === "kicked" ? "میزبان تو رو از اتاق خارج کرد." : "میزبان اتاق رو بست."}</p>
          <Button className="mt-4" variant="secondary" onClick={onLeave}>
            بازگشت به لیست اتاق‌ها
          </Button>
        </Card>
      )}

      {!fatal && !state && (
        <Card className="flex flex-col items-center gap-4 py-10 text-center">
          {status === "notfound" ? (
            <>
              <div className="text-5xl">🔍</div>
              <div className="font-bold">اتاق {session.code} پیدا نشد</div>
              <p className="text-sm leading-6 text-slate-400">کد رو چک کن و مطمئن شو میزبان صفحه‌ی اتاق رو باز نگه داشته. همچنان در حال تلاشیم…</p>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={retry}>🔄 تلاش دوباره</Button>
                <Button variant="ghost" onClick={onLeave}>بازگشت</Button>
              </div>
            </>
          ) : (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/10 border-t-violet-400" />
              <div className="font-bold">{isHost ? "در حال ساخت اتاق…" : `در حال اتصال به اتاق ${session.code}…`}</div>
              <RelayBadge relays={relays} />
            </>
          )}
        </Card>
      )}

      {state && !fatal && (
        <>
          {status === "reconnecting" && <div className="rounded-2xl bg-amber-500/20 px-4 py-2 text-center text-sm text-amber-100">⚠️ اینترنت قطع شد، در حال اتصال دوباره…</div>}
          {status === "hostaway" && <div className="rounded-2xl bg-amber-500/20 px-4 py-2 text-center text-sm text-amber-100">⏳ میزبان فعلاً آفلاینه؛ به محض برگشتنش بازی ادامه پیدا می‌کنه.</div>}

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
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="secondary" onClick={share}>{copied ? "✅ لینک کپی شد" : "📤 اشتراک لینک دعوت"}</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (await copy(state.code)) {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                      }
                    }}
                  >
                    📋 کپی کد
                  </Button>
                </div>
                {isHost && (
                  <div className="mt-3">
                    <Toggle label="نمایش در لیست اتاق‌های فعال" hint={pub ? "همه می‌تونن اتاقت رو ببینن و عضو بشن" : "فقط با کد یا لینک"} checked={pub} onChange={setPub} />
                  </div>
                )}
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
                        <button
                          onClick={() => confirm(`${m.name} از اتاق خارج بشه؟`) && send({ type: "kick", uid: m.uid })}
                          className="rounded-lg bg-white/5 px-2 py-0.5 text-xs hover:bg-rose-500/40"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {online.length < 2 && <p className="mt-3 text-center text-xs text-slate-400">منتظر بقیه… لینک دعوت رو بفرست یا بگو از لیست اتاق‌ها عضو بشن.</p>}
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
                  <Button
                    size="xl"
                    full
                    className={cn("bg-gradient-to-br", def?.accent ?? ACCENT)}
                    disabled={!def || online.length < def.min}
                    onClick={() => send({ type: "start" })}
                  >
                    {!def ? "یک بازی انتخاب کن" : online.length < def.min ? `حداقل ${toFa(def.min)} نفر لازمه` : `شروع ${def.name} 🚀`}
                  </Button>
                  {def && online.length > def.max && <p className="text-center text-xs text-amber-300">فقط {toFa(def.max)} نفر اول بازی می‌کنن و بقیه تماشاگرن.</p>}
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
