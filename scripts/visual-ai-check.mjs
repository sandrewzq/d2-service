import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { _electron as electron, chromium } from "playwright";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const viewport = process.env.D2_VISUAL_CAPTURE_VIEWPORT ?? "1365x900";
const [width, height] = viewport.split("x").map((part) => Number.parseInt(part, 10));
const theme = process.env.D2_VISUAL_THEME ?? "dark";
const defaultWebPngName = "web-ai-dark-1365x900.png";
const defaultDesktopPngName = "desktop-ai-dark-1365x900.png";
const outputDir = resolve(process.env.D2_VISUAL_OUTPUT_DIR ?? join(repoRoot, ".local-data", "tmp", "visual", "ai"));
const desktopDataDir = join(outputDir, "desktop-data");
const reportPath = join(outputDir, "report.json");
const forbiddenText = [
  "Web AI 助手入口待接入",
  "后续接入真实页面上下文"
];
const forbiddenGlobalTitle = "小日向";
const ignoredConsoleErrorPatterns = [
  "Failed to load resource: the server responded with a status of 404",
  "/api/home-snapshot",
  "/api/pages/"
];
const targets = [
  {
    key: "web",
    packageName: "@d2-tools/web",
    port: 53171,
    screenshot: theme === "dark" && viewport === "1365x900" ? defaultWebPngName : `web-ai-${theme}-${viewport}.png`
  }
];
const desktopTarget = {
  key: "desktop",
  packageName: "@d2-tools/desktop",
  port: 53172,
  screenshot: (colorMode) => colorMode === "dark" && viewport === "1365x900" ? defaultDesktopPngName : `desktop-ai-${colorMode}-${viewport}.png`
};

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
  child.on("error", (error) => {
    console.error(error);
  });
  return child;
}

function run(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const normalized = normalizeSpawn(command, args);
    const child = spawn(normalized.command, normalized.args, {
      cwd: repoRoot,
      env: { ...process.env, ...(options.env ?? {}) },
      stdio: options.stdio ?? "inherit",
      windowsHide: true
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolveRun();
      } else {
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
      }
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
      .once("listening", () => {
        server.close(() => resolvePort(true));
      })
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

async function ensureTargetServer(target) {
  const url = `http://127.0.0.1:${target.port}`;
  if (!(await isPortAvailable(target.port))) {
    await waitForUrl(url);
    return { url, child: null, reused: true };
  }

  const child = start(pnpm, [
    "--filter",
    target.packageName,
    "exec",
    "vite",
    "--host",
    "127.0.0.1",
    "--port",
    String(target.port),
    "--strictPort"
  ], {
    env: {
      VITE_D2_VISUAL_PAGE: "home",
      VITE_D2_VISUAL_THEME: theme
    }
  });
  await waitForUrl(url);
  return { url, child, reused: false };
}

async function buildDesktopOutputs() {
  await run(pnpm, ["--filter", "@d2-tools/core", "build"]);
  await run(pnpm, ["--filter", "@d2-tools/app", "build"]);
  await run(pnpm, ["--filter", "@d2-tools/http", "build"]);
  await run(pnpm, ["--filter", "@d2-tools/desktop", "exec", "tsc", "-p", "tsconfig.main.json"]);
  await run(pnpm, ["--filter", "@d2-tools/desktop", "exec", "vite", "build", "--config", "vite.preload.config.ts"]);
}

function prepareDesktopData() {
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
      base_url: ""
    },
    features: {
      color_mode: theme
    }
  }, null, 2), "utf8");
}

async function ensureColorMode(page, options = {}) {
  const shell = page.locator(".app-shell");
  await shell.waitFor({ state: "visible" });
  const currentMode = await shell.getAttribute("data-color-mode");
  if (currentMode === theme) {
    return currentMode;
  }

  if (options.allowToggle === true) {
    await page.locator(".shell-tool-theme").click();
    await page.waitForFunction((expectedTheme) => {
      return document.querySelector(".app-shell")?.getAttribute("data-color-mode") === expectedTheme;
    }, theme, { timeout: 3_000 });
    return theme;
  }

  throw new Error(`${options.targetKey ?? "target"} color mode mismatch: expected ${theme}, got ${currentMode ?? "unknown"}`);
}

