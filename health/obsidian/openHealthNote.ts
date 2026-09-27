import { TFile } from "obsidian";
import type { App } from "obsidian";
import { isVaultPath } from "../domain/validation";
import { defaultLocalVaultScope } from "../analyzers/local/localVaultSource";

export function resolveHealthNote(app: App, path: string | undefined): TFile | undefined {
  if (!isVaultPath(path) || !defaultLocalVaultScope(app.vault.configDir).includes(path)) return undefined;
  const file = app.vault.getAbstractFileByPath(path);
  return file instanceof TFile && file.extension.toLowerCase() === "md" ? file : undefined;
}

/** Navigation only. Resolve again at click time; never dispatch persisted FindingAction kinds. */
export async function openHealthNote(app: App, path: string | undefined): Promise<boolean> {
  try {
    const file = resolveHealthNote(app, path);
    if (!file) return false;
    await app.workspace.getLeaf("tab").openFile(file);
    return true;
  } catch { return false; }
}

/** Public typed split API; only creates leaves, never replaces or closes unrelated ones. */
export async function openHealthNotePair(app: App, leftPath: string, rightPath: string): Promise<boolean> {
  try {
    const left = resolveHealthNote(app, leftPath), right = resolveHealthNote(app, rightPath);
    if (!left || !right) return false;
    const first = app.workspace.getLeaf("tab");
    await first.openFile(left);
    // Opening the first note yields to the host; resolve the second again before navigation.
    const currentRight = resolveHealthNote(app, rightPath);
    if (!currentRight) return false;
    await app.workspace.createLeafBySplit(first, "vertical").openFile(currentRight);
    return true;
  } catch { return false; }
}
