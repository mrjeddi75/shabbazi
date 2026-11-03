import { doozOnline } from "./games/doozOnline";
import { mafiaOnline } from "./games/mafiaOnline";
import { menchOnline } from "./games/menchOnline";
import { spyOnline } from "./games/spyOnline";
import type { OnlineGame, RoomAction, RoomState } from "./types";

export const ONLINE_GAMES: OnlineGame[] = [doozOnline, menchOnline, spyOnline, mafiaOnline];
export const ONLINE_BY_ID: Record<string, OnlineGame> = Object.fromEntries(ONLINE_GAMES.map((g) => [g.id, g]));

export function gameOpts(def: OnlineGame, opts: Record<string, number>) {
  const out: Record<string, number> = {};
  def.options?.forEach((o) => (out[o.key] = opts[`${def.id}.${o.key}`] ?? o.def));
  return out;
}

export function roomReducer(s: RoomState, a: RoomAction, uid: string): RoomState {
  const isHost = uid === s.code;
  switch (a.type) {
    case "chat": {
      const member = s.members.find((m) => m.uid === uid && m.online);
      if (!member || typeof a.text !== "string" || typeof a.id !== "string") return s;
      const text = a.text.trim();
      if (!text || text.length > 280 || !/^[a-zA-Z0-9-]{8,64}$/.test(a.id)) return s;
      if (s.chat?.some((m) => m.id === a.id)) return s;
      return { ...s, chat: [...(s.chat ?? []).slice(-49), { id: a.id, uid, name: member.name, text, at: Date.now() }] };
    }
    case "select":
      if (!isHost) return s;
      return { ...s, game: a.game && ONLINE_BY_ID[a.game] ? a.game : null, g: null };
    case "opts":
      if (!isHost) return s;
      return { ...s, opts: { ...s.opts, ...a.opts } };
    case "start": {
      if (!isHost || !s.game) return s;
      const def = ONLINE_BY_ID[s.game];
      const host = s.members.filter((m) => m.uid === s.code);
      const others = s.members.filter((m) => m.online && m.uid !== s.code);
      const players = [...host, ...others].slice(0, def.max);
      if (players.length < def.min) return s;
      return { ...s, g: def.init(players, gameOpts(def, s.opts), s.code) };
    }
    case "lobby":
      if (!isHost) return s;
      return { ...s, g: null };
    case "kick":
      if (!isHost || a.uid === s.code) return s;
      return { ...s, members: s.members.filter((m) => m.uid !== a.uid), kicked: [...(s.kicked ?? []).slice(-20), a.uid] };
    case "g": {
      if (!s.g || !s.game) return s;
      const def = ONLINE_BY_ID[s.game];
      const g = def.reduce(s.g, a.a, uid, s.members, s.code);
      return g === s.g ? s : { ...s, g };
    }
  }
  return s;
}
