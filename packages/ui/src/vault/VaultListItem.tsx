import { memo } from "react";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import type { ArmorStatKey } from "@d2-tools/core/loadouts/analysis";
import type { VaultTagValue } from "@d2-tools/core/vault/tags";
import { ammoFilterLabels, armorStatLabels, formatArmorStatsInline, getAccountItemSlotLabel, getVaultItemKey, getVaultItemLocationLabel, tagLabels } from "@d2-tools/app/vault";
import { GameAssetImage } from "../media/GameAssetImage.js";
import { VaultAmmoTypeIcon, VaultDamageTypeIcon } from "./VaultWeaponFactIcons.js";
import type { VaultRecommendationSourceSummary } from "./vaultRecommendationMatch.js";
import {
  useVaultQuickAction,
  type VaultQuickActionStore
} from "./vaultQuickActionStore.js";

type VaultListItemProps = {
  item: AccountItemSummary;
  tagValue: VaultTagValue;
  isLoadoutMatch: boolean;
  sourceSummaries: VaultRecommendationSourceSummary[];
  additionalSourceCount: number;
  imagePriority?: boolean;
  isOrganizing: boolean;
  isSelected: boolean;
  isOpening?: boolean;
  currentCharacterId?: string;
  currentCharacterLabel?: string;
  quickActionStore: VaultQuickActionStore;
  quickActionsDisabled?: boolean;
  onSelectItem: (item: AccountItemSummary) => void;
  onToggleSelected: (item: AccountItemSummary) => void;
  onQuickAction?: (item: AccountItemSummary, action: "lock" | "unlock" | "transfer") => void | Promise<void>;
};

