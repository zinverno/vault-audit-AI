import { t } from "../../i18n";
import { formatSemanticScore } from "../../utils/semanticPresentation";
import type { ConnectionComparisonCategory, ConnectionComparisonPair, ConnectionComparisonPort, ConnectionComparisonProductSnapshot } from "../connectionComparisonPort";
import { healthButton } from "../ui/renderHealthHome";

export interface ConnectionComparisonViewState {
  category: ConnectionComparisonCategory;
  query: string;
  selectedPair?: string;
  visibleLimit: number;
}
export function newConnectionComparisonViewState(): ConnectionComparisonViewState { return { category: "candidate", query: "", visibleLimit: 50 }; }
export function connectionComparisonStatus(snapshot: ConnectionComparisonProductSnapshot): string | undefined {
  if (snapshot.state === "loading") return t("@connections.loading");
  if (snapshot.reason) return t(`@connections.${snapshot.reason}`);
  return undefined;
}
function markdownText(pair: ConnectionComparisonPair): string {
  if (!pair.markdown) return t("@connections.no-markdown");
  if (pair.markdown.direction === "reciprocal") return t("@connections.reciprocal");
  const [from, to] = pair.markdown.direction === "left-to-right" ? [pair.leftBasename, pair.rightBasename] : [pair.rightBasename, pair.leftBasename];
  return `${t("@connections.markdown")}: ${from} → ${to}`;
}
function rankingText(pair: ConnectionComparisonPair): string {
  if (!pair.semantic) return t("@connections.outside-top-five");
  return pair.semantic.mutualTopK ? t("@connections.mutual") : t("@connections.top-for", { note: pair.semantic.leftRank ? pair.leftBasename : pair.rightBasename });
}

