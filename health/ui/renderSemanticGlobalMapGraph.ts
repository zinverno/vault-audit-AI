import { t } from "../../i18n";
import type { SemanticGlobalFocus, SemanticGlobalMap } from "../semanticGlobalMapPort";
import { compareStrings } from "../domain/validation";
import { bindGraphViewport } from "./bindGraphViewport";
import { clampZoom, fitGraph, panGraph, zoomGraph } from "./graphViewport";
import type { Viewport } from "./graphViewport";
import { semanticGraphBasename, semanticGraphLabel, separateSemanticLabels } from "./semanticGraphLabel";
import { semanticCoreRadius, semanticFocusLayout, semanticGlobalMapLayout } from "./semanticGlobalMapLayout";

const layouts = new WeakMap<SemanticGlobalMap, ReturnType<typeof semanticGlobalMapLayout>>();
export const SEMANTIC_MAP_MAX_ZOOM = 24;
export interface SemanticGlobalMapViewState { query: string; selected?: string; map?: SemanticGlobalMap; viewport: Viewport; focusAction?: "global-map-focus" | "global-map-search" }
export const newSemanticGlobalMapViewState = (): SemanticGlobalMapViewState => ({ query: "", viewport: fitGraph() });

export function renderSemanticGlobalMapGraph(parent: HTMLElement, map: SemanticGlobalMap, state: SemanticGlobalMapViewState, onSelect: (path: string) => void, focus?: SemanticGlobalFocus) {
  const started = performance.now();
  let layout = layouts.get(map);
  if (!layout) { layout = semanticGlobalMapLayout(map); layouts.set(map, layout); }
  layout = semanticFocusLayout(layout, focus);
  const laidOut = performance.now();
  const positions = new Map(layout.map((point) => [point.path, point]));
  const nodes = new Map(map.nodes.map((node) => [node.path, node]));
  const labeled = [...map.nodes].sort((a, b) => (b.semanticConnectedness ?? -1) - (a.semanticConnectedness ?? -1) || compareStrings(a.path, b.path)).slice(0, 5).map((node) => node.path);
  const svg = parent.createSvg("svg", { cls: "veynrel-global-map-svg", attr: { viewBox: "0 0 1000 1000", "aria-hidden": "true", focusable: "false" } });
  const scene = svg.createSvg("g");
  const labelObstacles = [{ left: focus ? 340 : 365, right: focus ? 660 : 635, top: 527, bottom: focus ? 587 : 557 }, { left: 474, right: 526, top: 474, bottom: 526 }];
  for (const score of [1, 0, -1]) {
    const radius = semanticCoreRadius(score), y = 500 - radius - 12;
    scene.createSvg("circle", { cls: "veynrel-global-map-guide", attr: { cx: "500", cy: "500", r: String(radius) } });
    scene.createSvg("text", { cls: "veynrel-global-map-ring-label", attr: { x: "500", y: String(y), "text-anchor": "middle", "dominant-baseline": "middle" } }).textContent = score > 0 ? "+1" : String(score);
    labelObstacles.push({ left: 478, right: 522, top: y - 12, bottom: y + 12 });
  }
  const lines = map.edges.map((edge) => {
    const a = positions.get(edge.left)!; const b = positions.get(edge.right)!;
    return { edge, element: scene.createSvg("line", { cls: "veynrel-global-map-edge", attr: {
      x1: String(a.x), y1: String(a.y), x2: String(b.x), y2: String(b.y), "data-mutual": String(edge.mutual) } }) };
  });
  const center = scene.createSvg("g", { cls: focus ? "veynrel-global-map-focused-center" : "veynrel-global-map-core" });
  if (focus) {
    center.createSvg("circle", { attr: { cx: "500", cy: "500", r: String(positions.get(focus.path)!.radius + 5) } });
    center.createSvg("text", { attr: { x: "500", y: "573", "text-anchor": "middle" } }).textContent = semanticGraphBasename(nodes.get(focus.path)!.basename);
  } else {
    center.createSvg("path", { attr: { d: "M500 478 L522 500 L500 522 L478 500 Z" } });
    center.createSvg("circle", { attr: { cx: "500", cy: "500", r: "7" } });
  }
  center.createSvg("title").textContent = focus ? focus.path : t("@global-map.core");
  center.createSvg("text", { attr: { x: "500", y: "547", "text-anchor": "middle" } }).textContent = t(focus ? "@global-map.focused-note" : "@global-map.core");
  const groups = layout.map((point) => {
    const node = nodes.get(point.path)!;
    const group = scene.createSvg("g", { cls: "veynrel-global-map-node", attr: {
      "data-global-map-node": node.path, "data-focused": String(node.path === focus?.path), "data-label-rank": String(labeled.indexOf(node.path) + 1) } });
    group.createSvg("title").textContent = node.path;
    const connector = group.createSvg("line", { cls: "veynrel-global-map-label-link" });
    group.createSvg("circle", { cls: "veynrel-global-map-hit", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius + 5) } });
    group.createSvg("circle", { cls: "veynrel-global-map-dot", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius) } });
    const label = semanticGraphLabel(point, point.radius);
    const text = semanticGraphBasename(node.basename);
    const element = group.createSvg("text", { cls: "veynrel-global-map-label", attr: { x: String(label.x), y: String(label.y), "text-anchor": label.anchor,
      "dominant-baseline": "middle" } }); element.textContent = text;
    return { path: node.path, point, group, connector, label: { ...label, text, element } };
  });
  const update = (): void => {
    scene.setAttribute("transform", `translate(${state.viewport.x} ${state.viewport.y}) scale(${state.viewport.zoom})`);
    // Enlarge spacing, not markers/hit targets/text: otherwise zoom preserves every overlap.
    for (const { point, group } of groups) group.setAttribute("transform",
      `translate(${point.x} ${point.y}) scale(${1 / Math.max(1, state.viewport.zoom)}) translate(${-point.x} ${-point.y})`);
  };
  const highlight = (): void => {
    const nearest = new Set(nodes.get(state.selected ?? "")?.neighbors.map((neighbor) => neighbor.path));
    for (const { edge, element } of lines) {
      const selected = edge.left === state.selected && nearest.has(edge.right) || edge.right === state.selected && nearest.has(edge.left);
      element.setAttribute("data-highlight", String(selected));
    }
    for (const { path, group } of groups) group.setAttribute("data-selected", String(path === state.selected));
    for (const { label, connector } of groups) { label.element.setAttribute("x", String(label.x)); label.element.setAttribute("y", String(label.y)); connector.setAttribute("data-linked", "false"); }
    const permanent = groups.filter((item) => item.path !== focus?.path && (labeled.includes(item.path) || item.path === state.selected))
      .sort((a, b) => Number(b.path === state.selected) - Number(a.path === state.selected) || labeled.indexOf(a.path) - labeled.indexOf(b.path));
    const placement = separateSemanticLabels(permanent.map((item) => ({ path: item.path, ...item.label,
      width: item.label.element.getComputedTextLength?.() })), labelObstacles);
    placement.forEach((position, i) => {
      const { label, point, connector } = permanent[i];
      label.element.setAttribute("x", String(position.x)); label.element.setAttribute("y", String(position.y));
      const moved = Math.hypot(position.x - label.x, position.y - label.y) > 1;
      connector.setAttribute("data-linked", String(moved));
      // Finish at the nearest label edge; the text and leader never intercept input.
      const x = Math.max(position.left - 6, Math.min(position.right + 6, point.x));
      const y = Math.max(position.y - 12, Math.min(position.y + 12, point.y));
      const distance = Math.hypot(x - point.x, y - point.y) || 1;
      connector.setAttribute("x1", String(point.x + (x - point.x) * point.radius / distance));
      connector.setAttribute("y1", String(point.y + (y - point.y) * point.radius / distance));
      connector.setAttribute("x2", String(x)); connector.setAttribute("y2", String(y));
    });
  };
  const select = (path: string, center = false): void => {
    const point = positions.get(path); if (!point) return;
    state.selected = path;
    if (center) { state.viewport = panGraph({ ...state.viewport, x: 0, y: 0 }, 500 - point.x * state.viewport.zoom, 500 - point.y * state.viewport.zoom, SEMANTIC_MAP_MAX_ZOOM); update(); }
    highlight(); onSelect(path);
  };
  update(); highlight();
  const dispose = bindGraphViewport(svg, state, update, "data-global-map-node", (path) => select(path), SEMANTIC_MAP_MAX_ZOOM);
  svg.setAttribute("data-layout-ms", String(laidOut - started));
  svg.setAttribute("data-render-ms", String(performance.now() - laidOut));
  return { select, dispose,
    zoom: (factor: number) => { state.viewport = zoomGraph(state.viewport, factor, 500, 500, SEMANTIC_MAP_MAX_ZOOM); update(); },
    reset: () => { state.viewport = fitGraph(); update(); },
    fit: () => {
      const xs = [500, ...groups.map(({ point }) => point.x)], ys = [500, ...groups.map(({ point }) => point.y)];
      const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      const zoom = clampZoom(880 / Math.max(120, right - left, bottom - top), SEMANTIC_MAP_MAX_ZOOM);
      state.viewport = { zoom, x: 500 - (left + right) / 2 * zoom, y: 500 - (top + bottom) / 2 * zoom }; update();
    } };
}
