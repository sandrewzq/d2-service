import type { ReactNode } from "react";
import {
  ammoFilterLabels,
  classFilterLabels,
  damageFilterLabels,
  gearTierFilterLabels,
  lockFilterLabels,
  rarityFilterLabels,
  sortLabels,
  type VaultAmmoFilter,
  type VaultArmorSetFilter,
  type VaultArmorSetOption,
  type VaultArmorStatRule,
  type VaultClassFilter,
  type VaultDamageFilter,
  type VaultFrameFilter,
  type VaultFrameOption,
  type VaultGearTierFilter,
  type VaultGroupFilter,
  type VaultGroupSummary,
  type VaultLockFilter,
  type VaultLocationFilter,
  type VaultLocationSummary,
  type VaultRarityFilter,
  type VaultSlotFilter,
  type VaultSlotSummary,
  type VaultSortKey,
  type VaultTagFilter
} from "@d2-tools/app/vault";
import { VaultArmorFilterPanel } from "./VaultArmorFilterPanel.js";
import { VaultAmmoTypeIcon, VaultDamageTypeIcon } from "./VaultWeaponFactIcons.js";

export type VaultSignalFilter = "wishlist" | "loadout" | "target";
export type VaultArmorSetCatalogStatus = "loading" | "ready" | "error";

const dispositionOptions: Array<{ key: VaultTagFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "untagged", label: "未标记" },
  { key: "keep", label: "保留" },
  { key: "review", label: "待复查" },
  { key: "junk", label: "待处理" }
];

const signalOptions: Array<{ key: VaultSignalFilter; label: string }> = [
  { key: "wishlist", label: "愿望单" },
  { key: "loadout", label: "配装引用" },
  { key: "target", label: "目标命中" }
];

const damageTypeIds: Record<string, number> = {
  kinetic: 1,
  arc: 2,
  solar: 3,
  void: 4,
  stasis: 6,
  strand: 7
};

type VaultAmmoType = Exclude<VaultAmmoFilter, "all">;

