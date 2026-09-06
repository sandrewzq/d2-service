import { useEffect, useMemo, useState } from "react";
import { LoadoutsPageContentView, type LoadoutActionFeedbackState, type LoadoutsPageActions } from "@d2-tools/ui";
import { analyzeLoadoutTemplate } from "@d2-tools/core/loadouts/analysis";
import type {
  AccountSummary,
  ArmorSetCatalogEntry,
  CharacterSummary,
  LoadoutTemplate
} from "../../api/types";
import type { EquipmentTargetStore } from "../../api/targetApi";
import type { ArmorClass, ArmorSlot } from "@d2-tools/core/armor";
import type { ArmorStatKey } from "@d2-tools/core/loadouts/analysis";
import type { CreateLocalLoadoutPlanInput, LocalLoadoutPlan } from "@d2-tools/core/loadouts/plans";
import {
  createDimLoadoutExport,
  type DimLoadoutExportResult,
  type DimLoadoutImportPreview
} from "@d2-tools/core/loadouts/dimImport";
import type { LocalLoadoutPlanExecutionPlan } from "@d2-tools/core/loadouts/localPlanExecution";
import {
  consumeApplicationLoadoutFocusRequest,
  createApplicationLoadoutNavigationState,
  getActiveApplicationLoadoutScreen,
  popApplicationLoadoutScreen,
  pushApplicationLoadoutScreen,
  replaceApplicationLoadoutScreen,
  selectApplicationLoadoutCompareViewModel,
  selectApplicationLoadoutLibraryViewModel,
  selectLoadoutsPageModel,
  type ApplicationLoadoutCompareViewModel,
  type ApplicationLoadoutInGameReference,
  type ApplicationLoadoutLibraryViewModel,
  type ApplicationLoadoutNavigationState,
  type ApplicationLoadoutScreen,
  type LocalLoadoutPlanWorkbenchModel
} from "@d2-tools/app/loadouts";
import type {
  AssistantLoadoutArtifact,
  AssistantEquipmentTargetCandidatesArtifact
} from "@d2-tools/app/capabilities";
import type { LocalPlanExecutionReport, LocalPlanPublishReport } from "./useLocalLoadoutPlans";
import { useArmorPlannerWorkspace } from "./useArmorPlannerWorkspace";
import { api } from "../../api/client";
import type { ArmorPlannerCandidateView } from "@d2-tools/app/armor";
import {
  createArmorPlannerGapTarget,
  upsertEquipmentTarget
} from "@d2-tools/core/targets/equipmentTargets";

