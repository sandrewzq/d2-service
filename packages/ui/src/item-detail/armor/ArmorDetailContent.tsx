import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from "react";
import type {
  ArmorDetailInstance,
  ArmorDetailViewModel,
  ArmorRecommendation,
  ArmorStatTrack
} from "@d2-tools/app/items";
import type { ItemReleaseKind } from "@d2-tools/core/items/release";
import { GameAssetImage } from "../../media/GameAssetImage.js";
import { formatStandardDateTime } from "../../time/formatTime.js";
import { EquipmentDetailContextLedger } from "../EquipmentDetailContextLedger.js";

export type ArmorDetailSection = "overview" | "configuration" | "targets" | "upgrades" | "analysis";

export type ArmorDetailContentActions = {
  selectInstance?: (instance: ArmorDetailInstance) => boolean | void;
  runAnalysis?: (request: { prompt: string; allow_external_search: boolean }) => void;
};

export type ArmorDetailAnalysis = {
  status?: "idle" | "running" | "ready" | "error";
  title?: string;
  body?: string;
  evidence?: Array<{ label: string; value: string }>;
  externalSources?: Array<{ title?: string; url: string; queried_at: string }>;
  externalSearchMessage?: string;
  message?: string;
};

export type ArmorDetailContentProps = {
  model: ArmorDetailViewModel;
  actions?: ArmorDetailContentActions;
  analysis?: ArmorDetailAnalysis;
  activeSection?: ArmorDetailSection;
  onSectionChange?: (section: ArmorDetailSection) => void;
  instanceActions?: ReactNode;
  className?: string;
};

type ArmorTargetSource = "personal" | "loadout" | "community";

const sectionLabels: Array<{ key: ArmorDetailSection; label: string }> = [
  { key: "overview", label: "属性与获取" },
  { key: "configuration", label: "护甲配置" },
  { key: "targets", label: "目标匹配" },
  { key: "upgrades", label: "强化状态" },
  { key: "analysis", label: "AI 分析" }
];

export function ArmorDetailContent(props: ArmorDetailContentProps) {
  const { model } = props;
  const detailLoading = model.loading
    || model.loading_state.definition
    || (model.context.kind === "account_item" && model.loading_state.instance);
  const [internalSection, setInternalSection] = useState<ArmorDetailSection>("overview");
  const [analysisPrompt, setAnalysisPrompt] = useState(() => armorAnalysisPrompt(model));
  const [allowExternalSearch, setAllowExternalSearch] = useState(false);
  const [instanceRailOpen, setInstanceRailOpen] = useState(false);
  const section = props.activeSection ?? internalSection;
  const sectionIdPrefix = useId();
  const detailRef = useRef<HTMLElement>(null);
  const instanceRailRef = useRef<HTMLElement>(null);
  const instanceRailTriggerRef = useRef<HTMLButtonElement>(null);
  const instanceRailCloseRef = useRef<HTMLButtonElement>(null);
  const observedSectionRef = useRef<ArmorDetailSection>("overview");
  const sectionRefs = useRef<Record<ArmorDetailSection, HTMLElement | null>>({
    overview: null,
    configuration: null,
    targets: null,
    upgrades: null,
    analysis: null
  });

  useEffect(() => {
    setInternalSection("overview");
    setAnalysisPrompt(armorAnalysisPrompt(model));
    setAllowExternalSearch(false);
    setInstanceRailOpen(false);
    observedSectionRef.current = "overview";
  }, [model.identity.hash, model.context.object_id, model.context.kind]);

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
    const updateActiveSection = () => {
      const activationLine = scrollRoot.getBoundingClientRect().top + 96;
      let next: ArmorDetailSection = "overview";
      for (const item of sectionLabels) {
        const element = sectionRefs.current[item.key];
        if (element && element.getBoundingClientRect().top <= activationLine) next = item.key;
      }
      if (observedSectionRef.current === next) return;
      observedSectionRef.current = next;
      if (props.activeSection === undefined) setInternalSection(next);
      props.onSectionChange?.(next);
    };
    scrollRoot.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    updateActiveSection();
    return () => {
      scrollRoot.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [model.context.object_id, model.identity.hash, props.activeSection, props.onSectionChange]);

  const changeSection = (next: ArmorDetailSection) => {
    observedSectionRef.current = next;
    if (props.activeSection === undefined) setInternalSection(next);
    props.onSectionChange?.(next);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    sectionRefs.current[next]?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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
    <>
      <article
        ref={detailRef}
        className={["armor-detail", props.className].filter(Boolean).join(" ")}
        data-contract-root="detail-dossier"
        data-contract-id="armor.detail"
        data-detail-contract="detail.dossier"
        data-layout="hybrid-workspace"
        data-surface="page"
        data-state={detailLoading ? "loading" : "normal"}
        aria-busy={detailLoading}
      >
        <ArmorIdentity model={model} />

        <nav className="armor-detail-nav" data-ui-kind="section-navigation" aria-label="护甲详情章节">
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
                {item.label}
              </button>
            ))}
          </div>
          <button
            ref={instanceRailTriggerRef}
            type="button"
            className="armor-detail-rail-toggle"
            data-ui-kind="button"
            data-control-variant="secondary"
            aria-expanded={instanceRailOpen}
            aria-controls={`${sectionIdPrefix}-instance-rail`}
            onClick={() => setInstanceRailOpen((value) => !value)}
          >我的同版本护甲</button>
        </nav>

        <div className="armor-detail-workspace" data-surface="split">
          <div className="armor-detail-sections" data-surface="content-stack">
            <section ref={(node) => { sectionRefs.current.overview = node; }} id={`${sectionIdPrefix}-overview`} className="armor-detail-section">
              <OverviewSection model={model} />
            </section>
            <section ref={(node) => { sectionRefs.current.configuration = node; }} id={`${sectionIdPrefix}-configuration`} className="armor-detail-section">
              <ConfigurationSection model={model} />
            </section>
            <section ref={(node) => { sectionRefs.current.targets = node; }} id={`${sectionIdPrefix}-targets`} className="armor-detail-section">
              <TargetSection model={model} />
            </section>
            <section ref={(node) => { sectionRefs.current.upgrades = node; }} id={`${sectionIdPrefix}-upgrades`} className="armor-detail-section">
              <UpgradeSection model={model} />
            </section>
            <section ref={(node) => { sectionRefs.current.analysis = node; }} id={`${sectionIdPrefix}-analysis`} className="armor-detail-section">
              <AnalysisSection
                model={model}
                analysis={props.analysis}
                prompt={analysisPrompt}
                allowExternalSearch={allowExternalSearch}
                onPromptChange={setAnalysisPrompt}
                onAllowExternalSearchChange={setAllowExternalSearch}
                onRun={props.actions?.runAnalysis}
              />
            </section>
          </div>

          <aside
            ref={instanceRailRef}
            id={`${sectionIdPrefix}-instance-rail`}
            className={["armor-detail-instance-rail", instanceRailOpen && "is-open"].filter(Boolean).join(" ")}
            data-surface="drawer"
            data-ui-kind="drawer"
            data-scroll-region="pane"
            aria-label="当前对象与我的同版本护甲"
            onKeyDown={handleInstanceRailKeyDown}
          >
            <header className="armor-detail-rail-drawer-head">
              <div><span>护甲操作</span><strong>我的同版本护甲</strong></div>
              <button
                ref={instanceRailCloseRef}
                type="button"
                className="armor-detail-rail-close"
                data-ui-kind="button"
                data-control-variant="quiet"
                aria-label="关闭我的同版本护甲"
                title="关闭"
                onClick={() => setInstanceRailOpen(false)}
              >×</button>
            </header>
            {props.instanceActions ? (
              <div className="armor-detail-instance-actions">{props.instanceActions}</div>
            ) : (
              <div className="armor-detail-instance-readonly" data-status="neutral">
                <span>{model.context.kind === "vendor_offer" ? "当前售卖只读" : "资料库内容只读"}</span>
                <h3>{armorObjectLabel(model.context.kind)}</h3>
                <p>{model.context.kind === "vendor_offer"
                  ? "选择下方账号中已有的同版本护甲，可以比较售卖属性并管理已有装备。"
                  : "选择下方账号中已有的同版本护甲后，可执行装备、转移、锁定和本地整理。"}</p>
              </div>
            )}
            <InstancesRail
              model={model}
              onSelect={props.actions?.selectInstance ? (instance) => {
                const selected = props.actions?.selectInstance?.(instance);
                if (selected !== false) setInstanceRailOpen(false);
                return selected;
              } : undefined}
            />
          </aside>
        </div>
      </article>
      <button
        type="button"
        className={["armor-detail-rail-scrim", instanceRailOpen && "is-open"].filter(Boolean).join(" ")}
        data-ui-kind="button"
        data-control-variant="quiet"
        aria-label="关闭我的同版本护甲"
        onClick={() => setInstanceRailOpen(false)}
      />
    </>
  );
}