export function VaultFilterToolbar(props: {
  query: string;
  sortKey: VaultSortKey;
  tagFilter: VaultTagFilter;
  signalFilters: VaultSignalFilter[];
  armorStatRules: VaultArmorStatRule[];
  lockFilter: VaultLockFilter;
  slotFilter: VaultSlotFilter;
  locationFilter: VaultLocationFilter;
  ammoFilter: VaultAmmoFilter;
  itemTypeFilter: string;
  rarityFilter: VaultRarityFilter;
  gearTierFilter: VaultGearTierFilter;
  classFilter: VaultClassFilter;
  damageFilter: VaultDamageFilter;
  armorSetFilter: VaultArmorSetFilter;
  frameFilters: VaultFrameFilter;
  group: VaultGroupFilter;
  groups: VaultGroupSummary[];
  slotFilters: VaultSlotSummary[];
  locationFilters: VaultLocationSummary[];
  itemTypeFilters: Array<{ key: string; label: string; count: number }>;
  armorSetFilters: VaultArmorSetOption[];
  armorSetCatalogStatus: VaultArmorSetCatalogStatus;
  availableFrameFilters: VaultFrameOption[];
  onQueryChange: (value: string) => void;
  onSortKeyChange: (value: VaultSortKey) => void;
  onTagFilterChange: (value: VaultTagFilter) => void;
  onSignalFilterToggle: (value: VaultSignalFilter) => void;
  onAddArmorStatRule: () => void;
  onClearArmorStatRules: () => void;
  onRemoveArmorStatRule: (index: number) => void;
  onUpdateArmorStatRule: (index: number, rule: VaultArmorStatRule) => void;
  onLockFilterChange: (value: VaultLockFilter) => void;
  onSlotFilterChange: (value: VaultSlotFilter) => void;
  onLocationFilterChange: (value: VaultLocationFilter) => void;
  onAmmoFilterChange: (value: VaultAmmoFilter) => void;
  onItemTypeFilterChange: (value: string) => void;
  onRarityFilterChange: (value: VaultRarityFilter) => void;
  onGearTierFilterChange: (value: VaultGearTierFilter) => void;
  onClassFilterChange: (value: VaultClassFilter) => void;
  onDamageFilterChange: (value: VaultDamageFilter) => void;
  onArmorSetFilterChange: (value: VaultArmorSetFilter) => void;
  onGroupChange: (value: VaultGroupFilter) => void;
  onToggleFrameFilter: (key: string) => void;
}) {
  const isWeaponMode = props.group === "weapons";
  const isArmorMode = props.group === "armor";
  const visibleGroups = props.groups.filter((item) => item.key === "weapons" || item.key === "armor" || item.key === "equipment");
  const visibleSlotFilters = props.slotFilters.filter((item) => {
    if (item.key === "all") return true;
    if (isWeaponMode) return ["动能武器", "能量武器", "威能武器"].includes(item.label);
    if (isArmorMode) return ["头盔", "臂铠", "胸甲", "腿甲", "职业物品"].includes(item.label);
    return true;
  });

  return (
    <aside className="vault-filter-workbench" aria-label="仓库筛选" data-surface="section" data-contract-id="vault.filters">
      <label className="vault-filter-search">
        <span>搜索</span>
        <input
          type="search"
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          placeholder="名称、Perk、标签或备注"
        />
      </label>

      <FilterSection title="物品范围" hint="账号总数">
        <div className="vault-filter-option-grid vault-filter-category-grid" role="group" aria-label="物品范围">
          {visibleGroups.map((item) => (
            <button type="button" key={item.key} aria-pressed={props.group === item.key} onClick={() => props.onGroupChange(item.key)}>
              <span>{item.label}</span><small>{item.count}</small>
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={isArmorMode ? "护甲部位" : isWeaponMode ? "武器槽位" : "物品位置"} hint="匹配其他条件">
        <div className="vault-filter-option-grid vault-filter-slot-grid" role="group" aria-label={isWeaponMode ? "武器槽位" : isArmorMode ? "护甲部位" : "物品位置"}>
          {visibleSlotFilters.map((item) => (
            <button type="button" key={item.key} aria-pressed={props.slotFilter === item.key} onClick={() => props.onSlotFilterChange(item.key)}>
              <span>{shortSlotLabel(item.label)}</span><small>{item.count}</small>
            </button>
          ))}
        </div>
        {(isWeaponMode || isArmorMode) ? (
          <div className="vault-quality-stack">
            <SegmentedFilter
              label="稀有度"
              value={props.rarityFilter}
              options={Object.entries(rarityFilterLabels)}
              tone={(key) => key === "legendary" ? "rarity-legendary" : key === "exotic" ? "rarity-exotic" : undefined}
              onChange={(value) => props.onRarityFilterChange(value as VaultRarityFilter)}
            />
            <SegmentedFilter
              label="装备阶级"
              value={props.gearTierFilter}
              options={Object.entries(gearTierFilterLabels)}
              compact
              onChange={(value) => props.onGearTierFilterChange(value as VaultGearTierFilter)}
            />
          </div>
        ) : null}
      </FilterSection>

      {isWeaponMode ? (
        <FilterSection title="查看范围" hint="匹配其他条件">
          <div className="vault-filter-option-grid vault-filter-location-grid" role="group" aria-label="武器查看范围">
            {props.locationFilters.map((item) => (
              <button type="button" key={item.key} aria-pressed={props.locationFilter === item.key} onClick={() => props.onLocationFilterChange(item.key)}>
                <span>{item.label}</span><small>{item.count}</small>
              </button>
            ))}
          </div>
        </FilterSection>
      ) : null}

      {isWeaponMode ? (
        <FilterSection title="武器条件" hint="真实实例字段">
          <div className="vault-domain-stack">
            <label className="vault-filter-field">
              <span>武器类型</span>
              <select value={props.itemTypeFilter} onChange={(event) => props.onItemTypeFilterChange(event.target.value)}>
                <option value="all">全部类型</option>
                {props.itemTypeFilters.map((item) => <option key={item.key} value={item.key}>{item.label} {item.count}</option>)}
              </select>
            </label>
            <SegmentedFilter
              label="弹药类型"
              value={props.ammoFilter}
              options={Object.entries(ammoFilterLabels).map(([key, label]) => [key, label.replace("全部弹药", "全部")])}
              icon={(key) => isVaultAmmoType(key) ? <VaultAmmoTypeIcon type={key} size="compact" /> : null}
              tone={(key) => key === "all" ? undefined : `ammo-${key}`}
              onChange={(value) => props.onAmmoFilterChange(value as VaultAmmoFilter)}
            />
            <SegmentedFilter
              label="伤害属性"
              value={props.damageFilter}
              options={Object.entries(damageFilterLabels)}
              icon={(key) => key === "all" ? null : <VaultDamageTypeIcon damageType={damageTypeIds[key]} size="compact" />}
              tone={(key) => key === "all" ? undefined : `damage-${key}`}
              wrap
              onChange={(value) => props.onDamageFilterChange(value as VaultDamageFilter)}
            />
            <details className="vault-frame-filter" open={Boolean(props.frameFilters.length)}>
              <summary><span>武器框架</span><small>{props.frameFilters.length ? `已选 ${props.frameFilters.length} 项` : "全部框架"}</small></summary>
              {props.availableFrameFilters.length ? (
                <div className="vault-frame-chip-grid" aria-label="仓库武器框架筛选">
                  {props.availableFrameFilters.map((item) => (
                    <button type="button" key={item.key} className={props.frameFilters.includes(item.key) ? "active" : ""} aria-pressed={props.frameFilters.includes(item.key)} onClick={() => props.onToggleFrameFilter(item.key)}>
                      <span>{item.label}</span><small>{item.count}</small>
                    </button>
                  ))}
                </div>
              ) : <p>当前范围没有可用的武器框架字段。</p>}
            </details>
          </div>
        </FilterSection>
      ) : null}

      {isArmorMode ? (
        <FilterSection title="护甲条件" hint="多个属性条件同时成立">
          <SegmentedFilter
            label="职业"
            value={props.classFilter}
            options={Object.entries(classFilterLabels)}
            onChange={(value) => props.onClassFilterChange(value as VaultClassFilter)}
          />
          <label className="vault-filter-field">
            <span>护甲套装</span>
            <select
              value={props.armorSetFilter}
              disabled={props.armorSetCatalogStatus !== "ready" || !props.armorSetFilters.length}
              onChange={(event) => props.onArmorSetFilterChange(event.target.value)}
            >
              <option value="all">{armorSetCatalogLabel(props.armorSetCatalogStatus, props.armorSetFilters.length)}</option>
              {props.armorSetFilters.map((item) => (
                <option key={item.key} value={item.key}>{item.label}（持有 {item.count}）</option>
              ))}
            </select>
          </label>
          <VaultArmorFilterPanel
            rules={props.armorStatRules}
            onAddRule={props.onAddArmorStatRule}
            onClearRules={props.onClearArmorStatRules}
            onRemoveRule={props.onRemoveArmorStatRule}
            onUpdateRule={props.onUpdateArmorStatRule}
          />
        </FilterSection>
      ) : null}

      <FilterSection title="共同条件" hint="始终生效">
        <div className="vault-filter-common-row">
          <label className="vault-filter-field">
            <span>锁定状态</span>
            <select value={props.lockFilter} onChange={(event) => props.onLockFilterChange(event.target.value as VaultLockFilter)}>
              {(Object.keys(lockFilterLabels) as VaultLockFilter[]).map((key) => <option key={key} value={key}>{lockFilterLabels[key]}</option>)}
            </select>
          </label>
          <label className="vault-filter-field">
            <span>结果排序</span>
            <select value={props.sortKey} onChange={(event) => props.onSortKeyChange(event.target.value as VaultSortKey)}>
              {(Object.keys(sortLabels) as VaultSortKey[]).map((key) => <option key={key} value={key}>{sortLabels[key]}</option>)}
            </select>
          </label>
        </div>
      </FilterSection>

      <FilterSection title="整理状态" hint="玩家决定 · 单选">
        <div className="vault-filter-option-grid vault-disposition-grid" role="group" aria-label="玩家整理状态">
          {dispositionOptions.map((item) => (
            <button type="button" key={item.key} aria-pressed={props.tagFilter === item.key} onClick={() => props.onTagFilterChange(item.key)}>
              {item.key === "untagged" && isWeaponMode ? "未整理" : item.label}
            </button>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="保护与匹配" hint="只提供证据 · 可多选">
        <div className="vault-filter-option-grid vault-signal-grid" role="group" aria-label="保护与匹配信号">
          {signalOptions.map((item) => (
            <button type="button" key={item.key} aria-pressed={props.signalFilters.includes(item.key)} onClick={() => props.onSignalFilterToggle(item.key)}>{item.label}</button>
          ))}
        </div>
      </FilterSection>
    </aside>
  );
}

function FilterSection(props: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="vault-filter-section">
      <div className="vault-filter-section-head"><strong>{props.title}</strong><span>{props.hint}</span></div>
      {props.children}
    </section>
  );
}

function SegmentedFilter(props: {
  label: string;
  value: string;
  options: Array<[string, string]>;
  compact?: boolean;
  wrap?: boolean;
  icon?: (key: string) => ReactNode;
  tone?: (key: string) => string | undefined;
  onChange: (value: string) => void;
}) {
  return (
    <div className="vault-segmented-field">
      <span>{props.label}</span>
      <div className={["vault-choice-strip", props.compact ? "compact" : "", props.wrap ? "wrap" : ""].filter(Boolean).join(" ")} role="group" aria-label={props.label}>
        {props.options.map(([key, label]) => (
          <button type="button" key={key} data-filter-tone={props.tone?.(key)} aria-pressed={props.value === key} onClick={() => props.onChange(key)}>
            {props.icon?.(key)}<span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function shortSlotLabel(label: string): string {
  return label.replace("武器", "").replace("物品", "").replace("全部位置", "全部");
}

function isVaultAmmoType(value: string): value is VaultAmmoType {
  return value === "primary" || value === "special" || value === "heavy";
}

function armorSetCatalogLabel(status: VaultArmorSetCatalogStatus, count: number): string {
  if (status === "loading") return "套装目录加载中";
  if (status === "error") return "套装目录不可用";
  return count ? "全部套装" : "暂无套装目录";
}