export function VaultListItem(props: VaultListItemProps) {
  const disposition = dispositionForTag(props.tagValue);
  const gearTier = displayGearTier(props.item.instance?.gear_tier);
  const isWeapon = props.item.group_key === "weapons";
  const isArmor = props.item.group_key === "armor";
  const detailAvailable = props.item.group_key === "weapons" || props.item.group_key === "armor";
  const gearTierOverlay = props.item.instance?.gear_tier_overlay ?? gearTierOverlayUrl(gearTier);
  const crafting = isWeapon ? props.item.crafting : undefined;
  const visual = (
    <div
      className="vault-card-visual"
      title={[
        gearTier > 0 ? `装备阶级 T${gearTier}` : "",
        crafting ? craftingLabel(crafting.kind, true) : ""
      ].filter(Boolean).join(" · ") || undefined}
    >
      <GameAssetImage
        alt=""
        fetchPriority={props.imagePriority ? "high" : "auto"}
        loading={props.imagePriority ? "eager" : "lazy"}
        src={props.item.icon}
        fallback={<div className="item-icon-placeholder" />}
      />
      {crafting?.background ? (
        <GameAssetImage
          className="vault-crafting-background"
          alt=""
          aria-hidden="true"
          loading={props.imagePriority ? "eager" : "lazy"}
          src={crafting.background}
        />
      ) : null}
      {crafting?.overlay ? (
        <GameAssetImage
          className="vault-crafting-overlay"
          alt=""
          aria-hidden="true"
          loading={props.imagePriority ? "eager" : "lazy"}
          src={crafting.overlay}
        />
      ) : null}
      <GameAssetImage
        className="vault-gear-tier"
        alt=""
        aria-hidden="true"
        loading={props.imagePriority ? "eager" : "lazy"}
        src={gearTierOverlay}
      />
    </div>
  );
  const stateFlags = (
    <span className="vault-card-state-flags">
      {props.item.locked ? <span className="vault-item-lock-icon" aria-label="已锁定" title="已锁定"><i /></span> : null}
      {props.isLoadoutMatch ? <small data-status="success">配装</small> : null}
      {props.isOpening ? <small data-status="pending">打开中</small> : null}
    </span>
  );
  const strongestArmorStat = isArmor ? getStrongestArmorStat(props.item) : undefined;
  const sourceSummaries = isWeapon ? props.sourceSummaries : [];
  const totalSourceCount = sourceSummaries.length + props.additionalSourceCount;
  const itemKey = getVaultItemKey(props.item);
  const activeQuickAction = useVaultQuickAction(props.quickActionStore, itemKey);
  const canUseQuickActions = Boolean(props.item.instance_id && props.onQuickAction);
  const canTransfer = canUseQuickActions && getItemSourceKind(props.item) === "vault" && Boolean(props.currentCharacterId);
  const lockQuickAction = props.item.locked ? "unlock" : "lock";
  const lockQuickActionLabel = props.item.locked ? "解锁" : "加锁";
  const activeLockQuickAction = activeQuickAction === "lock" || activeQuickAction === "unlock"
    ? activeQuickAction
    : undefined;
  const activeLockQuickActionLabel = activeLockQuickAction === "unlock" ? "解锁" : "加锁";
  const cardContent = isWeapon ? <>
      <div className="vault-weapon-identity">
        {visual}
        <div className="vault-weapon-copy">
          <strong title={props.item.name}>{props.item.name}</strong>
          <span title={[getAccountItemSlotLabel(props.item), props.item.item_type].filter(Boolean).join(" · ")}>
            {[formatWeaponSlot(props.item), props.item.item_type || "武器"].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <div className="vault-weapon-fact-row">
        <span className={`vault-weapon-fact ammo-${props.item.ammo_type ?? "unknown"}`} title={props.item.ammo_type ? ammoFilterLabels[props.item.ammo_type] : "弹药类型未知"}>
          <VaultAmmoTypeIcon type={props.item.ammo_type} size="compact" />
          <span>{formatAmmoCompact(props.item.ammo_type)}</span>
        </span>
        <span className="vault-weapon-fact" title={formatVaultCardContext(props.item)}>
          <VaultDamageTypeIcon damageType={props.item.instance?.damage_type} src={props.item.instance?.damage_type_icon} size="compact" />
          <span>{formatVaultCardContext(props.item) || "属性未知"}</span>
        </span>
        <span className="vault-weapon-power" title={`光等 ${props.item.power ?? "未知"}`}>
          <small>光</small><strong>{props.item.power ?? "—"}</strong>
        </span>
      </div>
      <div
        className="vault-weapon-source-summary"
        aria-label={sourceSummaries.length
          ? `推荐 Roll 匹配：${sourceSummaries.map((summary) => summary.detail).join("；")}${props.additionalSourceCount > 0 ? `；另有 ${props.additionalSourceCount} 个来源，请进入详情查看` : ""}`
          : "当前武器暂无推荐来源"}
      >
        <span className="vault-weapon-source-head">
          <span>推荐 Roll 匹配</span>
          <small>{totalSourceCount > 0
            ? `${totalSourceCount} 个来源${props.additionalSourceCount > 0 ? ` · 另有 ${props.additionalSourceCount} 个` : ""}`
            : "暂无来源"}</small>
        </span>
        <span className="vault-weapon-source-list">
          {sourceSummaries.map((summary) => (
            <span
              className="vault-weapon-source-row"
              data-match-state={summary.state}
              key={summary.sourceId}
              title={summary.detail}
            >
              <span>{summary.shortLabel}</span>
              <strong>{summary.resultText}</strong>
            </span>
          ))}
          {!sourceSummaries.length ? <span className="vault-weapon-source-empty">暂无推荐来源</span> : null}
        </span>
      </div>
      <div className="vault-weapon-status">
        <span className="vault-weapon-location-state">
          <span className="vault-weapon-location">{getVaultItemLocationLabel(props.item)}</span>
          {crafting ? (
            <span
              className="vault-weapon-crafting"
              data-crafting-kind={crafting.kind}
              title={craftingLabel(crafting.kind, true)}
            >
              {craftingLabel(crafting.kind)}
            </span>
          ) : null}
          {disposition === "none"
            ? props.isOrganizing ? <span className="vault-weapon-unmarked">未整理</span> : null
            : <span className={`vault-score-badge score-${disposition}`}>{dispositionShortLabel(disposition)}</span>}
        </span>
        {stateFlags}
      </div>
    </> : isArmor ? <>
      <div className="vault-armor-identity">
        {visual}
        <div className="vault-armor-copy">
          <strong title={props.item.name}>{props.item.name}</strong>
          <span>{classTypeLabel(props.item.class_type) || "通用护甲"}</span>
          <span title={props.item.bucket_name}>{props.item.bucket_name || props.item.item_type || "未知部位"}</span>
        </div>
      </div>
      <div className="vault-armor-fact-row">
        <span className="vault-armor-fact"><small>总值</small><strong>{props.item.armor_stats?.total ?? "—"}</strong></span>
        <span className="vault-armor-fact" title={strongestArmorStat?.fullLabel}>
          <small>{strongestArmorStat?.label ?? "属性"}</small><strong>{strongestArmorStat?.value ?? "—"}</strong>
        </span>
        <span className="vault-weapon-power" title={`光等 ${props.item.power ?? "未知"}`}>
          <small>光</small><strong>{props.item.power ?? "—"}</strong>
        </span>
      </div>
      <div className="vault-armor-status">
        <span className={`vault-score-badge score-${disposition}`}>{dispositionShortLabel(disposition)}</span>
        {stateFlags}
      </div>
    </> : <>
      <div className="vault-card-visual-stack">
        {visual}
        <span className="vault-card-power">{props.item.power ?? "—"}</span>
      </div>
      <div className="vault-card-body">
        <strong title={props.item.name}>{props.item.name}</strong>
        <span className="vault-card-meta">{formatVaultCardMeta(props.item)}</span>
        <span className="vault-card-footer">
          <span className={`vault-score-badge score-${disposition}`}>{dispositionShortLabel(disposition)}</span>
          {stateFlags}
        </span>
      </div>
    {props.isLoadoutMatch ? (
      <span className="vault-card-corner-flags" aria-label="配装引用">
        <span title="配装引用">配</span>
      </span>
    ) : null}
  </>;

  return (
    <article
      className={[
        "vault-item-card",
        props.isSelected ? "selected" : "",
        props.isOrganizing ? "is-organizing" : "",
        props.isLoadoutMatch ? "loadout-highlight" : "",
        props.isOpening ? "pending" : "",
        `vault-item-${props.item.group_key}`,
        detailAvailable ? "" : "is-readonly"
      ].filter(Boolean).join(" ")}
      data-ui-kind="object-card"
      data-vault-item-key={itemKey}
    >
      {props.isOrganizing ? (
        <label className="vault-card-select" aria-label={`选择${props.item.name}`}>
          <input
            checked={props.isSelected}
            type="checkbox"
            onChange={() => props.onToggleSelected(props.item)}
          />
        </label>
      ) : null}
      {detailAvailable ? (
        <button
          type="button"
          className="vault-card-main"
          title={formatVaultCardTitle(props.item, disposition, props.isLoadoutMatch)}
          aria-busy={props.isOpening}
          disabled={props.isOpening}
          onClick={() => props.onSelectItem(props.item)}
        >
          {cardContent}
        </button>
      ) : <div className="vault-card-main is-readonly" tabIndex={-1}>{cardContent}</div>}
      {!props.isOrganizing && canUseQuickActions ? (
        <div className="vault-card-quick-actions" aria-label={`${props.item.name}快捷操作`}>
          <button
            type="button"
            data-ui-kind="button"
            data-control-variant="quiet"
            data-vault-action="lock"
            disabled={props.quickActionsDisabled || Boolean(activeQuickAction)}
            aria-busy={Boolean(activeLockQuickAction)}
            title={`一键${lockQuickActionLabel}：${props.item.name}`}
            onClick={() => void props.onQuickAction?.(props.item, lockQuickAction)}
          >
            {activeLockQuickAction ? `${activeLockQuickActionLabel}中` : lockQuickActionLabel}
          </button>
          {canTransfer ? (
            <button
              type="button"
              data-ui-kind="button"
              data-control-variant="secondary"
              data-vault-action="transfer"
              disabled={props.quickActionsDisabled || Boolean(activeQuickAction)}
              aria-busy={activeQuickAction === "transfer"}
              title={`取出到当前角色${props.currentCharacterLabel ? `（${props.currentCharacterLabel}）` : ""}`}
              onClick={() => void props.onQuickAction?.(props.item, "transfer")}
            >
              {activeQuickAction === "transfer" ? "取出中" : "取出"}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export const MemoizedVaultListItem = memo(VaultListItem, sameVaultListItemProps);

function sameVaultListItemProps(previous: VaultListItemProps, next: VaultListItemProps): boolean {
  return previous.item === next.item
    && previous.tagValue === next.tagValue
    && previous.isLoadoutMatch === next.isLoadoutMatch
    && previous.additionalSourceCount === next.additionalSourceCount
    && previous.imagePriority === next.imagePriority
    && previous.isOrganizing === next.isOrganizing
    && previous.isSelected === next.isSelected
    && previous.isOpening === next.isOpening
    && previous.currentCharacterId === next.currentCharacterId
    && previous.currentCharacterLabel === next.currentCharacterLabel
    && previous.quickActionStore === next.quickActionStore
    && previous.quickActionsDisabled === next.quickActionsDisabled
    && sameSourceSummaries(previous.sourceSummaries, next.sourceSummaries)
    && previous.onSelectItem === next.onSelectItem
    && previous.onToggleSelected === next.onToggleSelected
    && previous.onQuickAction === next.onQuickAction;
}

function sameSourceSummaries(
  previous: VaultRecommendationSourceSummary[],
  next: VaultRecommendationSourceSummary[]
): boolean {
  return previous.length === next.length && previous.every((summary, index) => {
    const candidate = next[index];
    return candidate?.sourceId === summary.sourceId
      && candidate.state === summary.state
      && candidate.shortLabel === summary.shortLabel
      && candidate.resultText === summary.resultText
      && candidate.text === summary.text
      && candidate.detail === summary.detail;
  });
}

function dispositionForTag(tag: VaultTagValue): "none" | "keep" | "review" | "junk" {
  return tag === "keep" || tag === "review" || tag === "junk" ? tag : "none";
}

function getItemSourceKind(item: AccountItemSummary): "equipped" | "inventory" | "vault" | "postmaster" {
  if ("source_kind" in item) {
    const sourceKind = item.source_kind;
    if (sourceKind === "equipped" || sourceKind === "inventory" || sourceKind === "postmaster") {
      return sourceKind;
    }
  }
  return "vault";
}

function dispositionLabel(tag: "none" | "keep" | "review" | "junk"): string {
  return tag === "none" ? "未标记" : tag === "review" ? "待定" : tagLabels[tag];
}

function dispositionShortLabel(tag: "none" | "keep" | "review" | "junk"): string {
  if (tag === "review") return "待定";
  if (tag === "junk") return "清理";
  return dispositionLabel(tag);
}

function formatVaultCardMeta(item: AccountItemSummary): string {
  if (item.group_key === "weapons") {
    return item.item_type || "武器";
  }
  if (item.group_key === "armor") {
    return [classTypeLabel(item.class_type), item.bucket_name ?? item.item_type].filter(Boolean).join(" · ") || "护甲";
  }
  return [
    item.item_type,
    item.bucket_name
  ].filter(Boolean).slice(0, 2).join(" · ") || "装备";
}

function formatVaultCardContext(item: AccountItemSummary): string {
  if (item.group_key !== "weapons") return "";
  if (item.instance?.damage_type_name) return item.instance.damage_type_name;
  switch (item.instance?.damage_type) {
    case 1: return "动能";
    case 2: return "电弧";
    case 3: return "烈日";
    case 4: return "虚空";
    case 6: return "冰影";
    case 7: return "缚丝";
    default: return "";
  }
}

function formatWeaponSlot(item: AccountItemSummary): string {
  const slot = getAccountItemSlotLabel(item).replace(/武器$/u, "").trim();
  return slot ? `${slot}位` : "未知槽位";
}

function formatAmmoCompact(type: AccountItemSummary["ammo_type"]): string {
  if (type === "primary") return "主弹药";
  if (type === "special") return "特殊";
  if (type === "heavy") return "重型";
  return "未知";
}

function getStrongestArmorStat(item: AccountItemSummary): {
  label: string;
  fullLabel: string;
  value: number;
} | undefined {
  if (!item.armor_stats) return undefined;
  const keys = Object.keys(armorStatLabels) as ArmorStatKey[];
  const strongest = keys.reduce<ArmorStatKey | undefined>((current, key) => {
    if (!current || item.armor_stats![key] > item.armor_stats![current]) return key;
    return current;
  }, undefined);
  if (!strongest) return undefined;
  return {
    label: compactArmorStatLabel(strongest),
    fullLabel: armorStatLabels[strongest],
    value: item.armor_stats[strongest]
  };
}

function compactArmorStatLabel(stat: ArmorStatKey): string {
  if (stat === "health") return "生命";
  if (stat === "grenade") return "手雷";
  if (stat === "super") return "超能";
  if (stat === "class") return "职业";
  if (stat === "weapon") return "武器";
  return "近战";
}

function gearTierOverlayUrl(gearTier: number): string | undefined {
  if (gearTier <= 0) return undefined;
  return `https://www.bungie.net/img/destiny_content/items/inventory-item-tier${gearTier}.png`;
}

function classTypeLabel(classType: number | undefined): string | undefined {
  if (classType === 0) return "泰坦";
  if (classType === 1) return "猎人";
  if (classType === 2) return "术士";
  return undefined;
}

function displayGearTier(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 0;
  return Math.min(5, Math.floor(value));
}

function craftingLabel(kind: NonNullable<AccountItemSummary["crafting"]>["kind"], full = false): string {
  if (kind === "crafted") return full ? "锻造武器" : "锻造";
  return full ? "强化武器" : "强化";
}

function formatVaultCardTitle(
  item: AccountItemSummary,
  disposition: "none" | "keep" | "review" | "junk",
  isLoadoutMatch: boolean
): string {
  return [
    item.name,
    formatVaultCardMeta(item),
    item.group_key === "weapons" ? formatWeaponSlot(item) : "",
    item.group_key === "weapons" && item.ammo_type ? ammoFilterLabels[item.ammo_type] : "",
    item.crafting ? craftingLabel(item.crafting.kind, true) : "",
    formatVaultCardContext(item),
    item.power !== undefined ? `光等 ${item.power}` : "",
    `整理状态：${disposition === "none" && item.group_key === "weapons" ? "未整理" : dispositionLabel(disposition)}`,
    item.locked ? "已锁定" : "",
    isLoadoutMatch ? "配装引用" : ""
  ].filter(Boolean).join("\n");
}

export function formatVaultItemMeta(item: AccountItemSummary): string {
  return [
    item.bucket_name,
    item.item_type,
    item.ammo_type ? ammoFilterLabels[item.ammo_type] : undefined,
    item.tier,
    item.power ? `光等 ${item.power}` : undefined,
    item.crafting ? craftingLabel(item.crafting.kind, true) : undefined,
    formatArmorStatsInline(item),
    item.locked ? "已锁定" : undefined
  ].filter(Boolean).join(" / ");
}
