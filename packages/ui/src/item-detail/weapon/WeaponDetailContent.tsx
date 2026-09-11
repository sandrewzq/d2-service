import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { GameAssetImage } from "../../media/GameAssetImage.js";
import { GameCombatIcon } from "../../media/GameCombatIcon.js";
import { formatStandardDateTime } from "../../time/formatTime.js";
import { RefreshControlButton } from "../../control/RefreshControlButton.js";
import { EquipmentDetailContextLedger } from "../EquipmentDetailContextLedger.js";
import type {
  WeaponDetailViewModel,
  WeaponPerkCandidate,
  WeaponPerkColumnRole,
  WeaponPerkPoolColumn,
  WeaponPerkSelectionColumn,
  WeaponRecommendation,
  WeaponRecommendationPerkCandidate,
  WeaponSourceEntry,
  WeaponStatTrack
} from "@d2-tools/app/items";
import type { RecommendationSourceMatch, RecommendationSourceSlotMatch } from "@d2-tools/core/community-perks";
import type { ItemReleaseKind } from "@d2-tools/core/items/release";
import {
  isDimRecommendationSource,
  presentCuratedRecommendationMatch,
  presentRecommendationSlotMatch
} from "../../recommendationMatchPresentation.js";

export type WeaponDetailSection =
  | "overview"
  | "configuration"
  | "recommendations"
  | "upgrades"
  | "analysis";

type WeaponTargetSource = "dim" | "community" | "personal";

export type WeaponDetailContentActions = {
  selectVersion?: (hash: number) => void;
  openSource?: (source: WeaponSourceEntry) => void;
  stagePerk?: (column: WeaponPerkSelectionColumn, perk: WeaponPerkCandidate) => void;
  cancelPendingPerks?: () => void;
  applyPendingPerks?: () => void | Promise<void>;
  refreshConfiguration?: () => void | Promise<void>;
  loadConfiguration?: () => void | Promise<void>;
  activateSection?: (section: WeaponDetailSection) => void;
  runAnalysis?: (request: { prompt: string; allow_external_search: boolean }) => void;
};

export type WeaponConfigurationWriteFeedback = {
  status: "idle" | "submitting" | "refreshing" | "success" | "error" | "refresh-error";
  message?: string;
};

export type WeaponDetailAnalysis = {
  status?: "idle" | "running" | "ready" | "error";
  title?: string;
  body?: string;
  evidence?: Array<{ label: string; value: string }>;
  externalSources?: Array<{ title?: string; url: string; queried_at: string }>;
  externalSearchMessage?: string;
  message?: string;
};

export type WeaponDetailContentProps = {
  model: WeaponDetailViewModel;
  actions?: WeaponDetailContentActions;
  configurationWriteFeedback?: WeaponConfigurationWriteFeedback;
  analysis?: WeaponDetailAnalysis;
  recommendationEvidence?: {
    sourceMatches: RecommendationSourceMatch[];
    status: "idle" | "loading" | "partial" | "ready" | "error";
    message?: string;
  };
  activeSection?: WeaponDetailSection;
  onSectionChange?: (section: WeaponDetailSection) => void;
  instanceActions?: ReactNode;
  className?: string;
};

const sectionLabels: Array<{ key: WeaponDetailSection; label: string }> = [
  { key: "configuration", label: "当前配置" },
  { key: "recommendations", label: "推荐 Roll" },
  { key: "overview", label: "属性与获取" },
  { key: "upgrades", label: "升级与锻造" },
  { key: "analysis", label: "AI 分析" }
];

export function WeaponDetailContent(props: WeaponDetailContentProps) {
  const { model } = props;
  const [internalSection, setInternalSection] = useState<WeaponDetailSection>("configuration");
  const [poolOpen, setPoolOpen] = useState(false);
  const [analysisPrompt, setAnalysisPrompt] = useState("");
  const [allowExternalSearch, setAllowExternalSearch] = useState(false);
  const [targetSource, setTargetSource] = useState<WeaponTargetSource>(() => (
    preferredWeaponTargetSource(model, props.recommendationEvidence)
  ));
  const [instanceRailOpen, setInstanceRailOpen] = useState(false);
  const [mountedSections, setMountedSections] = useState<Set<WeaponDetailSection>>(() => new Set(["configuration"]));
  const section = props.activeSection ?? internalSection;
  const sectionIdPrefix = useId();
  const detailRef = useRef<HTMLElement>(null);
  const instanceRailRef = useRef<HTMLElement>(null);
  const instanceRailTriggerRef = useRef<HTMLButtonElement>(null);
  const instanceRailCloseRef = useRef<HTMLButtonElement>(null);
  const observedSectionRef = useRef<WeaponDetailSection>("configuration");
  const activateSectionRef = useRef(props.actions?.activateSection);
  const visibleSectionsRef = useRef(new Map<WeaponDetailSection, number>());
  const sectionRefs = useRef<Record<WeaponDetailSection, HTMLElement | null>>({
    overview: null,
    configuration: null,
    recommendations: null,
    upgrades: null,
    analysis: null
  });
  activateSectionRef.current = props.actions?.activateSection;

  useEffect(() => {
    setPoolOpen(false);
    setInternalSection("configuration");
    setAnalysisPrompt("");
    setAllowExternalSearch(false);
    setTargetSource(preferredWeaponTargetSource(model, props.recommendationEvidence));
    setInstanceRailOpen(false);
    setMountedSections(new Set(["configuration"]));
    observedSectionRef.current = "configuration";
    visibleSectionsRef.current.clear();
  }, [model.identity.hash, model.context.object_id, model.context.kind]);

  useEffect(() => {
    for (const mountedSection of mountedSections) {
      if (mountedSection !== "configuration") activateSectionRef.current?.(mountedSection);
    }
  }, [mountedSections]);

  useEffect(() => {
    const availableSources = availableWeaponTargetSources(model, props.recommendationEvidence);
    if (!availableSources.length || availableSources.includes(targetSource)) return;
    setTargetSource(availableSources[0]);
  }, [
    model.personal_targets,
    model.recommendations,
    props.recommendationEvidence?.sourceMatches,
    targetSource
  ]);

  useEffect(() => {
    if (!instanceRailOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : instanceRailTriggerRef.current;
    requestAnimationFrame(() => instanceRailCloseRef.current?.focus());
    return () => previousFocus?.focus();
  }, [instanceRailOpen]);

  useEffect(() => {
    const detail = detailRef.current;
    const scrollRoot = detail?.closest<HTMLElement>(".shared-item-detail-body");
    if (!detail || !scrollRoot) return;
    if (typeof IntersectionObserver === "undefined") {
      setMountedSections(new Set(sectionLabels.map((item) => item.key)));
      return;
    }

    const sectionElements = sectionLabels.flatMap(({ key }) => {
      const element = sectionRefs.current[key];
      return element ? [{ key, element }] : [];
    });
    const sectionByElement = new Map(sectionElements.map(({ key, element }) => [element, key]));
    const mountObserver = new IntersectionObserver((entries) => {
      const enteringSections = entries.flatMap((entry) => {
        const key = sectionByElement.get(entry.target as HTMLElement);
        return entry.isIntersecting && key ? [key] : [];
      });
      if (!enteringSections.length) return;
      setMountedSections((current) => {
        if (enteringSections.every((key) => current.has(key))) return current;
        return new Set([...current, ...enteringSections]);
      });
    }, { root: scrollRoot, rootMargin: "160px 0px", threshold: 0.01 });
    const activeObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const key = sectionByElement.get(entry.target as HTMLElement);
        if (!key) continue;
        if (entry.isIntersecting) visibleSectionsRef.current.set(key, entry.boundingClientRect.top);
        else visibleSectionsRef.current.delete(key);
      }
      const nextSection = [...visibleSectionsRef.current]
        .sort((left, right) => Math.abs(left[1]) - Math.abs(right[1]))[0]?.[0];
      if (!nextSection || observedSectionRef.current === nextSection) return;
      observedSectionRef.current = nextSection;
      if (props.activeSection === undefined) setInternalSection(nextSection);
      props.onSectionChange?.(nextSection);
    }, { root: scrollRoot, rootMargin: "-88px 0px -68% 0px", threshold: [0, 0.01, 0.5] });
    for (const { element } of sectionElements) {
      mountObserver.observe(element);
      activeObserver.observe(element);
    }
    return () => {
      mountObserver.disconnect();
      activeObserver.disconnect();
      visibleSectionsRef.current.clear();
    };
  }, [model.identity.hash, model.context.object_id, props.activeSection, props.onSectionChange]);

  const changeSection = (next: WeaponDetailSection) => {
    observedSectionRef.current = next;
    if (props.activeSection === undefined) setInternalSection(next);
    props.onSectionChange?.(next);
    setMountedSections((current) => current.has(next) ? current : new Set([...current, next]));
    const schedule = typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16);
    schedule(() => {
      sectionRefs.current[next]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleInstanceRailKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setInstanceRailOpen(false);
      return;
    }
    if (event.key !== "Tab" || !instanceRailRef.current) return;
    const focusable = [...instanceRailRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <article
      ref={detailRef}
      className={["weapon-detail", props.className].filter(Boolean).join(" ")}
      data-contract-root="detail-dossier"
      data-contract-id="weapon.detail"
      data-detail-contract="detail.dossier"
      data-layout="hybrid-workspace"
      data-surface="page"
      data-state={model.loading ? "loading" : "normal"}
      aria-busy={model.loading}
    >
      <WeaponIdentity model={model} onSelectVersion={props.actions?.selectVersion} />

      <nav className="weapon-detail-nav" data-ui-kind="section-navigation" aria-label="武器详情章节">
        <div>
          {sectionLabels.map((item) => (
            <button
              key={item.key}
              type="button"
              data-ui-kind="button"
              data-control-variant="quiet"
              aria-current={section === item.key ? "location" : undefined}
              aria-controls={`${sectionIdPrefix}-${item.key}`}
              className={section === item.key ? "is-active" : undefined}
              onClick={() => changeSection(item.key)}
            >
              {item.key === "recommendations" && model.context.kind === "definition" ? "推荐资料" : item.label}
            </button>
          ))}
        </div>
        <button
          ref={instanceRailTriggerRef}
          type="button"
          className="weapon-detail-rail-toggle"
          data-ui-kind="button"
          data-control-variant="secondary"
          aria-expanded={instanceRailOpen}
          aria-controls={`${sectionIdPrefix}-instance-rail`}
          onClick={() => setInstanceRailOpen((value) => !value)}
        >武器操作</button>
      </nav>

      <div className="weapon-detail-workspace" data-surface="split">
        <div className="weapon-detail-sections" data-surface="content-stack">
          <section ref={(node) => { sectionRefs.current.configuration = node; }} id={`${sectionIdPrefix}-configuration`} className="weapon-detail-section">
            <ConfigurationSection
              model={model}
              poolOpen={poolOpen}
              onTogglePool={() => setPoolOpen((value) => !value)}
              actions={props.actions}
              configurationWriteFeedback={props.configurationWriteFeedback}
            />
          </section>
          <section ref={(node) => { sectionRefs.current.recommendations = node; }} id={`${sectionIdPrefix}-recommendations`} className="weapon-detail-section weapon-detail-recommendation-section">
            {mountedSections.has("recommendations") ? (
              <RecommendationSection
                model={model}
                evidence={props.recommendationEvidence}
                source={targetSource}
                onSourceChange={setTargetSource}
              />
            ) : <DeferredWeaponSection label="推荐 Roll" />}
          </section>
          <section ref={(node) => { sectionRefs.current.overview = node; }} id={`${sectionIdPrefix}-overview`} className="weapon-detail-section">
            {mountedSections.has("overview")
              ? <OverviewSection model={model} onOpenSource={props.actions?.openSource} />
              : <DeferredWeaponSection label="属性与获取" />}
          </section>
          <section ref={(node) => { sectionRefs.current.upgrades = node; }} id={`${sectionIdPrefix}-upgrades`} className="weapon-detail-section">
            {mountedSections.has("upgrades")
              ? <UpgradeSection model={model} />
              : <DeferredWeaponSection label="升级与锻造" />}
          </section>
          <section ref={(node) => { sectionRefs.current.analysis = node; }} id={`${sectionIdPrefix}-analysis`} className="weapon-detail-section">
            {mountedSections.has("analysis") ? (
              <AnalysisSection
                model={model}
                analysis={props.analysis}
                prompt={analysisPrompt}
                onPromptChange={setAnalysisPrompt}
                allowExternalSearch={allowExternalSearch}
                onAllowExternalSearchChange={setAllowExternalSearch}
                onRun={props.actions?.runAnalysis}
              />
            ) : <DeferredWeaponSection label="AI 分析" />}
          </section>
        </div>
        <aside
          ref={instanceRailRef}
          id={`${sectionIdPrefix}-instance-rail`}
          className={["weapon-detail-instance-rail", instanceRailOpen && "is-open"].filter(Boolean).join(" ")}
          data-surface="drawer"
          data-ui-kind="drawer"
          data-scroll-region="pane"
          aria-label="当前武器操作"
          onKeyDown={handleInstanceRailKeyDown}
        >
          <header className="weapon-detail-rail-drawer-head">
            <div><span>武器操作</span><strong>当前装备</strong></div>
            <button
              ref={instanceRailCloseRef}
              type="button"
              className="weapon-detail-rail-close"
              data-ui-kind="button"
              data-control-variant="quiet"
              aria-label="关闭武器操作"
              title="关闭"
              onClick={() => setInstanceRailOpen(false)}
            >×</button>
          </header>
          {props.instanceActions ? (
            <div className="weapon-detail-instance-actions">{props.instanceActions}</div>
          ) : (
            <div className="weapon-detail-instance-readonly">
              <h3>当前内容仅供查看</h3>
              <p>资料库定义和商人售卖内容没有可执行的实例操作。</p>
            </div>
          )}
        </aside>
      </div>
      <button
        type="button"
        className={["weapon-detail-rail-scrim", instanceRailOpen && "is-open"].filter(Boolean).join(" ")}
        data-ui-kind="button"
        data-control-variant="quiet"
        aria-label="关闭武器操作"
        onClick={() => setInstanceRailOpen(false)}
      />
    </article>
  );
}

