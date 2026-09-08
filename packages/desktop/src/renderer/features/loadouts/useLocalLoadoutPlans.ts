import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEmptyLocalLoadoutPlanDraft,
  createLocalLoadoutPlanDraftFromInGameLoadout,
  createLocalLoadoutPlanDraftFromCharacter,
  selectLocalLoadoutPlanWorkbench,
  toLocalLoadoutPlanDraft
} from "@d2-tools/app/loadouts";
import type { CharacterSummary } from "@d2-tools/core/account/summary";
import type { CreateLocalLoadoutPlanInput, LocalLoadoutPlan } from "@d2-tools/core/loadouts/plans";
import { matchLocalLoadoutPlan } from "@d2-tools/core/loadouts/plans";
import {
  createLocalLoadoutPlanExecutionPlan,
  createLocalLoadoutPlanPublishPlan,
  validateLocalLoadoutPlanExecutionPlan,
  validateLocalLoadoutPlanPublishPlan,
  verifyLocalLoadoutPlanPublishPlan,
  type LocalLoadoutPlanExecutionPlan,
  type LocalLoadoutPlanPublishPlan
} from "@d2-tools/core/loadouts/localPlanExecution";
import type { DimLoadoutImportPreview } from "@d2-tools/core/loadouts/dimImport";
import type { BuildGuideLoadoutDraft } from "@d2-tools/core/assistant/guideSchema";
import type { GuideSourceReadPreview } from "@d2-tools/core/guides/source";
import type {
  AssistantLoadoutArtifact,
  AssistantEquipmentTargetCandidatesArtifact
} from "@d2-tools/app/capabilities";
import type { ActionVerificationStatus } from "@d2-tools/core/actions/log";
import { api } from "../../api/client";
import { useAccountSummaryStore } from "../../shared/stores/accountEntityStore";

const legacyGuideTaskContextStorageKey = "d2-tools.assistant.task-context";

export type LocalPlanExecutionReport = {
  plan: LocalLoadoutPlanExecutionPlan;
  completed_steps: string[];
  failed_step?: string;
  error?: string;
  confirmation_id?: string;
  execution_id?: string;
  verification_status?: ActionVerificationStatus;
  verification_logged?: boolean;
  preflight_verified: boolean;
  refresh_verified: boolean;
};

export type LocalPlanPublishReport = {
  plan: LocalLoadoutPlanPublishPlan;
  confirmation_id: string;
  execution_id: string;
  preflight_verified: boolean;
  verification_status?: ActionVerificationStatus;
  verification_logged?: boolean;
  error?: string;
};

