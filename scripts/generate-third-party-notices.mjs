import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import process from "node:process";

const repoRoot = resolve(import.meta.dirname, "..");
const outputPath = join(repoRoot, "packages", "desktop", "build", "THIRD_PARTY_NOTICES.txt");
const packagedLicensePath = join(repoRoot, "packages", "desktop", "build", "LICENSE.txt");
const projectLicensePath = join(repoRoot, "LICENSE");
const checkOnly = process.argv.includes("--check");

const applicationPackageDirs = [
  join(repoRoot, "packages", "services"),
  join(repoRoot, "packages", "desktop")
];
const bundledDesktopPackages = ["react", "react-dom", "electron"];

const packages = collectApplicationPackages();
const notices = renderNotices(packages);
const projectLicense = normalizeText(readFileSync(projectLicensePath, "utf8"));

if (checkOnly) {
  assertCurrent(outputPath, notices, "第三方许可证清单");
  assertCurrent(packagedLicensePath, projectLicense, "安装包项目许可证");
  console.log(`许可证文件已同步：${packages.length} 个应用依赖。`);
} else {
  writeFileSync(outputPath, notices, "utf8");
  writeFileSync(packagedLicensePath, projectLicense, "utf8");
  console.log(`已生成 ${relative(repoRoot, outputPath)}：${packages.length} 个应用依赖。`);
}

function collectApplicationPackages() {
  const visited = new Map();
  for (const packageDir of applicationPackageDirs) {
    const manifest = readJson(join(packageDir, "package.json"));
    for (const dependency of Object.keys(manifest.dependencies ?? {})) {
      if (!dependency.startsWith("@d2-tools/")) visitPackage(dependency, packageDir, visited);
    }
  }
  for (const dependency of bundledDesktopPackages) {
    visitPackage(dependency, join(repoRoot, "packages", "desktop"), visited);
  }
  return [...visited.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function visitPackage(name, fromDir, visited) {
  const manifestPath = resolvePackageManifest(name, fromDir);
  const packageDir = realpathSync(dirname(manifestPath));
  const manifest = readJson(manifestPath);
  const id = `${manifest.name ?? name}@${manifest.version ?? "unknown"}`;
  if (visited.has(id)) return;

  const noticeFiles = readNoticeFiles(packageDir);
  if (!noticeFiles.length && !manifest.license) {
    throw new Error(`${id} 没有可识别的许可证文件或 license 字段。`);
  }
  visited.set(id, {
    id,
    license: normalizeLicense(manifest.license),
    homepage: manifest.homepage ?? manifest.repository?.url ?? "",
    noticeText: noticeFiles.length
      ? noticeFiles.map(({ name: fileName, text }) => `--- ${fileName} ---\n${text}`).join("\n\n")
      : `Package metadata license: ${normalizeLicense(manifest.license)}`
  });

  for (const dependency of Object.keys(manifest.dependencies ?? {})) {
    visitPackage(dependency, packageDir, visited);
  }
}

function resolvePackageManifest(name, fromDir) {
  const request = createRequire(join(fromDir, "package.json"));
  try {
    return request.resolve(`${name}/package.json`);
  } catch {
    let current = dirname(request.resolve(name));
    while (current !== dirname(current)) {
      const candidate = join(current, "package.json");
      if (existsSync(candidate)) {
        const manifest = readJson(candidate);
        if (manifest.name === name) return candidate;
      }
      current = dirname(current);
    }
    throw new Error(`无法定位依赖 ${name}（起点：${relative(repoRoot, fromDir)}）。`);
  }
}

function readNoticeFiles(packageDir) {
  return readdirSync(packageDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^(licen[cs]e|copying|notice)(?:\..*)?$/i.test(entry.name))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const path = join(packageDir, entry.name);
      if (statSync(path).size > 512 * 1024) {
        throw new Error(`${relative(repoRoot, path)} 超过 512 KiB，请单独检查该许可证文件。`);
      }
      return { name: entry.name, text: normalizeText(readFileSync(path, "utf8")).trimEnd() };
    });
}

function renderNotices(packageList) {
  const groups = new Map();
  for (const entry of packageList) {
    const key = createHash("sha256").update(entry.noticeText).digest("hex");
    const group = groups.get(key) ?? { noticeText: entry.noticeText, packages: [] };
    group.packages.push(entry);
    groups.set(key, group);
  }

  const sections = [...groups.values()]
    .sort((left, right) => left.packages[0].id.localeCompare(right.packages[0].id))
    .map((group, index) => {
      const packageLines = group.packages
        .sort((left, right) => left.id.localeCompare(right.id))
        .map((entry) => `- ${entry.id} | ${entry.license}${entry.homepage ? ` | ${entry.homepage}` : ""}`)
        .join("\n");
      return [
        `================================================================================`,
        `${index + 1}. Packages`,
        `================================================================================`,
        packageLines,
        "",
        group.noticeText
      ].join("\n");
    });

  return normalizeText([
    "d2-tools Third-Party Notices",
    "",
    "This file covers third-party packages that run with the desktop application or are bundled into its renderer.",
    "Build-only and test-only tools are excluded. Electron distributions also carry Electron/Chromium notice files supplied by Electron.",
    "Package names, versions, license expressions, source links, and bundled license/notice text follow below.",
    "",
    `Generated package count: ${packageList.length}`,
    "",
    ...sections,
    ""
  ].join("\n"));
}

function assertCurrent(path, expected, label) {
  if (!existsSync(path) || normalizeText(readFileSync(path, "utf8")) !== expected) {
    throw new Error(`${label}不是最新状态，请运行 pnpm licenses:generate。`);
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function normalizeLicense(value) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && typeof value.type === "string") return value.type.trim();
  return "SEE BUNDLED NOTICE";
}

function normalizeText(value) {
  return value.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n*$/, "\n");
}
