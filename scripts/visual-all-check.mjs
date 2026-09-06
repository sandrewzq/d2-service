import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, chromium } from "playwright";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const shellContractOnly = process.argv.includes("--shell-contract-only");
const skipBuild = process.env.D2_VISUAL_SKIP_BUILD === "1";
const pages = shellContractOnly
  ? ["home"]
  : ["home", "account", "vault", "loadouts", "library", "vendors", "settings"];
const settingsSections = shellContractOnly
  ? []
  : ["overview", "language", "account", "library", "bungie", "ai", "backup", "diagnostics"];
const themes = ["light", "dark"];
const viewport = process.env.D2_VISUAL_CAPTURE_VIEWPORT ?? "1365x900";
const [width, height] = viewport.split("x").map((part) => Number.parseInt(part, 10));
const outputDir = resolve(process.env.D2_VISUAL_OUTPUT_DIR ?? join(
  repoRoot,
  ".local-data",
  "tmp",
  "visual",
  shellContractOnly ? "shell-contract" : "all"
));
const reportPath = join(outputDir, "report.json");
const desktopDataDir = join(outputDir, "desktop-data");
const allowedLightBackgroundSelectors = [
  ".item-detail-game-card",
  ".item-detail-game-card *",
  ".vault-card-visual",
  ".account-equipment-icon",
  ".shell-tool-github svg",
  ".shell-tool-github path"
];
const pageLabels = {
  home: "首页",
  account: "账号",
  vault: "仓库",
  loadouts: "配装",
  library: "资料库",
  vendors: "商人",
  settings: "设置"
};
const settingsSectionLabels = {
  overview: "总览",
  language: "语言",
  account: "账号",
  library: "资料库",
  bungie: "Bungie",
  ai: "AI",
  backup: "备份",
  diagnostics: "诊断"
};
const browserTargets = [
  { key: "web", packageName: "@d2-tools/web", port: 53171, fullSettings: false }
];
const desktopTarget = { key: "desktop", packageName: "@d2-tools/desktop", port: 53172, fullSettings: true };

function normalizeSpawn(command, args) {
  if (isWindows && command === pnpm) {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", command, ...args] };
  }
  return { command, args };
}

