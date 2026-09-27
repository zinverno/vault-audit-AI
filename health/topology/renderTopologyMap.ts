import { bindGraphViewport } from "../ui/bindGraphViewport";
import { t } from "../../i18n";
import { fitTopology, layoutTopology, panTopology } from "./topologyLayout";
import type { TopologyLayout, Viewport } from "./topologyLayout";
import { topologyRelationships } from "./topologyPresentation";
import type { VaultTopologySnapshot } from "./types";

const layouts = new WeakMap<VaultTopologySnapshot, TopologyLayout>();
export interface TopologyViewState { selected?: string; query: string; viewport: Viewport }
export function newTopologyViewState(): TopologyViewState { return { query: "", viewport: fitTopology() }; }

/** SVG is pointer-oriented. Search and the inspector provide the complete keyboard route. */
export function renderTopologyMap(parent: HTMLElement, map: VaultTopologySnapshot, state?: TopologyViewState, onSelect?: (path: string) => void) {
  const started = performance.now();
  let layout = layouts.get(map);
  if (!layout) { layout = layoutTopology(map); layouts.set(map, layout); }
  const laidOut = performance.now();
  const positions = new Map(layout.points.map((point) => [point.path, point]));
  const nodes = new Map(map.nodes.map((node) => [node.path, node]));
  const presentation = topologyRelationships(map);
  const svg = parent.createSvg("svg", { cls: "veynrel-topology-svg", attr: { viewBox: "0 0 1000 1000", "aria-hidden": "true", focusable: "false" } });
  const scene = svg.createSvg("g");
  for (const box of layout.components) scene.createSvg("rect", { cls: "veynrel-topology-boundary", attr: {
    x: String(box.x), y: String(box.y), width: String(box.width), height: String(box.height), rx: "16" } });
  const lines = presentation.relationships.map((edge) => {
    const source = positions.get(edge.source)!; const target = positions.get(edge.target)!;
    const element = scene.createSvg("line", { cls: "veynrel-topology-edge", attr: { x1: String(source.x), y1: String(source.y), x2: String(target.x), y2: String(target.y),
      "data-reciprocal": String(edge.reciprocal) } });
    return { ...edge, element };
  });
  const circles = layout.points.map((point) => {
    const node = nodes.get(point.path)!;
    const group = scene.createSvg("g", { cls: "veynrel-topology-node", attr: { "data-topology-node": node.id,
      "data-orphan": String(node.orphan), "data-connector": String(node.connector), "data-unknown": String(!map.complete && node.degree === 0) } });
    group.createSvg("circle", { cls: "veynrel-topology-dot", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius) } });
    if (node.connector) group.createSvg("circle", { cls: "veynrel-topology-ring", attr: { cx: String(point.x), cy: String(point.y), r: String(point.radius + 3) } });
    group.createSvg("title").textContent = node.path;
    return { path: node.path, group };
  });
  const label = scene.createSvg("text", { cls: "veynrel-topology-label" });
  const transform = (): void => {
    const view = state?.viewport ?? fitTopology();
    scene.setAttribute("transform", `translate(${view.x} ${view.y}) scale(${view.zoom})`);
  };
  const highlight = (path?: string): void => {
    const adjacent = new Set<string>();
    for (const edge of lines) {
      const incoming = edge.target === path || edge.reciprocal && edge.source === path;
      const outgoing = edge.source === path || edge.reciprocal && edge.target === path;
      edge.element.setAttribute("data-direction", incoming && outgoing ? "both" : incoming ? "incoming" : outgoing ? "outgoing" : "none");
      if (incoming || outgoing) { adjacent.add(edge.source); adjacent.add(edge.target); }
    }
    svg.setAttribute("data-selection", String(Boolean(path)));
    for (const circle of circles) {
      circle.group.setAttribute("data-selected", String(circle.path === path));
      circle.group.setAttribute("data-neighbor", String(adjacent.has(circle.path)));
    }
    const point = path ? positions.get(path) : undefined;
    label.textContent = point ? nodes.get(point.path)!.basename : "";
    if (point) { label.setAttribute("x", String(point.x + point.radius + 6)); label.setAttribute("y", String(point.y - point.radius - 6)); }
  };
  const select = (path: string, center = false): void => {
    const point = positions.get(path);
    if (!point || !state) return;
    state.selected = path;
    if (center) { state.viewport = panTopology({ ...state.viewport, x: 0, y: 0 }, 500 - point.x * state.viewport.zoom, 500 - point.y * state.viewport.zoom); transform(); }
    highlight(path); onSelect?.(path);
  };
  const fit = (): void => { if (state) state.viewport = fitTopology(); transform(); };
  transform(); highlight(state?.selected);
  const notice = presentation.shown < presentation.total ? t("@topology.simplified") + " · " + t("@topology.showing-links", { shown: presentation.shown, total: presentation.total }) : undefined;
  if (notice) parent.createEl("p", { text: notice, cls: "veynrel-health-muted" });
  const pathsById = new Map(map.nodes.map((node) => [node.id, node.path]));
  const dispose = state ? bindGraphViewport(svg, state, transform, "data-topology-node", (id) => { const path = pathsById.get(id); if (path) select(path); }) : () => {};
  svg.setAttribute("data-layout-ms", String(laidOut - started));
  svg.setAttribute("data-render-ms", String(performance.now() - laidOut));
  return { select, fit, dispose };
}
