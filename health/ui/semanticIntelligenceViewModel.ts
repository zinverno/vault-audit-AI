import { t } from "../../i18n";
import { semanticIndexFailureMessage } from "../../utils/semanticIndexDiagnostics";
import type { SemanticIndexProgress } from "../../utils/semanticIndexDiagnostics";
import type { SemanticIntelligenceSnapshot, SemanticSetupMode, SemanticSetupResult } from "../semanticIntelligencePort";

export type SemanticAction = "enable" | "change" | "check" | "build" | "rebuild" | "search";

export function semanticSetupCopy(mode: SemanticSetupMode): { title: string; provider: string; privacy: string } {
  return { title: t(`@semantic.mode.${mode}`), provider: t(`@semantic.provider.${mode}`), privacy: t(`@semantic.privacy.${mode}`) };
}

export function semanticSetupError(result: SemanticSetupResult | undefined, mode: SemanticSetupMode): string | undefined {
  if (!result || result.ok) return undefined;
  return t(result.reason === "connection" && mode === "local" ? "@semantic.local-failed" : `@semantic.error.${result.reason}`);
}

export function semanticIntelligenceViewModel(snapshot: SemanticIntelligenceSnapshot, connected = false) {
  const mode = snapshot.provider === "ollama" ? "local" : snapshot.provider === "openrouter" ? "cloud" : "custom";
  const indexRequired = snapshot.state === "configured" && (snapshot.indexRequired || connected);
  const state = indexRequired ? "index-required" : snapshot.state;
  const actions: SemanticAction[] = snapshot.state === "disabled" ? ["enable"]
    : snapshot.state === "ready" ? ["search", "change"]
    : snapshot.state === "incompatible" ? ["rebuild", "change"]
    : snapshot.state === "error" ? ["check", "change"]
    : snapshot.state === "configured" ? indexRequired ? ["build", "change"] : ["check", "build", "change"] : [];
  const working = snapshot.operation === "connect" ? "@semantic.connecting"
    : snapshot.operation === "build" || snapshot.operation === "rebuild" || snapshot.progress ? "@semantic.building" : "@semantic.working";
  const batch = !snapshot.busy && (snapshot.failure === "provider-request" || snapshot.failure === "provider-response")
    ? snapshot.rejectedBatch : undefined;
  return {
    title: t("@semantic.title"), status: t(snapshot.busy ? working : `@semantic.state.${state}`),
    description: !snapshot.busy && snapshot.failure ? semanticIndexFailureMessage(snapshot.failure) : t(`@semantic.description.${state}`),
    progress: snapshot.busy && snapshot.progress ? semanticProgressViewModel(snapshot.progress) : undefined,
    rejectedBatch: batch ? [
      t("@semantic.progress.batch", { current: batch.batchCurrent, total: batch.batchTotal }),
      t("@semantic.batch.inputs", { n: batch.inputCount }),
      t("@semantic.batch.largest", { n: batch.largestInputChars }),
      t("@semantic.batch.total", { n: batch.totalInputChars }),
      t("@semantic.batch.help"),
    ] : undefined,
    details: snapshot.enabled ? `${mode === "custom" ? t("@semantic.mode.custom") : snapshot.providerLabel} · ${snapshot.model}` : undefined,
    vectors: snapshot.state === "ready" ? t("@semantic.vectors", { n: snapshot.vectorCount }) : undefined,
    privacy: semanticSetupCopy(mode).privacy,
    actions: actions.map((action) => ({ id: action, label: t(`@semantic.action.${action}`) })),
  };
}

function semanticProgressViewModel(progress: SemanticIndexProgress) {
  const numeric = progress.chunksTotal !== undefined && progress.chunksTotal > 0 && progress.chunksCompleted !== undefined;
  return {
    stage: t(`@semantic.progress.${progress.phase}`),
    documents: progress.documentsTotal === undefined ? undefined : t("@semantic.progress.documents", { n: progress.documentsTotal }),
    chunks: numeric ? t("@semantic.progress.chunks", { current: progress.chunksCompleted!, total: progress.chunksTotal! }) : undefined,
    batch: progress.batchCurrent === undefined ? undefined : t("@semantic.progress.batch", { current: progress.batchCurrent, total: progress.batchTotal! }),
    retry: progress.phase === "retrying" ? t("@semantic.progress.retry", { current: progress.retryAttempt! + 1, total: progress.retryMaximum! + 1 }) : undefined,
    reason: progress.phase === "retrying" ? t(`@semantic.progress.${progress.retryReason}`) : undefined,
    value: numeric ? progress.chunksCompleted : undefined,
    max: numeric ? progress.chunksTotal : undefined,
  };
}