function ArmorIdentity({ model }: { model: ArmorDetailViewModel }) {
  const { identity, context } = model;
  const primaryAbilityGroup = model.ability_groups[0];
  const selectedGroupOption = primaryAbilityGroup?.options.find((option) => option.hash === primaryAbilityGroup.selected_option_hash);
  const feature = identity.armor_set
    ? { label: identity.armor_set.name, tone: "set", title: identity.armor_set.description }
    : model.abilities[0]
      ? { label: model.abilities[0].name, tone: "ability", title: model.abilities[0].description }
      : primaryAbilityGroup
        ? {
            label: selectedGroupOption?.name ?? primaryAbilityGroup.name,
            tone: "ability",
            title: primaryAbilityGroup.options.map((option) => option.name).join(" / ")
          }
        : undefined;
  const releaseLabel = identity.release?.description ?? "官方定义未提供发布信息";
  const watermarks = identity.definition_version?.watermark_icons ?? [];
  const currentWatermark = identity.definition_version?.current_watermark_icon;
  return (
    <header className="armor-detail-identity" data-surface="section">
      <div className="armor-detail-identity-main">
        <GameAssetImage src={identity.icon} alt="" loading="eager" fallback={<span className="armor-detail-icon-placeholder" aria-hidden="true" />} />
        <div>
          <h2 data-ui-part="value" data-text-tone="primary" data-info-priority="display">{identity.name}</h2>
          <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{[identity.tier, identity.item_type, identity.class_name].filter(Boolean).join(" · ")}</p>
          <div className="armor-detail-facts" aria-label="护甲摘要">
            {identity.tier ? <Fact label={identity.tier} tone={/异域|exotic/i.test(identity.tier) ? "exotic" : "legendary"} /> : null}
            {identity.item_type ? <Fact label={identity.item_type} /> : null}
            {identity.class_name ? <Fact label={identity.class_name} /> : null}
            {feature
              ? <Fact label={feature.label} tone={feature.tone} title={feature.title} />
              : <Fact label={model.loading_state.definition ? "套装与能力读取中" : "没有可确认的套装或固有能力"} tone="incomplete" />}
          </div>
        </div>
      </div>

      <div className="armor-detail-identity-context">
        <EquipmentDetailContextLedger
          entryLabel={context.entry_label}
          currentViewLabel={armorObjectLabel(context.kind)}
          locationLabel={identity.bucket_name ?? identity.item_type ?? "护甲"}
          versionFieldLabel={context.kind === "account_item" ? "装备版本" : context.kind === "vendor_offer" ? "售卖版本" : "发布版本"}
          versionValue={releaseLabel}
          watermarkIcon={currentWatermark}
        />
        <details className="armor-detail-definition-details">
          <summary>护甲定义信息</summary>
          <div>
            <dl><dt>装备 Hash</dt><dd>{identity.hash}</dd></dl>
            <dl><dt>发布版本</dt><dd>{identity.release?.description ?? "资料未返回"}</dd></dl>
            <dl><dt>赛季 Hash</dt><dd>{identity.release?.season_hash ?? "资料未返回"}</dd></dl>
            <dl><dt>发布类型</dt><dd>{armorReleaseKindLabel(identity.release?.kind)}</dd></dl>
            <dl><dt>定义版本</dt><dd>{identity.definition_version?.label ?? "资料未返回"}</dd></dl>
            <dl><dt>光等上限 Hash</dt><dd>{identity.definition_version?.power_cap_hash ?? "资料未返回"}</dd></dl>
            <dl><dt>版本水印</dt><dd>{watermarks.length ? <span className="armor-detail-definition-watermarks">{watermarks.map((icon, index) => <GameAssetImage key={`${icon}:${index}`} src={icon} alt={`官方版本水印 ${index + 1}`} title="官方定义版本水印" loading="eager" />)}</span> : "资料未返回"}</dd></dl>
            <dl><dt>职业限制</dt><dd>{identity.class_name ?? "所有职业"}</dd></dl>
            <dl><dt>护甲部位</dt><dd>{identity.bucket_name ?? identity.item_type ?? "护甲"}</dd></dl>
              <dl><dt>套装或固有能力</dt><dd>{identity.armor_set?.name ?? ([...model.abilities.map((ability) => ability.name), ...model.ability_groups.map((group) => `${group.name}（${group.options.map((option) => option.name).join(" / ")}）`)].join(" / ") || "资料未返回")}</dd></dl>
            <dl><dt>套装 Hash</dt><dd>{identity.armor_set?.hash ?? "资料未返回"}</dd></dl>
            <dl className="is-wide"><dt>定义说明</dt><dd>{identity.description || "当前游戏资料未返回额外说明"}</dd></dl>
          </div>
        </details>
      </div>
    </header>
  );
}

