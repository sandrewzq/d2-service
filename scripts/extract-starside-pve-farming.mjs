#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { JSDOM } from "jsdom";

const SITE_ROOT = "https://starside.work";
const ENTRY_URL = `${SITE_ROOT}/pve-farming/index.html`;

const pageDefinitions = [
  { directory: "shopping-primary", dataset: "aegis", output: "Aegis武器推荐.csv" },
  { directory: "shopping-special", dataset: "aegis", output: "Aegis武器推荐.csv" },
  { directory: "shopping-heavy", dataset: "aegis", output: "Aegis武器推荐.csv" },
  { directory: "shopping-other", dataset: "aegis", output: "Aegis武器推荐.csv" },
  { directory: "legendary-primary", dataset: "lgpig-legendary", output: "LGpig传说武器推荐.csv" },
  { directory: "legendary-special", dataset: "lgpig-legendary", output: "LGpig传说武器推荐.csv" },
  { directory: "legendary-heavy", dataset: "lgpig-legendary", output: "LGpig传说武器推荐.csv" },
  { directory: "exotic-weapons", dataset: "lgpig-exotic", output: "LGpig异域武器推荐.csv" },
  { directory: "crafting", dataset: "crafting", output: "锻造与异域来源.csv" },
];

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--input" || argument === "--output") {
      result[argument.slice(2)] = argv[index + 1];
      index += 1;
    }
  }
  if (!result.input || !result.output) {
    throw new Error("用法：node scripts/extract-starside-pve-farming.mjs --input <HTML快照目录> --output <输出目录>");
  }
  return { input: resolve(result.input), output: resolve(result.output) };
}

function normalizedText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function renderNode(node) {
  if (node.nodeType === node.TEXT_NODE) return node.nodeValue ?? "";
  if (node.nodeType !== node.ELEMENT_NODE) return "";
  const tag = node.tagName.toLowerCase();
  if (tag === "br") return "\n";
  if (tag === "img") return node.getAttribute("alt")?.trim() ?? "";
  const content = [...node.childNodes].map(renderNode).join("");
  if (tag === "s" || tag === "del") return `【已划除】${content}`;
  return content;
}

function cellText(cell) {
  return normalizedText([...cell.childNodes].map(renderNode).join(""))
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" / ");
}

