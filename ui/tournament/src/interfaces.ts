import { VNode } from 'snabbdom/vnode'

export type MaybeVNode = VNode | string | null | undefined;
export type MaybeVNodes = MaybeVNode[];

interface Untyped {
  [key: string]: any;
}

export interface TournamentOpts extends Untyped {
  element: HTMLElement;
  socketSend: SocketSend;
}

export interface TournamentData extends Untyped {
  teamBattle?: TeamBattle;
  teamStanding?: RankedTeam[];
  myTeam?: RankedTeam;
  featured?: FeaturedGame;
}

export interface FeaturedGame {
  id: string;
  fen: Fen;
  orientation: Color;
  lastMove: string;
  white: FeaturedPlayer;
  black: FeaturedPlayer;
  board: BoardData;
  clock?: {
    white: number;
    black: number;
  };
  winner?: Color
}

interface FeaturedPlayer {
  rank: number;
  name: string;
  rating: number;
  title?: string;
  berserk?: boolean;
}

export interface TeamBattle {
  teams: {
    [id: string]: string
  };
  joinWith: string[];
  hasMoreThanTenTeams?: boolean;
}

export interface RankedTeam {
  id: string;
  rank: number;
  score: number;
  players: TeamPlayer[];
}

export interface TeamPlayer {
  user: {
    name: string
  };
  score: number
}

export interface Page extends Untyped {
}

export interface Pages {
  [n: number]: Page
}

export interface PlayerInfo {
  id?: string;
  player?: any;
  data?: any;
}
export interface TeamInfo {
  id: string;
  nbPlayers: number;
  rating: number;
  perf: number;
  score: number;
  topPlayers: TeamPlayer[];
}

export interface TeamPlayer {
  name: string;
  rating: number;
  score: number;
  fire: boolean;
  title?: string;
}

export interface Duel {
  id: string;
  p: [DuelPlayer, DuelPlayer]
}

export interface DuelPlayer {
  n: string; // name
  r: number // rating
  k: number // rank
  t?: string // title
}

export interface DuelTeams {
  [userId: string]: string
}