function armorReleaseKindLabel(kind: ItemReleaseKind | undefined): string {
  if (kind === "season") return "赛季";
  if (kind === "annual") return "年度资料片";
  if (kind === "dlc") return "内容包";
  if (kind === "core") return "常规版本";
  if (kind === "update") return "版本更新";
  return "官方未标注";
}

type ArmorObjectKind = ArmorDetailViewModel["context"]["kind"];

function armorObjectLabel(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "当前装备";
  if (kind === "vendor_offer") return "当前售卖";
  return "资料库版本";
}

function armorOverviewTitle(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "本件属性与获取方式";
  if (kind === "vendor_offer") return "售卖属性与购买信息";
  return "属性规则与获取方式";
}

function armorOverviewDescription(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "区分这件护甲的基础属性、当前实际值和已确认加成。";
  if (kind === "vendor_offer") return "只展示本次售卖的真实属性、购买状态和刷新边界。";
  return "资料库版本只说明随机属性规则、固定能力和已确认获取方式。";
}

function ArmorObjectSummary({ model }: { model: ArmorDetailViewModel }) {
  const loading = model.loading_state.definition
    || (model.context.kind === "account_item" && model.loading_state.instance);
  return (
    <div className="armor-detail-object-summary" aria-busy={loading}>
      {armorOverviewSummaryItems(model).map((item) => (
        <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>
      ))}
    </div>
  );
}

function armorOverviewSummaryItems(model: ArmorDetailViewModel): Array<{ label: string; value: string }> {
  const baseTotal = confirmedBaseTotal(model.stats);
  const currentTotal = model.stats.length ? model.stat_total ?? sumCurrentStats(model.stats) : undefined;
  const feature = model.identity.armor_set?.name ?? model.abilities[0]?.name ?? model.ability_groups[0]?.name;
  if (model.context.kind === "account_item") {
    return [
      { label: "当前查看", value: "当前装备" },
      { label: "基础总属性", value: baseTotal !== undefined ? String(baseTotal) : model.loading_state.instance ? "正在读取" : "未确认" },
      { label: "当前总属性", value: currentTotal !== undefined ? String(currentTotal) : model.loading_state.instance ? "正在读取" : "未确认" },
      { label: "强化状态", value: model.energy ? `${model.energy.capacity} 级能量` : model.loading_state.instance ? "正在读取" : "未确认" }
    ];
  }
  if (model.context.kind === "vendor_offer") {
    const offer = model.sources.offer;
    const purchase = offer?.purchase_label
      ?? (offer?.can_purchase === true ? "当前可购买" : offer?.can_purchase === false ? "条件未满足" : model.loading_state.definition ? "正在核对" : "资格未知");
    return [
      { label: "当前查看", value: "当前售卖" },
      { label: "售卖总属性", value: currentTotal !== undefined ? String(currentTotal) : model.loading_state.definition ? "正在读取" : "未提供" },
      { label: "购买状态与价格", value: [purchase, offer?.cost_label].filter(Boolean).join(" · ") },
      { label: "刷新时间", value: offer?.refresh_label ?? (model.loading_state.definition ? "正在读取" : "未提供") }
    ];
  }
  return [
    { label: "当前查看", value: "资料库版本" },
    { label: "属性规则", value: model.loading_state.definition ? "正在读取" : "每件实例随机" },
    { label: "固定内容", value: feature ?? (model.loading_state.definition ? "正在读取" : "没有固定能力") },
    { label: "获取状态", value: model.sources.entries.length ? sourceStatusShortLabel(model.sources.status) : model.loading_state.definition ? "正在读取" : "尚未确认" }
  ];
}

function ArmorLoadingNote({ text }: { text: string }) {
  return <p className="armor-detail-loading-note" role="status" aria-live="polite"><span aria-hidden="true" />{text}</p>;
}

