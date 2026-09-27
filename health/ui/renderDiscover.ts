import { renderSemanticIndexProgress, renderSemanticRejectedBatch } from "./renderSemanticIntelligence";
import { t } from "../../i18n";
import { healthButton } from "./renderHealthHome";
import type { DiscoverAction, DiscoverViewModel } from "./discoverViewModel";

export function renderDiscover(parent: HTMLElement, model: DiscoverViewModel, action: (action: DiscoverAction) => void, openNeighborhood?: () => void, openGlobalMap?: () => void, openComparison?: () => void): void {
  const section = parent.createEl("section", { cls: "veynrel-health-home veynrel-discover",
    attr: { "aria-label": model.title, "aria-busy": String(model.busy) } });
  section.createEl("h1", { text: model.title, attr: { tabindex: "-1", "data-health-heading": "true" } });
  section.createEl("p", { text: model.introduction });
  if (model.state === "ready" && (openNeighborhood || openGlobalMap || openComparison)) {
    section.createEl("h2", { text: t("@global-map.exploration") });
    const exploration = section.createDiv({ cls: "veynrel-semantic-exploration" });
    for (const [key, open, actionKey] of [["neighborhood", openNeighborhood, "neighborhood-open"], ["global-map", openGlobalMap, "global-map-open"], ["connections", openComparison, "connections-open"]] as const) {
      if (!open) continue;
      const card = exploration.createEl("section", { cls: "veynrel-neighborhood-card" });
      card.createEl("h3", { text: t(`@${key}.title`) });
      card.createEl("p", { text: t(`@${key}.tagline`), cls: "veynrel-neighborhood-card-lead" });
      healthButton(card, t(`@${key}.open`), open, actionKey, model.busy);
    }
    section.createEl("p", { text: t("@neighborhood.index-only"), cls: "veynrel-health-muted" });
  }
  if (model.workflows.length) {
    section.createEl("h2", { text: model.exploreTitle });
    const workflows = section.createDiv({ cls: "veynrel-discover-workflows" });
    for (const workflow of model.workflows) {
      const button = healthButton(workflows, "", () => action(workflow.id), `discover-${workflow.id}`, model.busy);
      button.addClass("veynrel-health-profile-option");
      button.createSpan({ text: workflow.label, cls: "veynrel-health-profile-name" });
      button.createSpan({ text: workflow.description });
    }
  }
  if (model.healthAnalysis) {
    const health = section.createEl("section", { cls: "veynrel-discover-health", attr: { "aria-label": model.healthAnalysis.title } });
    health.createEl("h2", { text: model.healthAnalysis.title });
    health.createEl("p", { text: model.healthAnalysis.description });
    healthButton(health, model.healthAnalysis.label, () => action("semantic-duplicates"), "semantic-health-scan", model.healthAnalysis.disabled);
  }
  if (model.healthStatus) section.createEl("p", { text: model.healthStatus });
  section.createEl("h2", { text: model.capabilityTitle });
  section.createEl("p", { text: model.status, cls: "veynrel-health-state" });
  section.createEl("p", { text: model.description });
  renderSemanticRejectedBatch(section, model.rejectedBatch);
  renderSemanticIndexProgress(section, model.progress);
  if (model.details) section.createEl("p", { text: model.details, cls: "veynrel-health-muted" });
  if (model.vectors) section.createEl("p", { text: model.vectors });
  const actions = section.createDiv({ cls: "veynrel-semantic-actions" });
  for (const item of model.actions) healthButton(actions, item.label, () => action(item.id), `discover-${item.id}`, model.busy);
}