export function useLocalLoadoutPlans(input: {
  refreshAccount: () => Promise<ReturnType<typeof useAccountSummaryStore> | null>;
}) {
  const accountSummary = useAccountSummaryStore();
  const [plans, setPlans] = useState<LocalLoadoutPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CreateLocalLoadoutPlanInput | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [dimPreview, setDimPreview] = useState<DimLoadoutImportPreview | null>(null);
  const [isPreviewingDim, setIsPreviewingDim] = useState(false);
  const [isImportingGuide, setIsImportingGuide] = useState(false);
  const [legacyGuideText, setLegacyGuideText] = useState(readLegacyGuideText);
  const [assistantPrefill, setAssistantPrefill] = useState<(AssistantLoadoutArtifact & { request_id: number }) | null>(null);
  const [executionReport, setExecutionReport] = useState<LocalPlanExecutionReport | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [publishReport, setPublishReport] = useState<LocalPlanPublishReport | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    setExecutionReport(null);
    setPublishReport(null);
  }, [draft]);

  useEffect(() => {
    setPublishReport(null);
  }, [executionReport?.execution_id]);

  const applyPlans = useCallback((nextPlans: LocalLoadoutPlan[], preferredId = selectedPlanId) => {
    const selected = nextPlans.find((plan) => plan.id === preferredId) ?? nextPlans[0] ?? null;
    setPlans(nextPlans);
    setSelectedPlanId(selected?.id ?? "");
  }, [selectedPlanId]);

  const reload = useCallback(async () => {
    try {
      applyPlans(await api.listLocalLoadoutPlans());
      setError("");
    } catch {
      applyPlans([]);
      setError("应用配装读取失败，请检查本地数据目录后重试。");
    }
  }, [applyPlans]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const workspace = useMemo(() => selectLocalLoadoutPlanWorkbench({
    accountSummary,
    plans,
    selectedPlanId
  }), [accountSummary, plans, selectedPlanId]);

  const isDraftDirty = useMemo(() => {
    if (!draft) return false;
    if (!editingPlanId) return true;
    const savedPlan = plans.find((plan) => plan.id === editingPlanId);
    if (!savedPlan) return true;
    return JSON.stringify(draft) !== JSON.stringify(toLocalLoadoutPlanDraft(savedPlan));
  }, [draft, editingPlanId, plans]);

  const executionPlan = useMemo(() => {
    if (!draft || !accountSummary || !draft.target_character_id) return null;
    try {
      return createLocalLoadoutPlanExecutionPlan({
        plan: draft,
        account: accountSummary,
        target_character_id: draft.target_character_id
      });
    } catch {
      return null;
    }
  }, [accountSummary, draft]);

  const selectPlan = useCallback((id: string) => {
    const plan = plans.find((candidate) => candidate.id === id);
    if (!plan) return;
    setSelectedPlanId(plan.id);
    setEditingPlanId(null);
    setDraft(null);
    setError("");
    setExecutionReport(null);
  }, [plans]);

  const editPlan = useCallback((id: string) => {
    const plan = plans.find((candidate) => candidate.id === id);
    if (!plan) return;
    setSelectedPlanId(plan.id);
    setEditingPlanId(plan.id);
    setDraft(toLocalLoadoutPlanDraft(plan));
    setError("");
    setExecutionReport(null);
  }, [plans]);

  const startNewPlan = useCallback((character: CharacterSummary | null) => {
    if (!character) return;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft(createEmptyLocalLoadoutPlanDraft({
      class_name: character.class_name,
      target_character_id: character.character_id
    }));
    setError("");
    setExecutionReport(null);
  }, []);

  const startFromCurrentCharacter = useCallback((character: CharacterSummary | null) => {
    if (!character) return;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft(createLocalLoadoutPlanDraftFromCharacter(character));
    setError("");
    setExecutionReport(null);
  }, []);

  const startFromInGameLoadout = useCallback((character: CharacterSummary, slot: CharacterSummary["loadout_slots"][number]) => {
    if (!accountSummary) return;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft(createLocalLoadoutPlanDraftFromInGameLoadout({ accountSummary, character, slot }));
    setDimPreview(null);
    setExecutionReport(null);
    setError("");
  }, [accountSummary]);

  const closeEditor = useCallback(() => {
    setDraft(null);
    setEditingPlanId(null);
    setError("");
    setDimPreview(null);
    setExecutionReport(null);
  }, []);

  const previewDimImport = useCallback(async (url: string) => {
    if (isPreviewingDim) return;
    setIsPreviewingDim(true);
    setError("");
    try {
      setDimPreview(await api.previewDimLoadoutImport(url));
    } catch (previewError) {
      const message = previewError instanceof Error ? previewError.message : String(previewError);
      setDimPreview(null);
      setError(`DIM 完整链接导入失败：${message}`);
    } finally {
      setIsPreviewingDim(false);
    }
  }, [isPreviewingDim]);

  const acceptDimImport = useCallback((character: CharacterSummary | null) => {
    if (!dimPreview || !character) return;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft({
      ...dimPreview.draft,
      class_name: dimPreview.draft.class_name === "未限定职业" ? character.class_name : dimPreview.draft.class_name,
      target_character_id: character.character_id
    });
    setDimPreview(null);
    setExecutionReport(null);
    setError("");
  }, [dimPreview]);

  const dismissDimImport = useCallback(() => setDimPreview(null), []);

  const startFromGuideDraft = useCallback((
    guide: BuildGuideLoadoutDraft,
    assistantArtifact?: AssistantLoadoutArtifact,
    sourcePreview?: GuideSourceReadPreview
  ) => {
    const target = accountSummary?.characters.find((character) => character.character_id === guide.character_id) ?? null;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft({
      name: assistantArtifact?.kind === "armor_solution_comparison"
        ? assistantArtifact.title
        : guide.name || "攻略配装",
      class_name: guide.class_name || target?.class_name || "未限定职业",
      target_character_id: guide.character_id || target?.character_id,
      source: {
        kind: assistantArtifact?.kind === "armor_solution_comparison" ? "armor-plan" : "guide",
        ...(sourcePreview?.final_url ? { reference_url: sourcePreview.final_url } : {}),
        label: assistantArtifact?.kind === "armor_solution_comparison"
          ? "AI 护甲方案交接"
          : assistantArtifact
            ? "AI 工作台交接"
            : sourcePreview
              ? [sourcePreview.title, sourcePreview.author].filter(Boolean).join(" · ") || "攻略链接"
              : "攻略解析"
      },
      item_targets: guide.items.map((item, index) => ({
        slot: item.bucket_name || `攻略目标 ${index + 1}`,
        item_hash: item.hash,
        ...(item.instance_id ? { selected_instance_id: item.instance_id } : {}),
        plug_hashes: [],
        notes: item.reason
      })),
      ...(guide.armor_constraint_draft
        ? { armor_constraints: guide.armor_constraint_draft.constraints }
        : {}),
      notes: guide.notes.join("\n") || undefined,
      guidance: {
        raw_text: guide.raw_text,
        warnings: [
          ...(sourcePreview?.warnings ?? []),
          ...guide.missing_requirements,
          ...(guide.armor_constraint_draft?.warnings ?? []),
          ...(guide.armor_constraint_draft?.confirmations.map((item) => `待确认：${item}`) ?? [])
        ],
        evidence: [
          ...(sourcePreview ? [
            `攻略来源：${sourcePreview.final_url}`,
            `正文读取：${sourcePreview.reader === "dynamic-page" ? "动态页面" : "静态页面"}${sourcePreview.media_count ? ` · ${sourcePreview.media_count} 个媒体内容` : ""}`
          ] : []),
          ...guide.notes,
          ...(assistantArtifact ? [
            `AI 上下文快照：${assistantArtifact.source_snapshot_id}`,
            ...assistantArtifact.result_ids.map((resultId) => `AI 数据结果：${resultId}`),
            ...(assistantArtifact.kind === "armor_solution_comparison"
              ? [`Armor 底层规划结果：${assistantArtifact.source_result_id}`]
              : [])
          ] : [])
        ]
      }
    });
    setDimPreview(null);
    setExecutionReport(null);
    setError("");
  }, [accountSummary]);

  const importGuideSource = useCallback(async (sourceInput: string, character: CharacterSummary | null) => {
    const normalizedInput = sourceInput.trim();
    if (!character || !normalizedInput || isImportingGuide) return false;
    setIsImportingGuide(true);
    setError("");
    try {
      const sourcePreview = isHttpUrl(normalizedInput)
        ? await api.readGuideSource(normalizedInput)
        : undefined;
      const rawText = sourcePreview?.body.trim() || normalizedInput;
      if (!rawText) throw new Error("来源中没有可分析的攻略正文");
      const parsed = await api.parseBuildGuide({ rawText });
      const match = await api.matchBuildGuide({ requirement: parsed.requirement, characterId: character.character_id });
      const guide = await api.createGuideLoadoutDraft({
        match,
        characterId: character.character_id,
        fallbackName: sourcePreview?.title ?? rawText.split(/\r?\n/).find(Boolean) ?? "攻略配装"
      });
      const assistantArtifact = assistantPrefill
        && "raw_text" in assistantPrefill
        && assistantPrefill.raw_text === rawText
        ? assistantPrefill
        : undefined;
      startFromGuideDraft(guide, assistantArtifact, sourcePreview);
      clearLegacyGuideText();
      setLegacyGuideText("");
      setAssistantPrefill(null);
      return true;
    } catch (guideError) {
      const message = guideError instanceof Error ? guideError.message : String(guideError);
      setError(`攻略分析失败：${message}`);
      return false;
    } finally {
      setIsImportingGuide(false);
    }
  }, [assistantPrefill, isImportingGuide, startFromGuideDraft]);

  const acceptAssistantEquipmentTargets = useCallback((
    artifact: AssistantEquipmentTargetCandidatesArtifact,
    candidateIds: string[],
    character: CharacterSummary | null
  ) => {
    if (!character) return false;
    const selectedIds = new Set(candidateIds);
    const candidates = artifact.candidates.filter((candidate) => selectedIds.has(candidate.candidate_id));
    if (!candidates.length) return false;
    setSelectedPlanId("");
    setEditingPlanId(null);
    setDraft({
      name: artifact.title || "AI 装备目标",
      class_name: character.class_name,
      target_character_id: character.character_id,
      source: { kind: "assistant-targets", label: "AI 装备目标交接" },
      item_targets: candidates.map((candidate) => ({
        slot: candidate.bucket_name
          ? `${candidate.bucket_name} · ${candidate.name}`
          : candidate.name,
        item_hash: candidate.item_hash,
        ...(candidate.status === "owned-instance" && candidate.instance_id
          ? { selected_instance_id: candidate.instance_id }
          : {}),
        plug_hashes: [],
        notes: candidate.status === "owned-instance"
          ? `AI 装备目标：${candidate.name}`
          : `AI 装备目标：${candidate.name}（仅定义，待获取并选择实例）`
      })),
      guidance: {
        raw_text: artifact.raw_text,
        warnings: candidates
          .filter((candidate) => candidate.status === "definition-only")
          .map((candidate) => `${candidate.name} 当前只有装备定义，获得实例后仍需在方案中选择。`),
        evidence: [
          `AI 上下文快照：${artifact.source_snapshot_id}`,
          ...[...new Set(candidates.map((candidate) => candidate.source_result_id))]
            .map((resultId) => `AI 数据结果：${resultId}`)
        ]
      }
    });
    setDimPreview(null);
    setExecutionReport(null);
    setAssistantPrefill(null);
    setError("");
    return true;
  }, []);

  const prefillFromAssistant = useCallback((artifact: AssistantLoadoutArtifact) => {
    setAssistantPrefill((current) => ({
      ...artifact,
      request_id: (current?.request_id ?? 0) + 1
    }));
    setError("");
  }, []);

  const dismissAssistantPrefill = useCallback(() => {
    setAssistantPrefill(null);
  }, []);

  const executeDraft = useCallback(async () => {
    if (!draft || !accountSummary || !draft.target_character_id || isExecuting) return;
    if (!editingPlanId) {
      setError("请先保存应用配装，再生成并执行穿戴计划。");
      return;
    }
    const target = accountSummary.characters.find((character) => character.character_id === draft.target_character_id);
    if (!target) {
      setError("目标角色不在当前账号快照中，请刷新账号后重试。");
      return;
    }
    if (draft.class_name && draft.class_name !== "未限定职业" && draft.class_name !== target.class_name) {
      setError(`方案职业为 ${draft.class_name}，当前目标角色为 ${target.class_name}，不能直接应用。`);
      return;
    }
    const plan = createLocalLoadoutPlanExecutionPlan({ plan: draft, account: accountSummary, target_character_id: target.character_id });
    if (!plan.executable_steps.length) {
      setExecutionReport({ plan, completed_steps: [], preflight_verified: false, refresh_verified: false });
      setError(plan.gaps.length ? `没有可执行步骤：${plan.gaps.join("；")}` : "方案没有已确认的可执行实例。");
      return;
    }
    if (!window.confirm(`计划 ${plan.plan_id}\n将按顺序执行 ${plan.executable_steps.length} 个步骤。${plan.gaps.length ? `\n仍有 ${plan.gaps.length} 项缺口不会执行。` : ""}\n确认后先刷新账号复核；计划变化时不会执行任何写操作。任一步失败会停止后续操作并再次刷新账号。继续吗？`)) {
      return;
    }

    const confirmationId = createTraceId("local-loadout-confirmation");
    const executionId = createTraceId("local-loadout-execution");
    setIsExecuting(true);
    setPublishReport(null);
    setError("");
    let executionAccount = accountSummary;
    try {
      const latestAccount = await input.refreshAccount();
      if (!latestAccount) throw new Error("执行前账号刷新没有返回可用快照");
      const observedPlan = createLocalLoadoutPlanExecutionPlan({
        plan: draft,
        account: latestAccount,
        target_character_id: target.character_id
      });
      const validation = validateLocalLoadoutPlanExecutionPlan(plan, observedPlan);
      if (validation.status === "stale") {
        const message = `方案在确认后已失效：${validation.reasons.join("；")}。请检查最新账号状态并重新确认。`;
        setExecutionReport({
          plan,
          completed_steps: [],
          error: message,
          confirmation_id: confirmationId,
          execution_id: executionId,
          preflight_verified: false,
          refresh_verified: false
        });
        setError(message);
        setIsExecuting(false);
        return;
      }
      executionAccount = latestAccount;
    } catch (preflightError) {
      const message = `执行前账号复核失败：${preflightError instanceof Error ? preflightError.message : String(preflightError)}`;
      setExecutionReport({
        plan,
        completed_steps: [],
        error: message,
        confirmation_id: confirmationId,
        execution_id: executionId,
        preflight_verified: false,
        refresh_verified: false
      });
      setError(message);
      setIsExecuting(false);
      return;
    }
    const completedSteps: string[] = [];
    let failedStep: string | undefined;
    let failure: string | undefined;
    let refreshedAccount = null as typeof accountSummary | null;
    try {
      for (const step of plan.executable_steps) {
        const trace = {
          plan_id: plan.plan_id,
          confirmation_id: confirmationId,
          execution_id: executionId,
          step_id: step.id
        };
        try {
          if (step.kind === "transfer-to-vault") {
            await api.transferItem({ membership_type: executionAccount.membership_type, character_id: step.character_id, item_id: step.item_instance_id, item_reference_hash: step.item_hash, item_name: step.item_name, transfer_to_vault: true, trace });
          } else if (step.kind === "transfer-from-vault") {
            await api.transferItem({ membership_type: executionAccount.membership_type, character_id: step.character_id, item_id: step.item_instance_id, item_reference_hash: step.item_hash, item_name: step.item_name, transfer_to_vault: false, trace });
          } else if (step.kind === "equip" || step.kind === "equip-source-replacement") {
            await api.equipItem({ membership_type: executionAccount.membership_type, character_id: step.character_id, item_id: step.item_instance_id, item_name: step.item_name, wait_for_character_inventory: true, trace });
          } else if (step.socket_index !== undefined && step.plug_hash !== undefined) {
            await api.insertSocketPlug({ membership_type: executionAccount.membership_type, character_id: step.character_id, item_id: step.item_instance_id, item_name: step.item_name, socket_index: step.socket_index, plug_hash: step.plug_hash, trace });
          }
          completedSteps.push(step.id);
        } catch (stepError) {
          failedStep = step.label;
          failure = stepError instanceof Error ? stepError.message : String(stepError);
          break;
        }
      }
    } finally {
      try {
        refreshedAccount = await input.refreshAccount();
      } catch (refreshError) {
        failure = failure ?? `装备数据同步失败：${refreshError instanceof Error ? refreshError.message : String(refreshError)}`;
      }
      const targetAfterRefresh = refreshedAccount?.characters.find((character) => character.character_id === target.character_id);
      const selectedInstanceIds = draft.item_targets
        .map((item) => item.selected_instance_id)
        .filter((item): item is string => Boolean(item));
      const verified = !failedStep
        && Boolean(targetAfterRefresh)
        && matchLocalLoadoutPlan(draft, refreshedAccount ?? executionAccount).selected_count === draft.item_targets.length
        && selectedInstanceIds.every((instanceId) => targetAfterRefresh?.equipped_items.some((item) => item.instance_id === instanceId));
      const verificationStatus: ActionVerificationStatus = !refreshedAccount
        ? "unavailable"
        : verified
          ? "verified"
          : failedStep && completedSteps.length
            ? "partial"
            : "mismatch";
      const verificationMessage = buildExecutionVerificationMessage({
        status: verificationStatus,
        completedStepCount: completedSteps.length,
        totalStepCount: plan.executable_steps.length,
        failedStep,
        error: failure
      });
      let verificationLogged = true;
      try {
        await api.recordActionVerification({
          plan_id: plan.plan_id,
          confirmation_id: confirmationId,
          execution_id: executionId,
          character_id: target.character_id,
          status: verificationStatus,
          message: verificationMessage
        });
      } catch (verificationLogError) {
        verificationLogged = false;
        const logMessage = `执行验证记录写入失败：${verificationLogError instanceof Error ? verificationLogError.message : String(verificationLogError)}`;
        failure = failure ? `${failure}；${logMessage}` : logMessage;
      }
      const report = { plan, completed_steps: completedSteps, ...(failedStep ? { failed_step: failedStep } : {}), ...(failure ? { error: failure } : {}), confirmation_id: confirmationId, execution_id: executionId, verification_status: verificationStatus, verification_logged: verificationLogged, preflight_verified: true, refresh_verified: verified };
      setExecutionReport(report);
      if (failedStep) {
        setError(`已完成 ${completedSteps.length} 步；${failedStep} 失败，后续 ${plan.executable_steps.length - completedSteps.length - 1} 步未执行。${failure ?? ""}`);
      } else if (!verified) {
        setError(`已执行 ${completedSteps.length} 步，但刷新后的账号状态未完整核对通过。请检查缺口后再保存到 Bungie 槽位。`);
      }
      setIsExecuting(false);
    }
  }, [accountSummary, draft, editingPlanId, input, isExecuting]);

  const publishAppliedPlan = useCallback(async (loadoutIndex: number) => {
    if (!draft || !accountSummary || !editingPlanId || !executionReport?.refresh_verified || isPublishing || isExecuting) return;
    let plan: LocalLoadoutPlanPublishPlan;
    try {
      plan = createLocalLoadoutPlanPublishPlan({
        executionPlan: executionReport.plan,
        account: accountSummary,
        loadoutIndex
      });
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : String(planError));
      return;
    }

    if (!window.confirm([
      `保存到游戏内槽位 ${plan.plan_id}`,
      `目标：${plan.loadout_name || `槽位 ${plan.loadout_index + 1}`}`,
      plan.overwrites_existing_slot ? "该槽位已有内容，将被当前角色状态覆盖。" : "该槽位当前为空。",
      "确认后会再次刷新账号；装备状态或槽位内容变化时不会执行写入。继续吗？"
    ].join("\n"))) return;

    const confirmationId = createTraceId("local-loadout-publish-confirmation");
    const executionId = createTraceId("local-loadout-publish-execution");
    setIsPublishing(true);
    setPublishReport(null);
    setError("");

    let latestAccount: typeof accountSummary | null = null;
    try {
      latestAccount = await input.refreshAccount();
      if (!latestAccount) throw new Error("保存到游戏内槽位前，账号刷新没有返回可用快照");
    } catch (preflightError) {
      const message = `保存到游戏内槽位前，账号复核失败：${preflightError instanceof Error ? preflightError.message : String(preflightError)}`;
      setPublishReport({
        plan,
        confirmation_id: confirmationId,
        execution_id: executionId,
        preflight_verified: false,
        error: message
      });
      setError(message);
      setIsPublishing(false);
      return;
    }

    const validation = validateLocalLoadoutPlanPublishPlan(plan, latestAccount);
    if (validation.status === "stale") {
      const message = `保存计划在确认后已失效：${validation.reasons.join("；")}。请重新选择游戏内槽位并确认。`;
      setPublishReport({
        plan,
        confirmation_id: confirmationId,
        execution_id: executionId,
        preflight_verified: false,
        verification_status: "mismatch",
        error: message
      });
      setError(message);
      setIsPublishing(false);
      return;
    }

    let actionSucceeded = false;
    let refreshedAccount: typeof accountSummary | null = null;
    let failure = "";
    try {
      await api.snapshotLoadout({
        membership_type: latestAccount.membership_type,
        character_id: plan.target_character_id,
        loadout_index: plan.loadout_index,
        loadout_name: plan.loadout_name,
        ...(plan.loadout_name_hash !== undefined ? { loadout_name_hash: plan.loadout_name_hash } : {}),
        ...(plan.loadout_icon_hash !== undefined ? { loadout_icon_hash: plan.loadout_icon_hash } : {}),
        ...(plan.loadout_color_hash !== undefined ? { loadout_color_hash: plan.loadout_color_hash } : {}),
        trace: {
          plan_id: plan.plan_id,
          confirmation_id: confirmationId,
          execution_id: executionId,
          step_id: plan.step_id
        }
      });
      actionSucceeded = true;
      refreshedAccount = await input.refreshAccount();
    } catch (publishError) {
      failure = publishError instanceof Error ? publishError.message : String(publishError);
    }

    const verification = !actionSucceeded
      ? { status: "mismatch" as const, reasons: [failure || "Bungie 槽位写入失败"] }
      : !refreshedAccount
        ? { status: "unavailable" as const, reasons: ["写入完成后账号刷新没有返回可用快照"] }
        : verifyLocalLoadoutPlanPublishPlan(plan, refreshedAccount);
    const verificationStatus: ActionVerificationStatus = verification.status;
    const verificationMessage = verification.status === "verified"
      ? `游戏内配装槽位 ${plan.loadout_index + 1} 已保存，并在刷新后核对到 ${plan.selected_item_instance_ids.length} 个已确认实例。`
      : `游戏内配装槽位 ${plan.loadout_index + 1} 保存验证${verification.status === "unavailable" ? "不可用" : "未通过"}：${verification.reasons.join("；")}`;
    let verificationLogged = true;
    try {
      await api.recordActionVerification({
        plan_id: plan.plan_id,
        confirmation_id: confirmationId,
        execution_id: executionId,
        character_id: plan.target_character_id,
        status: verificationStatus,
        message: verificationMessage
      });
    } catch (verificationError) {
      verificationLogged = false;
      const logMessage = `保存到游戏内槽位的验证记录写入失败：${verificationError instanceof Error ? verificationError.message : String(verificationError)}`;
      failure = failure ? `${failure}；${logMessage}` : logMessage;
    }

    const errorMessage = verification.status === "verified" && verificationLogged
      ? undefined
      : failure || verificationMessage;
    setPublishReport({
      plan,
      confirmation_id: confirmationId,
      execution_id: executionId,
      preflight_verified: true,
      verification_status: verificationStatus,
      verification_logged: verificationLogged,
      ...(errorMessage ? { error: errorMessage } : {})
    });
    setError(errorMessage ?? "");
    setIsPublishing(false);
  }, [accountSummary, draft, editingPlanId, executionReport, input, isExecuting, isPublishing]);

  const saveDraft = useCallback(async () => {
    if (!draft || isSaving) return null;
    setIsSaving(true);
    try {
      const saved = editingPlanId
        ? await api.updateLocalLoadoutPlan(editingPlanId, draft)
        : await api.createLocalLoadoutPlan(draft);
      const nextPlans = editingPlanId
        ? plans.map((plan) => plan.id === saved.id ? saved : plan)
        : [saved, ...plans];
      applyPlans(nextPlans, saved.id);
      setEditingPlanId(saved.id);
      setDraft(toLocalLoadoutPlanDraft(saved));
      setError("");
      return saved;
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : String(saveError);
      setError(`保存应用配装失败：${message}`);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [applyPlans, draft, editingPlanId, isSaving, plans]);

  const deletePlan = useCallback(async (id: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const nextPlans = await api.deleteLocalLoadoutPlan(id);
      applyPlans(nextPlans, selectedPlanId === id ? "" : selectedPlanId);
      if (editingPlanId === id) closeEditor();
      setError("");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : String(deleteError);
      setError(`删除应用配装失败：${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [applyPlans, closeEditor, editingPlanId, isSaving, selectedPlanId]);

  return {
    plans,
    selectedPlanId,
    workspace,
    draft,
    isDraftDirty,
    editingPlanId,
    isSaving,
    error,
    reload,
    selectPlan,
    editPlan,
    startNewPlan,
    startFromCurrentCharacter,
    startFromInGameLoadout,
    setDraft,
    saveDraft,
    closeEditor,
    deletePlan,
    dimPreview,
    isPreviewingDim,
    previewDimImport,
    acceptDimImport,
    dismissDimImport,
    isImportingGuide,
    legacyGuideText,
    assistantPrefill,
    prefillFromAssistant,
    dismissAssistantPrefill,
    importGuideSource,
    acceptAssistantEquipmentTargets,
    executionPlan,
    executionReport,
    isExecuting,
    executeDraft,
    publishReport,
    isPublishing,
    publishAppliedPlan
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function readLegacyGuideText(): string {
  try {
    return window.localStorage.getItem(legacyGuideTaskContextStorageKey) ?? "";
  } catch {
    return "";
  }
}

function clearLegacyGuideText(): void {
  try {
    window.localStorage.removeItem(legacyGuideTaskContextStorageKey);
  } catch {
    // 恢复文本清理失败不应影响已经生成的配装草稿。
  }
}

function createTraceId(prefix: string): string {
  const suffix = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}:${suffix}`;
}

function buildExecutionVerificationMessage(input: {
  status: ActionVerificationStatus;
  completedStepCount: number;
  totalStepCount: number;
  failedStep?: string;
  error?: string;
}): string {
  if (input.status === "verified") {
    return `执行 ${input.completedStepCount}/${input.totalStepCount} 步，账号刷新验证通过。`;
  }
  if (input.status === "partial") {
    return `执行 ${input.completedStepCount}/${input.totalStepCount} 步后停止${input.failedStep ? `，失败步骤：${input.failedStep}` : ""}${input.error ? `。${input.error}` : "。"}`;
  }
  if (input.status === "unavailable") {
    return `执行后账号刷新不可用，无法验证最终状态${input.error ? `：${input.error}` : "。"}`;
  }
  return `执行后账号状态与方案预期不一致${input.error ? `：${input.error}` : "。"}`;
}