function DeferredWeaponSection(props: { label: string }) {
  return (
    <div className="weapon-detail-deferred-section" role="status" aria-label={`${props.label}将在接近视口时载入`}>
      <span aria-hidden="true" />
      <span aria-hidden="true" />
    </div>
  );
}

function WeaponIdentity(props: {
  model: WeaponDetailViewModel;
  onSelectVersion?: (hash: number) => void;
}) {
  const { identity, context, versions } = props.model;
  const currentDefinition = versions.find((version) => version.is_current) ?? versions[0];
  const releaseLabel = identity.release?.description ?? "官方发布版本未标注";
  const definitionVersionLabel = identity.definition_version?.label ?? "定义版本资料未返回";
  const watermarks = identity.definition_version?.watermark_icons ?? [];
  const locationLabel = context.kind === "account_instance"
    ? context.location_label ?? context.entry_label
    : context.kind === "vendor_offer"
      ? "商人当前售卖"
      : "资料库";
  const canSelectDefinitionVersion = context.kind === "definition" && versions.length > 1 && Boolean(props.onSelectVersion);
  const versionLabel = context.kind === "account_instance"
    ? "装备版本"
    : context.kind === "vendor_offer"
      ? "售卖版本"
      : "发布版本";
  return (
    <header className="weapon-detail-identity" data-surface="section">
      <div className="weapon-detail-identity-main">
        <span className="weapon-detail-identity-icon">
          {identity.crafting?.background ? (
            <GameAssetImage className="weapon-detail-crafting-background" src={identity.crafting.background} alt="" aria-hidden="true" loading="eager" />
          ) : null}
          <GameAssetImage src={identity.icon} alt="" loading="eager" fallback={<span className="weapon-detail-icon-placeholder" aria-hidden="true" />} />
          {identity.crafting?.overlay ? (
            <GameAssetImage className="weapon-detail-crafting-overlay" src={identity.crafting.overlay} alt="" aria-hidden="true" loading="eager" />
          ) : null}
        </span>
        <div>
          <h2 data-ui-part="value" data-text-tone="primary" data-info-priority="display">{identity.name}</h2>
          <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{[identity.item_type, identity.frame?.name].filter(Boolean).join(" · ")}</p>
          <div className="weapon-detail-facts" aria-label="武器摘要">
            {identity.tier ? <Fact label={identity.tier} tone={identity.is_exotic ? "rarity-exotic" : "rarity"} /> : null}
            {identity.slot ? <Fact label={identity.slot} tone="slot" /> : null}
            {identity.ammo ? <Fact label={identity.ammo.label} iconKind="ammo" iconType={identity.ammo.key} tone={`ammo-${identity.ammo.key}`} /> : null}
            {identity.damage ? <Fact label={identity.damage.label} icon={identity.damage.icon} iconKind="damage" iconType={identity.damage.key} title={identity.damage.description} tone={`damage-${identity.damage.key}`} /> : null}
            {identity.champion ? (
              <Fact
                label={identity.champion.label}
                icon={identity.champion.icon}
                iconKind="champion"
                iconType={identity.champion.key}
                title={`${identity.champion.label}：${identity.champion.effect_label}。${identity.champion.description ?? ""}`}
                tone={`champion-${identity.champion.key}`}
              />
            ) : null}
            {identity.crafting ? <Fact label={identity.crafting.label} tone={`crafting-${identity.crafting.kind}`} /> : null}
          </div>
        </div>
      </div>

      <div className="weapon-detail-identity-context">
        <EquipmentDetailContextLedger
          entryLabel={context.entry_label}
          currentViewLabel={weaponObjectLabel(context.kind)}
          locationLabel={locationLabel}
          locationFieldLabel="所在位置"
          slotLabel={identity.slot ?? identity.item_type ?? "武器"}
          slotFieldLabel="武器槽位"
          versionFieldLabel={versionLabel}
          versionValue={currentDefinition?.label ?? releaseLabel}
          versionOptions={canSelectDefinitionVersion
            ? versions.map((version) => ({ hash: version.hash, label: version.label }))
            : undefined}
          selectedVersionHash={currentDefinition?.hash ?? identity.hash}
          watermarkIcon={identity.definition_version?.current_watermark_icon}
          versionLoading={props.model.loading_state.versions}
          showVersionField={context.kind === "definition" && canSelectDefinitionVersion}
          onSelectVersion={canSelectDefinitionVersion ? props.onSelectVersion : undefined}
        />
        <details className="weapon-detail-definition-details">
          <summary>武器定义信息</summary>
          <div>
            <dl><dt>官方描述</dt><dd>{identity.description || "当前资料库未返回描述"}</dd></dl>
            <dl><dt>发布版本</dt><dd>{releaseLabel}</dd></dl>
            <dl><dt>发布类型</dt><dd>{releaseKindLabel(identity.release?.kind)}</dd></dl>
            <dl><dt>定义版本</dt><dd>{definitionVersionLabel}</dd></dl>
            <dl><dt>光等上限编号</dt><dd>{identity.definition_version?.power_cap_hash ?? "资料未返回"}</dd></dl>
            <dl><dt>版本水印</dt><dd>{watermarks.length ? <span className="weapon-detail-definition-watermarks">{watermarks.map((icon, index) => <GameAssetImage key={`${icon}:${index}`} src={icon} alt={`官方版本水印 ${index + 1}`} title="官方定义版本水印" loading="lazy" />)}</span> : "资料未返回"}</dd></dl>
            <dl><dt>装备编号</dt><dd>{identity.hash}</dd></dl>
            <dl><dt>数据来源</dt><dd>资料库定义{context.kind === "account_instance" ? " + 当前装备" : context.kind === "vendor_offer" ? " + 商人当前售卖" : ""}</dd></dl>
            <dl><dt>操作方式</dt><dd>{context.read_only ? "只读查看" : "可管理装备"}</dd></dl>
          </div>
        </details>
      </div>
    </header>
  );
}

function weaponObjectLabel(kind: WeaponDetailViewModel["context"]["kind"]): string {
  if (kind === "account_instance") return "这件武器";
  if (kind === "vendor_offer") return "本次售卖";
  return "资料库武器";
}

function releaseKindLabel(kind: ItemReleaseKind | undefined): string {
  if (kind === "season") return "赛季";
  if (kind === "annual") return "年度资料片";
  if (kind === "dlc") return "内容包";
  if (kind === "core") return "常规版本";
  if (kind === "update") return "版本更新";
  return "官方未标注";
}

function Fact(props: {
  label: string;
  icon?: string;
  iconKind?: "damage" | "champion" | "ammo";
  iconType?: string;
  tone?: string;
  title?: string;
}) {
  return (
    <span
      className={["weapon-detail-fact", props.tone].filter(Boolean).join(" ")}
      data-ui-part="value"
      data-text-tone="primary"
      data-info-priority="support"
      title={props.title}
      tabIndex={props.title ? 0 : undefined}
    >
      {props.iconKind && props.iconType
        ? <GameCombatIcon kind={props.iconKind} type={props.iconType} src={props.icon} />
        : <GameAssetImage src={props.icon} alt="" loading="lazy" />}
      {props.label}
    </span>
  );
}