async function collectDrawerStyles(page) {
  return await page.evaluate(() => {
    const selectors = {
      panel: ".global-assistant-panel",
      drawer: ".global-assistant-drawer",
      sidebar: ".global-assistant-sidebar",
      chatPanel: ".ai-chat-panel",
      assistantMessage: ".ai-chat-message.message-assistant, .ai-chat-message"
    };

    return Object.fromEntries(Object.entries(selectors).map(([key, selector]) => {
      const element = document.querySelector(selector);
      if (!element) return [key, null];
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return [key, {
        selector,
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      }];
    }));
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

function isInvalidDarkBackground(value) {
  const rgb = parseCssRgb(value);
  if (!rgb) return true;
  if (rgb.a <= 0.05) return true;
  return rgb.r >= 230 && rgb.g >= 230 && rgb.b >= 230;
}

function assertDarkDrawerStyles(targetKey, drawerStyles) {
  if (theme !== "dark") return;

  for (const key of ["panel", "drawer", "sidebar"]) {
    const style = drawerStyles[key];
    if (!style) {
      throw new Error(`${targetKey} missing ${key} style snapshot`);
    }
    if (isInvalidDarkBackground(style.backgroundColor)) {
      throw new Error(`${targetKey} global-assistant-panel background invalid for ${key}: ${style.backgroundColor}`);
    }
    if (style.rect.width <= 0 || style.rect.height <= 0) {
      throw new Error(`${targetKey} global-assistant-panel background target has empty rect for ${key}`);
    }
  }

  const messageStyle = drawerStyles.assistantMessage;
  if (messageStyle && isInvalidDarkBackground(messageStyle.backgroundColor)) {
    throw new Error(`${targetKey} global-assistant-panel background invalid for assistant message: ${messageStyle.backgroundColor}`);
  }
}

async function inspectAiDrawerPage(page, target, server, options = {}) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      if (!ignoredConsoleErrorPatterns.some((pattern) => text.includes(pattern))) {
        consoleErrors.push(text);
      }
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  const colorMode = await ensureColorMode(page, { targetKey: target.key, allowToggle: options.allowToggle });
  await page.locator(".shell-tool-ai").click();
  const drawer = page.locator(".global-assistant-panel");
  await drawer.waitFor({ state: "visible" });
  await page.locator(".global-assistant-panel h2", { hasText: "AI 助手" }).waitFor();

  const title = (await page.locator(".global-assistant-panel h2").first().textContent())?.trim() ?? "";
  const drawerText = await drawer.textContent() ?? "";
  if (title !== "AI 助手") {
    throw new Error(`${target.key} AI drawer title mismatch: ${title}`);
  }
  for (const text of forbiddenText) {
    if (drawerText.includes(text)) {
      throw new Error(`${target.key} AI drawer still contains forbidden text: ${text}`);
    }
  }
  if (title === forbiddenGlobalTitle) {
    throw new Error(`${target.key} AI drawer uses task assistant title: ${forbiddenGlobalTitle}`);
  }

  const checkedText = ["AI 助手"];
  if (options.canSend !== false) {
    await page.locator(".ai-composer textarea").fill("仓库清理建议");
    await page.locator(".ai-composer button[type='submit']").click();
    await page.locator(".ai-chat-message.message-user", { hasText: "仓库清理建议" }).waitFor();
    await page.locator(".ai-chat-message.message-assistant").last().waitFor();
    checkedText.push("仓库清理建议");
  }
  const drawerStyles = await collectDrawerStyles(page);
  assertDarkDrawerStyles(target.key, drawerStyles);

  if (consoleErrors.length || pageErrors.length) {
    throw new Error(`${target.key} AI drawer console errors: ${[...consoleErrors, ...pageErrors].join(" | ")}`);
  }

  const screenshotName = typeof target.screenshot === "function" ? target.screenshot(colorMode) : target.screenshot;
  const screenshotPath = join(outputDir, screenshotName);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return {
    key: target.key,
    url: server.url,
    reusedServer: server.reused,
    title,
    colorMode,
    screenshot: screenshotPath,
    checkedText,
    forbiddenText,
    drawerStyles
  };
}

async function inspectBrowserAiDrawer(browser, target, server) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(server.url, { waitUntil: "networkidle" });
  const result = await inspectAiDrawerPage(page, target, server, { canSend: true });
  await page.close();
  return result;
}

async function inspectDesktopAiDrawer(server) {
  prepareDesktopData();
  const app = await electron.launch({
    args: [join(repoRoot, "packages", "desktop", "dist", "main", "main.js")],
    env: {
      ...process.env,
      NODE_ENV: "development",
      D2_RENDERER_URL: server.url,
      D2_DATA_DIR: desktopDataDir,
      D2_VISUAL_USER_DATA_DIR: join(outputDir, "electron-user-data"),
      D2_COLOR_MODE: theme
    }
  });
  try {
    const page = await app.firstWindow();
    await page.setViewportSize({ width, height });
    await page.waitForLoadState("networkidle");
    return await inspectAiDrawerPage(page, desktopTarget, server, { canSend: false, allowToggle: false });
  } finally {
    await app.close();
    rmSync(desktopDataDir, { recursive: true, force: true });
  }
}

async function main() {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    throw new Error(`Invalid D2_VISUAL_CAPTURE_VIEWPORT: ${viewport}`);
  }

  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const servers = [];
  const results = [];
  const browser = await chromium.launch({ headless: true });
  try {
    for (const target of targets) {
      const server = await ensureTargetServer(target);
      servers.push(server);
      results.push(await inspectBrowserAiDrawer(browser, target, server));
    }
    await buildDesktopOutputs();
    const desktopServer = await ensureTargetServer(desktopTarget);
    servers.push(desktopServer);
    results.push(await inspectDesktopAiDrawer(desktopServer));
  } finally {
    await browser.close();
    for (const server of servers) {
      stop(server.child);
    }
  }

  const report = {
    viewport,
    theme,
    generatedAt: new Date().toISOString(),
    results
  };
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Visual AI report: ${reportPath}`);
  for (const result of results) {
    console.log(`${result.key}: ${result.screenshot}`);
  }
  if (!existsSync(reportPath)) {
    throw new Error(`Report was not written: ${reportPath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
