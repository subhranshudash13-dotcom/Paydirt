import type { BoardQuery, RankedIssue, TrackedItem, TrackSignal, ModelMetrics } from "@paydirt/shared";

export type Driver = "postgres" | "memory";

export interface Store {
  readonly driver: Driver;
  listBoard(q: BoardQuery): Promise<RankedIssue[]>;
  getIssue(id: number): Promise<RankedIssue | null>;
  search(q: string, k: number): Promise<RankedIssue[]>;
  listTracked(): Promise<TrackedItem[]>;
  createTrack(issueId: number): Promise<TrackedItem | null>;
  signalTrack(id: number, signal: TrackSignal): Promise<TrackedItem | null>;
  getModelMetrics(): Promise<ModelMetrics>;
}