function ArmorDataSkeleton({ rows }: { rows: number }) {
  return <div className="armor-detail-data-skeleton" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

function ArmorFeatureSkeleton() {
  return <div className="armor-detail-feature-skeleton" aria-hidden="true"><i /><div><b /><span /><span /></div></div>;
}

function ArmorSocketSkeleton() {
  return <div className="armor-detail-socket-skeleton" aria-hidden="true">{Array.from({ length: 3 }, (_, index) => <span key={index} />)}</div>;
}

function ArmorDefinitionStatRule() {
  return (
    <article className="armor-detail-definition-rule" data-ui-kind="callout" data-callout-tone="info">
      <strong>这个版本没有固定六维属性</strong>
      <p>实际属性只存在于商人当前售卖品或账号中的具体护甲；资料库不会模拟一件不存在的 Roll。</p>
    </article>
  );
}

function armorStatsLoadingText(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "正在读取这件护甲的基础属性、当前实际值和强化状态。";
  if (kind === "vendor_offer") return "正在读取本次售卖的六维属性、价格和购买条件。";
  return "正在读取这个版本的属性规则、固定能力和获取方式。";
}

function armorStatSourceLabel(model: ArmorDetailViewModel): string {
  if (model.context.kind === "account_item") return model.stats.length ? "当前装备 · 已确认" : model.loading_state.instance ? "当前装备 · 读取中" : "当前装备未返回属性";
  if (model.context.kind === "vendor_offer") return model.stats.length ? "当前售卖 · 已确认" : model.loading_state.definition ? "当前售卖 · 读取中" : "当前售卖未提供属性";
  return model.loading_state.definition ? "资料库属性规则 · 读取中" : "资料库版本没有固定属性";
}

function armorStatNote(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "当前实际值只包含可确认归属于这件护甲的数值；角色级加成不会补入。";
  if (kind === "vendor_offer") return "这些数值只代表本次售卖品，不会回退展示其他角色或上一次售卖属性。";
  return "资料库定义不生成单件护甲属性。";
}

function armorSourceNote(kind: ArmorObjectKind): string {
  if (kind === "vendor_offer") return "历史获取方式和当前售卖分别展示；购买资格未知时不会推断为可购买。";
  if (kind === "account_item") return "获取来源描述这件护甲的版本来源，不代表当前仍然可以获得。";
  return "资料库记录历史来源；只有实时商人或活动数据才能说明当前是否存在获取入口。";
}

function armorConfigurationTitle(kind: ArmorObjectKind, isExotic: boolean, hasSet: boolean): string {
  const feature = isExotic ? "异域能力" : hasSet ? "套装效果" : "固定能力";
  if (kind === "account_item") return `${feature}与本件配置`;
  if (kind === "vendor_offer") return `${feature}与售卖配置`;
  return `${feature}与支持项`;
}

function armorConfigurationDescription(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "固定能力、套装规则和这件护甲已安装的真实内容分别展示。";
  if (kind === "vendor_offer") return "固定能力、套装规则和本次售卖可确认的配置分别展示，全部只读。";
  return "资料库版本只说明固定能力、套装规则和定义可确认的支持项。";
}

function armorConfigurationSource(kind: ArmorObjectKind, loading: boolean): string {
  const state = loading ? "读取中" : "当前确认";
  if (kind === "account_item") return `当前装备 + 游戏资料 · ${state}`;
  if (kind === "vendor_offer") return `当前售卖 + 游戏资料 · ${state}`;
  return `资料库版本 · ${state}`;
}

function armorConfigurationLoadingText(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "已确认的本件配置会先显示，固定能力和完整插槽信息随后补齐。";
  if (kind === "vendor_offer") return "正在读取本次售卖配置；不会用资料库支持项代替当前售卖内容。";
  return "正在读取固定能力、套装规则和这个版本支持的插槽信息。";
}

function armorConfigurationStatus(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "可管理装备";
  if (kind === "vendor_offer") return "售卖只读";
  return "定义只读";
}

function armorSocketCountLabel(kind: ArmorObjectKind, count: number, loading: boolean): string {
  if (loading && count === 0) return "配置插槽读取中";
  if (kind === "account_item") return `${count} 个本件配置项`;
  if (kind === "vendor_offer") return `${count} 个售卖配置项`;
  return `${count} 个定义支持项`;
}

function armorConfigurationCountLabel(
  kind: ArmorObjectKind,
  socketCount: number,
  abilityGroupCount: number,
  loading: boolean
): string {
  if (!abilityGroupCount) return armorSocketCountLabel(kind, socketCount, loading);
  const socketLabel = socketCount > 0 ? ` · ${armorSocketCountLabel(kind, socketCount, false)}` : "";
  return `${abilityGroupCount} 个异域能力组${socketLabel}`;
}

function armorSocketFallback(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "这件护甲当前已安装的内容";
  if (kind === "vendor_offer") return "本次售卖可确认的配置";
  return "资料库定义支持内容";
}

function armorSocketEmptyText(kind: ArmorObjectKind, hasAbilityGroups = false): string {
  if (hasAbilityGroups) return "没有返回额外的护甲模组配置；异域能力支持项已在上方列出。";
  if (kind === "account_item") return "读取完成，但游戏没有返回这件护甲的可显示配置。";
  if (kind === "vendor_offer") return "读取完成，但当前售卖没有返回可显示的护甲配置。";
  return "资料库没有返回这个版本可确认的玩家配置插槽。";
}

function armorUpgradeTitle(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "本件能量与强化状态";
  if (kind === "vendor_offer") return "当前售卖强化状态";
  return "强化规则与定义支持";
}

function armorUpgradeDescription(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "只展示这件护甲可确认的能量、强化和属性变化。";
  if (kind === "vendor_offer") return "只展示本次售卖明确提供的强化事实，未提供的状态不补造。";
  return "资料库版本不保存单件升级进度，只展示定义可确认的强化支持。";
}

function armorUpgradeSource(kind: ArmorObjectKind, loading: boolean): string {
  const state = loading ? "读取中" : "当前确认";
  if (kind === "account_item") return `当前装备 + 游戏规则 · ${state}`;
  if (kind === "vendor_offer") return `当前售卖 + 游戏规则 · ${state}`;
  return `资料库强化规则 · ${state}`;
}

function armorUpgradeLoadingText(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "正在读取这件护甲的能量容量、使用情况和强化插槽。";
  if (kind === "vendor_offer") return "正在核对当前售卖是否提供可确认的强化状态。";
  return "正在读取这个版本可确认的强化规则和支持项。";
}

function armorUpgradeSummary(
  model: ArmorDetailViewModel,
  upgradeSocketCount: number,
  loading: boolean
): Array<{ label: string; value: string }> {
  if (model.context.kind === "account_item") {
    return [
      { label: "当前查看", value: "当前装备" },
      { label: "能量容量", value: model.energy ? `${model.energy.capacity} 级` : loading ? "正在读取" : "未确认" },
      { label: "已用能量", value: model.energy ? String(model.energy.used) : loading ? "正在读取" : "未确认" },
      { label: "剩余能量", value: model.energy ? String(model.energy.unused) : loading ? "正在读取" : "未确认" }
    ];
  }
  if (model.context.kind === "vendor_offer") {
    return [
      { label: "当前查看", value: "当前售卖" },
      { label: "售卖能量", value: model.energy ? `${model.energy.capacity} 级` : loading ? "正在读取" : "商人未提供" },
      { label: "强化内容", value: upgradeSocketCount ? `${upgradeSocketCount} 项` : loading ? "正在读取" : "未提供" },
      { label: "操作状态", value: loading ? "读取中" : "购买前只读" }
    ];
  }
  return [
    { label: "当前查看", value: "资料库版本" },
    { label: "单件进度", value: "由具体装备决定" },
    { label: "定义支持", value: upgradeSocketCount ? `${upgradeSocketCount} 项` : loading ? "正在读取" : "未标注" },
    { label: "操作状态", value: loading ? "读取中" : "规则只读" }
  ];
}

function armorUpgradeEmptyText(kind: ArmorObjectKind): string {
  if (kind === "account_item") return "读取完成，但游戏没有返回这件护甲的强化状态。";
  if (kind === "vendor_offer") return "当前商人没有提供这件售卖护甲的强化状态。";
  return "资料库不保存单件护甲的能量和升级进度。";
}

function armorAnalysisPrompt(model: ArmorDetailViewModel): string {
  if (model.context.kind === "account_item") return "结合本件属性、已安装配置、强化状态、目标匹配和获取来源分析这件护甲。";
  if (model.context.kind === "vendor_offer") return "结合当前售卖属性、价格条件、配置、目标匹配和账号已有同版本护甲分析是否值得关注。";
  return "结合这个护甲版本的固定能力、套装规则、获取方式和目标要求分析其用途。";
}

function armorAnalysisDescription(kind: ArmorObjectKind): string {
  if (kind === "vendor_offer") return "AI 可以解释当前售卖价值，但不会把主观建议写入购买状态或事实区。";
  if (kind === "account_item") return "AI 可以解释本件属性与用途，但不会自动修改、锁定或装备护甲。";
  return "AI 可以解释版本用途和获取方向，但不会为资料库定义伪造单件属性。";
}

function armorTargetUnknownText(kind: ArmorObjectKind): string {
  if (kind === "definition") return "资料库版本没有单件属性，无法判断属性门槛。";
  if (kind === "vendor_offer") return "当前售卖没有可确认的属性匹配数据。";
  return "当前装备没有可确认的属性匹配数据。";
}

function sourceStatusShortLabel(status: ArmorDetailViewModel["sources"]["status"]): string {
  if (status === "ready") return "当前可确认";
  if (status === "partial") return "部分可用";
  return "尚未确认";
}

function OverviewSection({ model }: { model: ArmorDetailViewModel }) {
  const statsLoading = model.context.kind === "account_item"
    ? model.loading_state.instance
    : model.loading_state.definition;
  const sourceLoading = model.loading_state.definition && !model.sources.entries.length;
  return (
    <>
      <SectionHeading
        eyebrow="属性与获取"
        title={armorOverviewTitle(model.context.kind)}
        description={armorOverviewDescription(model.context.kind)}
      />
      <ArmorObjectSummary model={model} />
      {statsLoading ? <ArmorLoadingNote text={armorStatsLoadingText(model.context.kind)} /> : null}
      <div className="armor-detail-overview-grid">
        <section className="armor-detail-data-block">
          <DataBlockHeading title="护甲属性" source={armorStatSourceLabel(model)} />
          {model.stats.length ? (
            <>
              <div className="armor-detail-stat-list">
                {model.stats.map((stat) => <ArmorStatRow key={stat.key} stat={stat} kind={model.context.kind} />)}
              </div>
              <p className="armor-detail-stat-note">{armorStatNote(model.context.kind)}</p>
            </>
          ) : statsLoading
            ? <ArmorDataSkeleton rows={6} />
            : model.context.kind === "definition"
              ? <ArmorDefinitionStatRule />
              : <EmptyState text={model.context.kind === "vendor_offer"
                ? "读取完成，但当前售卖内容没有返回可显示的护甲属性。"
                : "读取完成，但游戏没有返回这件护甲的可显示属性。"} />}
        </section>

        <section className="armor-detail-data-block">
          <DataBlockHeading title="获取来源" source={sourceStatusLabel(model)} />
          {model.sources.entries.length ? (
            <div className="armor-detail-source-ledger">
              {model.sources.entries.map((source) => (
                <article key={source.id} className="armor-detail-source-row" data-surface="row" data-status={source.available_now === true ? "success" : source.available_now === false ? "warning" : "neutral"}>
                  <strong>{source.label}</strong>
                  <p>{source.description}</p>
                  <span className={source.available_now === false ? "is-muted" : source.available_now === undefined ? "is-neutral" : undefined}>{source.status_label ?? (source.available_now ? "当前可获得" : "来源已记录")}</span>
                </article>
              ))}
            </div>
          ) : sourceLoading
            ? <ArmorDataSkeleton rows={3} />
            : <EmptyState text="这件护甲的获取方式暂未确认。" />}
          <p className="armor-detail-note" data-ui-kind="callout" data-callout-tone="info">{armorSourceNote(model.context.kind)}</p>
        </section>
      </div>
    </>
  );
}

function ConfigurationSection({ model }: { model: ArmorDetailViewModel }) {
  const isExotic = /异域|exotic/i.test(model.identity.tier ?? "");
  const armorSet = model.identity.armor_set;
  const abilityOptionHashes = new Set(model.ability_groups.flatMap((group) => group.options.map((option) => option.hash)));
  const configurationSockets = model.sockets.filter((socket) => socket.kind !== "upgrade" && !abilityOptionHashes.has(socket.hash));
  const configurationLoading = model.loading_state.definition
    || (model.context.kind === "account_item" && model.loading_state.instance);
  const featureLoading = model.loading_state.definition && !armorSet && !model.abilities.length && !model.ability_groups.length;
  const socketLoading = configurationLoading && !configurationSockets.length;
  return (
    <>
      <SectionHeading
        eyebrow="护甲配置"
        title={armorConfigurationTitle(model.context.kind, isExotic, Boolean(armorSet))}
        description={armorConfigurationDescription(model.context.kind)}
      />
      <DataBlockHeading title="配置数据" source={armorConfigurationSource(model.context.kind, configurationLoading)} />
      {configurationLoading ? <ArmorLoadingNote text={armorConfigurationLoadingText(model.context.kind)} /> : null}
      <div className="armor-detail-configuration">
        <div className="armor-detail-configuration-grid">
          <div className="armor-detail-core-features">
            {armorSet ? <ArmorSetBonus armorSet={armorSet} /> : null}
            {model.abilities.length ? model.abilities.map((ability) => (
              <article key={ability.hash} className={["armor-detail-core-feature", isExotic && "is-exotic"].filter(Boolean).join(" ")} data-ui-kind="object-card">
                <GameAssetImage className="game-definition-icon" src={ability.icon} alt="" loading="eager" fallback={<span className="armor-detail-core-feature-icon" aria-hidden="true" />} />
                <div><span>{isExotic ? "异域固有能力" : "护甲能力"}</span><h4>{ability.name}</h4><p>{ability.description}</p><small>固定能力与单件随机属性、已安装配置分别展示。</small></div>
              </article>
            )) : null}
            {model.ability_groups.map((group) => (
              <ArmorAbilityGroupCard key={group.key} model={model} group={group} />
            ))}
            {!armorSet && !model.abilities.length && !model.ability_groups.length
              ? featureLoading
                ? <ArmorFeatureSkeleton />
                : <EmptyState text="游戏资料没有返回可确认的固定护甲能力。" />
              : null}
          </div>
          <div className="armor-detail-capability-table">
            <CapabilityRow label="适用职业" value={model.identity.class_name ?? "所有职业"} status="装备要求" />
            <CapabilityRow label="护甲部位" value={model.identity.bucket_name ?? model.identity.item_type ?? "护甲"} status="部位规则" />
            <CapabilityRow label="随机属性" value="每件商人售卖品或账号中的具体护甲可能拥有不同属性分布" status="每件可能不同" />
            <CapabilityRow label="当前查看" value={armorObjectLabel(model.context.kind)} status={armorConfigurationStatus(model.context.kind)} />
            {isExotic ? <CapabilityRow label="异域限制" value="同一时间只能装备一件异域护甲" status="装备规则" /> : null}
          </div>
        </div>

        <div className="armor-detail-socket-block">
          <div className="armor-detail-socket-heading">
            <strong>{armorConfigurationCountLabel(model.context.kind, configurationSockets.length, model.ability_groups.length, socketLoading)}</strong>
            <span>{armorObjectLabel(model.context.kind)}</span>
          </div>
          {configurationSockets.length ? configurationSockets.map((socket) => (
            <article key={socket.key} className={socket.kind === "special" ? "is-special" : undefined}>
              <strong>{socket.label}</strong>
              <div><GameAssetImage className="game-definition-icon" src={socket.icon} alt="" loading="eager" /><p>{socket.name}</p></div>
              <small>{socket.description ?? armorSocketFallback(model.context.kind)}</small>
            </article>
          )) : socketLoading
            ? <ArmorSocketSkeleton />
            : <EmptyState text={armorSocketEmptyText(model.context.kind, model.ability_groups.length > 0)} />}
        </div>
      </div>
    </>
  );
}

function ArmorAbilityGroupCard(props: {
  model: ArmorDetailViewModel;
  group: ArmorDetailViewModel["ability_groups"][number];
}) {
  const selectedOption = props.group.options.find((option) => option.hash === props.group.selected_option_hash);
  const contextLabel = props.model.context.kind === "account_item"
    ? "本件当前选择"
    : props.model.context.kind === "vendor_offer"
      ? "当前售卖选择"
      : "资料库支持能力";
  const selectionStatus = selectedOption
    ? `${contextLabel}：${selectedOption.name}`
    : props.model.context.kind === "vendor_offer"
      ? "本次售卖未固定学派，购买后可在游戏中选择"
      : props.model.context.kind === "account_item"
        ? "本件当前选择尚未返回"
        : "该护甲支持以下异域能力选择";
  return (
    <section className="armor-detail-ability-group" data-ui-kind="object-card" aria-label={props.group.name}>
      <header>
        <div><span>异域能力选择</span><h4>{props.group.name}</h4></div>
        <small>{selectionStatus}</small>
      </header>
      <ol>
        {props.group.options.map((option) => {
          const selected = option.hash === props.group.selected_option_hash;
          return (
            <li key={option.hash} data-selected={selected ? "true" : undefined}>
              <GameAssetImage className="game-definition-icon" src={option.icon} alt="" loading="eager" fallback={<span className="armor-detail-ability-option-icon" aria-hidden="true" />} />
              <div><strong>{option.name}</strong><p>{option.description}</p></div>
              <em>{selected ? contextLabel : "可选能力"}</em>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ArmorSetBonus(props: { armorSet: NonNullable<ArmorDetailViewModel["identity"]["armor_set"]> }) {
  const bonuses = props.armorSet.bonuses ?? [];
  return (
    <section className="armor-detail-set-bonus" data-ui-kind="object-card" aria-label={`${props.armorSet.name}套装效果`}>
      <header>
        <div><span>套装效果</span><h4>{props.armorSet.name}</h4></div>
        <small>游戏官方套装规则</small>
      </header>
      {props.armorSet.description ? <p className="armor-detail-set-description">{props.armorSet.description}</p> : null}
      {bonuses.length ? (
        <ol>
          {bonuses.map((bonus, index) => (
            <li key={`${bonus.required_piece_count}:${bonus.perk_hash}`}>
              <strong>{bonus.required_piece_count} 件套</strong>
              <GameAssetImage className="game-definition-icon" src={bonus.icon} alt="" loading="eager" fallback={<span className="armor-detail-set-perk-icon" aria-hidden="true" />} />
              <div><b>{bonus.name ?? `套装效果 ${index + 1}`}</b><p>{bonus.description ?? "官方套装效果定义未返回说明。"}</p></div>
            </li>
          ))}
        </ol>
      ) : <EmptyState text="官方套装定义未返回可确认的套装效果。" />}
    </section>
  );
}

function TargetSection({ model }: { model: ArmorDetailViewModel }) {
  const [source, setSource] = useState<ArmorTargetSource>("personal");
  const panelId = useId();
  const recommendationsBySource: Record<ArmorTargetSource, ArmorRecommendation[]> = {
    personal: model.recommendations.filter((recommendation) => recommendation.source_label === "我的推荐"),
    loadout: model.recommendations.filter((recommendation) => recommendation.source_label === "应用推荐"),
    community: model.recommendations.filter((recommendation) => recommendation.source_label === "在线补充推荐")
  };
  const sourceOrder: ArmorTargetSource[] = ["personal", "loadout", "community"];
  const targets = recommendationsBySource[source];
  const handleSourceKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const currentIndex = sourceOrder.indexOf(source);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? sourceOrder.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + sourceOrder.length) % sourceOrder.length;
    const nextSource = sourceOrder[nextIndex];
    event.preventDefault();
    setSource(nextSource);
    requestAnimationFrame(() => document.getElementById(`${panelId}-${nextSource}`)?.focus());
  };
  return (
    <>
      <SectionHeading eyebrow="目标匹配" title="独立数据源条件匹配" description="个人目标、配装与攻略要求、社区来源分别匹配，不合并排序，不生成保留或购买结论。" />
      <div className="armor-detail-target-tabs" data-ui-kind="segmented-control" role="tablist" aria-label="选择护甲目标数据源">
        {([[
          "personal", "个人目标"
        ], [
          "loadout", "配装与攻略"
        ], [
          "community", "社区来源"
        ]] as const).map(([key, label]) => (
          <button
            key={key}
            id={`${panelId}-${key}`}
            type="button"
            role="tab"
            aria-controls={`${panelId}-panel`}
            aria-selected={source === key}
            tabIndex={source === key ? 0 : -1}
            onClick={() => setSource(key)}
            onKeyDown={handleSourceKeyDown}
          >{label}<span>{recommendationsBySource[key].length}</span></button>
        ))}
      </div>
      <div id={`${panelId}-panel`} className="armor-detail-target-list" role="tabpanel" aria-labelledby={`${panelId}-${source}`}>
        {targets.length ? targets.map((recommendation) => <RecommendationCard key={recommendation.id} model={model} recommendation={recommendation} />) : <EmptyState text="当前来源没有护甲目标；不会从其他来源补齐。" />}
      </div>
    </>
  );
}

function UpgradeSection({ model }: { model: ArmorDetailViewModel }) {
  const upgradeSockets = model.sockets.filter((socket) => socket.kind === "upgrade");
  const baseTotal = confirmedBaseTotal(model.stats);
  const upgradeLoading = model.context.kind === "account_item"
    ? model.loading_state.instance
    : model.loading_state.definition;
  const objectLabel = armorObjectLabel(model.context.kind);
  const rows = [
    model.context.kind !== "definition" && model.energy ? {
      key: "capacity",
      label: "能量容量",
      definition: "游戏返回的强化状态",
      current: `${model.energy.capacity} 级`,
      source: model.context.kind === "vendor_offer" ? "当前售卖" : "当前装备"
    } : null,
    model.context.kind !== "definition" && model.energy ? {
      key: "usage",
      label: "能量使用",
      definition: "已用与剩余能量",
      current: `已用 ${model.energy.used} · 剩余 ${model.energy.unused}`,
      source: model.context.kind === "vendor_offer" ? "当前售卖" : "当前装备"
    } : null,
    model.context.kind === "account_item" && baseTotal !== undefined ? {
      key: "stats",
      label: "强化后属性",
      definition: `基础 ${baseTotal}`,
      current: `当前 ${model.stat_total ?? sumCurrentStats(model.stats)}`,
      source: "本件属性与模组"
    } : null,
    ...upgradeSockets.map((socket) => ({
      key: socket.key,
      label: socket.label,
      definition: socket.description ?? "强化类插槽",
      current: socket.name,
      source: model.context.kind === "definition" ? "资料库版本" : objectLabel
    }))
  ].filter((row): row is NonNullable<typeof row> => Boolean(row));
  const summary = armorUpgradeSummary(model, upgradeSockets.length, upgradeLoading);
  return (
    <>
      <SectionHeading eyebrow="强化状态" title={armorUpgradeTitle(model.context.kind)} description={armorUpgradeDescription(model.context.kind)} />
      <DataBlockHeading title="强化数据" source={armorUpgradeSource(model.context.kind, upgradeLoading)} />
      {upgradeLoading ? <ArmorLoadingNote text={armorUpgradeLoadingText(model.context.kind)} /> : null}
      <div className="armor-detail-upgrade-layout">
        <div className="armor-detail-upgrade-summary">
          {summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong></div>)}
        </div>
        {rows.length ? (
          <div className="armor-detail-upgrade-table" role="table" aria-label="护甲强化状态">
            <div role="row"><strong role="columnheader">项目</strong><strong role="columnheader">规则／基础</strong><strong role="columnheader">{objectLabel}</strong><strong role="columnheader">数据来源</strong></div>
            {rows.map((row) => <div key={row.key} role="row"><strong role="cell">{row.label}</strong><span role="cell">{row.definition}</span><span role="cell">{row.current}</span><span role="cell">{row.source}</span></div>)}
          </div>
        ) : upgradeLoading
          ? <ArmorDataSkeleton rows={3} />
          : <EmptyState text={armorUpgradeEmptyText(model.context.kind)} />}
      </div>
    </>
  );
}

function AnalysisSection(props: {
  model: ArmorDetailViewModel;
  analysis?: ArmorDetailAnalysis;
  prompt: string;
  allowExternalSearch: boolean;
  onPromptChange: (value: string) => void;
  onAllowExternalSearchChange: (value: boolean) => void;
  onRun?: (request: { prompt: string; allow_external_search: boolean }) => void;
}) {
  const status = props.analysis?.status ?? "idle";
  return (
    <>
      <SectionHeading eyebrow="智能分析" title="AI 护甲分析" description={armorAnalysisDescription(props.model.context.kind)} />
      <div className="armor-detail-ai-layout" aria-busy={status === "running"}>
        <div className="armor-detail-ai-analysis">
          {props.analysis?.message || status === "running" ? <p className={`status-message status-${status === "error" ? "error" : status === "ready" ? "ready" : "pending"}`} role="status">{props.analysis?.message ?? "正在分析这件护甲..."}</p> : null}
          {props.analysis?.body ? (
            <article className="armor-detail-ai-result" data-ui-kind="callout" data-callout-tone="ai">
              <span>AI 生成 · 用户尚未确认</span>
              <h4>{props.analysis.title ?? `${props.model.identity.name}分析`}</h4>
              <p>{props.analysis.body}</p>
              {props.analysis.evidence?.length ? <dl>{props.analysis.evidence.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{entry.value}</dd></div>)}</dl> : null}
            </article>
          ) : <EmptyState text="运行分析后，这里会显示主观结论和使用依据。" />}
          {props.analysis?.externalSearchMessage ? <p className="armor-detail-note" data-ui-kind="callout" data-callout-tone="info">{props.analysis.externalSearchMessage}</p> : null}
          {props.analysis?.externalSources?.length ? (
            <section className="armor-detail-external-sources" aria-label="AI 外部知识来源">
              <DataBlockHeading title="外部知识来源" source="最低优先级" />
              <ul>{props.analysis.externalSources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title ?? source.url}</a><span>{formatStandardDateTime(source.queried_at)}</span></li>)}</ul>
            </section>
          ) : null}
        </div>
        <aside className="armor-detail-ai-tools">
          <label htmlFor="armor-detail-question">询问这件护甲</label>
          <textarea id="armor-detail-question" value={props.prompt} onChange={(event) => props.onPromptChange(event.target.value)} />
          <label className="armor-detail-ai-external"><input type="checkbox" checked={props.allowExternalSearch} onChange={(event) => props.onAllowExternalSearchChange(event.target.checked)} />允许 AI 查询外部知识，必须保留引用</label>
          <button type="button" data-ui-kind="button" data-control-variant="ai" data-control-size="prominent" disabled={!props.onRun || status === "running"} onClick={() => props.onRun?.({ prompt: props.prompt, allow_external_search: props.allowExternalSearch })}>{status === "running" ? "正在分析..." : "分析这件护甲"}</button>
          <small>AI 结果不会自动进入可靠数据区。</small>
        </aside>
      </div>
    </>
  );
}

function InstancesRail(props: { model: ArmorDetailViewModel; onSelect?: (instance: ArmorDetailInstance) => boolean | void }) {
  return (
    <section className="armor-detail-rail-instances">
      <div className="armor-detail-rail-heading">
        <div><span>账号已有</span><h3>同版本护甲</h3></div>
        <strong>{props.model.same_hash_instances.length} 件</strong>
      </div>
      {props.model.same_hash_instances.length ? (
        <div className="armor-detail-instance-list" role="list">
          {props.model.same_hash_instances.map((instance) => (
            <button
              key={instance.instance_id}
              type="button"
              role="listitem"
              className={instance.current ? "is-current" : undefined}
              aria-current={instance.current ? "true" : undefined}
              onClick={() => props.onSelect?.(instance)}
              disabled={!props.onSelect}
            >
              <header><strong>{instance.current ? "当前装备" : instance.equipped ? "已装备护甲" : "账号护甲"}</strong><span>{instance.location}{instance.power ? ` · ${instance.power}` : ""}</span></header>
              <div className="armor-detail-instance-total"><strong>{instance.stats?.total ?? "—"}</strong><span>{energyLabel(instance.energy)}</span></div>
              {instance.stats ? <div className="armor-detail-stat-strip">{instanceStatEntries(instance).map(([label, value]) => <span key={label}>{label}<b>{value}</b></span>)}</div> : <small className="armor-detail-instance-no-stats">属性暂未获取</small>}
              <div className="armor-detail-instance-foot">
                <span>{instance.locked === undefined ? "锁定状态未知" : instance.locked ? "已锁定" : "未锁定"}</span>
                <span>{instance.equipped ? "已装备" : "未装备"}</span>
                {instance.plug_names.slice(0, 2).map((name, plugIndex) => <span key={`${name}-${plugIndex}`}>{name}</span>)}
              </div>
            </button>
          ))}
        </div>
      ) : <EmptyState text="账号中没有这个版本的护甲。" />}
      <p className="armor-detail-rail-note">这里只显示账号中相同游戏版本的护甲；装备和转移仍受职业兼容性限制。</p>
    </section>
  );
}

function SectionHeading(props: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="armor-detail-section-heading">
      <div><span data-ui-part="label" data-text-tone="meta" data-info-priority="support">{props.eyebrow}</span><h3 data-ui-part="value" data-text-tone="primary" data-info-priority="display">{props.title}</h3></div>
      <p data-ui-part="detail" data-text-tone="body" data-info-priority="reading">{props.description}</p>
    </div>
  );
}