export type LoadoutsPageProps = {
  accountSummary: AccountSummary | null;
  isLoadingAccount: boolean;
  isShowingCachedAccount: boolean;
  accountError: string;
  lastAccountLoadedAt: Date | null;
  templates: LoadoutTemplate[];
  selectedTemplateId: string;
  compareTemplateId: string;
  renameDraft: string;
  showDiffOnly: boolean;
  message: string;
  isRunningItemAction: boolean;
  actionFeedback: Record<string, LoadoutActionFeedbackState>;
  localPlanWorkspace: LocalLoadoutPlanWorkbenchModel;
  localPlans: LocalLoadoutPlan[];
  selectedLocalPlanId: string;
  localPlanDraft: CreateLocalLoadoutPlanInput | null;
  localPlanIsDirty: boolean;
  localPlanEditingId: string | null;
  localPlanIsSaving: boolean;
  localPlanError: string;
  dimPreview: DimLoadoutImportPreview | null;
  localPlanIsPreviewingDim: boolean;
  localPlanExecutionPlan: LocalLoadoutPlanExecutionPlan | null;
  localPlanExecutionReport: LocalPlanExecutionReport | null;
  localPlanIsExecuting: boolean;
  localPlanPublishReport: LocalPlanPublishReport | null;
  localPlanIsPublishing: boolean;
  localPlanIsImportingGuide: boolean;
  localPlanLegacyGuideText: string;
  localPlanAssistantPrefill: (AssistantLoadoutArtifact & { request_id: number }) | null;
  equipmentTargetStore: EquipmentTargetStore;
  armorResultTraceRequest: { resultId: string; candidateId: string; requestId: number } | null;
  onSelectTemplate: (id: string) => void;
  onSelectCompareTemplate: (id: string) => void;
  onRenameDraftChange: (value: string) => void;
  onShowDiffOnlyChange: (value: boolean) => void;
  onRenameTemplate: (template: LoadoutTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onCreateLocalPlanFromCharacter: (character: AccountSummary["characters"][number]) => void;
  onCreateTransferPlan: (template: LoadoutTemplate) => void;
  onCopyMissingItems: (
    template: LoadoutTemplate,
    analysis: ReturnType<typeof analyzeLoadoutTemplate> | null
  ) => void;
  onExecuteMissingTransfer: (
    template: LoadoutTemplate,
    analysis: ReturnType<typeof analyzeLoadoutTemplate> | null
  ) => void;
  onExecuteSingleItemTransfer: (
    template: LoadoutTemplate,
    item: LoadoutTemplate["items"][number]
  ) => void;
  onEquipSingleItem: (
    template: LoadoutTemplate,
    item: LoadoutTemplate["items"][number]
  ) => void;
  onEquipSavedLoadout: (
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) => void;
  onSnapshotCurrentLoadout: (
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) => void;
  onClearSavedLoadout: (
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number]
  ) => void;
  onUpdateSavedLoadoutIdentifiers: (
    character: AccountSummary["characters"][number],
    slot: AccountSummary["characters"][number]["loadout_slots"][number],
    identifiers: { name_hash?: number; icon_hash?: number; color_hash?: number }
  ) => void;
  onOpenInGameItemDetail: (item: AccountSummary["characters"][number]["equipped_items"][number]) => void;
  onOpenTemplateSourceItem: (
    item: LoadoutTemplate["items"][number],
    templateCharacterId?: string
  ) => void;
  onSelectLocalPlan: (id: string) => void;
  onEditLocalPlan: (id: string) => void;
  onStartNewLocalPlan: (character: CharacterSummary | null) => void;
  onStartLocalPlanFromCharacter: (character: CharacterSummary | null) => void;
  onStartLocalPlanFromInGameLoadout: (
    character: CharacterSummary,
    slot: CharacterSummary["loadout_slots"][number]
  ) => void;
  onLocalPlanDraftChange: (draft: CreateLocalLoadoutPlanInput) => void;
  onSaveLocalPlan: () => void;
  onCloseLocalPlanEditor: () => void;
  onDeleteLocalPlan: (id: string) => void;
  onPreviewDimImport: (url: string) => void;
  onAcceptDimImport: (character: CharacterSummary | null) => void;
  onDismissDimImport: () => void;
  onExecuteLocalPlan: () => void;
  onPublishLocalPlanToSlot: (loadoutIndex: number) => void;
  onImportGuideSource: (sourceInput: string, character: CharacterSummary | null) => Promise<boolean>;
  onAcceptAssistantEquipmentTargets: (
    artifact: AssistantEquipmentTargetCandidatesArtifact,
    candidateIds: string[],
    character: CharacterSummary | null
  ) => boolean;
  onDismissAssistantPrefill: () => void;
  onDismissArmorResultTrace: () => void;
  onEquipmentTargetStoreChanged: (store: EquipmentTargetStore) => void;
};