/** Local filters and selection only. Note names/paths always use native text sinks. */
export function renderConnectionComparison(parent: HTMLElement, port: ConnectionComparisonPort, state: ConnectionComparisonViewState,
  actions: { back(): void; openNote(path: string): void; explore(path: string): void }): void {
  const snapshot = port.getSnapshot(), comparison = snapshot.comparison;
  const section = parent.createEl("section", { cls: "veynrel-connections", attr: { "aria-label": t("@connections.title"), "aria-busy": String(snapshot.state === "loading") } });
  healthButton(section, t("@global-map.back"), () => actions.back(), "connections-back");
  section.createEl("h1", { text: t("@connections.title"), attr: { tabindex: "-1", "data-health-heading": "true" } });
  section.createEl("p", { text: t("@connections.description"), cls: "veynrel-connections-lead" });
  const status = connectionComparisonStatus(snapshot);
  if (status) section.createEl("p", { text: status, cls: "veynrel-connections-status" });
  healthButton(section, t("@connections.refresh"), () => { void port.refresh(); }, "connections-refresh", snapshot.state === "loading");
  if (!comparison) return;
  const metrics = section.createEl("dl", { cls: "veynrel-connections-metrics" });
  for (const [key, count] of [["mapped", comparison.semanticMappedNoteCount], ["comparable", comparison.comparableNoteCount], ["semantic-pairs", comparison.semanticPairCount]] as const) {
    const metric = metrics.createDiv(); metric.createEl("dt", { text: t(`@connections.${key}`) }); metric.createEl("dd", { text: String(count) });
  }
  const categories = ["candidate", "aligned", "explicit-only"] as const;
  const overview = section.createDiv({ cls: "veynrel-connections-overview" });
  for (const [category, count] of [["candidate", comparison.candidateCount], ["aligned", comparison.alignedCount], ["explicit-only", comparison.explicitOnlyCount]] as const) {
    const card = overview.createDiv({ cls: "veynrel-connections-count" });
    card.createEl("strong", { text: String(count) }); card.createSpan({ text: t(`@connections.${category}-count`) });
  }
  section.createEl("p", { text: `${t("@connections.unclassified")}: ${comparison.unclassifiedSemanticPairCount} · ${t("@connections.explicit-outside")}: ${comparison.explicitOutsideSemanticMapCount}`,
    cls: "veynrel-health-muted" });
  const coverage = section.createEl("details", { cls: "veynrel-connections-coverage" });
  coverage.createEl("summary", { text: t("@connections.coverage") });
  const coverageMetrics = coverage.createEl("dl", { cls: "veynrel-connections-coverage-metrics" });
  for (const [key, count] of [["topology-notes", comparison.topologyNoteCount], ["unclassified-explicit", comparison.unclassifiedExplicitPairCount],
    ["missing-topology", comparison.semanticNotesMissingTopologyCount], ["unavailable-links", comparison.semanticNotesUnavailableLinksCount]] as const) {
    const item = coverageMetrics.createDiv(); item.createEl("dt", { text: t(`@connections.${key}`) }); item.createEl("dd", { text: String(count) });
  }
  if (comparison.unclassifiedSemanticPairCount || comparison.explicitOutsideSemanticMapCount || comparison.unclassifiedExplicitPairCount || comparison.semanticNotesMissingTopologyCount || comparison.semanticNotesUnavailableLinksCount) {
    section.createEl("p", { text: t("@connections.coverage-notice"), cls: "veynrel-health-muted" });
  }
  section.createEl("p", { text: t("@connections.exploratory"), cls: "veynrel-health-muted" });
  const filters = section.createDiv({ cls: "veynrel-connections-filters", attr: { role: "group", "aria-label": t("@connections.categories") } });
  const filterButtons = new Map<ConnectionComparisonCategory, HTMLButtonElement>();
  for (const category of categories) {
    const button = healthButton(filters, t(`@connections.${category}`), () => {
      state.category = category; state.visibleLimit = 50; state.selectedPair = undefined; update();
    }, `connections-${category}`);
    filterButtons.set(category, button);
  }
  const search = section.createEl("label", { cls: "veynrel-connections-search" });
  search.createSpan({ text: t("@connections.search") });
  const input = search.createEl("input", { type: "search", attr: { "data-health-action": "connections-search" } }); input.value = state.query;
  const showing = section.createEl("p", { cls: "veynrel-health-muted", attr: { role: "status", "aria-live": "polite" } });
  const composition = section.createDiv({ cls: "veynrel-connections-composition" });
  const listing = composition.createDiv();
  const list = listing.createDiv({ cls: "veynrel-connections-list" });
  const more = healthButton(listing, t("@connections.show-more"), () => { state.visibleLimit += 50; update(); }, "connections-more");
  const inspector = composition.createEl("section", { cls: "veynrel-connections-inspector", attr: { "aria-label": t("@connections.inspector"), tabindex: "-1" } });
  const rowButtons = new Map<string, HTMLButtonElement>();
  const inspect = (): void => {
    inspector.empty();
    const pair = comparison.pairs.find(pair => pair.id === state.selectedPair);
    for (const [id, button] of rowButtons) button.setAttribute("aria-pressed", String(id === state.selectedPair));
    if (!pair) { inspector.createEl("h2", { text: t("@connections.inspector") }); inspector.createEl("p", { text: t("@connections.select") }); return; }
    inspector.createEl("p", { text: t(`@connections.${pair.category}`), cls: "veynrel-health-muted" });
    for (const [name, path] of [[pair.leftBasename, pair.leftPath], [pair.rightBasename, pair.rightPath]]) {
      inspector.createEl("h2", { text: name }); inspector.createEl("p", { text: path, cls: "veynrel-connections-path" });
    }
    inspector.createEl("h3", { text: t("@connections.semantic") });
    if (pair.semantic) {
      inspector.createEl("p", { text: `${t("@connections.similarity")} ${formatSemanticScore(pair.semantic.score)}` });
      for (const [note, rank] of [[pair.leftBasename, pair.semantic.leftRank], [pair.rightBasename, pair.semantic.rightRank]] as const) {
        inspector.createEl("p", { text: rank === undefined ? t("@connections.not-ranked", { note }) : t("@connections.rank", { note, rank }) });
      }
    }
    inspector.createEl("p", { text: rankingText(pair) });
    inspector.createEl("h3", { text: t("@connections.markdown-relationship") });
    inspector.createEl("p", { text: markdownText(pair) });
    const buttons = inspector.createDiv({ cls: "veynrel-connections-actions" });
    for (const [side, path] of [["left", pair.leftPath], ["right", pair.rightPath]] as const) {
      healthButton(buttons, t(`@connections.open-${side}`), () => actions.openNote(path), `connections-open-${side}`);
      healthButton(buttons, t(`@connections.explore-${side}`), () => actions.explore(path), `connections-explore-${side}`, snapshot.state !== "ready");
    }
  };
  const update = (): void => {
    for (const [category, button] of filterButtons) button.setAttribute("aria-pressed", String(category === state.category));
    const needle = state.query.trim().toLowerCase();
    const matches = comparison.pairs.filter(pair => pair.category === state.category &&
      [pair.leftBasename, pair.leftPath, pair.rightBasename, pair.rightPath].some(text => text.toLowerCase().includes(needle)));
    const visible = matches.slice(0, state.visibleLimit);
    showing.setText(t("@connections.showing", { shown: visible.length, total: matches.length }));
    list.empty(); rowButtons.clear();
    visible.forEach((pair, index) => {
      const button = healthButton(list, "", () => { state.selectedPair = pair.id; inspect(); inspector.focus(); }, `connections-pair-${index}`);
      button.setAttribute("title", `${pair.leftPath} ↔ ${pair.rightPath}`);
      button.createEl("strong", { text: `${pair.leftBasename} ↔ ${pair.rightBasename}` });
      if (pair.semantic) button.createSpan({ text: `${t("@connections.similarity")} ${formatSemanticScore(pair.semantic.score)}` });
      button.createSpan({ text: rankingText(pair) }); button.createSpan({ text: markdownText(pair) });
      rowButtons.set(pair.id, button);
    });
    more.hidden = visible.length >= matches.length;
    if (more.hidden && more === more.ownerDocument.activeElement) input.focus({ preventScroll: true });
    inspect();
  };
  input.addEventListener("input", () => { state.query = input.value; state.visibleLimit = 50; update(); });
  update();
}
