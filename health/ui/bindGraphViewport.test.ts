import { describe, expect, it, vi } from "vitest";
import { bindGraphViewport } from "./bindGraphViewport";
import { fitGraph, panGraph, zoomGraph } from "./graphViewport";

describe("shared graph pointer lifecycle", () => {
  it("anchors semantic zoom in SVG coordinates, permits access to the whole map at 24x, and resets exactly", () => {
    let view = panGraph(fitGraph(), 35, -20, 24);
    const anchor = { x: 200, y: 750 };
    const world = { x: (anchor.x - view.x) / view.zoom, y: (anchor.y - view.y) / view.zoom };
    for (const factor of [2, 5, 100, 0.5]) {
      view = zoomGraph(view, factor, anchor.x, anchor.y, 24);
      expect(world.x * view.zoom + view.x).toBeCloseTo(anchor.x);
      expect(world.y * view.zoom + view.y).toBeCloseTo(anchor.y);
      expect(view.zoom).toBeLessThanOrEqual(24);
    }
    expect(zoomGraph(view, 0.0001, 500, 500, 24).zoom).toBe(0.4);
    expect(panGraph({ x: 0, y: 0, zoom: 24 }, 500 - 900 * 24, 500 - 900 * 24, 24)).toEqual({ x: -21100, y: -21100, zoom: 24 });
    view = fitGraph(); expect(view).toEqual({ x: 0, y: 0, zoom: 1 });
  });
  it("uses screen coordinates, clamps zoom, suppresses drag selection, and releases capture/listeners", () => {
    const listeners = new Map<string, (event: unknown) => void>(); let captured: number | undefined;
    const svg = { addEventListener: (name: string, fn: (event: unknown) => void) => listeners.set(name, fn),
      removeEventListener: (name: string) => listeners.delete(name), getScreenCTM: () => ({ inverse: () => ({}) }),
      createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }),
      setPointerCapture: (id: number) => { captured = id; }, hasPointerCapture: (id: number) => captured === id,
      releasePointerCapture: () => { captured = undefined; } };
    const state = { viewport: fitGraph() }; const update = vi.fn(), select = vi.fn();
    const dispose = bindGraphViewport(svg as unknown as SVGSVGElement, state, update, "data-node", select);
    const event = { pointerId: 1, clientX: 100, clientY: 100, button: 0, target: { closest: () => ({ getAttribute: () => "id-123" }) } };
    listeners.get("pointerdown")!(event); listeners.get("pointerup")!({ ...event, clientX: 103 });
    expect(select).toHaveBeenCalledWith("id-123"); expect(captured).toBeUndefined(); select.mockClear();
    listeners.get("pointerdown")!(event); listeners.get("pointermove")!({ ...event, clientX: 130 }); listeners.get("pointerup")!(event);
    expect(state.viewport.x).toBe(30); expect(select).not.toHaveBeenCalled();
    listeners.get("pointerdown")!(event); listeners.get("pointerup")!({ ...event, clientX: 130 }); expect(select).not.toHaveBeenCalled();
    listeners.get("pointerdown")!(event); listeners.get("pointercancel")!(event); expect(captured).toBeUndefined();
    const preventDefault = vi.fn(); for (let i = 0; i < 20; i++) listeners.get("wheel")!({ ...event, deltaMode: 0, deltaY: -1000, preventDefault });
    expect(state.viewport.zoom).toBe(4); expect(preventDefault).toHaveBeenCalledTimes(20);
    listeners.get("pointerdown")!(event); dispose(); expect(captured).toBeUndefined(); expect(listeners.size).toBe(0);
  });
});