export function LoadoutsPage(props: LoadoutsPageProps) {
  const [selectedEntryId, setSelectedEntryId] = useState("");
  const [armorSetCatalog, setArmorSetCatalog] = useState<ArmorSetCatalogEntry[]>([]);
  const [armorSetCatalogStatus, setArmorSetCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [dimExportFeedback, setDimExportFeedback] = useState("");
  const [armorTargetFeedback, setArmorTargetFeedback] = useState("");
  const [isSavingArmorTargets, setIsSavingArmorTargets] = useState(false);
  const [applicationLoadoutNavigation, setApplicationLoadoutNavigation] = useState<ApplicationLoadoutNavigationState>(() => (
    createApplicationLoadoutNavigationState(props.selectedLocalPlanId
      ? { selected_plan_id: props.selectedLocalPlanId }
      : undefined)
  ));
  const [applicationLoadoutCompareIds, setApplicationLoadoutCompareIds] = useState<string[]>([]);
  const [applicationLoadoutInGameReference, setApplicationLoadoutInGameReference] = useState<ApplicationLoadoutInGameReference | null>(null);
  const [applicationLoadoutShowDiffOnly, setApplicationLoadoutShowDiffOnly] = useState(false);
  const armorPlanner = useArmorPlannerWorkspace();
  useEffect(() => {
    let active = true;
    setArmorSetCatalogStatus("loading");
    void api.getArmorSetCatalog().then(
      (catalog) => {
        if (!active) return;
        setArmorSetCatalog(catalog);
        setArmorSetCatalogStatus("ready");
      },
      () => {
        if (!active) return;
        setArmorSetCatalog([]);
        setArmorSetCatalogStatus("error");
      }
    );
    return () => {
      active = false;
    };
  }, []);
  const model = useMemo(() => selectLoadoutsPageModel({
    accountSummary: props.accountSummary,
    templates: props.templates,
    selectedTemplateId: props.selectedTemplateId,
    selectedEntryId,
    compareTemplateId: props.compareTemplateId,
    showDiffOnly: props.showDiffOnly
  }), [
    props.accountSummary,
    props.templates,
    props.selectedTemplateId,
    selectedEntryId,
    props.compareTemplateId,
    props.showDiffOnly
  ]);
  const applicationLoadoutLibrary = useMemo<ApplicationLoadoutLibraryViewModel>(() => (
    selectApplicationLoadoutLibraryViewModel({
      account_summary: props.accountSummary,
      plans: props.localPlans,
      selected_plan_id: props.selectedLocalPlanId
    })
  ), [props.accountSummary, props.localPlans, props.selectedLocalPlanId]);
  const applicationLoadoutCompare = useMemo<ApplicationLoadoutCompareViewModel>(() => (
    selectApplicationLoadoutCompareViewModel({
      plans: props.localPlans,
      plan_ids: applicationLoadoutCompareIds,
      in_game_reference: applicationLoadoutInGameReference,
      showDiffOnly: applicationLoadoutShowDiffOnly
    })
  ), [applicationLoadoutCompareIds, applicationLoadoutInGameReference, applicationLoadoutShowDiffOnly, props.localPlans]);

  useEffect(() => {
    setApplicationLoadoutNavigation((current) => {
      const screen = getActiveApplicationLoadoutScreen(current);
      if (screen.kind !== "library" || screen.selected_plan_id === props.selectedLocalPlanId) return current;
      return replaceApplicationLoadoutScreen(current, {
        kind: "library",
        ...(props.selectedLocalPlanId ? { selected_plan_id: props.selectedLocalPlanId } : {})
      }).state;
    });
  }, [props.selectedLocalPlanId]);
  const dimExport = useMemo<DimLoadoutExportResult | null>(() => (
    props.localPlanDraft
      ? createDimLoadoutExport({ plan: props.localPlanDraft, account: props.accountSummary })
      : null
  ), [props.accountSummary, props.localPlanDraft]);
  useEffect(() => {
    setDimExportFeedback("");
  }, [dimExport]);
  useEffect(() => {
    setArmorTargetFeedback("");
  }, [armorPlanner.state.status === "ready" ? armorPlanner.state.result.resultId : armorPlanner.state.status]);

  async function copyDimLoadoutLink() {
    if (!dimExport || dimExport.status !== "ready") return;
    try {
      await navigator.clipboard.writeText(dimExport.url);
      setDimExportFeedback(`已复制包含 ${dimExport.item_count} 个真实实例的 DIM 链接。`);
    } catch (error) {
      setDimExportFeedback(`DIM 链接复制失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function saveArmorAcquisitionTargets(
    candidate: Extract<ArmorPlannerCandidateView, { kind: "acquisition" }>,
    targetClass: ArmorClass
  ) {
    const plannerState = armorPlanner.state;
    if (isSavingArmorTargets || plannerState.status !== "ready") return;
    const gaps = candidate.pieces.filter((piece) => piece.acquisitionRequired);
    if (!gaps.length) {
      setArmorTargetFeedback("这个候选没有待获取护甲缺口。");
      return;
    }
    setIsSavingArmorTargets(true);
    setArmorTargetFeedback("");
    try {
      let next = props.equipmentTargetStore;
      let created = 0;
      let unchanged = 0;
      for (const piece of gaps) {
        const targetId = `armor-gap:${plannerState.result.resultId}:${candidate.summary.candidateId}:${piece.slot}`;
        if (next.targets.some((target) => target.id === targetId)) {
          unchanged += 1;
          continue;
        }
        const rawStats = piece.theoretical.rawStats;
        next = upsertEquipmentTarget(next, createArmorPlannerGapTarget({
          id: targetId,
          name: `${armorSlotLabel(piece.slot)} / ${piece.identity.itemName ?? piece.identity.archetypeName}`,
          ...(armorClassType(targetClass) !== undefined ? { class_type: armorClassType(targetClass) } : {}),
          bucket_name: armorSlotLabel(piece.slot),
          stat_requirements: { ...rawStats },
          minimum_total: Object.values(rawStats).reduce((total, value) => total + value, 0),
          result_id: plannerState.result.resultId,
          candidate_id: candidate.summary.candidateId,
          slot: piece.slot,
          archetype_id: piece.identity.archetypeId,
          archetype_name: piece.identity.archetypeName,
          tertiary_stat: piece.identity.tertiaryStat,
          tuning_label: piece.identity.tuning.mode === "plus3"
            ? "+3 调整"
            : `固定转移到 ${armorStatLabel(piece.identity.tuning.fixedToStat)}`,
          ...(piece.identity.set?.hash !== undefined ? { set_hash: piece.identity.set.hash } : {}),
          ...(piece.identity.set?.name ? { set_name: piece.identity.set.name } : {}),
          exotic: piece.identity.exotic,
          exotic_class_item: piece.identity.exoticClassItem,
          target_masterwork_tier: piece.identity.targetMasterworkTier,
          note: "来自已审阅的自动配甲待刷候选；命中基础属性后仍需复核框架、调整、套装和大师杰作身份。"
        }));
        created += 1;
      }
      const saved = created ? await api.saveEquipmentTargetStore(next) : next;
      props.onEquipmentTargetStoreChanged(saved);
      setArmorTargetFeedback(`已新增 ${created} 个护甲待刷目标，已有 ${unchanged} 个目标保持不变。`);
    } catch (error) {
      setArmorTargetFeedback(`护甲待刷目标保存失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsSavingArmorTargets(false);
    }
  }
  const actions: LoadoutsPageActions = {
    selectEntry: setSelectedEntryId,
    selectTemplate: (id) => {
      setSelectedEntryId(`local-template-${id}`);
      props.onSelectTemplate(id);
    },
    selectCompareTemplate: props.onSelectCompareTemplate,
    renameDraftChange: props.onRenameDraftChange,
    showDiffOnlyChange: props.onShowDiffOnlyChange,
    renameTemplate: props.onRenameTemplate,
    deleteTemplate: props.onDeleteTemplate,
    createLocalPlanFromCharacter: props.onCreateLocalPlanFromCharacter,
    createTransferPlan: props.onCreateTransferPlan,
    copyMissingItems: props.onCopyMissingItems,
    executeMissingTransfer: props.onExecuteMissingTransfer,
    executeSingleItemTransfer: props.onExecuteSingleItemTransfer,
    equipSingleItem: props.onEquipSingleItem,
    equipSavedLoadout: props.onEquipSavedLoadout,
    snapshotCurrentLoadout: props.onSnapshotCurrentLoadout,
    clearSavedLoadout: props.onClearSavedLoadout,
    updateSavedLoadoutIdentifiers: props.onUpdateSavedLoadoutIdentifiers,
    openInGameItemDetail: props.onOpenInGameItemDetail,
    openTemplateSourceItem: props.onOpenTemplateSourceItem,
    selectLocalPlan: (id) => {
      armorPlanner.reset();
      props.onSelectLocalPlan(id);
    },
    editLocalPlan: (id) => {
      armorPlanner.reset();
      props.onEditLocalPlan(id);
    },
    startNewLocalPlan: (character) => {
      armorPlanner.reset();
      props.onStartNewLocalPlan(character);
    },
    startLocalPlanFromCharacter: (character) => {
      armorPlanner.reset();
      props.onStartLocalPlanFromCharacter(character);
    },
    startLocalPlanFromInGameLoadout: (character, slot) => {
      armorPlanner.reset();
      props.onStartLocalPlanFromInGameLoadout(character, slot);
    },
    localPlanDraftChange: props.onLocalPlanDraftChange,
    saveLocalPlan: props.onSaveLocalPlan,
    closeLocalPlanEditor: () => {
      armorPlanner.reset();
      props.onCloseLocalPlanEditor();
    },
    deleteLocalPlan: props.onDeleteLocalPlan,
    previewDimImport: props.onPreviewDimImport,
    acceptDimImport: props.onAcceptDimImport,
    dismissDimImport: props.onDismissDimImport,
    copyDimLoadoutLink: () => void copyDimLoadoutLink(),
    executeLocalPlan: props.onExecuteLocalPlan,
    publishLocalPlanToSlot: props.onPublishLocalPlanToSlot,
    importGuideSource: props.onImportGuideSource,
    acceptAssistantEquipmentTargets: props.onAcceptAssistantEquipmentTargets,
    dismissAssistantPrefill: props.onDismissAssistantPrefill,
    dismissArmorResultTrace: props.onDismissArmorResultTrace,
    planArmor: armorPlanner.plan,
    resetArmorPlanner: armorPlanner.reset,
    saveArmorAcquisitionTargets: (candidate, targetClass) => void saveArmorAcquisitionTargets(candidate, targetClass),
    pushApplicationLoadoutScreen: (screen: ApplicationLoadoutScreen) => {
      setApplicationLoadoutNavigation((current) => pushApplicationLoadoutScreen(current, screen).state);
    },
    replaceApplicationLoadoutScreen: (screen: ApplicationLoadoutScreen) => {
      setApplicationLoadoutNavigation((current) => replaceApplicationLoadoutScreen(current, screen).state);
    },
    popApplicationLoadoutScreen: () => {
      setApplicationLoadoutNavigation((current) => popApplicationLoadoutScreen(current).state);
    },
    consumeApplicationLoadoutFocusRequest: () => {
      setApplicationLoadoutNavigation((current) => consumeApplicationLoadoutFocusRequest(current).state);
    },
    toggleApplicationLoadoutCompare: (planId: string) => {
      const next = applicationLoadoutCompareIds.includes(planId)
        ? applicationLoadoutCompareIds.filter((id) => id !== planId)
        : applicationLoadoutCompareIds.length < 3
          ? [...applicationLoadoutCompareIds, planId]
          : applicationLoadoutCompareIds;
      setApplicationLoadoutCompareIds(next);
      setApplicationLoadoutNavigation((navigation) => {
        const screen = getActiveApplicationLoadoutScreen(navigation);
        if (screen.kind !== "compare") return navigation;
        return replaceApplicationLoadoutScreen(navigation, {
          ...screen,
          plan_ids: next,
          show_diff_only: applicationLoadoutShowDiffOnly
        }).state;
      });
    },
    applicationLoadoutInGameReferenceChange: (reference: ApplicationLoadoutInGameReference | null) => {
      setApplicationLoadoutInGameReference(reference);
      setApplicationLoadoutNavigation((navigation) => {
        const screen = getActiveApplicationLoadoutScreen(navigation);
        if (screen.kind !== "compare") return navigation;
        return replaceApplicationLoadoutScreen(navigation, {
          kind: "compare",
          plan_ids: screen.plan_ids,
          show_diff_only: screen.show_diff_only,
          ...(screen.return_focus_id ? { return_focus_id: screen.return_focus_id } : {}),
          ...(reference ? { in_game_reference_id: `in-game:${reference.character.character_id}:${reference.slot.index}` } : {})
        }).state;
      });
    },
    applicationLoadoutShowDiffOnlyChange: (value: boolean) => {
      setApplicationLoadoutShowDiffOnly(value);
      setApplicationLoadoutNavigation((navigation) => {
        const screen = getActiveApplicationLoadoutScreen(navigation);
        if (screen.kind !== "compare") return navigation;
        return replaceApplicationLoadoutScreen(navigation, { ...screen, show_diff_only: value }).state;
      });
    }
  };

  return (
    <LoadoutsPageContentView
      accountSummary={props.accountSummary}
      model={model}
      actions={actions}
      compareTemplateId={props.compareTemplateId}
      renameDraft={props.renameDraft}
      showDiffOnly={props.showDiffOnly}
      message={props.message}
      isRunningItemAction={props.isRunningItemAction}
      actionFeedback={props.actionFeedback}
      localPlanWorkspace={props.localPlanWorkspace}
      applicationLoadoutNavigation={applicationLoadoutNavigation}
      applicationLoadoutLibrary={applicationLoadoutLibrary}
      applicationLoadoutCompare={applicationLoadoutCompare}
      localPlanDraft={props.localPlanDraft}
      localPlanIsDirty={props.localPlanIsDirty}
      localPlanEditingId={props.localPlanEditingId}
      localPlanIsSaving={props.localPlanIsSaving}
      localPlanError={props.localPlanError}
      dimPreview={props.dimPreview}
      localPlanIsPreviewingDim={props.localPlanIsPreviewingDim}
      localPlanDimExport={dimExport}
      localPlanDimExportFeedback={dimExportFeedback}
      localPlanExecutionPlan={props.localPlanExecutionPlan}
      localPlanExecutionReport={props.localPlanExecutionReport}
      localPlanIsExecuting={props.localPlanIsExecuting}
      localPlanPublishReport={props.localPlanPublishReport}
      localPlanIsPublishing={props.localPlanIsPublishing}
      localPlanIsImportingGuide={props.localPlanIsImportingGuide}
      localPlanLegacyGuideText={props.localPlanLegacyGuideText}
      localPlanAssistantPrefill={props.localPlanAssistantPrefill}
      armorResultTraceRequest={props.armorResultTraceRequest}
      armorPlannerState={armorPlanner.state}
      armorSetCatalog={armorSetCatalog}
      armorSetCatalogStatus={armorSetCatalogStatus}
      armorTargetFeedback={armorTargetFeedback}
      isSavingArmorTargets={isSavingArmorTargets}
      accountDataStatus={!props.accountSummary
        ? undefined
        : props.isLoadingAccount
          ? "refreshing"
          : props.accountError
            ? "stale"
            : props.isShowingCachedAccount
              ? "cached"
              : "ready"}
      accountDataSource={props.accountSummary
        ? props.isShowingCachedAccount ? "local" : "remote"
        : undefined}
      accountDataFetchedAt={props.lastAccountLoadedAt?.toISOString()}
      accountDataError={props.accountError || undefined}
    />
  );
}

function armorClassType(value: ArmorClass): number | undefined {
  if (value === "titan") return 0;
  if (value === "hunter") return 1;
  if (value === "warlock") return 2;
  return undefined;
}

function armorSlotLabel(slot: ArmorSlot): string {
  return {
    helmet: "头盔",
    arms: "臂铠",
    chest: "胸甲",
    legs: "腿甲",
    class: "职业物品"
  }[slot];
}

function armorStatLabel(stat: ArmorStatKey): string {
  return {
    health: "生命值",
    melee: "近战",
    grenade: "手雷",
    super: "超能",
    class: "职业",
    weapon: "武器"
  }[stat];
}
