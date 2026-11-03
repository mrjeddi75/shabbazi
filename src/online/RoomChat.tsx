import { useEffect, useRef, useState, type FormEvent } from "react";
import { toFa } from "@/lib/utils";
import { cn } from "@/utils/cn";
import type { ChatMessage, RoomAction } from "./types";

interface Props {
  messages: ChatMessage[];
  uid: string;
  connected: boolean;
  send: (a: RoomAction) => void;
}

export default function RoomChat({ messages, uid, connected, send }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const lastId = useRef<string | undefined>(messages.at(-1)?.id);
  const lastSent = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const latest = messages.at(-1)?.id;
    if (latest === lastId.current) return;
    const index = messages.findIndex((m) => m.id === lastId.current);
    const newMessages = lastId.current && index >= 0 ? messages.slice(index + 1) : [];
    if (!open) setUnread((n) => Math.min(99, n + newMessages.filter((m) => m.uid !== uid).length));
    lastId.current = latest;
  }, [messages, open, uid]);

  useEffect(() => {
    if (!open) return;
    setUnread(0);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [open, messages]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    if (Date.now() - lastSent.current < 800) return;
    lastSent.current = Date.now();
    send({ type: "chat", id: crypto.randomUUID(), text });
    setDraft("");
    inputRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread ? `باز کردن چت، ${toFa(unread)} پیام جدید` : "باز کردن چت اتاق"}
        aria-expanded={open}
        className={cn(
          "fixed end-4 z-40 flex h-14 items-center gap-2 rounded-2xl border border-violet-300/30 bg-violet-600 px-4 text-sm font-bold text-white shadow-xl shadow-black/50 transition active:scale-95 sm:end-6",
          "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
          open && "hidden",
        )}
      >
        <span aria-hidden="true" className="text-xl">💬</span>
        چت اتاق
        {unread > 0 && <span className="flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs" aria-live="polite">{toFa(unread)}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label="چت اتاق"
            className="flex h-[min(78dvh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-white/15 bg-slate-900 shadow-2xl sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <div>
                <h2 className="font-black">💬 چت اتاق</h2>
                <p className="text-xs text-slate-400">{toFa(messages.length)} پیام اخیر · همه‌ی اعضای اتاق می‌بینن</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن چت" className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-xl active:scale-95">×</button>
            </div>

            <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4" role="log" aria-live="polite" aria-relevant="additions text">
              {messages.length === 0 && <p className="m-auto text-center text-sm text-slate-400">هنوز پیامی نیست. اولین پیام رو بفرست!</p>}
              {messages.map((m) => {
                const mine = m.uid === uid;
                return (
                  <div key={m.id} className={cn("flex w-full flex-col", mine ? "items-start" : "items-end")}>
                    <span className="mb-1 max-w-[85%] truncate px-1 text-xs text-slate-400">
                      {mine ? "تو" : m.name}
                      <time className="ms-2" dateTime={new Date(m.at).toISOString()}>{new Date(m.at).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}</time>
                    </span>
                    <div className={cn("max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-6", mine ? "rounded-tr-sm bg-violet-600 text-white" : "rounded-tl-sm bg-white/10 text-slate-100")}>{m.text}</div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-white/10 bg-slate-900 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-4 sm:pb-3">
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, 280))}
                placeholder={connected ? "پیامت رو بنویس…" : "منتظر اتصال…"}
                aria-label="متن پیام"
                maxLength={280}
                disabled={!connected}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base outline-none placeholder:text-slate-500 focus:border-violet-400 disabled:opacity-50"
              />
              <button type="submit" disabled={!connected || !draft.trim()} className="h-12 shrink-0 rounded-2xl bg-violet-600 px-5 font-bold text-white transition active:scale-95 disabled:opacity-40">ارسال</button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}