function SectionHeading(props: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="weapon-detail-section-heading">
      <div><span data-ui-part="label" data-text-tone="meta" data-info-priority="support">{props.eyebrow}</span><h3 data-ui-part="value" data-text-tone="primary" data-info-priority="display">{props.title}</h3></div>
      <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{props.description}</p>
    </div>
  );
}

function DataBlockHeading(props: { id?: string; title: string; source: string }) {
  return (
    <div className="weapon-detail-data-heading">
      <h4 id={props.id} data-ui-part="value" data-text-tone="primary" data-info-priority="context">{props.title}</h4>
      <span data-ui-part="source" data-text-tone="meta" data-info-priority="trace">{props.source}</span>
    </div>
  );
}

function OverviewSection(props: {
  model: WeaponDetailViewModel;
  onOpenSource?: (source: WeaponSourceEntry) => void;
}) {
  const preferCurrentValues = props.model.context.kind !== "definition"
    && props.model.stats.some((stat) => stat.current_value !== undefined);
  const statSource = preferCurrentValues
    ? props.model.context.kind === "vendor_offer" ? "当前售卖数值" : "当前数值"
    : "资料库数值";
  return (
    <>
      <SectionHeading eyebrow="属性与获取" title="武器数值与获取方式" description="属性只保留当前可用数值；获取入口区分当前状态与历史记录。" />
      <div className="weapon-detail-overview-grid">
        <section className="weapon-detail-block" aria-labelledby="weapon-stat-title">
          <DataBlockHeading
            id="weapon-stat-title"
            title="武器属性"
            source={`${statSource} · ${props.model.stats.length} 项`}
          />
          {props.model.stats.length ? (
            <dl className="weapon-detail-stats">
              {props.model.stats.map((stat) => (
                <StatValue
                  key={stat.key}
                  stat={stat}
                  preferCurrent={preferCurrentValues}
                />
              ))}
            </dl>
          ) : <EmptyState text="当前定义没有可显示的武器属性。" />}
        </section>
        <section className="weapon-detail-block" aria-labelledby="weapon-source-title">
          <DataBlockHeading
            id="weapon-source-title"
            title="获取方式"
            source={`依据：游戏官方资料与当前商人、活动数据${props.model.sources.updated_at ? ` · ${formatUpdatedAt(props.model.sources.updated_at)}` : ""}`}
          />
          {props.model.sources.entries.length ? (
            <div className="weapon-detail-source-list">
              {props.model.sources.entries.map((source) => (
                <article
                  key={source.id}
                  className={[
                    "weapon-detail-source-row",
                    source.available_now ? "is-current" : source.kind === "manifest_hint" ? "is-definition" : "is-scheduled"
                  ].join(" ")}
                >
                  <div className="weapon-detail-source-identity">
                    <GameAssetImage src={source.icon} alt="" loading="lazy" />
                    <strong data-ui-part="value" data-text-tone="primary" data-info-priority="context">{source.label}</strong>
                  </div>
                  <div className="weapon-detail-source-copy">
                    <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{source.description}</p>
                    {source.offer?.purchase_requirements?.length ? <small>{source.offer.purchase_requirements.join(" / ")}</small> : null}
                    {source.offer?.can_purchase === false ? <small data-text-tone="status" data-status="warning">{source.offer.failure_messages.join(" / ") || "当前条件未满足，游戏没有返回具体限制。"}</small> : null}
                  </div>
                  <div className="weapon-detail-source-meta">
                    <span
                      data-ui-part="state"
                      data-text-tone={source.available_now === true || source.available_now === false ? "status" : "meta"}
                      data-info-priority="support"
                      data-status={source.kind === "vendor_offer" && source.offer?.can_purchase === false
                        ? "warning"
                        : source.available_now === true
                          ? "success"
                          : source.available_now === false
                            ? "warning"
                            : undefined}
                    >
                      {sourceEntryStatusLabel(source)}
                    </span>
                    {source.offer?.inventory_path ? <span>{source.offer.inventory_path}</span> : null}
                    {source.offer?.price_labels.length ? <span>{source.offer.price_labels.join(" + ")}</span> : null}
                    {source.offer?.refresh_at ? <span>{formatStandardDateTime(source.offer.refresh_at)}</span> : null}
                    {source.updated_at ? <span>更新于 {formatUpdatedAt(source.updated_at)}</span> : null}
                    {props.onOpenSource ? <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => props.onOpenSource?.(source)}>查看</button> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <EmptyState text="暂时没有足够数据确认这件武器的获取方式。" />}
          <p className="weapon-detail-data-note" data-ui-kind="callout" data-callout-tone="info">{sourceStatusDescription(props.model.sources.status)}</p>
        </section>
      </div>
    </>
  );
}

function StatValue(props: {
  stat: WeaponStatTrack;
  preferCurrent: boolean;
}) {
  const { stat } = props;
  const primaryValue = props.preferCurrent
    ? stat.current_value ?? stat.standard_value
    : stat.standard_value ?? stat.current_value;
  const pendingValue = stat.pending_delta ? stat.pending_value : undefined;
  const value = pendingValue !== undefined && pendingValue !== primaryValue
    ? `${primaryValue ?? "—"} → ${pendingValue}`
    : primaryValue ?? "—";
  return (
    <div className="weapon-detail-stat-row" data-pending={pendingValue !== undefined ? "true" : undefined}>
      <dt>{stat.label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function ConfigurationSection(props: {
  model: WeaponDetailViewModel;
  poolOpen: boolean;
  onTogglePool: () => void;
  actions?: WeaponDetailContentActions;
  configurationWriteFeedback?: WeaponConfigurationWriteFeedback;
}) {
  const { configuration, context } = props.model;
  const isDefinitionLoading = props.model.loading_state.definition;
  const isInstanceLoading = context.kind === "account_instance" && props.model.loading_state.instance;
  const isConfigurationLoading = isDefinitionLoading || isInstanceLoading;
  const hasDefinitionConfigurationData = Boolean(
    configuration.intrinsic
    || configuration.pool_columns.length
  );
  const hasConfigurationData = Boolean(
    hasDefinitionConfigurationData
    || configuration.selection_columns.length
  );
  const isFixedExotic = hasDefinitionConfigurationData
    && props.model.identity.is_exotic
    && configuration.kind === "fixed";
  const isVariableExotic = props.model.identity.is_exotic && configuration.kind === "variable_exotic";
  const usesSelectionColumns = context.kind !== "definition"
    && (
      configuration.kind !== "fixed"
      || (isConfigurationLoading && !hasDefinitionConfigurationData && configuration.selection_columns.length > 0)
    );
  const showSelection = usesSelectionColumns && configuration.selection_columns.length > 0;
  const columns = usesSelectionColumns ? configuration.selection_columns : configuration.pool_columns;
  const canWriteConfiguration = context.kind === "account_instance"
    && configuration.kind !== "fixed"
    && configuration.selection_columns.some((column) => column.candidates.some((candidate) => candidate.can_apply));
  const writeFeedback = props.configurationWriteFeedback ?? { status: "idle" as const };
  const isBusy = writeFeedback.status === "submitting" || writeFeedback.status === "refreshing";
  const pendingChangeCount = configuration.selection_columns.reduce(
    (count, column) => count + (column.candidates.some((candidate) => candidate.pending) ? 1 : 0),
    0
  );
  const panelState = writeFeedback.status === "idle" && configuration.has_pending_changes
    ? "pending"
    : writeFeedback.status;
  const showWritePanel = canWriteConfiguration && panelState !== "idle";
  const panelContent = configurationPanelContent(panelState, pendingChangeCount, writeFeedback.message);
  const loadingCopy = configurationLoadingCopy(context.kind, isDefinitionLoading, isInstanceLoading);
  const title = isConfigurationLoading && !hasConfigurationData
    ? loadingCopy.title
    : isFixedExotic
    ? "固定配置"
    : context.kind === "definition"
      ? isVariableExotic ? "异域配置候选" : "完整 Perk 池"
      : context.kind === "vendor_offer"
        ? "当前售卖 Roll"
        : "本件 Roll";
  const description = isConfigurationLoading
    ? loadingCopy.description
    : isFixedExotic
    ? "固有能力与其余固定 Perk 使用同一配置网格，不提供随机池筛选、推荐 Roll 命中或远程切换。"
    : isVariableExotic
      ? context.kind === "account_instance"
        ? "只展示这件武器真实拥有的异域配置选项；可写项以游戏返回的插槽状态为准。"
        : "展示当前异域定义或商人售卖可确认的配置，不把它称为普通传说武器掉落池。"
      : context.kind === "account_instance"
        ? "只允许切换这件武器真实拥有且可应用的 Perk。"
        : "当前查看内容为只读，不提供远程配置操作。";
  const operationLabel = canWriteConfiguration
    ? "可远程切换 · 需要联网"
    : props.actions?.loadConfiguration
      ? "当前 Roll 已显示 · 完整配置按需读取"
    : context.kind === "account_instance" && configuration.kind === "fixed"
      ? "固定配置 · 只读"
      : "只读";
  return (
    <>
      <SectionHeading
        eyebrow="当前配置"
        title={title}
        description={description}
      />
      <div className="weapon-detail-config-summary" aria-busy={isConfigurationLoading}>
        {configurationSummaryItems(
          props.model,
          pendingChangeCount,
          operationLabel,
          isDefinitionLoading,
          isInstanceLoading,
          Boolean(props.actions?.loadConfiguration)
        ).map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
      <p className="weapon-detail-config-source">
        {context.kind === "account_instance"
          ? "依据：当前装备插槽与资料库 Perk 信息"
          : context.kind === "vendor_offer"
            ? "依据：商人当前售卖配置与资料库 Perk 信息"
            : "依据：资料库 Perk 信息"}
      </p>
      {props.actions?.loadConfiguration && !isConfigurationLoading ? (
        <div className="weapon-detail-config-on-demand" data-ui-kind="callout" data-status="neutral">
          <span><strong>当前 Roll 已可查看</strong><small>完整候选、可切换项和详细说明只在需要时读取，不再每次打开详情都请求游戏服务。</small></span>
          <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => void props.actions?.loadConfiguration?.()}>读取完整 Roll</button>
        </div>
      ) : null}
      {isConfigurationLoading ? (
        <p className="weapon-detail-config-loading-note" role="status" aria-live="polite">
          <span aria-hidden="true" />
          {loadingCopy.status}
        </p>
      ) : null}
      {hasConfigurationData ? (
        <div className="weapon-detail-config-grid" aria-busy={isConfigurationLoading}>
          {configuration.intrinsic
            ? <PerkColumn label="固有能力" role="intrinsic" candidates={[configuration.intrinsic]} />
            : isDefinitionLoading
              ? <ConfigurationLoadingColumn />
              : <div className="weapon-detail-intrinsic-empty">未返回固有能力</div>}
          {columns.map((column) => (
            <PerkColumn
              key={column.key}
              label={column.label}
              role={column.role}
              candidates={column.candidates}
              interactive={showSelection && canWriteConfiguration && !isBusy}
              onSelect={(perk) => props.actions?.stagePerk?.(column as WeaponPerkSelectionColumn, perk)}
            />
          ))}
          {isConfigurationLoading && columns.length === 0 ? <ConfigurationLoadingColumn /> : null}
        </div>
      ) : isConfigurationLoading ? (
        <ConfigurationLoadingGrid />
      ) : (
        <EmptyState text={configurationEmptyText(context.kind)} />
      )}

      {showWritePanel ? (
        <div
          className={`weapon-detail-write-panel is-${panelState}`}
          role={panelState === "error" || panelState === "refresh-error" ? "alert" : "status"}
          aria-live={panelState === "error" || panelState === "refresh-error" ? "assertive" : "polite"}
          aria-busy={isBusy}
        >
          <span className="weapon-detail-write-indicator" aria-hidden="true" />
          <div className="weapon-detail-write-copy">
            <div className="weapon-detail-write-heading">
              <strong>{panelContent.title}</strong>
              <span>{panelContent.step}</span>
            </div>
            <p>{panelContent.message}</p>
          </div>
          <div className="weapon-detail-write-actions">
            {panelState === "pending" ? (
              <>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.actions?.cancelPendingPerks}>取消选择</button>
                <button type="button" data-ui-kind="button" data-control-variant="primary" disabled={!configuration.can_apply_changes} onClick={() => void props.actions?.applyPendingPerks?.()}>应用 {pendingChangeCount} 项更改</button>
              </>
            ) : null}
            {panelState === "error" ? (
              <>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={props.actions?.cancelPendingPerks}>取消选择</button>
                <button type="button" data-ui-kind="button" data-control-variant="secondary" onClick={() => void props.actions?.refreshConfiguration?.()}>重新读取</button>
                <button type="button" data-ui-kind="button" data-control-variant="primary" disabled={!configuration.can_apply_changes} onClick={() => void props.actions?.applyPendingPerks?.()}>保留选择重试</button>
              </>
            ) : null}
            {panelState === "refresh-error" ? (
              <RefreshControlButton variant="primary" onClick={() => void props.actions?.refreshConfiguration?.()}>重新读取配置</RefreshControlButton>
            ) : null}
            {isBusy ? <span className="weapon-detail-write-busy-label">处理中</span> : null}
          </div>
        </div>
      ) : null}

      {context.kind !== "definition" && configuration.kind === "random_roll" && configuration.pool_columns.length ? (
        <section className="weapon-detail-full-pool">
          <button type="button" data-ui-kind="button" data-control-variant="secondary" aria-expanded={props.poolOpen} onClick={props.onTogglePool}>
            <strong>{props.poolOpen ? "收起完整掉落池" : "查看完整掉落池"}</strong>
            <span>{props.poolOpen ? "收起" : `展开 ${countPool(configuration.pool_columns)} 个候选`}</span>
          </button>
          {props.poolOpen ? (
            <><div className="weapon-detail-pool-grid">
              {configuration.pool_columns.map((column) => <PerkColumn key={column.key} label={column.label} role={column.role} candidates={column.candidates} />)}
            </div><p className="weapon-detail-note">这里只展示可能掉落的候选，不标记当前已选状态；这件武器未拥有的 Perk 不能远程安装。</p></>
          ) : null}
        </section>
      ) : null}

      {context.kind !== "definition"
      && isVariableExotic
      && configuration.pool_kind === "randomized"
      && configuration.pool_columns.length ? (
        <section className="weapon-detail-full-pool">
          <button type="button" data-ui-kind="button" data-control-variant="secondary" aria-expanded={props.poolOpen} onClick={props.onTogglePool}>
            <strong>{props.poolOpen ? "收起异域配置候选" : "查看异域配置候选"}</strong>
            <span>{props.poolOpen ? "收起" : `展开 ${countPool(configuration.pool_columns)} 个候选`}</span>
          </button>
          {props.poolOpen ? (
            <><div className="weapon-detail-pool-grid">
              {configuration.pool_columns.map((column) => <PerkColumn key={column.key} label={column.label} role={column.role} candidates={column.candidates} />)}
            </div><p className="weapon-detail-note">这些是当前资料库可确认的特殊异域随机配置候选，不代表这件武器已经拥有，也不属于普通传说武器掉落池。</p></>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function configurationSummaryItems(
  model: WeaponDetailViewModel,
  pendingChangeCount: number,
  operationLabel: string,
  isDefinitionLoading: boolean,
  isInstanceLoading: boolean,
  canLoadConfiguration: boolean
): Array<{ label: string; value: string }> {
  const selectedPerks = model.configuration.selection_columns.flatMap((column) => (
    column.candidates.filter((candidate) => candidate.selected).map((candidate) => candidate.name)
  ));
  const fixedPerks = model.configuration.kind === "fixed"
    ? [
        model.configuration.intrinsic?.name,
        ...model.configuration.pool_columns.flatMap((column) => column.candidates.map((candidate) => candidate.name))
      ].filter((name): name is string => Boolean(name))
    : [];
  const currentRoll = selectedPerks.length ? selectedPerks : fixedPerks;
  const switchableColumns = model.configuration.selection_columns.filter((column) => (
    column.candidates.some((candidate) => candidate.can_apply)
  )).length;
  const candidateCount = countPool(model.configuration.pool_columns);

  if (model.context.kind === "account_instance") {
    return [
      { label: "当前查看", value: "这件武器" },
      { label: "本件 Roll", value: currentRoll.join(" / ") || (isInstanceLoading ? "正在读取" : "当前配置未返回") },
      { label: "可切换", value: switchableColumns ? `${switchableColumns} 个插槽` : isInstanceLoading ? "正在核对" : canLoadConfiguration ? "展开后核对" : "没有可远程切换项" },
      { label: "配置状态", value: pendingChangeCount ? `${pendingChangeCount} 项待应用` : isDefinitionLoading || isInstanceLoading ? "读取中" : operationLabel }
    ];
  }

  if (model.context.kind === "vendor_offer") {
    return [
      { label: "当前查看", value: "当前售卖" },
      { label: "售卖 Roll", value: currentRoll.join(" / ") || (isDefinitionLoading ? "正在读取" : "售卖配置未返回") },
      { label: "配置类型", value: isDefinitionLoading && !currentRoll.length ? "正在判断" : configurationKindLabel(model.configuration.kind) },
      { label: "操作状态", value: isDefinitionLoading ? "读取中" : "购买前只读" }
    ];
  }

  return [
    { label: "当前查看", value: "资料库版本" },
    { label: "配置范围", value: candidateCount ? `${model.configuration.pool_columns.length} 个插槽 · ${candidateCount} 个候选` : isDefinitionLoading ? "正在读取" : "配置候选未返回" },
    { label: "配置类型", value: isDefinitionLoading && !candidateCount ? "正在判断" : configurationKindLabel(model.configuration.kind) },
    { label: "操作状态", value: isDefinitionLoading ? "读取中" : "只读查看" }
  ];
}

function configurationLoadingCopy(
  kind: WeaponDetailViewModel["context"]["kind"],
  isDefinitionLoading: boolean,
  isInstanceLoading: boolean
): { title: string; description: string; status: string } {
  if (kind === "account_instance") {
    if (isDefinitionLoading && isInstanceLoading) {
      return {
        title: "本件 Roll",
        description: "正在读取这件武器的当前选择、可切换项和完整 Perk 信息。",
        status: "正在读取本件 Roll 和可切换项；已确认内容会先显示，其余内容随后补齐。"
      };
    }
    if (isInstanceLoading) {
      return {
        title: "本件 Roll",
        description: "完整 Perk 池已经可用，正在核对这件武器实际拥有的配置。",
        status: "正在读取本件 Roll；完整掉落池只表示可能候选，不代表这件武器已经拥有。"
      };
    }
    return {
      title: "本件 Roll",
      description: "这件武器的当前选择已经可用，正在补齐资料库 Perk 信息。",
      status: "本件 Roll 已读取，正在补齐 Perk 名称、说明和完整候选。"
    };
  }
  if (kind === "vendor_offer") {
    return {
      title: "当前售卖 Roll",
      description: "正在读取商人本次售卖配置和对应的 Perk 信息。",
      status: "正在读取当前售卖 Roll；完成前不会用完整掉落池代替本次售卖配置。"
    };
  }
  return {
    title: "Perk 配置",
    description: "正在读取这个版本的完整 Perk 池。",
    status: "正在读取这个版本的固有能力和完整 Perk 池。"
  };
}

function configurationEmptyText(kind: WeaponDetailViewModel["context"]["kind"]): string {
  if (kind === "account_instance") return "读取完成，但游戏没有返回这件武器的可显示配置。";
  if (kind === "vendor_offer") return "读取完成，但当前售卖内容没有返回可显示的 Roll。";
  return "读取完成，但资料库没有返回这个版本的 Perk 配置。";
}

function ConfigurationLoadingGrid() {
  return (
    <div className="weapon-detail-config-grid is-loading" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => <ConfigurationLoadingColumn key={index} />)}
    </div>
  );
}

function ConfigurationLoadingColumn() {
  return (
    <div className="weapon-detail-config-placeholder-column" aria-hidden="true">
      <span />
      <div><i /><b /><em /></div>
    </div>
  );
}

function configurationPanelContent(
  state: WeaponConfigurationWriteFeedback["status"] | "pending",
  pendingChangeCount: number,
  message?: string
): { title: string; step: string; message: string } {
  switch (state) {
    case "pending":
      return {
        title: `已选择 ${pendingChangeCount} 项更改`,
        step: "待提交",
        message: "确认后才会写入游戏；写入成功前，当前配置保持不变。"
      };
    case "submitting":
      return { title: "正在提交武器配置", step: "第 1/2 步", message: message ?? "正在将 Perk 更改提交到游戏服务..." };
    case "refreshing":
      return { title: "正在同步最新配置", step: "第 2/2 步", message: message ?? "正在读取游戏返回的最新装备状态..." };
    case "success":
      return { title: "武器配置已更新", step: "已完成", message: message ?? "详情已按服务器最新状态重绘。" };
    case "error":
      return { title: "武器配置未更新", step: "需要处理", message: message ?? "提交失败，已核对服务器当前配置。你可以保留选择重试。" };
    case "refresh-error":
      return { title: "写入成功，详情同步失败", step: "需要刷新", message: message ?? "请重新读取服务器配置，确认当前实际状态。" };
    default:
      return { title: "", step: "", message: "" };
  }
}

function PerkColumn(props: {
  label: string;
  role: WeaponPerkColumnRole;
  candidates: readonly WeaponPerkCandidate[];
  interactive?: boolean;
  onSelect?: (perk: WeaponPerkCandidate) => void;
}) {
  return (
    <section className={`weapon-detail-perk-column role-${props.role}`}>
      <h4>{props.label}</h4>
      <div>
        {props.candidates.length ? props.candidates.map((perk) => {
          const selection = "selected" in perk ? perk as WeaponPerkSelectionColumn["candidates"][number] : undefined;
          const stateLabel = selection
            ? selection.pending ? "待应用" : selection.selected ? "当前已选" : selection.can_apply ? "这件武器拥有 · 可切换" : "这件武器拥有"
            : undefined;
          const content = <>{stateLabel || perk.enhanced_of_hash ? <small>{[stateLabel, perk.enhanced_of_hash ? "强化版本" : undefined].filter(Boolean).join(" · ")}</small> : null}<GameAssetImage className="game-definition-icon" src={perk.icon} alt="" loading="lazy" /><span><strong>{perk.name}</strong><p>{perk.description}</p></span></>;
          return props.interactive && selection?.can_apply ? (
            <button key={perk.hash} type="button" className={["weapon-detail-perk", selection.selected && "is-selected", selection.pending && "is-pending"].filter(Boolean).join(" ")} aria-pressed={selection.selected || selection.pending} onClick={() => props.onSelect?.(perk)}>{content}</button>
          ) : <article key={perk.hash} className={["weapon-detail-perk", selection?.selected && "is-selected", selection?.pending && "is-pending"].filter(Boolean).join(" ")}>{content}</article>;
        }) : <EmptyState text="此列没有返回候选。" />}
      </div>
    </section>
  );
}

function RecommendationSection(props: {
  model: WeaponDetailViewModel;
  evidence?: WeaponDetailContentProps["recommendationEvidence"];
  source: WeaponTargetSource;
  onSourceChange: (source: WeaponTargetSource) => void;
}) {
  const { model } = props;
  const isFixedExotic = model.identity.is_exotic && model.configuration.kind === "fixed";
  const isDefinition = model.context.kind === "definition";
  const panelId = useId();
  const targetsBySource: Record<WeaponTargetSource, WeaponRecommendation[]> = {
    dim: model.personal_targets.filter((target) => target.source === "dim"),
    community: model.recommendations.filter((target) => target.source === "builtin" || target.source === "external"),
    personal: model.recommendations.filter((target) => target.source === "user")
  };
  const evidence = model.context.kind === "account_instance" ? props.evidence : undefined;
  const sourceMatches = evidence
    ? evidence.sourceMatches.filter((source) => !isDimRecommendationSource(source.source_id)).sort((left, right) => (
        recommendationSourceOrder(left.source_id) - recommendationSourceOrder(right.source_id)
        || recommendationSourceLabel(left.source_id, left.source_label).localeCompare(
          recommendationSourceLabel(right.source_id, right.source_label),
          "zh-Hans-CN"
        )
      ))
    : [];
  const targets = targetsBySource[props.source];
  const sourceCounts: Record<WeaponTargetSource, number> = {
    dim: targetsBySource.dim.length,
    community: evidence ? sourceMatches.length : targetsBySource.community.length,
    personal: targetsBySource.personal.length
  };
  const sourceOrder = availableWeaponTargetSources(model, evidence);
  const handleSourceKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const currentIndex = sourceOrder.indexOf(props.source);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? sourceOrder.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + sourceOrder.length) % sourceOrder.length;
    const nextSource = sourceOrder[nextIndex];
    event.preventDefault();
    props.onSourceChange(nextSource);
    requestAnimationFrame(() => document.getElementById(`${panelId}-${nextSource}`)?.focus());
  };
  return (
    <>
      <SectionHeading
        eyebrow={isDefinition ? "推荐资料" : "推荐判断"}
        title={isDefinition ? "这把武器的来源推荐" : "这件武器的推荐 Roll"}
        description={isDefinition
          ? "按数据源原始形式展示：完整组合保持组合，分栏候选保持 Perk 池；这里不进行玩家 Roll 命中核对。"
          : isFixedExotic
            ? "固定异域不进行随机 Roll 核对；攻略推荐、我的推荐和 DIM 只保留拥有状态、催化剂进度与使用建议。"
            : "先看各来源的核心 Perk 与完整匹配，再按需展开逐栏依据；DIM 作为最低权重辅助来源固定放在最后。"}
      />
      {sourceOrder.length ? <div className="weapon-detail-target-tabs" data-ui-kind="segmented-control" role="tablist" aria-label="选择推荐 Roll 来源">
        {([
          ["community", "攻略推荐"],
          ["personal", "我的推荐"],
          ["dim", "DIM"]
        ] as const).filter(([key]) => sourceCounts[key] > 0).map(([key, label]) => (
          <button
            key={key}
            id={`${panelId}-${key}`}
            type="button"
            role="tab"
            aria-controls={`${panelId}-panel`}
            aria-selected={props.source === key}
            tabIndex={props.source === key ? 0 : -1}
            onClick={() => props.onSourceChange(key)}
            onKeyDown={handleSourceKeyDown}
          >
            {label}<span>{sourceCounts[key]}</span>
          </button>
        ))}
      </div> : null}
      {!sourceOrder.length ? <EmptyState text={isDefinition
        ? "这把武器暂时没有来源推荐资料。"
        : evidence?.status === "loading" ? "正在读取这把武器的推荐 Roll。" : "这把武器暂时没有可核对的推荐 Roll。"} /> : props.source === "community" && evidence ? (
        <div
          id={`${panelId}-panel`}
          className="weapon-detail-recommendations"
          role="tabpanel"
          aria-labelledby={`${panelId}-${props.source}`}
          aria-busy={evidence.status === "loading"}
        >
          {evidence.message ? <p className={`status-message status-${evidence.status === "error" ? "error" : evidence.status === "partial" ? "warning" : "pending"}`} role="status">{evidence.message}</p> : null}
          {sourceMatches.length
            ? sourceMatches.map((sourceMatch) => (
                <RecommendationSourceEvidenceCard
                  key={`${sourceMatch.source_id}:${sourceMatch.source_label}`}
                  model={model}
                  sourceMatch={sourceMatch}
                />
              ))
            : <EmptyState text={recommendationEvidenceEmptyText(evidence.status)} />}
        </div>
      ) : targets.length ? (
        <div
          id={`${panelId}-panel`}
          className="weapon-detail-recommendations"
          role="tabpanel"
          aria-labelledby={`${panelId}-${props.source}`}
        >
          {targets.map((target) => <RecommendationCard key={target.id} model={model} recommendation={target} />)}
        </div>
      ) : <div id={`${panelId}-panel`} role="tabpanel" aria-labelledby={`${panelId}-${props.source}`}><EmptyState text={isDefinition ? "当前来源没有可显示的推荐资料。" : "当前来源没有可显示的推荐 Roll。"} /></div>}
    </>
  );
}

function availableWeaponTargetSources(
  model: WeaponDetailViewModel,
  evidence: WeaponDetailContentProps["recommendationEvidence"] | undefined
): WeaponTargetSource[] {
  const counts: Record<WeaponTargetSource, number> = {
    community: model.context.kind === "account_instance" && evidence
      ? evidence.sourceMatches.filter((source) => !isDimRecommendationSource(source.source_id)).length
      : model.recommendations.filter((target) => target.source === "builtin" || target.source === "external").length,
    dim: model.personal_targets.filter((target) => target.source === "dim").length,
    personal: model.recommendations.filter((target) => target.source === "user").length
  };
  return (["community", "personal", "dim"] as const).filter((source) => counts[source] > 0);
}

function preferredWeaponTargetSource(
  model: WeaponDetailViewModel,
  evidence: WeaponDetailContentProps["recommendationEvidence"] | undefined
): WeaponTargetSource {
  return availableWeaponTargetSources(model, evidence)[0] ?? "community";
}

function RecommendationSourceEvidenceCard(props: {
  model: WeaponDetailViewModel;
  sourceMatch: RecommendationSourceMatch;
}) {
  const source = props.sourceMatch;
  const [open, setOpen] = useState(false);
  const sourceLabel = recommendationSourceLabel(source.source_id, source.source_label);
  const presentation = presentCuratedRecommendationMatch(source, sourceLabel);
  const specifiedSlots = source.slots.filter((slot) => slot.state !== "source_not_specified");
  const unrequestedSlotLabels = source.slots
    .filter((slot) => slot.state === "source_not_specified")
    .map((slot) => slot.label);
  const metadata = [
    source.purposes.length ? `用途：${source.purposes.map(recommendationPurposeLabel).join(" / ")}` : undefined,
    source.rating ? `评级：${source.rating}` : undefined,
    source.ranking ? `排名：${source.ranking}` : undefined,
    source.page_updated_at ? `更新时间：${formatUpdatedAt(source.page_updated_at)}` : undefined
  ].filter((entry): entry is string => Boolean(entry));
  return (
    <details
      className="weapon-detail-source-evidence"
      data-match-state={recommendationSourceMatchState(source)}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{sourceLabel}</strong>
          <small>{metadata.join(" · ") || "来源没有提供额外元数据"}</small>
        </span>
        <span className="weapon-detail-source-score" role="group" aria-label={presentation.summary}>
          {presentation.requirementCount > 0 ? (
            <>
              <span data-score-kind="perk">
                <small>核心 Perk</small>
                <strong>{presentation.perkRequirementCount > 0
                  ? `${presentation.matchedPerkCount}/${presentation.perkRequirementCount}`
                  : "未要求"}</strong>
              </span>
              <span data-score-kind="complete">
                <small>完整匹配</small>
                <strong>{presentation.matchedRequirementCount}/{presentation.requirementCount}</strong>
              </span>
              {presentation.uncheckableRequirementCount > 0 ? (
                <span data-score-kind="pending">
                  <small>无法判断</small>
                  <strong>{presentation.uncheckableRequirementCount} 项</strong>
                </span>
              ) : null}
            </>
          ) : (
            <span data-score-kind="weapon-only">
              <small>推荐范围</small>
              <strong>仅推荐武器</strong>
              <em>未指定 Roll</em>
            </span>
          )}
        </span>
      </summary>
      {open ? (
        <div className="weapon-detail-source-evidence-body">
          {source.note ? <p className="weapon-detail-source-quote" data-ui-kind="callout" data-callout-tone="info">{source.note}</p> : null}
          <div className="weapon-detail-source-trace">
            {source.source_location ? <span>原表位置：{source.source_location}</span> : null}
            {source.source_url
              ? <a href={source.source_url} target="_blank" rel="noreferrer">查看原始来源</a>
              : <span>原始链接未提供</span>}
          </div>
          {source.state === "weapon_only" || !specifiedSlots.length ? (
            <p className="weapon-detail-match-empty">该来源推荐这把武器，但没有指定需要核对的枪管、第二列、大师、Perk 或起源特性，因此不作 Roll 对照。</p>
          ) : (
            <>
              <div className="weapon-detail-source-slot-list" aria-label={`${sourceLabel}推荐项核对`}>
                {specifiedSlots.map((slot) => (
                  <RecommendationSourceSlotRow key={slot.slot} model={props.model} slot={slot} />
                ))}
              </div>
              {unrequestedSlotLabels.length ? (
                <p className="weapon-detail-source-unrequested">
                  <strong>其他栏位未要求</strong>
                  <span>{unrequestedSlotLabels.join("、")}</span>
                </p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </details>
  );
}

function RecommendationSourceSlotRow(props: {
  model: WeaponDetailViewModel;
  slot: RecommendationSourceSlotMatch;
}) {
  const { model, slot } = props;
  const sourceCandidates = recommendationSourceCandidates(model, slot);
  const instanceOwned = slot.instance_owned.map((plug) => recommendationOwnedPerk(model, plug));
  const presentation = presentRecommendationSlotMatch(slot.state, {
    hasInstanceOwned: slot.instance_owned.length > 0,
    hasCurrentEnabled: slot.current_enabled.length > 0
  });
  return (
    <div
      className="weapon-detail-source-slot"
      data-core-slot={slot.slot === "perk1" || slot.slot === "perk2" ? "true" : undefined}
      data-match-state={slot.state}
    >
      <header>
        <strong>{slot.label}</strong>
        <span className="ui-badge" data-ui-kind="status-chip" data-status={presentation.tone}>{presentation.label}</span>
      </header>
      <div className="weapon-detail-source-slot-comparison">
        <section>
          <header><span>来源要求</span>{sourceCandidates.length > 1 ? <small>满足其中一个即可</small> : null}</header>
          {sourceCandidates.length ? (
            <div className="weapon-detail-recommendation-perks" role="group" aria-label={`${slot.label}来源要求`}>
              {sourceCandidates.map((candidate) => {
                const hit = recommendationPerkMatches(model, candidate, slot.instance_owned);
                const active = recommendationPerkMatches(model, candidate, slot.current_enabled);
                return (
                  <RecommendationPerkIcon
                    key={candidate.key}
                    perk={candidate}
                    hit={hit}
                    active={active}
                    muted={slot.state === "match" && !hit}
                    unknown={candidate.unresolved}
                    contextLabel="来源推荐"
                    visibleStatusLabel={hit ? active ? "本件命中 · 当前" : "本件命中" : "推荐候选"}
                    statusLabel={hit
                      ? active ? "本件已拥有，当前已启用" : "本件已拥有，当前未启用"
                      : slot.state === "uncheckable" ? "当前无法确认本件是否拥有" : "本件没有这个推荐项"}
                  />
                );
              })}
            </div>
          ) : <p>{slot.state === "source_not_specified" ? "未指定" : "要求名称未返回"}</p>}
        </section>
        <section>
          <header><span>本件拥有</span><small>蓝点表示当前启用</small></header>
          {instanceOwned.length ? (
            <div className="weapon-detail-recommendation-perks" role="group" aria-label={`${slot.label}本件拥有`}>
              {instanceOwned.map((candidate) => {
                const hit = recommendationPerkMatches(model, candidate, sourceCandidates);
                const active = recommendationPerkMatches(model, candidate, slot.current_enabled) || candidate.selected;
                return (
                  <RecommendationPerkIcon
                    key={candidate.key}
                    perk={candidate}
                    hit={hit}
                    active={active}
                    muted={slot.state === "match" && !hit}
                    contextLabel="本件拥有"
                    visibleStatusLabel={hit ? active ? "符合 · 当前" : "符合" : active ? "当前启用" : "本件拥有"}
                    statusLabel={hit
                      ? active ? "符合来源要求，当前已启用" : "符合来源要求，当前未启用"
                      : active ? "当前已启用，但不在该来源候选中" : "本件拥有，但不在该来源候选中"}
                  />
                );
              })}
            </div>
          ) : <p>{presentation.instanceOwnedFallback}</p>}
        </section>
      </div>
    </div>
  );
}

function recommendationEvidenceEmptyText(status: NonNullable<WeaponDetailContentProps["recommendationEvidence"]>["status"]): string {
  if (status === "idle") return "尚未开始账号武器推荐核对；进入仓库后会生成当前实例的逐项结果。";
  if (status === "loading") return "正在读取这件武器的推荐来源与逐项结果。";
  if (status === "partial") return "本次账号武器核对未完整完成，当前实例没有可显示的逐项结果。";
  if (status === "error") return "账号武器推荐来源核对失败，当前实例没有可显示的逐项结果。";
  return "当前实例没有可显示的推荐来源逐项结果。";
}

function recommendationSourceMatchState(source: RecommendationSourceMatch): RecommendationSourceMatch["state"] {
  return source.state;
}

function recommendationPurposeLabel(purpose: RecommendationSourceMatch["purposes"][number]): string {
  return purpose === "pve" ? "PVE" : purpose === "pvp" ? "PVP" : "通用";
}

function recommendationSourceLabel(sourceId: string, fallback: string): string {
  if (sourceId === "aegis") return "Aegis推荐";
  if (sourceId === "lgpig") return "LGpig推荐";
  if (sourceId === "yxcrallxy") return "YXCRALLXY推荐表";
  if (sourceId === "sayalarry") return "Sayalarry推荐表";
  if (sourceId === "dim_voltron" || sourceId === "dim_wishlist") return "DIM社区愿望单";
  return fallback || sourceId || "推荐来源";
}

function recommendationSourceOrder(sourceId: string): number {
  if (sourceId === "aegis") return 0;
  if (sourceId === "lgpig") return 1;
  if (sourceId === "yxcrallxy") return 2;
  if (sourceId === "sayalarry") return 3;
  return 99;
}

function RecommendationCard(props: { model: WeaponDetailViewModel; recommendation: WeaponRecommendation }) {
  const { model, recommendation } = props;
  const isDefinition = model.context.kind === "definition";
  const hasObject = !isDefinition;
  const perkMatches = recommendation.perk_options.map((option) => {
    const candidates = option.candidates?.length
      ? option.candidates.map((candidate) => recommendationTargetPerk(model, option.column_key, candidate.name, candidate))
      : option.names.map((name) => recommendationTargetPerk(model, option.column_key, name));
    return {
      ...option,
      candidates,
      owned: hasObject && candidates.some((candidate) => candidate.hit),
      active: hasObject && candidates.some((candidate) => candidate.active)
    };
  });
  const masterworkMatch = hasObject && recommendation.masterwork_names.some((name) => sameLabel(name, model.upgrades.masterwork?.name));
  const modMatch = hasObject && recommendation.mod_names.some((name) => sameLabel(name, model.upgrades.mod?.name));
  const isFixedExotic = model.identity.is_exotic && model.configuration.kind === "fixed";
  const sourcePurposeLabel = (recommendation.purposes?.length ? recommendation.purposes : [recommendation.mode])
    .map((mode) => mode === "pve" ? "PVE" : mode === "pvp" ? "PVP" : "通用")
    .filter((mode, index, values) => values.indexOf(mode) === index)
    .join(" / ");
  const presentationLabel = recommendation.presentation === "perk_pool" ? "Perk 池" : "完整组合";
  return (
    <article className="weapon-detail-recommendation">
      <header>
        <div>
          <h4>{recommendation.title}</h4>
          <p>{recommendation.source_label} · {sourcePurposeLabel}{recommendation.updated_at ? ` · ${formatUpdatedAt(recommendation.updated_at)}` : ""}</p>
        </div>
        <div className="weapon-detail-recommendation-heading-status">
          {isDefinition ? (
            <span className="ui-badge status-neutral" data-ui-kind="status-chip">{presentationLabel}</span>
          ) : !isFixedExotic && perkMatches.length ? (
            <span className={`ui-badge ${recommendationMatchBadgeClass(recommendation.match)}`} data-ui-kind="status-chip">
              {recommendation.match === "full"
                ? "完整符合"
                : recommendation.match === "partial"
                  ? `${perkMatches.filter((option) => option.owned).length}/${perkMatches.length}`
                  : recommendation.match === "none" ? "不符" : "不作核对"}
            </span>
          ) : null}
          {recommendation.external_url ? <a href={recommendation.external_url} target="_blank" rel="noreferrer">查看原始来源</a> : <span>本地数据</span>}
        </div>
      </header>
      {recommendation.reason ? <p className="weapon-detail-source-quote is-single-line" data-ui-kind="callout" data-callout-tone="info" title={recommendation.reason}>{recommendation.reason}</p> : null}
      {perkMatches.length ? (
        <div className="weapon-detail-recommendation-combo" data-recommendation-source={recommendation.source}>
          {perkMatches.map((option) => (
            <section key={option.column_key} data-match-state={isDefinition ? undefined : option.owned ? "match" : "different"}>
              <header>
                <strong>{option.column_key}</strong>
                <span>{isDefinition ? recommendation.presentation === "perk_pool" ? "候选池" : "组合要求" : option.owned ? "符合" : "不符"}</span>
              </header>
              <div className="weapon-detail-recommendation-perks" role="group" aria-label={`${option.column_key}推荐候选`}>
                {option.candidates.map((candidate) => (
                  <RecommendationPerkIcon
                    key={candidate.key}
                    perk={candidate}
                    hit={hasObject && candidate.hit}
                    active={hasObject && candidate.active}
                    muted={hasObject && option.owned && !candidate.hit}
                    unknown={!candidate.icon}
                    contextLabel={recommendation.source === "dim" ? "DIM 组合要求" : recommendation.presentation === "perk_pool" ? "来源候选池" : "完整组合要求"}
                    visibleStatusLabel={isDefinition
                      ? recommendation.presentation === "perk_pool" ? "候选" : "组合要求"
                      : candidate.hit
                        ? candidate.active ? "命中 · 当前" : "命中"
                        : "推荐候选"}
                    statusLabel={isDefinition
                      ? recommendation.presentation === "perk_pool" ? "数据源在该栏给出的候选项" : "数据源明确给出的完整组合项"
                      : candidate.hit
                        ? candidate.active ? "本件已拥有，当前已启用" : "本件已拥有，当前未启用"
                        : "本件没有这个推荐项"}
                  />
                ))}
              </div>
              {recommendation.presentation === "perk_pool" && option.names.length > 1 ? <small>满足其中一个即可</small> : null}
            </section>
          ))}
        </div>
      ) : <p className="weapon-detail-match-empty">{isFixedExotic ? "固定异域不使用随机 Perk 目标；此处保留来源说明和使用建议。" : "该来源没有指定随机 Perk 目标。"}</p>}
      {!isDefinition ? <div className="weapon-detail-match-summary">
        {isFixedExotic ? (
          <>
            <span>配置：固定 Perk · 不执行 Roll 命中</span>
            {model.upgrades.catalyst ? <span>催化剂：{catalystStateLabel(model)}</span> : null}
            <span>当前查看：{weaponObjectLabel(model.context.kind)}</span>
          </>
        ) : (
          <>
            <span>{recommendation.source === "dim" ? "最佳组合" : "Perk"}：{!perkMatches.length ? "未指定" : !hasObject ? "未选择账号装备" : `${perkMatches.filter((option) => option.owned).length}/${perkMatches.length} 这件武器拥有 · ${perkMatches.filter((option) => option.active).length}/${perkMatches.length} 当前启用`}</span>
            <span>大师杰作：{recommendation.masterwork_names.length ? matchFactLabel(hasObject, masterworkMatch) : "未指定"}</span>
            <span>武器模组：{recommendation.mod_names.length ? matchFactLabel(hasObject, modMatch) : "未指定"}</span>
          </>
        )}
      </div> : null}
    </article>
  );
}

type RecommendationPerkVisual = {
  key: string;
  hash?: number;
  hashes?: number[];
  name: string;
  englishName?: string;
  description?: string;
  icon?: string;
  selected?: boolean;
  unresolved?: boolean;
  hit?: boolean;
  active?: boolean;
};

function RecommendationPerkIcon(props: {
  perk: RecommendationPerkVisual;
  hit?: boolean;
  active?: boolean;
  muted?: boolean;
  unknown?: boolean;
  contextLabel: string;
  visibleStatusLabel: string;
  statusLabel: string;
}) {
  const { perk } = props;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const ariaLabel = [
    perk.name,
    props.contextLabel,
    props.hit ? "命中推荐" : undefined,
    props.active ? "当前启用" : undefined,
    props.statusLabel
  ].filter(Boolean).join("，");
  return (
    <span
      ref={rootRef}
      className="weapon-detail-recommendation-perk"
      data-hit={props.hit ? "true" : undefined}
      data-active={props.active ? "true" : undefined}
      data-muted={props.muted ? "true" : undefined}
      data-unknown={props.unknown ? "true" : undefined}
      data-open={open ? "true" : undefined}
    >
      <button
        type="button"
        aria-label={ariaLabel}
        aria-describedby={tooltipId}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="weapon-detail-recommendation-perk-art">
          <GameAssetImage
            src={normalizeRecommendationIconUrl(perk.icon)}
            alt=""
            loading="lazy"
            fallback={<span className="weapon-detail-recommendation-perk-placeholder" aria-hidden="true">◆</span>}
          />
        </span>
        <span className="weapon-detail-recommendation-perk-copy">
          <strong>{perk.name}</strong>
          <small>{props.visibleStatusLabel}</small>
        </span>
        {props.hit ? <span className="weapon-detail-recommendation-perk-hit" aria-hidden="true">✓</span> : null}
        {props.active ? <span className="weapon-detail-recommendation-perk-active" aria-hidden="true" /> : null}
      </button>
      <span id={tooltipId} className="weapon-detail-recommendation-perk-popover" role="tooltip">
        <span className="weapon-detail-recommendation-perk-popover-heading">
          <span className="weapon-detail-recommendation-perk-art">
            <GameAssetImage
              src={normalizeRecommendationIconUrl(perk.icon)}
              alt=""
              loading="lazy"
              fallback={<span className="weapon-detail-recommendation-perk-placeholder" aria-hidden="true">◆</span>}
            />
          </span>
          <span><strong>{perk.name}</strong>{perk.englishName ? <small>{perk.englishName}</small> : null}</span>
        </span>
        <span className="weapon-detail-recommendation-perk-description">{perk.description || "游戏资料没有返回这项 Perk 的说明。"}</span>
        <span className="weapon-detail-recommendation-perk-context"><strong>{props.contextLabel}</strong><small>{props.statusLabel}</small></span>
      </span>
    </span>
  );
}

function recommendationMatchBadgeClass(match: WeaponRecommendation["match"]): string {
  if (match === "full") return "status-ready";
  if (match === "partial") return "status-warning";
  if (match === "none") return "status-error";
  return "status-neutral";
}

function UpgradeSection({ model }: { model: WeaponDetailViewModel }) {
  const { upgrades } = model;
  const objectSource = model.context.kind === "account_instance"
    ? "当前装备"
    : model.context.kind === "vendor_offer"
      ? "商人当前售卖"
      : "资料库定义";
  const rows = [
    upgrades.masterwork ? { key: "masterwork", label: "大师杰作", current: `${upgrades.masterwork.name}${upgrades.masterwork.level ? ` · ${upgrades.masterwork.level} 级` : ""}`, detail: `${upgrades.masterwork.complete ? "已完成" : "未完成"}${upgrades.masterwork.stat_amount ? ` · 属性 ${upgrades.masterwork.stat_amount > 0 ? "+" : ""}${upgrades.masterwork.stat_amount}` : ""}`, source: objectSource } : null,
    upgrades.mod ? { key: "mod", label: "武器模组", current: upgrades.mod.name, detail: upgrades.mod.description, source: objectSource } : null,
    upgrades.catalyst ? { key: "catalyst", label: "催化剂", current: upgrades.catalyst.name, detail: catalystStateLabel(model), source: upgrades.catalyst.acquired === undefined ? "资料库定义" : "账号进度 + 资料库定义" } : null,
    upgrades.enhancement ? { key: "enhancement", label: "强化阶级", current: upgrades.enhancement.name, detail: upgrades.enhancement.level !== undefined ? `当前 ${upgrades.enhancement.level} 阶` : "当前装备强化状态", source: objectSource } : null,
    upgrades.crafting_level !== undefined ? { key: "crafting", label: "锻造等级", current: `${upgrades.crafting_level} 级`, detail: upgrades.enhanced ? "已包含强化能力" : "未强化", source: objectSource } : null
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!rows.length) return null;
  return (
    <>
      <SectionHeading eyebrow="升级与锻造" title={upgrades.catalyst ? "催化剂、杰作与当前进度" : "大师杰作、模组与强化"} description="这件武器的状态与版本能力分别标明来源，不把未返回的信息补成结论。" />
      <DataBlockHeading title="升级状态" source={upgrades.catalyst ? (upgrades.catalyst.acquired === undefined ? "资料库定义" : "账号进度 + 资料库定义 · 当前读取") : objectSource} />
      <div className={["weapon-detail-upgrade-layout", !upgrades.catalyst && "without-catalyst"].filter(Boolean).join(" ")}>
        {upgrades.catalyst ? <article className="weapon-detail-catalyst"><header><GameAssetImage className="game-definition-icon" src={upgrades.catalyst.icon} alt="" loading="lazy" /><div><strong>{upgrades.catalyst.name}</strong><span>{upgrades.catalyst.objective || catalystStateLabel(model)}</span></div></header>{upgrades.catalyst.acquired !== undefined ? <progress value={upgrades.catalyst.progress ?? (upgrades.catalyst.complete ? 100 : 0)} max={100} /> : null}{upgrades.catalyst.acquisition ? <p>获取：{upgrades.catalyst.acquisition}</p> : null}{upgrades.catalyst.effects.length ? <ul>{upgrades.catalyst.effects.map((effect) => <li key={effect}>{effect}</li>)}</ul> : null}</article> : null}
        {rows.length ? (
          <div className="weapon-detail-upgrade-table" role="table" aria-label="升级与锻造状态">
            <div role="row"><strong role="columnheader">项目</strong><strong role="columnheader">当前查看</strong><strong role="columnheader">状态</strong><strong role="columnheader">数据来源</strong></div>
            {rows.map((row) => <div key={row.key} role="row"><strong role="cell">{row.label}</strong><span role="cell">{row.current}</span><span role="cell">{row.detail}</span><span role="cell">{row.source}</span></div>)}
          </div>
        ) : <EmptyState text="这件武器没有可显示的升级或附加能力。" />}
      </div>
    </>
  );
}

function AnalysisSection(props: {
  model: WeaponDetailViewModel;
  analysis?: WeaponDetailAnalysis;
  prompt: string;
  onPromptChange: (value: string) => void;
  allowExternalSearch: boolean;
  onAllowExternalSearchChange: (value: boolean) => void;
  onRun?: (request: { prompt: string; allow_external_search: boolean }) => void;
}) {
  const status = props.analysis?.status ?? "idle";
  const isFixedExotic = props.model.identity.is_exotic && props.model.configuration.kind === "fixed";
  return (
    <>
      <SectionHeading eyebrow="AI 分析" title="结合这件武器与推荐来源分析" description="AI 只提供辅助解释，不修改装备、标签或推荐数据。" />
      <div className="weapon-detail-ai-layout">
        <div className="weapon-detail-ai-analysis">
          {props.analysis?.message ? <p className={`status-message status-${status === "error" ? "error" : status === "ready" ? "ready" : "pending"}`} role="status">{props.analysis.message}</p> : null}
          {props.analysis?.body ? <article className="weapon-detail-ai-result" data-ui-kind="callout" data-callout-tone="ai"><span>AI 生成 · 可以查看依据</span><h4>{props.analysis.title ?? `${props.model.identity.name}分析`}</h4><p>{props.analysis.body}</p>{props.analysis.evidence?.length ? <dl>{props.analysis.evidence.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl> : null}</article> : <EmptyState text="运行分析后，这里会显示结论和使用依据。" />}
          {props.analysis?.externalSearchMessage ? <p className="weapon-detail-note">{props.analysis.externalSearchMessage}</p> : null}
          {props.analysis?.externalSources?.length ? (
            <section className="weapon-detail-external-sources" aria-label="AI 外部知识来源">
              <div className="weapon-detail-block-heading"><h4>外部知识来源</h4><span>最低优先级</span></div>
              <ul>{props.analysis.externalSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title || source.url}</a><span>{formatStandardDateTime(source.queried_at)}</span></li>)}</ul>
            </section>
          ) : null}
        </div>
        <aside className="weapon-detail-ai-tools">
          <div className="weapon-detail-ai-input">
            <label htmlFor="weapon-analysis-prompt">询问这件武器</label>
            <textarea id="weapon-analysis-prompt" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} placeholder={isFixedExotic ? "例如：结合固定配置、当前催化剂状态和获取来源，分析 PvE 使用方向。" : "例如：结合这件武器的全部可切换 Perk，分析 PvE 推荐匹配情况。"} />
            <label className="weapon-detail-ai-external"><input type="checkbox" checked={props.allowExternalSearch} onChange={(event) => props.onAllowExternalSearchChange(event.target.checked)} />允许 AI 查询外部知识，必须保留引用</label>
            <button type="button" data-ui-kind="button" data-control-variant="ai" data-control-size="prominent" disabled={!props.onRun || status === "running"} onClick={() => props.onRun?.({ prompt: props.prompt, allow_external_search: props.allowExternalSearch })}>{status === "running" ? "分析中..." : "结合全部来源分析"}</button>
            <small>AI 结果仅供参考，不会写入装备或推荐数据。</small>
          </div>
        </aside>
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="weapon-detail-empty">{text}</p>;
}

function sourceEntryStatusLabel(source: WeaponDetailViewModel["sources"]["entries"][number]): string {
  if (source.kind === "vendor_offer" && source.available_now === true) {
    if (source.offer?.can_purchase === true) return "当前可购买";
    if (source.offer?.can_purchase === false) return "当前有入口 · 条件未满足";
    return "当前有获取入口";
  }
  if (source.kind === "activity_reward" && source.available_now === true) return "当前活动奖励";
  if (source.available_now === true) return "当前有获取入口";
  if (source.kind === "live_status") {
    return source.available_now === false ? "暂未发现入口" : "当前状态未确认";
  }
  if (source.kind === "manifest_hint") return "官方历史资料";
  return "开放时间未确认";
}

function sourceStatusDescription(status: WeaponDetailViewModel["sources"]["status"]): string {
  if (status === "ready") return "已确认当前获取入口；价格、条件和刷新时间以对应商人或活动数据为准。";
  if (status === "partial") return "历史获取途径和当前获取状态分开显示；“暂未发现入口”不代表永久无法获得。";
  return "当前数据不足，暂时无法确认获取方式；不会回退显示已经过期的商人库存。";
}

function catalystStateLabel(model: WeaponDetailViewModel): string {
  const catalyst = model.upgrades.catalyst;
  if (!catalyst) return "";
  if (catalyst.complete) return "已完成并生效";
  if (catalyst.acquired === true) return catalyst.progress !== undefined ? `进行中 · ${catalyst.progress}%` : "已获得 · 进度未返回";
  if (catalyst.acquired === false) return "尚未获得";
  return "仅显示催化剂定义";
}

function configurationKindLabel(kind: WeaponDetailViewModel["configuration"]["kind"]) {
  if (kind === "fixed") return "固定 Perk";
  if (kind === "variable_exotic") return "可变异域配置";
  return "随机 Roll";
}

function countPool(columns: readonly WeaponPerkPoolColumn[]) {
  return columns.reduce((total, column) => total + column.candidates.length, 0);
}

function formatUpdatedAt(value: string): string {
  return formatStandardDateTime(value);
}

function recommendationSourceCandidates(
  model: WeaponDetailViewModel,
  slot: RecommendationSourceSlotMatch
): RecommendationPerkVisual[] {
  const candidates = new Map<string, RecommendationPerkVisual>();
  const addCandidate = (candidate: Omit<RecommendationPerkVisual, "key">) => {
    const normalizedName = normalizedLabel(candidate.name);
    const key = normalizedName ? `name:${normalizedName}` : `hash:${candidate.hash ?? "unknown"}`;
    const existing = candidates.get(key);
    const hashes = [...new Set([
      ...(existing?.hashes ?? []),
      existing?.hash,
      ...(candidate.hashes ?? []),
      candidate.hash
    ].filter((hash): hash is number => Boolean(hash)))];
    candidates.set(key, {
      key,
      hash: candidate.hash ?? existing?.hash,
      hashes,
      name: candidate.name || existing?.name || "未知 Perk",
      englishName: candidate.englishName ?? existing?.englishName,
      description: candidate.description ?? existing?.description,
      icon: candidate.icon ?? existing?.icon,
      selected: candidate.selected ?? existing?.selected,
      unresolved: existing?.unresolved === false || candidate.unresolved === false
        ? false
        : candidate.unresolved ?? existing?.unresolved
    });
  };

  for (const candidate of slot.source_candidates) {
    const visual = findWeaponPerkVisual(model, candidate.hash, candidate.name);
    addCandidate({
      hash: candidate.hash,
      name: candidate.name,
      englishName: candidate.englishName,
      description: candidate.description ?? visual?.description,
      icon: candidate.icon ?? visual?.icon,
      unresolved: false
    });
  }
  for (const name of slot.source_candidate_names) {
    if ([...candidates.values()].some((candidate) => sameLabel(candidate.name, name))) continue;
    const visual = findWeaponPerkVisual(model, undefined, name);
    addCandidate({
      hash: visual?.hash,
      name: visual?.name ?? name,
      description: visual?.description,
      icon: visual?.icon,
      unresolved: !visual
    });
  }
  for (const name of slot.unresolved_source_candidate_names) {
    if ([...candidates.values()].some((candidate) => sameLabel(candidate.name, name))) continue;
    addCandidate({ name, unresolved: true });
  }
  return [...candidates.values()];
}

function recommendationOwnedPerk(
  model: WeaponDetailViewModel,
  plug: RecommendationSourceSlotMatch["instance_owned"][number]
): RecommendationPerkVisual {
  const visual = findWeaponPerkVisual(model, plug.hash, plug.name);
  return {
    key: `owned:${plug.hash || normalizedLabel(plug.name)}`,
    hash: plug.hash,
    name: visual?.name ?? plug.name,
    description: plug.description ?? visual?.description,
    icon: plug.icon ?? visual?.icon,
    selected: plug.selected
  };
}

function recommendationTargetPerk(
  model: WeaponDetailViewModel,
  columnKey: string,
  targetName: string,
  sourceCandidate?: WeaponRecommendationPerkCandidate
): RecommendationPerkVisual {
  const matchedColumn = model.configuration.selection_columns.find((column) => (
    sameLabel(column.key, columnKey) || sameLabel(column.label, columnKey)
  ));
  const selectionCandidates = matchedColumn?.candidates
    ?? model.configuration.selection_columns.flatMap((column) => column.candidates);
  const sourceHashes = new Set([
    ...(sourceCandidate?.hashes ?? []),
    sourceCandidate?.hash
  ].filter((hash): hash is number => Boolean(hash)));
  const ownedMatches = selectionCandidates.filter((candidate) => (
    sourceHashes.has(candidate.hash) || weaponPerkMatchesTarget(model, candidate, targetName)
  ));
  const visual = findWeaponPerkVisual(model, undefined, targetName) ?? ownedMatches[0];
  return {
    key: `target:${normalizedLabel(columnKey)}:${normalizedLabel(targetName)}:${[...sourceHashes].join(",")}`,
    hash: sourceCandidate?.hash ?? visual?.hash,
    hashes: sourceCandidate?.hashes,
    name: sourceCandidate?.name ?? visual?.name ?? targetName,
    englishName: sourceCandidate?.englishName,
    description: sourceCandidate?.description ?? visual?.description,
    icon: sourceCandidate?.icon ?? visual?.icon,
    unresolved: sourceCandidate?.unresolved,
    hit: ownedMatches.length > 0,
    active: ownedMatches.some((candidate) => candidate.selected)
  };
}

function recommendationPerkMatches(
  model: WeaponDetailViewModel,
  candidate: Pick<RecommendationPerkVisual, "hash" | "hashes" | "name">,
  values: ReadonlyArray<{ hash?: number; hashes?: number[]; name: string }>
): boolean {
  const candidateHashes = recommendationPerkIdentityHashes(model, candidate);
  return values.some((value) => {
    const valueHashes = recommendationPerkIdentityHashes(model, value);
    return valueHashes.some((hash) => candidateHashes.includes(hash))
      || sameRecommendationPerkLabel(candidate.name, value.name);
  });
}

function sameRecommendationPerkLabel(left?: string, right?: string): boolean {
  if (sameLabel(left, right)) return true;
  const normalizedLeft = normalizedLabel(stripMasterworkDisplayPrefix(left));
  return Boolean(normalizedLeft)
    && normalizedLeft === normalizedLabel(stripMasterworkDisplayPrefix(right));
}

function stripMasterworkDisplayPrefix(value?: string): string {
  return (value ?? "")
    .replace(/^\s*\d+\s*阶\s*[：:]\s*/u, "")
    .replace(/^\s*大师杰作\s*[：:]\s*/u, "")
    .trim();
}

function recommendationPerkIdentityHashes(
  model: WeaponDetailViewModel,
  candidate: { hash?: number; hashes?: number[]; name: string }
): number[] {
  const visual = findWeaponPerkVisual(model, candidate.hash, candidate.name);
  return [...new Set([
    ...(candidate.hashes ?? []),
    candidate.hash,
    visual?.hash,
    visual?.enhanced_of_hash
  ].filter((hash): hash is number => Boolean(hash)))];
}

function findWeaponPerkVisual(
  model: WeaponDetailViewModel,
  hash: number | undefined,
  name: string | undefined
): WeaponPerkCandidate | undefined {
  const candidates = allWeaponPerkCandidates(model);
  return candidates.find((candidate) => Boolean(hash && candidate.hash === hash))
    ?? candidates.find((candidate) => sameLabel(candidate.name, name));
}

function allWeaponPerkCandidates(model: WeaponDetailViewModel): WeaponPerkCandidate[] {
  return [
    ...(model.configuration.intrinsic ? [model.configuration.intrinsic] : []),
    ...model.configuration.selection_columns.flatMap((column) => column.candidates),
    ...model.configuration.pool_columns.flatMap((column) => column.candidates)
  ];
}

function weaponPerkMatchesTarget(
  model: WeaponDetailViewModel,
  candidate: WeaponPerkCandidate,
  targetName: string
): boolean {
  if (sameLabel(candidate.name, targetName)) return true;
  if (!candidate.enhanced_of_hash) return false;
  const baseCandidate = allWeaponPerkCandidates(model).find((entry) => entry.hash === candidate.enhanced_of_hash);
  return sameLabel(baseCandidate?.name, targetName);
}

function normalizeRecommendationIconUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.startsWith("/") ? `https://www.bungie.net${normalized}` : normalized;
}

function normalizedLabel(value?: string): string {
  return (value ?? "").trim().toLocaleLowerCase();
}

function sameLabel(left?: string, right?: string): boolean {
  const normalizedLeft = normalizedLabel(left);
  return Boolean(normalizedLeft) && normalizedLeft === normalizedLabel(right);
}

function matchFactLabel(hasObject: boolean, matched: boolean): string {
  return hasObject ? matched ? "命中" : "未命中" : "未选择实际对象";
}
