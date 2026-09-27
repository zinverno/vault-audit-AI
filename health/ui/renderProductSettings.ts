import { healthButton } from "./renderHealthHome";
import type { ProductSettingsAction, settingsViewModel } from "./settingsViewModel";

export function renderProductSettings(parent: HTMLElement, model: ReturnType<typeof settingsViewModel>, action: (action: ProductSettingsAction) => void): void {
  const home = parent.createEl("section", { cls: "veynrel-health-home veynrel-product-settings", attr: { "aria-label": model.title } });
  home.createEl("h1", { text: model.title, attr: { tabindex: "-1", "data-health-heading": "true" } });
  home.createEl("p", { text: model.description, cls: "veynrel-health-muted" });
  for (const summary of model.summaries) {
    const section = home.createEl("section", { cls: "veynrel-capability-row" });
    const copy = section.createDiv();
    copy.createEl("h2", { text: summary.title });
    const metadata = copy.createDiv({ cls: "veynrel-capability-summary" });
    metadata.createSpan({ text: summary.status, cls: "veynrel-health-state" });
    if (summary.details) metadata.createSpan({ text: summary.details, cls: "veynrel-health-muted" });
    if (summary.vectors) metadata.createSpan({ text: summary.vectors });
    healthButton(section, summary.label, () => action(summary.id), `settings-${summary.id}`, summary.disabled).addClass("veynrel-quiet");
  }
  const recall = home.createEl("section");
  recall.createEl("h2", { text: model.recall.title });
  recall.createEl("p", { text: model.recall.status, cls: "veynrel-health-state" });
  recall.createEl("p", { text: model.recall.description });
  const advanced = home.createEl("section");
  advanced.createEl("h2", { text: model.advanced.title });
  advanced.createEl("p", { text: model.advanced.description, cls: "veynrel-health-muted" });
  advanced.createEl("p", { text: model.advanced.instructions });
}