function DataBlockHeading(props: { title: string; source: string }) {
  return <div className="armor-detail-data-heading"><h4 data-ui-part="value" data-text-tone="primary" data-info-priority="context">{props.title}</h4><span data-ui-part="source" data-text-tone="meta" data-info-priority="trace">{props.source}</span></div>;
}

function Fact(props: { label: string; tone?: string; title?: string }) {
  return <span className={["armor-detail-fact", props.tone].filter(Boolean).join(" ")} title={props.title} data-ui-part="value" data-text-tone="primary" data-info-priority="support">{props.label}</span>;
}

function CapabilityRow(props: { label: string; value: string; status: string }) {
  return <div><strong>{props.label}</strong><span>{props.value}</span><em>{props.status}</em></div>;
}

function ArmorStatRow({ stat, kind }: { stat: ArmorStatTrack; kind: ArmorObjectKind }) {
  const base = stat.base;
  const showBase = kind === "account_item" && base !== undefined;
  const baseWidth = showBase ? Math.max(0, Math.min(100, ((base ?? 0) / 45) * 100)) : 0;
  const currentWidth = Math.max(0, Math.min(100, (stat.value / 45) * 100));
  const style = {
    "--armor-stat-base": `${baseWidth}%`,
    "--armor-stat-current": `${currentWidth}%`
  } as CSSProperties;
  return (
    <div className="armor-detail-stat-row" data-surface="row">
      <strong>{stat.label}</strong>
      <span className="armor-detail-stat-base">{kind === "vendor_offer" ? "售卖属性" : base !== undefined ? `基础 ${base}` : "基础未确认"}</span>
      <i style={style} aria-hidden="true"><b className="is-current" />{showBase ? <b className="is-base" /> : null}</i>
      <span className="armor-detail-stat-current">{stat.value}</span>
      {stat.mod ? <small>已确认加成 +{stat.mod}</small> : null}
    </div>
  );
}

