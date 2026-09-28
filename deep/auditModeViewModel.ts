import { t } from "../i18n";
import type { IndexStats } from "../noteIndex";

/** Presentation of the legacy note index, independent of the semantic embedding index. */
export function auditModeViewModel(stats: IndexStats) {
  const pending = stats.stale + stats.unseen;
  const context = t(stats.total > 0 && stats.unseen === stats.total ? "@audit.first-run"
    : pending === 0 ? "@audit.current" : "@audit.changed", { count: pending });
  return { context, cards: (["changes", "full", "overview"] as const).map((mode) => ({
    mode, title: t(`@audit.${mode}.title`), subtitle: t(`@audit.${mode}.subtitle`),
    count: mode === "full" ? stats.total : pending,
    work: t("@audit.notes", { count: mode === "full" ? stats.total : pending }),
    lines: [t(`@audit.${mode}.cache`), t(`@audit.${mode}.result`), t(`@audit.${mode}.when`)],
  })) };
}
