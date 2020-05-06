import { VNode } from 'snabbdom/vnode'

export type MaybeVNode = VNode | string | null | undefined;
export type MaybeVNodes = MaybeVNode[];
export type Redraw = () => void;

export interface SwissOpts {
  data: SwissData;
  userId?: string;
  element: HTMLElement;
  $side: JQuery;
  socketSend: SocketSend;
  chat: any;
  i18n: any;
  classes: string;
}

export interface SwissData {
  id: string;
  name: string;
  createdBy: number;
  startsAt: string;
  perf: PerfType;
  clock: Clock;
  variant: string;
  me?: MyInfo;
  canJoin: boolean;
  joinTeam?: string;
  round: number;
  nbRounds: number;
  nbPlayers: number;
  nbOngoing: number;
  status: Status;
  standing: Standing;
  playerInfo?: PlayerExt;
  isStarted?: boolean;
  isFinished?: boolean;
  socketVersion?: number;
  quote?: {
    author: string;
    text: string;
  };
  description?: string;
  nextRound?: {
    at: string;
    in: number;
  }
  greatPlayer?: {
    name: string;
    url: string;
  };
}

export type Status = 'created' | 'started' | 'finished';

export interface MyInfo {
  id: string;
  rank: number;
  withdraw: boolean;
  gameId?: string;
}

export interface Pairing {
  g: string; // game
  c: boolean; // color
  w?: boolean; // won
  o?: boolean; // ongoing
}
export interface PairingExt extends Pairing {
  user: LightUser;
  rating: number;
}

export interface Standing {
  page: number;
  players: Player[];
  failed?: boolean;
}

export interface Player {
  user: LightUser;
  rating: number;
  provisional?: boolean;
  withdraw?: boolean;
  points: number;
  tieBreak: number;
  performance: number;
  rank: number;
  pairings: [Pairing | null];
  absent: boolean;
}

export interface PerfType {
  icon: string;
  name: string;
}

export interface Clock {
  limit: number;
  increment: number;
}

export type Page = Player[];

export interface Pages {
  [n: number]: Page
}

export interface PlayerExt extends Player {
  pairings: [PairingExt | null];
}
