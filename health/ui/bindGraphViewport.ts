import { panGraph, zoomGraph } from "./graphViewport";
import type { Viewport } from "./graphViewport";

/** Shared topology/semantic pointer contract; coordinates use the SVG screen transform. */
export function bindGraphViewport(svg: SVGSVGElement, state: { viewport: Viewport }, update: () => void,
  nodeAttribute: string, onSelect: (path: string) => void): () => void {
  let pointer: { id: number; startX: number; startY: number; lastX: number; lastY: number; dragged: boolean; node?: string } | undefined;
  const pointInSvg = (event: { clientX: number; clientY: number }): { x: number; y: number } | undefined => {
    const matrix = svg.getScreenCTM();
    if (!matrix) return undefined;
    const point = svg.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  };
  const down = (event: PointerEvent): void => {
    if (event.button !== 0 || pointer) return;
    const point = pointInSvg(event); if (!point) return;
    const target = event.target as Element | null;
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, lastX: point.x, lastY: point.y, dragged: false,
      node: target?.closest(`[${nodeAttribute}]`)?.getAttribute(nodeAttribute) ?? undefined };
    svg.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent): void => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const point = pointInSvg(event); if (!point) return;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 5) pointer.dragged = true;
    if (pointer.dragged) {
      state.viewport = panGraph(state.viewport, point.x - pointer.lastX, point.y - pointer.lastY); update();
      pointer.lastX = point.x; pointer.lastY = point.y;
    }
  };
  const release = (): void => {
    const id = pointer?.id; pointer = undefined;
    if (id !== undefined && svg.hasPointerCapture(id)) svg.releasePointerCapture(id);
  };
  const up = (event: PointerEvent): void => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const selected = !pointer.dragged && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) <= 5 ? pointer.node : undefined;
    release(); if (selected) onSelect(selected);
  };
  const cancel = (event: PointerEvent): void => { if (pointer?.id === event.pointerId) release(); };
  const wheel = (event: WheelEvent): void => {
    event.preventDefault(); const point = pointInSvg(event); if (!point) return;
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1);
    state.viewport = zoomGraph(state.viewport, Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.002), point.x, point.y); update();
  };
  if (state) {
    svg.addEventListener("pointerdown", down); svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up); svg.addEventListener("pointercancel", cancel); svg.addEventListener("lostpointercapture", cancel);
    svg.addEventListener("wheel", wheel, { passive: false });
  }
  return () => {
    release(); svg.removeEventListener("pointerdown", down); svg.removeEventListener("pointermove", move);
    svg.removeEventListener("pointerup", up); svg.removeEventListener("pointercancel", cancel); svg.removeEventListener("lostpointercapture", cancel);
    svg.removeEventListener("wheel", wheel);
  };
}
