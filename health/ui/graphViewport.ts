export interface Viewport { readonly x: number; readonly y: number; readonly zoom: number }
export const fitGraph = (): Viewport => ({ x: 0, y: 0, zoom: 1 });
export function clampZoom(value: number): number { return Number.isFinite(value) ? Math.max(0.4, Math.min(4, value)) : 1; }
export function panGraph(view: Viewport, dx: number, dy: number): Viewport {
  const bound = (n: number): number => Number.isFinite(n) ? Math.max(-4000, Math.min(4000, n)) : 0;
  return { x: bound(view.x + dx), y: bound(view.y + dy), zoom: clampZoom(view.zoom) };
}
export function zoomGraph(view: Viewport, factor: number, x: number, y: number): Viewport {
  const zoom = clampZoom(view.zoom * factor); const ratio = zoom / clampZoom(view.zoom);
  return panGraph({ x: view.x, y: view.y, zoom }, (x - view.x) * (1 - ratio), (y - view.y) * (1 - ratio));
}
