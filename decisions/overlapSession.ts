import { decisionsConfigured, DecisionsError } from "./openRouterDecisions";
import type { DecisionsErrorCode } from "./openRouterDecisions";
import type { DecisionsProvider, DecisionsSettings, OverlapAnswer, PreparedPair } from "./types";

export interface OverlapSessionDependencies {
  settings(): DecisionsSettings;
  stamp(): string;
  available(): boolean;
  prepare(isCurrent: () => boolean): Promise<PreparedPair>;
  provider(settings: DecisionsSettings): DecisionsProvider;
  release(): void;
}
export interface OverlapView {
  stage: "disabled" | "configuration" | "preparing" | "ready" | "refreshed" | "assessing" | "result" | "stale" | "error";
  preview?: PreparedPair;
  answer?: OverlapAnswer;
  error?: DecisionsErrorCode;
}

/** One comparison window; no persistence, retries, index writes or passive provider work. */
export class OverlapSession {
  view: OverlapView = { stage: "preparing" };
  private revision = 0;
  private closed = false;
  private request?: AbortController;
  private previewStamp = "";
  onChange: () => void = () => {};
  constructor(readonly paths: readonly string[], private readonly deps: OverlapSessionDependencies) {}
  get busy(): boolean { return this.view.stage === "preparing" || this.view.stage === "assessing"; }
  private stamp(): string { return `${this.revision}:${this.deps.stamp()}:${JSON.stringify(this.deps.settings())}`; }
  private publish(view: OverlapView): void { if (!this.closed) { this.view = view; this.onChange(); } }
  private configured(): boolean {
    const settings = this.deps.settings();
    if (!this.deps.available()) { this.publish({ ...this.view, stage: "stale" }); return false; }
    if (!settings.enabled || !decisionsConfigured(settings)) {
      this.publish({ stage: settings.enabled ? "configuration" : "disabled" }); return false;
    }
    return true;
  }
  invalidate(): void {
    if (this.closed) return;
    this.revision++;
    this.request?.abort();
    this.publish({ ...this.view, stage: "stale" });
  }
  close(): void {
    this.closed = true;
    this.revision++;
    this.request?.abort();
    this.view = { stage: "stale" };
    this.onChange = () => {};
    this.deps.release();
  }
  async prepare(): Promise<void> {
    if (this.closed || this.request || !this.configured()) return;
    const request = new AbortController();
    this.request = request;
    const stamp = this.stamp();
    const current = () => !this.closed && !request.signal.aborted && this.deps.available() && stamp === this.stamp();
    this.publish({ stage: "preparing" });
    try {
      const preview = await this.deps.prepare(current);
      if (!current()) return;
      this.previewStamp = stamp;
      this.publish({ stage: "ready", preview });
    } catch { if (current()) this.publish({ stage: "stale" }); }
    finally {
      if (this.request === request) this.request = undefined;
      if (!this.closed && stamp !== this.stamp()) this.publish({ ...this.view, stage: "stale" });
    }
  }
  async run(): Promise<void> {
    if (this.closed || this.request || !this.configured()) return;
    const previous = this.view.preview;
    if (!previous) return;
    const request = new AbortController();
    this.request = request;
    const stamp = this.stamp();
    const settings = { ...this.deps.settings() };
    const current = () => !this.closed && !request.signal.aborted && this.deps.available() && stamp === this.stamp();
    this.publish({ stage: "preparing", preview: previous });
    try {
      const preview = await this.deps.prepare(current);
      if (!current()) return;
      // A new preview needs another explicit click, even if only hidden source text changed.
      if (stamp !== this.previewStamp || JSON.stringify(preview) !== JSON.stringify(previous)) {
        this.previewStamp = stamp;
        this.publish({ stage: "refreshed", preview });
        return;
      }
      this.publish({ stage: "assessing", preview });
      const answer = await this.deps.provider(settings).assess({ fragmentA: preview.a.text, fragmentB: preview.b.text }, request.signal);
      if (!current()) return;
      const verified = await this.deps.prepare(current);
      if (!current()) return;
      if (JSON.stringify(verified) !== JSON.stringify(preview)) throw new DecisionsError("stale");
      this.publish({ stage: "result", preview, answer });
    } catch (error) {
      if (current()) {
        const code = error instanceof DecisionsError ? error.code : "network";
        this.publish({ stage: code === "stale" ? "stale" : "error", preview: previous, error: code });
      }
    } finally {
      if (this.request === request) this.request = undefined;
      if (!this.closed && stamp !== this.stamp() && this.view.stage !== "stale") this.publish({ ...this.view, stage: "stale" });
    }
  }
}
