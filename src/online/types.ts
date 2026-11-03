import type { ComponentType } from "react";

export interface Member {
  uid: string;
  name: string;
  online: boolean;
}

export interface RoomState {
  code: string; // = host uid
  members: Member[];
  game: string | null;
  g: unknown | null;
  opts: Record<string, number>;
  v: number;
}

export type RoomAction =
  | { type: "select"; game: string | null }
  | { type: "opts"; opts: Record<string, number> }
  | { type: "start" }
  | { type: "lobby" }
  | { type: "kick"; uid: string }
  | { type: "g"; a: unknown };

export interface GameViewProps<G, A> {
  g: G;
  me: string;
  hostId: string;
  members: Member[];
  send: (a: A) => void;
}

export interface OnlineGame<G = any, A = any> {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  min: number;
  max: number;
  accent: string;
  /** options shown in lobby (host). */
  options?: { key: string; label: string; min: number; max: number; step?: number; def: number; suffix?: string }[];
  init: (players: Member[], opts: Record<string, number>, hostId: string) => G;
  reduce: (g: G, a: A, uid: string, members: Member[], hostId: string) => G;
  View: ComponentType<GameViewProps<G, A>>;
}

export type Msg =
  | { t: "hello"; uid: string; name: string }
  | { t: "act"; a: RoomAction }
  | { t: "state"; s: RoomState }
  | { t: "kicked" }
  | { t: "ping" };
