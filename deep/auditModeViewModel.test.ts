import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auditModeViewModel } from "./auditModeViewModel";
import { collectDeepAuditFiles } from "./deepScope";
import { deepFixture } from "./testSupport";
import { NoteIndexManager } from "../noteIndex";
import type { NoteRecord } from "../noteIndex";
import { SingleAuditEngine, DeepAuditEngine } from "../deepAudit";
import { DEFAULT_SETTINGS } from "../settings";
import { callOpenRouter } from "../api";
import { setLanguage } from "../i18n";
vi.mock("obsidian", () => ({ Modal: class {}, Notice: class {}, PluginSettingTab: class {}, getLanguage: () => "en" }));
vi.mock("../api", () => ({ callOpenRouter: vi.fn() }));
beforeEach(() => { vi.stubGlobal("window", { setTimeout: (fn: () => void) => setTimeout(fn, 0) }); setLanguage("en"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const record: NoteRecord = { mtime: 1, analyzedAt: 1, mainIdea: "Synthetic", keyPoints: [], entities: [], quality: "developed", suggestedTags: [], wordCount: 1, mode: "single" };

describe("audit choices reflect existing work and cache semantics", () => {
  it.each(["en", "ru"] as const)("shows comparable counts and localized first/current/changed states in %s", (language) => {
    setLanguage(language);
    const f = deepFixture(Array.from({ length: 500 }, (_, i) => `${i}.md`)); const index = new NoteIndexManager(f.app);
    const model = () => auditModeViewModel(index.stats(collectDeepAuditFiles(f.app)));
    expect(model().cards.map(c => c.count)).toEqual([500, 500, 500]);
    expect(model().context).toContain(language === "en" ? "First run" : "Первый запуск");
    expect(model().cards.map(c => c.title)).toEqual(language === "en"
      ? ["Detailed audit of changes", "Full detailed audit", "Overview audit + report"]
      : ["Детальный аудит изменений", "Полный детальный аудит", "Обзорный аудит + отчёт"]);
    for (const file of f.files) index.set(file.path, { ...record });
    expect(model().cards.map(c => c.count)).toEqual([0, 500, 0]);
    expect(model().context).toContain(language === "en" ? "No new or changed" : "Новых и изменённых заметок нет");
    for (const file of f.files.slice(0, 12)) file.stat.mtime++;
    expect(model().cards.map(c => c.count)).toEqual([12, 500, 12]);
    expect(model().context).toContain("12");
    expect(JSON.stringify(model())).not.toMatch(/@audit|Recommended|Рекомендуется|~50/);
    expect(model().cards[2].lines[0]).toContain(language === "en" ? "excluded" : "не входят");
  });
  it.each([true, false])("matches detailed engine eligibility and onlyStale=%s without changing index mode", async onlyStale => {
    const f = deepFixture(["A.md", "B.md", "Templates/T.md", "Private/Config/X.md", ".ai-backup/X.md", "Notes/.hidden.md"]);
    const index = new NoteIndexManager(f.app); index.set("A.md", { ...record });
    f.vault.read.mockResolvedValue("Synthetic note");
    vi.mocked(callOpenRouter).mockReset().mockResolvedValue(JSON.stringify(record));
    const expected = auditModeViewModel(index.stats(collectDeepAuditFiles(f.app))).cards[onlyStale ? 0 : 1].count;
    const report = await new SingleAuditEngine(f.app, DEFAULT_SETTINGS, index, { onlyStale, delayMs: 0 }).run();
    expect(report.processedFiles).toBe(expected); expect(report.totalFiles).toBe(2);
    expect(callOpenRouter).toHaveBeenCalledTimes(onlyStale ? 1 : 2);
    expect(index.get("B.md")?.mode).toBe("single");
    expect(index.stats(collectDeepAuditFiles(f.app)).fresh).toBe(2);
  });
  it("overview skips current notes and synthesizes only the changed subset", async () => {
    const f = deepFixture(["A.md", "B.md"]); const index = new NoteIndexManager(f.app); index.set("A.md", { ...record });
    vi.mocked(callOpenRouter).mockReset()
      .mockResolvedValueOnce(JSON.stringify([{ path: "B.md", basename: "B", topics: [], keyIdeas: "Synthetic", entities: [], quality: "developed", wordCount: 2 }]))
      .mockResolvedValueOnce("[]").mockResolvedValueOnce('{"globalInsights":[],"actionPlan":[]}');
    const report = await new DeepAuditEngine(f.app, DEFAULT_SETTINGS, { delayBetweenBatchesMs: 0 }, index).run();
    expect(report.processedFiles).toBe(1);
    expect(new Set(f.vault.cachedRead.mock.calls.map(([f]) => f.path))).toEqual(new Set(["B.md"]));
    expect(index.get("A.md")).toEqual(record);
  });
});