function RecommendationCard({ model, recommendation }: { model: ArmorDetailViewModel; recommendation: ArmorRecommendation }) {
  const match = recommendationMatch(recommendation.match);
  const objectLabel = armorObjectLabel(model.context.kind);
  return (
    <article className="armor-detail-recommendation" data-surface="object-card" data-ui-kind="object-card">
      <header><div><h4>{recommendation.title}</h4><p>{recommendation.source_label} · 独立来源</p></div><span>条件匹配</span></header>
      <div className="armor-detail-condition-list">
        <div><span>目标条件</span><strong>{recommendation.value}</strong><em>来源定义</em></div>
        <div data-status={recommendation.match === "full" ? "success" : recommendation.match ? "warning" : "neutral"}><span>{objectLabel}</span><strong>{recommendation.match ? `${objectLabel}：${match}` : armorTargetUnknownText(model.context.kind)}</strong><em className={recommendation.match === "full" ? "is-hit" : recommendation.match ? "is-miss" : "is-unknown"}>{match}</em></div>
      </div>
      <p className="armor-detail-source-quote" data-ui-kind="callout" data-callout-tone="info">{recommendation.reason}</p>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="armor-detail-empty">{text}</p>;
}

function confirmedBaseTotal(stats: ArmorStatTrack[]): number | undefined {
  return stats.length && stats.every((stat) => stat.base !== undefined)
    ? stats.reduce((total, stat) => total + (stat.base ?? 0), 0)
    : undefined;
}

function sumCurrentStats(stats: ArmorStatTrack[]): number {
  return stats.reduce((total, stat) => total + stat.value, 0);
}

function energyLabel(energy: ArmorDetailViewModel["energy"]): string {
  if (!energy) return "强化状态未确认";
  return `${energy.capacity} 级能量 · 剩余 ${energy.unused}`;
}

function sourceStatusLabel(model: ArmorDetailViewModel): string {
  const state = sourceStatusShortLabel(model.sources.status);
  if (model.context.kind === "vendor_offer") return `当前售卖 + 游戏资料 · ${state}`;
  if (model.context.kind === "account_item") return `装备版本来源 + 当前获取状态 · ${state}`;
  return `资料库历史来源 + 当前获取状态 · ${state}`;
}

function recommendationMatch(match: ArmorRecommendation["match"]): string {
  if (match === "full") return "达到条件";
  if (match === "partial") return "部分达到";
  if (match === "none") return "未达到条件";
  return "无实例数据";
}

function instanceStatEntries(instance: ArmorDetailInstance): Array<[string, number]> {
  if (!instance.stats) return [];
  return [
    ["生", instance.stats.health],
    ["近", instance.stats.melee],
    ["雷", instance.stats.grenade],
    ["超", instance.stats.super],
    ["职", instance.stats.class],
    ["武", instance.stats.weapon]
  ];
}
