import { t } from "../../i18n";
import type { SemanticGlobalMap } from "../semanticGlobalMapPort";
import { compareStrings } from "../domain/validation";
import { bindGraphViewport } from "./bindGraphViewport";
import { fitGraph, panGraph } from "./graphViewport";
import type { Viewport } from "./graphViewport";
import { semanticGraphBasename, semanticGraphLabel, separateSemanticLabels } from "./semanticGraphLabel";
import { semanticGlobalMapLayout } from "./semanticGlobalMapLayout";

const layouts = new WeakMap<SemanticGlobalMap, ReturnType<typeof semanticGlobalMapLayout>>();
export interface SemanticGlobalMapViewState { query: string; selected?: string; map?: SemanticGlobalMap; viewport: Viewport }
export const newSemanticGlobalMapViewState = (): SemanticGlobalMapViewState => ({ query: "", viewport: fitGraph() });

export function renderSemanticGlobalMapGraph(parent: HTMLElement, map: SemanticGlobalMap, state: SemanticGlobalMapViewState, onSelect: (path: string) => void) {
  const started = performance.now();
  let layout = layouts.get(map);
  if (!layout) { layout = semanticGlobalMapLayout(map); layouts.set(map, layout); }
  const laidOut = performance.now();
  const positions = new Map(layout.map((point) => [point.path, point]));
  const nodes = new Map(map.nodes.map((node) => [node.path, node]));
  const labeled = [...map.nodes].sort((a, b) => (b.semanticConnectedness ?? -1) - (a.semanticConnectedness ?? -1) || compareStrings(a.path, b.path)).slice(0, 5).map((node) => node.path);
  const svg = parent.createSvg("svg", { cls: "veynrel-global-map-svg", attr: { viewBox: "0 0 1000 1000", "aria-hidden": "true", focusable: "false" } });
  const scene = svg.createSvg("g");
  for (const radius of [120, 265, 410]) scene.createSvg("circle", { cls: "veynrel-global-map-guide", attr: { cx: "500", cy: "500", r: String(radius) } });
  const lines = map.edges.map((edge) => {
    const a = positions.get(edge.left)!; const b = positions.get(edge.right)!;
    return { edge, element: scene.createSvg("line", { cls: "veynrel-global-map-edge", attr: {
      x1: String(a.x), y1: String(a.y), x2: String(b.x), y2: String(b.y), "data-mutual": String(edge.mutual) } }) };
  });
  const core = scene.createSvg("g", { cls: "veynrel-global-map-core" });
  core.createSvg("path", { attr: { d: "M500 478 L522 500 L500 522 L478 500 Z" } });
  core.createSvg("circle", { attr: { cx: "500", cy: "500", r: "7" } });
  core.createSvg("title").textContent = t("@global-map.core");
  core.createSvg("text", { attr: { x: "500", y: "547", "text-anchor": "middle" } }).textContent = t("@global-map.core");
  const groups = layout.map((point) => {
    const node = nodes.get(point.path)!;
    const group = scene.createSvg("g", { cls: "veynrel-global-map-node", attr: {
      "data-global-map-node": node.path, "data-label-rank": String(labeled.indexOf(node.path) + 1) } });
    group.createSvg("title").textContent = node.path;
    group.createSvg("circle", { cls: "veynrel-global-map-hit", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius + 5) } });
    group.createSvg("circle", { cls: "veynrel-global-map-dot", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius) } });
    const label = semanticGraphLabel(point, point.radius);
    const text = semanticGraphBasename(node.basename);
    const element = group.createSvg("text", { cls: "veynrel-global-map-label", attr: { x: String(label.x), y: String(label.y), "text-anchor": label.anchor,
      "dominant-baseline": "middle" } }); element.textContent = text;
    return { path: node.path, group, label: { ...label, text, element } };
  });
  const update = (): void => { scene.setAttribute("transform", `translate(${state.viewport.x} ${state.viewport.y}) scale(${state.viewport.zoom})`); };
  const highlight = (): void => {
    const nearest = new Set(nodes.get(state.selected ?? "")?.neighbors.map((neighbor) => neighbor.path));
    for (const { edge, element } of lines) {
      const selected = edge.left === state.selected && nearest.has(edge.right) || edge.right === state.selected && nearest.has(edge.left);
      element.setAttribute("data-highlight", String(selected));
    }
    for (const { path, group } of groups) group.setAttribute("data-selected", String(path === state.selected));
    for (const { label } of groups) { label.element.setAttribute("x", String(label.x)); label.element.setAttribute("y", String(label.y)); }
    const permanent = groups.filter((item) => labeled.includes(item.path) || item.path === state.selected)
      .sort((a, b) => Number(b.path === state.selected) - Number(a.path === state.selected) || labeled.indexOf(a.path) - labeled.indexOf(b.path));
    const placement = separateSemanticLabels(permanent.map((item) => ({ path: item.path, ...item.label })));
    placement.forEach((position, i) => { permanent[i].label.element.setAttribute("x", String(position.x)); permanent[i].label.element.setAttribute("y", String(position.y)); });
  };
  const select = (path: string, center = false): void => {
    const point = positions.get(path); if (!point) return;
    state.selected = path;
    if (center) { state.viewport = panGraph({ ...state.viewport, x: 0, y: 0 }, 500 - point.x * state.viewport.zoom, 500 - point.y * state.viewport.zoom); update(); }
    highlight(); onSelect(path);
  };
  update(); highlight();
  const dispose = bindGraphViewport(svg, state, update, "data-global-map-node", (path) => select(path));
  svg.setAttribute("data-layout-ms", String(laidOut - started));
  svg.setAttribute("data-render-ms", String(performance.now() - laidOut));
  return { select, dispose, fit: () => { state.viewport = fitGraph(); update(); } };
}
