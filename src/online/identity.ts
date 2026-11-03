const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون 0/O و 1/I برای خوانایی
export const PEER_PREFIX = "shabbazi-v1-";

export function randomCode(len = 6): string {
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => ALPH[n % ALPH.length]).join("");
}

export function getUid(): string {
  try {
    let id = localStorage.getItem("gamenight.uid");
    if (!id || !/^[A-Z0-9]{6}$/.test(id)) {
      id = randomCode(6);
      localStorage.setItem("gamenight.uid", id);
    }
    return id;
  } catch {
    return randomCode(6);
  }
}

export function resetUid(): string {
  const id = randomCode(6);
  try {
    localStorage.setItem("gamenight.uid", id);
  } catch {
    /* ignore */
  }
  return id;
}

export function normalizeCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

export function joinLink(code: string): string {
  const base = window.location.href.split("#")[0];
  return `${base}#/online?join=${code}`;
}
