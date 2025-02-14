import { Prop } from 'common';

export interface ForecastData {
  onMyTurn?: boolean;
  steps?: ForecastStep[][];
}

export interface ForecastStep {
  ply: Ply;
  displayPly?: Ply;
  uci: Uci;
  san: San;
  fen: Fen;
}

export interface ForecastCtrl {
  addNodes(fc);
  reloadToLastPly();
  truncate(fc: ForecastStep[]): ForecastStep[];
  truncateNodes(fc: any[]): any[];
  playAndSave(node: ForecastStep);
  findStartingWithNode(node: ForecastStep): ForecastStep[][];
  isCandidate(fc: ForecastStep[]): boolean;
  addNodes(fc: ForecastStep[]);
  removeIndex(index: number);
  list(): ForecastStep[][];
  loading: Prop<boolean>;
  onMyTurn: boolean;
  skipSteps: number;
}