function start(command, args, options = {}) {
  const normalized = normalizeSpawn(command, args);
  const child = spawn(normalized.command, normalized.args, {
    cwd: repoRoot,
    env: { ...process.env, ...(options.env ?? {}) },
    stdio: options.stdio ?? "pipe",
    windowsHide: true
  });
  child.on("error", (error) => console.error(error));
  return child;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    if (options.label) console.log(`[visual:all] ${options.label}`);
    const normalized = normalizeSpawn(command, args);
    const child = spawn(normalized.command, normalized.args, {
      cwd: repoRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

function stop(child) {
  if (!child || child.killed) return;
  if (isWindows) {
    spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    child.kill("SIGTERM");
  }
}

function isPortAvailable(port) {
  return new Promise((resolvePort) => {
    const server = createServer()
      .once("error", () => resolvePort(false))
      .once("listening", () => server.close(() => resolvePort(true)))
      .listen(port, "127.0.0.1");
  });
}

async function waitForUrl(url, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // keep waiting
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 40; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available local port found from ${startPort} to ${startPort + 39}`);
}

async function ensureTargetServer(target, theme) {
  const themeOffset = theme === "dark" ? 20 : 0;
  let port = await findAvailablePort(target.port + themeOffset);
  let url = `http://127.0.0.1:${port}`;

  const child = start(pnpm, [
    "--filter",
    target.packageName,
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort"
  ], {
    env: {
      VITE_D2_VISUAL_PAGE: "home",
      VITE_D2_VISUAL_THEME: theme,
      VITE_D2_VISUAL_CAPTURE: "1"
    }
  });
  await waitForUrl(url);
  return { url, child, reused: false };
}

async function buildDesktopOutputs() {
  await run(pnpm, ["--filter", "@d2-tools/core", "build"], { label: "build core" });
  await run(pnpm, ["--filter", "@d2-tools/app", "build"], { label: "build app" });
  await run(pnpm, ["--filter", "@d2-tools/http", "build"], { label: "build http" });
  await run(pnpm, ["--filter", "@d2-tools/desktop", "exec", "tsc", "-p", "tsconfig.main.json"], { label: "compile electron main" });
  await run(pnpm, ["--filter", "@d2-tools/desktop", "exec", "vite", "build", "--config", "vite.preload.config.ts"], { label: "build preload" });
}

function prepareDesktopData(theme) {
  rmSync(desktopDataDir, { recursive: true, force: true });
  mkdirSync(desktopDataDir, { recursive: true });
  writeFileSync(join(desktopDataDir, "config.json"), JSON.stringify({
    bungie: {
      api_key: "visual-api-key",
      client_id: "visual-client-id",
      client_secret: "visual-client-secret",
      redirect_uri: "https://127.0.0.1:28780/oauth/callback"
    },
    data: {
      data_dir: desktopDataDir,
      manifest_language: "zh-chs"
    },
    ai: {
      protocol: "",
      api_key: "",
      model: "",
      base_url: "",
      enable_lightgg: false,
      force_lightgg: false
    },
    features: {
      color_mode: theme
    }
  }, null, 2), "utf8");
}

async function ensureColorMode(page, theme, targetKey) {
  const shell = page.locator(".app-shell");
  await shell.waitFor({ state: "visible" });
  const colorMode = await shell.getAttribute("data-color-mode");
  if (colorMode !== theme) {
    throw new Error(`${targetKey} color mode mismatch: expected ${theme}, got ${colorMode ?? "unknown"}`);
  }
}

async function readShellContract(page, selectors) {
  return await page.evaluate(({ rootSelector, stripSelector, itemSelector }) => {
    const root = document.querySelector(rootSelector);
    const strip = document.querySelector(stripSelector);
    const itemElements = strip ? Array.from(strip.children).filter((element) => element.matches(itemSelector)) : [];
    if (!root || !strip || itemElements.length < 2) {
      throw new Error("Missing shared shell status strip or status items");
    }

    function resolveToken(name) {
      const probe = document.createElement("span");
      probe.style.color = `var(${name})`;
      root.appendChild(probe);
      const color = window.getComputedStyle(probe).color;
      probe.remove();
      return color;
    }

    function itemSnapshot(element) {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        tagName: element.tagName.toLowerCase(),
        display: style.display,
        alignItems: style.alignItems,
        gap: style.gap,
        minHeight: style.minHeight,
        paddingTop: style.paddingTop,
        paddingRight: style.paddingRight,
        paddingBottom: style.paddingBottom,
        paddingLeft: style.paddingLeft,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderLeftWidth: style.borderLeftWidth,
        borderTopStyle: style.borderTopStyle,
        borderRightStyle: style.borderRightStyle,
        borderBottomStyle: style.borderBottomStyle,
        borderLeftStyle: style.borderLeftStyle,
        borderTopColor: style.borderTopColor,
        borderRightColor: style.borderRightColor,
        borderBottomColor: style.borderBottomColor,
        borderLeftColor: style.borderLeftColor,
        borderTopLeftRadius: style.borderTopLeftRadius,
        borderTopRightRadius: style.borderTopRightRadius,
        borderBottomRightRadius: style.borderBottomRightRadius,
        borderBottomLeftRadius: style.borderBottomLeftRadius,
        backgroundColor: style.backgroundColor,
        color: style.color,
        fontSize: style.fontSize,
        whiteSpace: style.whiteSpace,
        appearance: style.appearance,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height
        }
      };
    }

    const stripStyle = window.getComputedStyle(strip);
    const rootStyle = window.getComputedStyle(root);
    return {
      tokens: {
        objectBorder: resolveToken("--object-border"),
        sectionDivider: resolveToken("--section-divider"),
        cardBackground: resolveToken("--card-bg"),
        radiusControl: rootStyle.getPropertyValue("--radius-control").trim(),
        fontBody: rootStyle.getPropertyValue("--font-body").trim()
      },
      strip: {
        display: stripStyle.display,
        alignItems: stripStyle.alignItems,
        gap: stripStyle.gap,
        overflowX: stripStyle.overflowX,
        overflowY: stripStyle.overflowY,
        paddingTop: stripStyle.paddingTop,
        paddingRight: stripStyle.paddingRight,
        paddingBottom: stripStyle.paddingBottom,
        paddingLeft: stripStyle.paddingLeft
      },
      items: itemElements.map(itemSnapshot)
    };
  }, selectors);
}

function assertSharedShellContract({ targetKey, theme, contract, reference }) {
  const errors = [];
  const expectEqual = (path, actual, expected) => {
    if (actual !== expected) errors.push(`${path}: expected ${expected}, got ${actual}`);
  };
  const expectClose = (path, actual, expected, tolerance = 0.51) => {
    if (Math.abs(actual - expected) > tolerance) errors.push(`${path}: expected ${expected} +/- ${tolerance}, got ${actual}`);
  };

  expectEqual("strip.display", contract.strip.display, "flex");
  expectEqual("strip.alignItems", contract.strip.alignItems, "center");
  expectEqual("strip.gap", contract.strip.gap, "0px");
  expectEqual("strip.overflowX", contract.strip.overflowX, "hidden");
  expectEqual("strip.overflowY", contract.strip.overflowY, "hidden");
  expectEqual("strip.paddingTop", contract.strip.paddingTop, "0px");
  expectEqual("strip.paddingRight", contract.strip.paddingRight, "12px");
  expectEqual("strip.paddingBottom", contract.strip.paddingBottom, "0px");
  expectEqual("strip.paddingLeft", contract.strip.paddingLeft, "12px");

  if (reference) {
    for (const [name, value] of Object.entries(reference.tokens)) {
      expectEqual(`tokens.${name}`, contract.tokens[name], value);
    }
    for (const [name, value] of Object.entries(reference.strip)) {
      expectEqual(`strip.${name}.reference`, contract.strip[name], value);
    }
    expectEqual("items.length.reference", String(contract.items.length), String(reference.items.length));
  }

  contract.items.forEach((item, index) => {
    const path = `items[${index}]`;
    const isFirst = index === 0;
    const isLast = index === contract.items.length - 1;
    expectEqual(`${path}.display`, item.display, reference?.items[index]?.display ?? "flex");
    expectEqual(`${path}.alignItems`, item.alignItems, "center");
    expectEqual(`${path}.gap`, item.gap, "5px");
    expectEqual(`${path}.minHeight`, item.minHeight, "26px");
    expectEqual(`${path}.paddingTop`, item.paddingTop, "0px");
    expectEqual(`${path}.paddingRight`, item.paddingRight, "8px");
    expectEqual(`${path}.paddingBottom`, item.paddingBottom, "0px");
    expectEqual(`${path}.paddingLeft`, item.paddingLeft, "8px");
    expectEqual(`${path}.borderTopWidth`, item.borderTopWidth, "1px");
    expectEqual(`${path}.borderRightWidth`, item.borderRightWidth, "1px");
    expectEqual(`${path}.borderBottomWidth`, item.borderBottomWidth, "1px");
    expectEqual(`${path}.borderLeftWidth`, item.borderLeftWidth, isFirst ? "1px" : "0px");
    expectEqual(`${path}.borderTopStyle`, item.borderTopStyle, "solid");
    expectEqual(`${path}.borderRightStyle`, item.borderRightStyle, "solid");
    expectEqual(`${path}.borderBottomStyle`, item.borderBottomStyle, "solid");
    expectEqual(`${path}.borderTopColor`, item.borderTopColor, contract.tokens.objectBorder);
    expectEqual(`${path}.borderRightColor`, item.borderRightColor, isLast ? contract.tokens.objectBorder : contract.tokens.sectionDivider);
    expectEqual(`${path}.borderBottomColor`, item.borderBottomColor, contract.tokens.objectBorder);
    if (isFirst) expectEqual(`${path}.borderLeftColor`, item.borderLeftColor, contract.tokens.objectBorder);
    expectEqual(`${path}.borderTopLeftRadius`, item.borderTopLeftRadius, isFirst ? contract.tokens.radiusControl : "0px");
    expectEqual(`${path}.borderBottomLeftRadius`, item.borderBottomLeftRadius, isFirst ? contract.tokens.radiusControl : "0px");
    expectEqual(`${path}.borderTopRightRadius`, item.borderTopRightRadius, isLast ? contract.tokens.radiusControl : "0px");
    expectEqual(`${path}.borderBottomRightRadius`, item.borderBottomRightRadius, isLast ? contract.tokens.radiusControl : "0px");
    expectEqual(`${path}.backgroundColor`, item.backgroundColor, contract.tokens.cardBackground);
    expectEqual(`${path}.fontSize`, item.fontSize, reference?.items[index]?.fontSize ?? contract.tokens.fontBody);
    expectEqual(`${path}.whiteSpace`, item.whiteSpace, "nowrap");
    expectClose(`${path}.rect.height`, item.rect.height, 26);
    if (item.tagName === "button") expectEqual(`${path}.appearance`, item.appearance, "none");

    const referenceItem = reference?.items[index];
    if (referenceItem) {
      const comparableProperties = [
        "display",
        "alignItems",
        "gap",
        "minHeight",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "borderTopWidth",
        "borderRightWidth",
        "borderBottomWidth",
        "borderLeftWidth",
        "borderTopStyle",
        "borderRightStyle",
        "borderBottomStyle",
        "borderLeftStyle",
        "borderTopColor",
        "borderRightColor",
        "borderBottomColor",
        "borderLeftColor",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
        "backgroundColor",
        "color",
        "fontSize",
        "whiteSpace"
      ];
      for (const property of comparableProperties) {
        expectEqual(`${path}.${property}.reference`, item[property], referenceItem[property]);
      }
      expectClose(`${path}.rect.height.reference`, item.rect.height, referenceItem.rect.height);
    }
  });

  for (let index = 1; index < contract.items.length; index += 1) {
    const previous = contract.items[index - 1].rect;
    const current = contract.items[index].rect;
    expectClose(`items[${index}].adjacentX`, current.x, previous.x + previous.width);
    expectClose(`items[${index}].alignedY`, current.y, previous.y);
    expectClose(`items[${index}].equalHeight`, current.height, previous.height);
  }

  if (errors.length) {
    throw new Error(`${targetKey}/${theme} shared shell contract failed:\n${errors.join("\n")}`);
  }
}

async function navigateToPage(page, pageKey) {
  const label = pageLabels[pageKey];
  await page.locator(".shell-nav button", { hasText: label }).click();
  await page.waitForFunction((expected) => {
    const active = document.querySelector(".shell-nav button.active");
    return active?.textContent?.trim() === expected;
  }, label, { timeout: 5_000 });
  await page.waitForTimeout(150);
}

async function navigateToSettingsSection(page, sectionKey) {
  const menu = page.locator(".settings-menu");
  if ((await menu.count()) === 0) return false;
  const sectionIndex = settingsSections.indexOf(sectionKey);
  if (sectionIndex < 0) return false;
  await menu.locator("button").nth(sectionIndex).click();
  await page.waitForSelector(`#settings-${sectionKey}.active`, { timeout: 5_000 });
  await page.waitForTimeout(150);
  return true;
}

async function scanState(page, target, theme, pageKey, sectionKey = null, referenceShellContract = null) {
  await ensureColorMode(page, theme, target.key);
  const stateName = [target.key, theme, pageKey, sectionKey].filter(Boolean).join("-");
  const screenshotDir = join(outputDir, "screenshots");
  mkdirSync(screenshotDir, { recursive: true });
  const shellContract = pageKey === "home" && !sectionKey
    ? await readShellContract(page, {
        rootSelector: ".app-shell",
        stripSelector: ".shell-status-strip",
        itemSelector: ".shell-status-group"
      })
    : null;
  const shellScreenshot = shellContractOnly
    ? join(screenshotDir, `${stateName}-shell-${viewport}.png`)
    : null;
  if (shellScreenshot) {
    await page.locator(".shell-titlebar").screenshot({ path: shellScreenshot });
  }
  if (shellContract) {
    assertSharedShellContract({
      targetKey: target.key,
      theme,
      contract: shellContract,
      reference: referenceShellContract
    });
  }
  const scan = await scanVisibleElementStyles(page);
  assertNoLargeLightBackgrounds({ targetKey: target.key, theme, pageKey, sectionKey, scan });
  assertReadableTextContrast({ targetKey: target.key, theme, pageKey, sectionKey, scan });

  const screenshot = join(screenshotDir, `${stateName}-${viewport}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  return {
    target: target.key,
    theme,
    page: pageKey,
    settingsSection: sectionKey,
    screenshot,
    shellScreenshot,
    shellContract,
    colorMode: await page.locator(".app-shell").getAttribute("data-color-mode"),
    url: page.url(),
    scannedElementCount: scan.elements.length,
    textElementCount: scan.textElements.length,
    computedStyles: scan.elements.slice(0, 120),
    contrastWarnings: scan.textElements.filter((item) => item.contrastRatio !== null && item.contrastRatio < 3).slice(0, 20)
  };
}

async function scanVisibleElementStyles(page) {
  return await page.evaluate(() => {
    const root = document.querySelector(".app-shell");
    if (!root) throw new Error("Missing .app-shell");
    const elements = Array.from(root.querySelectorAll("*"));

    function selectorFor(element) {
      const parts = [];
      let current = element;
      while (current && current !== root && parts.length < 4) {
        const tag = current.tagName.toLowerCase();
        const classes = Array.from(current.classList).slice(0, 4).map((item) => `.${item}`).join("");
        parts.unshift(`${tag}${classes}`);
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function parseRgb(value) {
      const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
      if (!match) return null;
      return {
        r: Number.parseInt(match[1], 10),
        g: Number.parseInt(match[2], 10),
        b: Number.parseInt(match[3], 10),
        a: match[4] === undefined ? 1 : Number.parseFloat(match[4])
      };
    }

    function luminance(rgb) {
      const channels = [rgb.r, rgb.g, rgb.b].map((value) => {
        const normalized = value / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }

    function contrastRatio(foreground, background) {
      const fg = parseRgb(foreground);
      const bg = parseRgb(background);
      if (!fg || !bg) return null;
      const lighter = Math.max(luminance(fg), luminance(bg));
      const darker = Math.min(luminance(fg), luminance(bg));
      return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
    }

    function toRgbString(rgb) {
      return `rgb(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)})`;
    }

    function blend(top, bottom) {
      const alpha = Math.max(0, Math.min(1, top.a));
      return {
        r: top.r * alpha + bottom.r * (1 - alpha),
        g: top.g * alpha + bottom.g * (1 - alpha),
        b: top.b * alpha + bottom.b * (1 - alpha),
        a: 1
      };
    }

    function effectiveBackground(element) {
      const chain = [];
      let current = element;
      while (current && current instanceof Element) {
        chain.unshift(current);
        if (current === root) break;
        current = current.parentElement;
      }

      let composed = parseRgb(window.getComputedStyle(root).backgroundColor) ?? { r: 255, g: 255, b: 255, a: 1 };
      for (const item of chain) {
        const rgb = parseRgb(window.getComputedStyle(item).backgroundColor);
        if (rgb && rgb.a > 0.01) {
          composed = rgb.a >= 1 ? { ...rgb, a: 1 } : blend(rgb, composed);
        }
      }
      return toRgbString(composed);
    }

    const visible = elements.map((element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const selector = selectorFor(element);
      const text = element.textContent?.trim().replace(/\s+/g, " ").slice(0, 120) ?? "";
      const backgroundColor = style.backgroundColor;
      const effectiveBg = effectiveBackground(element);
      return {
        selector,
        tagName: element.tagName.toLowerCase(),
        className: element.getAttribute("class") ?? "",
        text,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          area: Math.round(rect.width * rect.height)
        },
        style: {
          display: style.display,
          visibility: style.visibility,
          opacity: style.opacity,
          color: style.color,
          backgroundColor,
          effectiveBackgroundColor: effectiveBg,
          borderColor: style.borderColor,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight
        },
        contrastRatio: text ? contrastRatio(style.color, effectiveBg) : null
      };
    }).filter((item) => {
      return item.rect.width > 0
        && item.rect.height > 0
        && item.style.display !== "none"
        && item.style.visibility !== "hidden"
        && Number.parseFloat(item.style.opacity) > 0.05;
    });

    return {
      elements: visible,
      textElements: visible.filter((item) => item.text && item.rect.area >= 24)
    };
  });
}

function parseCssRgb(value) {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
  if (!match) return null;
  return {
    r: Number.parseInt(match[1], 10),
    g: Number.parseInt(match[2], 10),
    b: Number.parseInt(match[3], 10),
    a: match[4] === undefined ? 1 : Number.parseFloat(match[4])
  };
}

function isAllowedLightBackground(element) {
  return allowedLightBackgroundSelectors.some((selector) => element.selector.includes(selector.replaceAll("*", "").trim()));
}

function assertNoLargeLightBackgrounds({ targetKey, theme, pageKey, sectionKey, scan }) {
  if (theme !== "dark") return;
  const offenders = scan.elements.filter((element) => {
    const rgb = parseCssRgb(element.style.backgroundColor);
    if (!rgb || rgb.a < 0.2) return false;
    if (element.rect.area < 4_000) return false;
    if (isAllowedLightBackground(element)) return false;
    return rgb.r >= 230 && rgb.g >= 230 && rgb.b >= 230;
  });
  if (offenders.length) {
    throw new Error(`${targetKey}/${theme}/${pageKey}${sectionKey ? `/${sectionKey}` : ""} has large light backgrounds: ${JSON.stringify(offenders.slice(0, 5), null, 2)}`);
  }
}

function assertReadableTextContrast({ targetKey, theme, pageKey, sectionKey, scan }) {
  const offenders = scan.textElements.filter((element) => {
    if (element.rect.area < 80) return false;
    if (element.contrastRatio === null) return false;
    if (element.text.length <= 1) return false;
    return element.contrastRatio < 2.35;
  });
  if (offenders.length) {
    throw new Error(`${targetKey}/${theme}/${pageKey}${sectionKey ? `/${sectionKey}` : ""} has low text contrast: ${JSON.stringify(offenders.slice(0, 8), null, 2)}`);
  }
}

async function scanBrowserTarget(browser, target, theme, server, referenceShellContract) {
  const page = await browser.newPage({ viewport: { width, height } });
  try {
    await page.goto(server.url, { waitUntil: "networkidle" });
    const results = [];
    for (const pageKey of pages) {
      await navigateToPage(page, pageKey);
      if (pageKey === "settings") {
        if (target.fullSettings) {
          for (const section of settingsSections) {
            const found = await navigateToSettingsSection(page, section);
            results.push(await scanState(page, target, theme, pageKey, found ? section : `missing-${section}`));
          }
        } else {
          results.push(await scanState(page, target, theme, pageKey, "shell-only"));
        }
      } else {
        results.push(await scanState(page, target, theme, pageKey, null, referenceShellContract));
      }
    }
    return results;
  } finally {
    await page.close();
  }
}

async function scanDesktopTarget(target, theme, server, referenceShellContract) {
  prepareDesktopData(theme);
  const app = await electron.launch({
    args: [
      "--force-device-scale-factor=1",
      join(repoRoot, "packages", "desktop", "dist", "main", "main.js")
    ],
    env: {
      ...process.env,
      NODE_ENV: "development",
      D2_VISUAL_TEST: "1",
      D2_RENDERER_URL: server.url,
      D2_DATA_DIR: desktopDataDir,
      BUNGIE_API_KEY: "visual-api-key",
      BUNGIE_CLIENT_ID: "visual-client-id",
      BUNGIE_CLIENT_SECRET: "visual-client-secret",
      BUNGIE_REDIRECT_URI: "https://127.0.0.1:28780/oauth/callback",
      D2_VISUAL_USER_DATA_DIR: join(outputDir, "electron-user-data", theme),
      D2_COLOR_MODE: theme
    }
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width, height });
    await page.waitForLoadState("domcontentloaded");
    await page.waitForSelector(".app-shell");
    const results = [];
    for (const pageKey of pages) {
      await navigateToPage(page, pageKey);
      if (pageKey === "settings") {
        for (const section of settingsSections) {
          await navigateToSettingsSection(page, section);
          results.push(await scanState(page, target, theme, pageKey, section));
        }
      } else {
        results.push(await scanState(page, target, theme, pageKey, null, referenceShellContract));
      }
    }
    return results;
  } finally {
    await app.close();
  }
}

async function main() {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid D2_VISUAL_CAPTURE_VIEWPORT: ${viewport}`);
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  if (!skipBuild) await buildDesktopOutputs();

  const results = [];
  const sharedShellContracts = {};
  const browser = await chromium.launch({ headless: true });
  try {
    for (const theme of themes) {
      let referenceShellContract = null;
      const servers = [];
      try {
        for (const target of browserTargets) {
          const server = await ensureTargetServer(target, theme);
          servers.push(server);
          const targetResults = await scanBrowserTarget(browser, target, theme, server, referenceShellContract);
          results.push(...targetResults);
          referenceShellContract ??= targetResults.find((item) => item.page === "home" && !item.settingsSection)?.shellContract ?? null;
        }
        sharedShellContracts[theme] = referenceShellContract;
        const desktopServer = await ensureTargetServer(desktopTarget, theme);
        servers.push(desktopServer);
        results.push(...await scanDesktopTarget(desktopTarget, theme, desktopServer, referenceShellContract));
      } finally {
        for (const server of servers) stop(server.child);
      }
    }
  } finally {
    await browser.close();
    rmSync(desktopDataDir, { recursive: true, force: true });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    mode: shellContractOnly ? "shell-contract" : "all",
    skippedBuild: skipBuild,
    viewport,
    pages,
    settingsSections,
    themes,
    targets: [...browserTargets.map((target) => target.key), desktopTarget.key],
    allowedLightBackgroundSelectors,
    sharedShellContracts,
    resultCount: results.length,
    results
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Visual all report: ${reportPath}`);
  console.log(`Visual all states scanned: ${results.length}`);
}

main().catch((error) => {
  const partial = {
    generatedAt: new Date().toISOString(),
    mode: shellContractOnly ? "shell-contract" : "all",
    skippedBuild: skipBuild,
    viewport,
    pages,
    settingsSections,
    themes,
    targets: [...browserTargets.map((target) => target.key), desktopTarget.key],
    allowedLightBackgroundSelectors,
    error: error instanceof Error ? error.message : String(error)
  };
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(reportPath, JSON.stringify(partial, null, 2), "utf8");
  console.error(error);
  process.exitCode = 1;
});
