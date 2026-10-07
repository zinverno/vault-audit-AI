import { App, Modal } from "obsidian";
import { t as tr } from "../i18n";
import { openDiscoveryResult } from "../semantic/semanticDiscoveryModal";
import type { OverlapSession } from "./overlapSession";
import { OVERLAP_CATEGORIES } from "./types";

export class OverlapModal extends Modal {
  constructor(app: App, private readonly session: OverlapSession) { super(app); }
  onOpen(): void {
    this.titleEl.setText(tr("@decisions.title"));
    this.contentEl.addClass("ai-overlap-modal");
    this.contentEl.createEl("p", { text: tr("@decisions.scope") });
    this.contentEl.createEl("p", { text: tr("@decisions.disclosure") });
    const status = this.contentEl.createDiv({ attr: { role: "status", "aria-live": "polite" } });
    const preview = this.contentEl.createDiv({ cls: "ai-overlap-fragments" });
    const controls = this.contentEl.createDiv({ cls: "ai-semantic-search-controls" });
    const run = controls.createEl("button", { text: tr("@decisions.run"), cls: "mod-cta", attr: { type: "button" } });
    const refresh = controls.createEl("button", { text: tr("@decisions.refresh"), attr: { type: "button" } });
    const result = this.contentEl.createDiv({ cls: "ai-overlap-result" });
    run.addEventListener("click", () => { void this.session.run(); });
    refresh.addEventListener("click", () => { void this.session.prepare(); });
    this.session.onChange = () => {
      const view = this.session.view;
      status.setAttribute("data-state", view.stage);
      status.setText(tr(view.stage === "error" ? `@decisions.error.${view.error ?? "network"}` : `@decisions.${view.stage}`));
      run.disabled = this.session.busy || !view.preview || ["disabled", "configuration", "stale"].includes(view.stage);
      refresh.disabled = this.session.busy;
      preview.empty();
      if (view.preview) for (const [side, fragment] of [["A", view.preview.a], ["B", view.preview.b]] as const) {
        const card = preview.createDiv({ cls: "ai-semantic-result-card" });
        const open = card.createEl("button", { text: `${side}: ${fragment.match.path}`, cls: "ai-overlap-note", attr: { type: "button" } });
        open.addEventListener("click", () => { void openDiscoveryResult(this.app, fragment.match.path, fragment.match, () => {}); });
        if (fragment.truncated) card.createEl("p", { text: tr("@decisions.truncated") });
        card.createEl("pre", { cls: "ai-overlap-text", text: fragment.text, attr: { tabindex: "0", "aria-label": tr("@decisions.fragment", { side }) } });
      }
      result.empty();
      if (view.answer) {
        const answer = view.answer;
        if (view.stage === "stale") result.createEl("p", { text: tr("@decisions.staleResult") });
        result.createEl("p", { text: answer.tied.length > 1 ? tr("@decisions.tie") : tr(`@decisions.verdict.${answer.choice}`) });
        const details = result.createEl("details");
        details.createEl("summary", { text: tr("@decisions.details") });
        for (const category of OVERLAP_CATEGORIES) details.createEl("p", { text: `${tr(`@decisions.category.${category}`)}: ${answer.probabilities[category]}` });
        details.createEl("p", { text: tr("@decisions.confidence", { value: answer.confidence }) });
        details.createEl("p", { text: tr("@decisions.models", { requested: answer.requestedModel, resolved: answer.resolvedModel ?? "—", version: answer.criteriaVersion }) });
      }
    };
    this.session.onChange();
    void this.session.prepare();
  }
  onClose(): void { this.session.close(); this.contentEl.empty(); }
}
