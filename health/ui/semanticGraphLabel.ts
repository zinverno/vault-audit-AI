/** Text outside a node in its radial direction. No geometry changes for labels. */
export function semanticGraphLabel(point: { x: number; y: number }, radius: number) {
  const dx = point.x - 500; const dy = point.y - 500; const distance = Math.hypot(dx, dy);
  if (distance < 1) return { x: point.x, y: point.y - radius - 18, anchor: "middle" };
  const ux = dx / distance; const uy = dy / distance;
  return { x: point.x + ux * (radius + 12), y: point.y + uy * (radius + 12),
    anchor: Math.abs(ux) < 0.25 ? "middle" : ux > 0 ? "start" : "end" };
}
export const semanticGraphBasename = (basename: string, limit = 22): string => {
  const characters = Array.from(basename);
  return characters.length > limit ? characters.slice(0, limit - 1).join("") + "…" : basename;
};

/** At most six permanent global labels. Stagger text only; semantic node positions never move. */
export function separateSemanticLabels(labels: readonly { path: string; text: string; x: number; y: number; anchor: string }[]) {
  const boxes: Array<{ left: number; right: number; y: number }> = [];
  return labels.map((label) => {
    const width = Array.from(label.text).length * 10;
    const left = Math.max(16, Math.min(984 - width, label.x - (label.anchor === "end" ? width : label.anchor === "middle" ? width / 2 : 0)));
    let y = Math.max(20, Math.min(980, label.y));
    const direction = y < 500 ? -1 : 1;
    for (let attempt = 0; attempt < 12 && boxes.some((box) => left < box.right + 8 && left + width + 8 > box.left && Math.abs(y - box.y) < 24); attempt++) {
      y = Math.max(20, Math.min(980, label.y + direction * (attempt + 1) * 26));
    }
    boxes.push({ left, right: left + width, y });
    return { path: label.path, x: left + (label.anchor === "end" ? width : label.anchor === "middle" ? width / 2 : 0), y };
  });
}
