import type { MouseEvent } from "react";
import type { InterfaceLocale } from "../i18n/types.js";
import { settingsSourceCategoryLabels, settingsSourceEntries, type SettingsSourceEntry } from "./settingsSources.js";
import { SettingsButton } from "./SettingsButton.js";

export function SettingsSourcesSection({
  interfaceLocale = "zh-CN",
  onOpenLegalDocument,
  onOpenExternal
}: {
  interfaceLocale?: InterfaceLocale;
  onOpenLegalDocument?: (document: "project-license" | "third-party-notices") => void;
  onOpenExternal?: (url: string) => void;
}) {
  const english = interfaceLocale === "en-US";
  return (
    <section className="settings-section" data-reference-id="settings.section.sources" data-surface="section" id="settings-sources" aria-labelledby="settings-menu-sources">
      <header className="settings-section-head" data-ui-kind="page-section">
        <div>
          <h2 data-ui-part="value" data-info-priority="display" data-text-tone="primary">{english ? "Sources, references & credits" : "数据来源、参考项目与鸣谢"}</h2>
          <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{english ? "See where facts come from, which projects shaped the workflows, and what is not a runtime dependency." : "这里区分事实数据来源、功能参考项目和运行时依赖，避免把社区推荐误认为官方结论。"}</p>
        </div>
      </header>
      <div className="settings-sources-notice" data-ui-kind="callout" data-callout-tone="info">
        <strong data-ui-part="value" data-info-priority="decision" data-text-tone="primary">{english ? "Attribution boundary" : "来源边界"}</strong>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{english ? "Account facts and live rotations come from Bungie. Community sources only provide recommendations or reference material. User-imported local content is not listed here." : "账号事实和实时轮换来自 Bungie；社区来源只提供推荐或参考资料。本地用户导入内容暂不列入这里。"}</p>
      </div>
      {(Object.keys(settingsSourceCategoryLabels) as Array<keyof typeof settingsSourceCategoryLabels>).map((category) => {
        const entries = settingsSourceEntries.filter((entry) => entry.category === category);
        return (
          <section className="settings-sources-group" data-surface="section" key={category}>
            <header className="settings-sources-group-head">
              <h3 data-ui-part="value" data-info-priority="context" data-text-tone="primary">{english ? englishCategoryLabel(category) : settingsSourceCategoryLabels[category]}</h3>
              <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{entries.length}{english ? " entries" : " 项"}</span>
            </header>
            <div className="settings-sources-list" data-surface="list">
              {entries.map((entry) => <SourceRow english={english} entry={entry} key={entry.name} onOpenExternal={onOpenExternal} />)}
            </div>
          </section>
        );
      })}
      <section className="settings-sources-credits" data-surface="section">
        <header className="settings-sources-group-head">
          <h3 data-ui-part="value" data-info-priority="context" data-text-tone="primary">{english ? "Credits & license boundary" : "鸣谢与许可边界"}</h3>
        </header>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{english ? "Thanks to Bungie, DIM, DIM Wish List Sources, D2ArmorPicker, d2-armor-solver, Roll Report, d2-additional-info, Starside, and the Destiny 2 community maintainers whose public work informed this app." : "感谢 Bungie、DIM、DIM Wish List Sources、D2ArmorPicker、d2-armor-solver、Roll Report、d2-additional-info、Starside 以及所有提供公开资料和项目维护的 Destiny 2 社区贡献者。"}</p>
        <p data-ui-part="detail" data-info-priority="support" data-text-tone="meta">{english ? "A reference does not imply endorsement or a runtime dependency. Redistribution follows each source's license and permission; user-imported local content is not listed here." : "参考项目不代表背书，也不等于运行时依赖；再分发遵循各来源的许可证和授权范围。本地用户导入内容暂不列入这里。"}</p>
        {onOpenLegalDocument ? (
          <div className="settings-actions" data-ui-part="action">
            <SettingsButton data-control-variant="secondary" onClick={() => onOpenLegalDocument("project-license")}>{english ? "Project license" : "查看项目许可证"}</SettingsButton>
            <SettingsButton data-control-variant="secondary" onClick={() => onOpenLegalDocument("third-party-notices")}>{english ? "Third-party notices" : "查看第三方许可证"}</SettingsButton>
          </div>
        ) : null}
      </section>
      <p className="settings-sources-legal" data-ui-part="detail" data-info-priority="support" data-text-tone="meta">
        {english ? "Destiny 2 and related names are trademarks of Bungie, Inc. d2-tools is an unofficial community tool and is not affiliated with Bungie." : "Destiny 2 及相关名称、标识为 Bungie, Inc. 的商标。d2-tools 是非官方社区工具，与 Bungie 无从属关系。"}
      </p>
    </section>
  );
}

function SourceRow({ entry, english, onOpenExternal }: { entry: SettingsSourceEntry; english: boolean; onOpenExternal?: (url: string) => void }) {
  const handleExternalClick = (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    if (!onOpenExternal) return;
    event.preventDefault();
    onOpenExternal(url);
  };
  return (
    <article className="settings-source-row" data-surface="row">
      <div className="settings-source-main">
        <strong data-ui-part="value" data-info-priority="context" data-text-tone="primary">{entry.name}</strong>
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{entry.role}</span>
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{english ? englishRelationship(entry.relationship) : entry.relationship}</span>
      </div>
      <div className="settings-source-detail">
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{english ? "Provides" : "提供内容"}</span>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{entry.content}</p>
      </div>
      <div className="settings-source-detail">
        <span data-ui-part="label" data-info-priority="support" data-text-tone="meta">{english ? "Used in" : "使用位置"}</span>
        <p data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{entry.usedIn}</p>
      </div>
      <div className="settings-source-links" data-ui-part="action">
        {entry.githubUrl ? <a href={entry.githubUrl} target="_blank" rel="noreferrer" onClick={(event) => handleExternalClick(event, entry.githubUrl!)}>GitHub</a> : null}
        {entry.onlineUrl ? <a href={entry.onlineUrl} target="_blank" rel="noreferrer" onClick={(event) => handleExternalClick(event, entry.onlineUrl!)}>{english ? "Open online" : "在线访问"}</a> : null}
        <small>{english ? `License: ${entry.license}` : `许可：${entry.license}`}</small>
        <small>{english ? entry.note : entry.note}</small>
      </div>
    </article>
  );
}

function englishCategoryLabel(category: keyof typeof settingsSourceCategoryLabels): string {
  return category === "official" ? "Official data sources" : category === "community" ? "Community sources" : "Reference projects & features";
}

function englishRelationship(value: string): string {
  if (value.includes("事实")) return "Fact source";
  if (value.includes("社区数据")) return "Community data source";
  if (value.includes("内容")) return "Content and information reference";
  if (value.includes("功能")) return "Feature and interaction reference";
  if (value.includes("算法")) return "Algorithm reference";
  if (value.includes("数据生成")) return "Data generation reference";
  return value;
}
