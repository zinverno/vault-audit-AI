import type { SemanticIndexRevision } from "../../health/semanticHealthAnalysisPort";
import type { SemanticGlobalMapPort, SemanticGlobalMapProductSnapshot, SemanticGlobalSearchResult } from "../../health/semanticGlobalMapPort";
import { GLOBAL_SEMANTIC_DOCUMENT_CAP } from "../globalSemanticMap";
import type { GlobalSemanticAnalysis, GlobalSemanticOptions } from "../globalSemanticMap";
import type { SemanticIndexState } from "../types";
import { semanticIndexRevision, sameSemanticIndexRevision } from "../semanticIndexRevision";
import { InvalidGlobalSemanticResult, projectGlobalSemanticMap } from "./semanticGlobalMapModel";

export interface SemanticGlobalMapEngine {
  getCachedIndexState(): SemanticIndexState;
  subscribeStatus(listener: () => void): () => void;
  analyzeGlobalSemanticMap(options?: GlobalSemanticOptions): Promise<GlobalSemanticAnalysis>;
}
export class SemanticGlobalMapController implements SemanticGlobalMapPort {
  private snapshot: SemanticGlobalMapProductSnapshot = Object.freeze({ state: "idle", busy: false, supportedNoteCount: GLOBAL_SEMANTIC_DOCUMENT_CAP });
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: () => void;
  private revision?: SemanticIndexRevision;
  private abort?: AbortController;
  private pending?: Promise<void>;
  private epoch = 0;
  private disposed = false;

  constructor(private readonly engine: SemanticGlobalMapEngine) {
    this.unsubscribe = engine.subscribeStatus(() => {
      if (!this.disposed && this.revision && !sameSemanticIndexRevision(this.revision, semanticIndexRevision(engine.getCachedIndexState()))) this.invalidate();
    });
  }
  getSnapshot(): SemanticGlobalMapProductSnapshot { return this.snapshot; }
  subscribe(listener: () => void): () => void { if (!this.disposed) this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  load(): Promise<void> {
    if (this.pending) return this.pending;
    // Opening a cached/stale surface does not silently recompute it.
    if (this.snapshot.state === "stale" || this.snapshot.state === "ready") return Promise.resolve();
    return this.run();
  }
  refresh(): Promise<void> { return this.pending ?? this.run(); }
  search(query: string): SemanticGlobalSearchResult {
    const needle = query.trim().toLowerCase();
    const matches = this.disposed ? [] : (this.snapshot.map?.nodes ?? []).filter((node) => node.path.toLowerCase().includes(needle) || node.basename.toLowerCase().includes(needle));
    return Object.freeze({ nodes: Object.freeze(matches.slice(0, 20)), total: matches.length });
  }
  dispose(): void { this.disposed = true; this.epoch++; this.abort?.abort(); this.unsubscribe(); this.listeners.clear(); }
  private invalidate(): void {
    this.epoch++; this.abort?.abort(); this.revision = undefined;
    this.publish({ ...this.snapshot, state: "stale", reason: "changed", progress: undefined });
  }
  private current(epoch: number, revision: SemanticIndexRevision): boolean {
    if (this.disposed || epoch !== this.epoch) return false;
    if (sameSemanticIndexRevision(revision, semanticIndexRevision(this.engine.getCachedIndexState()))) return true;
    this.invalidate(); return false;
  }
  private run(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const revision = semanticIndexRevision(this.engine.getCachedIndexState());
    if (!revision) { this.publish({ ...this.snapshot, state: "unavailable", reason: "unavailable", busy: false }); return Promise.resolve(); }
    const epoch = ++this.epoch; this.revision = revision;
    const abort = new AbortController(); this.abort = abort;
    const pending = Promise.resolve().then(async () => {
      try {
        if (!this.current(epoch, revision)) return;
        const result = await this.engine.analyzeGlobalSemanticMap({ signal: abort.signal, onProgress: (progress) => {
          if (this.current(epoch, revision)) this.publish({ ...this.snapshot, progress: Object.freeze({ ...progress }) });
        } });
        if (!this.current(epoch, revision)) return;
        const map = projectGlobalSemanticMap(result, revision, Date.now());
        if (!this.current(epoch, revision)) return;
        this.publish({ state: map ? "ready" : "unavailable", reason: result.state === "ready" ? undefined : result.state,
          map, indexedNoteCount: result.indexedNoteCount, mappedNoteCount: result.mappedNoteCount,
          busy: true, supportedNoteCount: GLOBAL_SEMANTIC_DOCUMENT_CAP });
      } catch (error) {
        if (this.current(epoch, revision)) this.publish({ ...this.snapshot, state: "error", progress: undefined,
          reason: error instanceof InvalidGlobalSemanticResult ? "invalid" : "failed" });
      }
    }).finally(() => {
      if (this.pending !== pending) return;
      this.pending = undefined; this.abort = undefined;
      if (!this.disposed) this.publish({ ...this.snapshot, busy: false });
    });
    this.pending = pending;
    this.publish({ ...this.snapshot, state: "loading", busy: true, reason: undefined, progress: undefined });
    return pending;
  }
  private publish(snapshot: SemanticGlobalMapProductSnapshot): void {
    if (this.disposed) return;
    this.snapshot = Object.freeze(snapshot);
    for (const listener of [...this.listeners]) { try { listener(); } catch { /* Views cannot change ownership. */ } }
  }
}
