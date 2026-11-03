export type Team = "mafia" | "city" | "neutral";

export interface RoleDef {
  id: string;
  name: string;
  team: Team;
  emoji: string;
  desc: string;
  unique?: boolean;
}

export const TEAM_LABEL: Record<Team, string> = { mafia: "مافیا", city: "شهروند", neutral: "مستقل" };

export const MAFIA_ROLES: RoleDef[] = [
  { id: "godfather", name: "رئیس مافیا", team: "mafia", emoji: "🎩", desc: "رهبر تیم مافیا هستی. استعلام کارآگاه روی تو «منفی» است و حرف آخر شب را تو می‌زنی.", unique: true },
  { id: "mafia", name: "مافیای ساده", team: "mafia", emoji: "🔫", desc: "شب‌ها با هم‌تیمی‌هایت یک نفر را حذف می‌کنی. روزها خودت را شهروند جا بزن!" },
  { id: "lecter", name: "دکتر لکتر", team: "mafia", emoji: "💉", desc: "هر شب یکی از اعضای مافیا را نجات می‌دهی (خودت را فقط یک بار).", unique: true },
  { id: "natasha", name: "ناتاشا", team: "mafia", emoji: "💋", desc: "هر شب یک نفر را انتخاب می‌کنی تا فردا حق صحبت نداشته باشد.", unique: true },
  { id: "citizen", name: "شهروند ساده", team: "city", emoji: "🧑", desc: "توانایی خاصی نداری، اما با دقت و استدلال باید مافیا را پیدا کنی." },
  { id: "doctor", name: "دکتر", team: "city", emoji: "🩺", desc: "هر شب یک نفر را از حمله مافیا نجات می‌دهی (خودت را فقط یک بار).", unique: true },
  { id: "detective", name: "کارآگاه", team: "city", emoji: "🔍", desc: "هر شب درباره یک نفر از گرداننده می‌پرسی: مافیا هست یا نه؟", unique: true },
  { id: "sniper", name: "تک‌تیرانداز", team: "city", emoji: "🎯", desc: "دو تیر داری. اگر به شهروند شلیک کنی، خودت از بازی حذف می‌شوی!", unique: true },
  { id: "bulletproof", name: "زره‌پوش", team: "city", emoji: "🛡️", desc: "اولین حمله مافیا روی تو بی‌اثر است.", unique: true },
  { id: "mayor", name: "کدخدا", team: "city", emoji: "🏛️", desc: "یک بار در طول بازی می‌توانی رأی‌گیری روز را باطل کنی.", unique: true },
  { id: "psychologist", name: "روانشناس", team: "city", emoji: "🧠", desc: "هر شب یک نفر را انتخاب می‌کنی که روز بعد اجازه صحبت نداشته باشد.", unique: true },
  { id: "joker", name: "جوکر", team: "neutral", emoji: "🃏", desc: "تنها بازی می‌کنی! اگر روز با رأی‌گیری حذف شوی، برنده‌ای.", unique: true },
  { id: "killer", name: "قاتل زنجیره‌ای", team: "neutral", emoji: "🔪", desc: "هر شب یک نفر را می‌کشی. اگر آخرین نفر بمانی، برنده‌ای.", unique: true },
];

export const ROLE_BY_ID: Record<string, RoleDef> = Object.fromEntries(MAFIA_ROLES.map((r) => [r.id, r]));

/** Suggest a balanced role setup for n players. */
export function suggestRoles(n: number): Record<string, number> {
  const mafiaTotal = n <= 6 ? 1 : n <= 9 ? 2 : n <= 12 ? 3 : 4;
  const counts: Record<string, number> = {};
  if (mafiaTotal >= 2) {
    counts.godfather = 1;
    counts.mafia = mafiaTotal - 1;
  } else {
    counts.mafia = 1;
  }
  counts.doctor = 1;
  counts.detective = 1;
  if (n >= 8) counts.sniper = 1;
  if (n >= 10) counts.bulletproof = 1;
  if (n >= 12) counts.mayor = 1;
  const used = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.citizen = Math.max(0, n - used);
  return counts;
}
