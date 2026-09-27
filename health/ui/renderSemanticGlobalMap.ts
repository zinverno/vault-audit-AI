import { t } from "../../i18n";
import { formatSemanticScore } from "../../utils/semanticPresentation";
import type { SemanticGlobalMapPort, SemanticGlobalMapProductSnapshot } from "../semanticGlobalMapPort";
import { healthButton } from "./renderHealthHome";
import { fitGraph } from "./graphViewport";
import { renderSemanticGlobalMapGraph } from "./renderSemanticGlobalMapGraph";
import type { SemanticGlobalMapViewState } from "./renderSemanticGlobalMapGraph";

export function globalSemanticMapStatus(snapshot: SemanticGlobalMapProductSnapshot): string | undefined {
  if (snapshot.state === "loading") return snapshot.progress ? t("@global-map.comparing", { completed: snapshot.progress.completedPairs, total: snapshot.progress.totalPairs }) : t("@global-map.loading");
  if (snapshot.state === "stale") return t("@global-map.changed") + ". " + t("@global-map.stale");
  if (snapshot.reason) return t(`@global-map.${snapshot.reason}`, { n: snapshot.supportedNoteCount });
  return undefined;
}
export function renderSemanticGlobalMap(parent: HTMLElement, port: SemanticGlobalMapPort, state: SemanticGlobalMapViewState,
  actions: { back(): void; openNote(path: string): void; explore(path: string): void }): () => void {
  const snapshot = port.getSnapshot();
  const section = parent.createEl("section", { cls: "veynrel-global-map", attr: { "aria-label": t("@global-map.title"), "aria-busy": String(snapshot.busy) } });
  healthButton(section, t("@global-map.back"), () => actions.back(), "global-map-back");
  section.createEl("h1", { text: t("@global-map.title"), attr: { tabindex: "-1", "data-health-heading": "true" } });
  section.createEl("p", { text: t("@global-map.description") });
  const status = globalSemanticMapStatus(snapshot);
  if (status) section.createEl("p", { text: status, cls: "veynrel-global-map-status" });
  const metrics = section.createEl("dl", { cls: "veynrel-global-map-metrics" });
  for (const [label, value] of [["indexed", snapshot.indexedNoteCount], ["mapped", snapshot.mappedNoteCount]] as const) {
    if (value === undefined) continue;
    const item = metrics.createDiv(); item.createEl("dt", { text: t(`@global-map.${label}`) }); item.createEl("dd", { text: String(value) });
  }
  const controls = section.createDiv({ cls: "veynrel-global-map-actions" });
  healthButton(controls, t("@global-map.refresh"), () => { void port.refresh(); }, "global-map-refresh", snapshot.busy);
  const map = snapshot.map;
  if (!map) return () => {};
  if (state.map !== map) { state.map = map; state.viewport = fitGraph(); if (!map.nodes.some((node) => node.path === state.selected)) state.selected = undefined; }
  const search = section.createEl("label", { cls: "veynrel-global-map-search" });
  search.createSpan({ text: t("@global-map.search") });
  const input = search.createEl("input", { type: "search", attr: { "data-health-action": "global-map-search" } }); input.value = state.query;
  const results = section.createDiv({ cls: "veynrel-global-map-results" });
  const composition = section.createDiv({ cls: "veynrel-global-map-composition" });
  const visual = composition.createDiv({ cls: "veynrel-global-map-visual" });
  const inspector = composition.createEl("section", { cls: "veynrel-global-map-inspector", attr: { "aria-label": t("@global-map.selection"), tabindex: "-1" } });
  const nodes = new Map(map.nodes.map((node) => [node.path, node]));
  const inspect = (path?: string): void => {
    const heldFocus = inspector.contains(inspector.ownerDocument.activeElement);
    inspector.empty();
    const node = nodes.get(path ?? "");
    if (!node) { inspector.createEl("h2", { text: t("@global-map.selection") }); inspector.createEl("p", { text: t("@global-map.select") }); return; }
    inspector.createEl("h2", { text: node.basename });
    inspector.createEl("p", { text: node.path, cls: "veynrel-global-map-path" });
    const facts = inspector.createEl("dl", { cls: "veynrel-global-map-facts" });
    for (const [key, score] of [["similarity", node.coreSimilarity], ["connectedness", node.semanticConnectedness]] as const) {
      const item = facts.createDiv(); item.createEl("dt", { text: t(`@global-map.${key}`) });
      item.createEl("dd", { text: score === null ? t("@global-map.no-neighbors") : formatSemanticScore(score) });
    }
    inspector.createEl("p", { text: t("@global-map.connectedness-description"), cls: "veynrel-health-muted" });
    const buttons = inspector.createDiv({ cls: "veynrel-global-map-actions" });
    healthButton(buttons, t("@global-map.open-note"), () => actions.openNote(node.path), "global-map-open-note");
    healthButton(buttons, t("@global-map.explore"), () => actions.explore(node.path), "global-map-explore", snapshot.busy || snapshot.state !== "ready");
    inspector.createEl("h3", { text: t("@global-map.nearest") });
    const list = inspector.createDiv({ cls: "veynrel-global-map-neighbors" });
    node.neighbors.forEach((neighbor, i) => {
      const button = healthButton(list, "", () => graph.select(neighbor.path, true), `global-map-neighbor-${i}`);
      button.setAttribute("title", neighbor.path); button.setAttribute("aria-label", `${neighbor.path} · ${formatSemanticScore(neighbor.score)}`);
      button.createSpan({ text: nodes.get(neighbor.path)!.basename }); button.createSpan({ text: formatSemanticScore(neighbor.score) });
    });
    if (heldFocus) inspector.focus({ preventScroll: true });
  };
  const graph = renderSemanticGlobalMapGraph(visual, map, state, inspect);
  healthButton(controls, t("@global-map.fit"), graph.fit, "global-map-fit");
  inspect(state.selected);
  const legend = visual.createEl("details", { cls: "veynrel-global-map-legend", attr: { open: "" } });
  legend.createEl("summary", { text: t("@global-map.relationships") });
  for (const key of ["distance-legend", "size-legend", "edge-legend", "selected-legend", "core-description"]) legend.createEl("p", { text: t(`@global-map.${key}`) });
  const showResults = (): void => {
    results.empty();
    if (!state.query.trim()) return;
    const matches = port.search(state.query);
    results.createEl("p", { text: t("@global-map.showing", { shown: matches.nodes.length, total: matches.total }), attr: { role: "status", "aria-live": "polite" } });
    matches.nodes.forEach((node, i) => {
      healthButton(results, node.path, () => graph.select(node.path, true), `global-map-result-${i}`);
    });
  };
  input.addEventListener("input", () => { state.query = input.value; showResults(); }); showResults();
  return graph.dispose;
}