function absoluteUrl(pageUrl, value) {
  if (!value) return "";
  return new URL(value, pageUrl).href;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(path, rows, preferredFields = []) {
  const fields = [...preferredFields];
  for (const row of rows) {
    for (const field of Object.keys(row)) {
      if (!fields.includes(field)) fields.push(field);
    }
  }
  const lines = [fields.map(csvValue).join(",")];
  for (const row of rows) lines.push(fields.map((field) => csvValue(row[field])).join(","));
  writeFileSync(path, `\ufeff${lines.join("\r\n")}\r\n`, "utf8");
}

function pageUpdate(document) {
  const text = document.querySelector("footer .stamp")?.textContent?.trim() ?? "";
  return text.replace(/^更新\s*/, "");
}

function parsePage(inputRoot, definition) {
  const inputPath = join(inputRoot, definition.directory, "index.html");
  const html = readFileSync(inputPath, "utf8");
  const document = new JSDOM(html).window.document;
  const pageUrl = `${SITE_ROOT}/${definition.directory}/index.html`;
  const title = document.querySelector("h1")?.textContent?.trim() ?? definition.directory;
  const updatedAt = pageUpdate(document);
  const records = [];
  const laneRecords = [];
  let sourceRow = 0;

  for (const [tableIndex, table] of [...document.querySelectorAll("table")].entries()) {
    const category = table.closest("section")?.querySelector("h2.sect-label")?.textContent?.trim() ?? "";
    const headers = [...table.querySelectorAll("thead th")].map(cellText);
    for (const row of table.querySelectorAll("tbody tr")) {
      sourceRow += 1;
      if (row.classList.contains("lane")) {
        laneRecords.push({
          页面: title,
          分类: category,
          框架说明: cellText(row),
          来源URL: pageUrl,
          页面更新时间: updatedAt,
          来源位置: `${definition.directory}:table-${tableIndex + 1}:row-${sourceRow}`,
        });
        continue;
      }
      const cells = [...row.querySelectorAll(":scope > th, :scope > td")];
      if (!cells.length) continue;
      const record = {
        页面: title,
        分类: category,
        来源URL: pageUrl,
        页面更新时间: updatedAt,
        来源位置: `${definition.directory}:table-${tableIndex + 1}:row-${sourceRow}`,
      };
      for (let index = 0; index < cells.length; index += 1) {
        const field = headers[index] || `未命名列${index + 1}`;
        record[field] = cellText(cells[index]);
        const image = cells[index].querySelector("img[src]");
        if (image) record[`${field}图标URL`] = absoluteUrl(pageUrl, image.getAttribute("src"));
      }
      records.push(record);
    }
  }

  return {
    definition,
    title,
    pageUrl,
    updatedAt,
    inputPath,
    htmlSha256: sha256(html),
    records,
    laneRecords,
  };
}

function main() {
  const { input, output } = parseArguments(process.argv.slice(2));
  mkdirSync(output, { recursive: true });
  const parsedPages = pageDefinitions.map((definition) => parsePage(input, definition));
  const outputs = new Map();
  const frameworkNotes = [];

  for (const page of parsedPages) {
    const rows = outputs.get(page.definition.output) ?? [];
    rows.push(...page.records);
    outputs.set(page.definition.output, rows);
    frameworkNotes.push(...page.laneRecords);
  }

  const commonFields = ["页面", "分类", "武器", "评级", "排名"];
  for (const [fileName, rows] of outputs) {
    writeCsv(join(output, fileName), rows, commonFields);
  }
  writeCsv(join(output, "LGpig框架说明.csv"), frameworkNotes, [
    "页面", "分类", "框架说明", "来源URL", "页面更新时间", "来源位置",
  ]);

  const metadata = {
    source_entry_url: ENTRY_URL,
    captured_at: new Date().toISOString(),
    copyright_notice: "© 2026 日栎w",
    license_status: "页面未声明可再分发许可；当前快照仅用于本地研究和数据核对",
    pages: parsedPages.map((page) => ({
      directory: page.definition.directory,
      title: page.title,
      url: page.pageUrl,
      updated_at: page.updatedAt,
      html_file: page.inputPath,
      html_sha256: page.htmlSha256,
      data_rows: page.records.length,
      framework_note_rows: page.laneRecords.length,
      output: page.definition.output,
    })),
    outputs: [...outputs].map(([fileName, rows]) => ({ file: fileName, rows: rows.length })).concat([
      { file: "LGpig框架说明.csv", rows: frameworkNotes.length },
    ]),
  };
  writeFileSync(join(output, "抓取元数据.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
  writeFileSync(join(output, "来源与使用说明.md"), `# Starside PVE 终局刷取公开页面数据快照\n\n- 来源入口：<${ENTRY_URL}>\n- 页面标注更新时间：2026.8.30\n- 页面版权标注：© 2026 日栎w\n- 许可状态：页面未声明可再分发许可。当前文件仅作为本地研究、人工核对和数据源可行性分析，不直接并入公开发布物。\n- 原始网页：与结构化 CSV 一起保存在当前数据目录的 \`原始网页/\` 中；CSV 均保留来源 URL、页面更新时间和来源位置。\n- 图标：没有复制图片文件，只保存公开图片 URL。\n\n## 文件\n\n${metadata.outputs.map((item) => `- \`${item.file}\`：${item.rows} 行`).join("\n")}\n`, "utf8");

  console.log(JSON.stringify(metadata.outputs, null, 2));
}

main();
