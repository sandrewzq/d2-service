import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { createGuideSourceSections, isSupportedGuideSourceUrl, type GuideSourceReadPreview, type GuideSourceSection } from "@d2-tools/core/guides/source";

const maxRedirects = 5;
const maxResponseBytes = 2_000_000;
const maxExtractedCharacters = 200_000;
const requestTimeoutMs = 15_000;
const supportedContentTypes = ["text/html", "application/xhtml+xml", "text/plain", "text/markdown"];
const ignoredTags = new Set(["script", "style", "noscript", "svg", "canvas", "template", "form", "nav", "header", "footer", "aside"]);
const blockTags = new Set(["p", "li", "blockquote", "pre", "tr"]);

export async function readGuideSourceUrl(sourceUrl: string, now = new Date()): Promise<GuideSourceReadPreview> {
  if (!isSupportedGuideSourceUrl(sourceUrl)) throw new Error("攻略来源必须使用有效的 HTTP(S) 地址");
  let currentUrl = new URL(sourceUrl.trim());
  const warnings: string[] = [];
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicNetworkUrl(currentUrl);
    try {
      response = await fetch(currentUrl, {
        redirect: "manual",
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.1",
          "User-Agent": "d2-tools-guide-reader/0.0.15"
        },
        signal: AbortSignal.timeout(requestTimeoutMs)
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(`攻略链接读取失败：${detail}`);
    }
    if (!isRedirect(response.status)) break;
    const location = response.headers.get("location");
    if (!location) throw new Error("攻略链接返回了缺少目标地址的重定向");
    if (redirectCount === maxRedirects) throw new Error("攻略链接重定向次数过多");
    await response.body?.cancel();
    currentUrl = new URL(location, currentUrl);
    warnings.push(`来源经过重定向：${currentUrl.toString()}`);
  }

  if (!response) throw new Error("攻略链接没有返回响应");
  if (!response.ok) throw new Error(`攻略链接读取失败（HTTP ${response.status}）`);
  const contentType = normalizeContentType(response.headers.get("content-type"));
  if (!supportedContentTypes.includes(contentType)) {
    throw new Error(`不支持的攻略内容类型：${contentType || "未知"}`);
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    throw new Error("攻略页面超过 2 MB 读取上限");
  }

  const bytes = await readLimitedResponseBody(response, maxResponseBytes);
  const rawText = decodeResponseBody(bytes, response.headers.get("content-type"));
  const extracted = contentType === "text/html" || contentType === "application/xhtml+xml"
    ? extractHtmlDocument(rawText)
    : extractPlainText(rawText);
  if (!extracted.body.trim()) throw new Error("攻略页面没有可读取的正文");
  if (extracted.body.length > maxExtractedCharacters) {
    extracted.body = extracted.body.slice(0, maxExtractedCharacters).trimEnd();
    extracted.sections = createGuideSourceSections(extracted.body);
    warnings.push("正文超过 20 万字符，预览已截断");
  }

  return {
    source_url: sourceUrl.trim(),
    final_url: currentUrl.toString(),
    title: extracted.title,
    body: extracted.body,
    sections: extracted.sections,
    content_type: contentType,
    fetched_at: now.toISOString(),
    byte_length: bytes.byteLength,
    warnings: [...warnings, ...extracted.warnings],
    reader: "static-html",
    completeness: extracted.warnings.length ? "partial" : "complete",
    media_count: 0
  };
}

async function assertPublicNetworkUrl(url: URL): Promise<void> {
  if (!isSupportedGuideSourceUrl(url.toString()) || url.username || url.password) {
    throw new Error("攻略链接地址无效");
  }
  const hostname = url.hostname.toLocaleLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw new Error("攻略链接不能访问本机或局域网地址");
  }
  const addresses = isIP(hostname)
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("攻略链接不能访问本机或局域网地址");
  }
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLocaleLowerCase();
  if (normalized.includes(".")) {
    const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
    const parts = ipv4.split(".").map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
    const [a, b] = parts as [number, number, number, number];
    return a === 0
      || a === 10
      || a === 127
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19))
      || a >= 224;
  }
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") || normalized.startsWith("ff");
}

async function readLimitedResponseBody(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    length += next.value.byteLength;
    if (length > limit) {
      await reader.cancel();
      throw new Error("攻略页面超过 2 MB 读取上限");
    }
    chunks.push(next.value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function decodeResponseBody(bytes: Uint8Array, rawContentType: string | null): string {
  const charset = rawContentType?.match(/charset\s*=\s*["']?([^;"']+)/i)?.[1]?.trim() || "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

function extractHtmlDocument(html: string): { title?: string; body: string; sections: GuideSourceSection[]; warnings: string[] } {
  const document = parse(html);
  const title = findFirstText(document, "title") || findFirstText(document, "h1") || undefined;
  const candidates = collectContentCandidates(document);
  const candidateTexts = candidates.map((node) => extractBlocks(node)).filter((value) => value.join(" ").length >= 120);
  const lines = candidateTexts.sort((left, right) => right.join(" ").length - left.join(" ").length)[0] ?? extractBlocks(document);
  const body = normalizeExtractedLines(lines).join("\n");
  return {
    title: title?.slice(0, 240),
    body,
    sections: createGuideSourceSections(body),
    warnings: candidateTexts.length ? [] : ["页面没有明确正文容器，已使用整页可见文本"]
  };
}

function extractPlainText(text: string): { title?: string; body: string; sections: GuideSourceSection[]; warnings: string[] } {
  const body = normalizeExtractedLines(text.split(/\r?\n/)).join("\n");
  return {
    title: body.split("\n").find(Boolean)?.slice(0, 240),
    body,
    sections: createGuideSourceSections(body),
    warnings: []
  };
}

function collectContentCandidates(root: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.Node[] {
  const candidates: DefaultTreeAdapterTypes.Node[] = [];
  walk(root, (node) => {
    if (!isElement(node)) return;
    const identity = [node.tagName, attribute(node, "id"), attribute(node, "class")].join(" ").toLocaleLowerCase();
    if (node.tagName === "article" || node.tagName === "main" || /\b(content|article|post|entry|guide)\b/.test(identity)) {
      candidates.push(node);
    }
  });
  return candidates.length ? candidates : [root];
}

function extractBlocks(root: DefaultTreeAdapterTypes.Node): string[] {
  const lines: string[] = [];
  const visit = (node: DefaultTreeAdapterTypes.Node): void => {
    if (isElement(node)) {
      if (ignoredTags.has(node.tagName)) return;
      const headingLevel = /^h([1-6])$/.exec(node.tagName)?.[1];
      if (headingLevel) {
        const text = nodeText(node);
        if (text) lines.push(`${"#".repeat(Number(headingLevel))} ${text}`);
        return;
      }
      if (blockTags.has(node.tagName)) {
        const text = nodeText(node);
        if (text) lines.push(node.tagName === "li" ? `- ${text}` : text);
        return;
      }
    }
    for (const child of childNodes(node)) visit(child);
  };
  visit(root);
  if (!lines.length) {
    const fallback = nodeText(root);
    if (fallback) lines.push(fallback);
  }
  return lines;
}

function findFirstText(root: DefaultTreeAdapterTypes.Node, tagName: string): string {
  let result = "";
  walk(root, (node) => {
    if (!result && isElement(node) && node.tagName === tagName) result = nodeText(node);
  });
  return result;
}

function nodeText(node: DefaultTreeAdapterTypes.Node): string {
  if (isTextNode(node)) return node.value;
  if (isElement(node) && ignoredTags.has(node.tagName)) return "";
  return childNodes(node).map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

function walk(node: DefaultTreeAdapterTypes.Node, visitor: (node: DefaultTreeAdapterTypes.Node) => void): void {
  visitor(node);
  for (const child of childNodes(node)) walk(child, visitor);
}

function childNodes(node: DefaultTreeAdapterTypes.Node): DefaultTreeAdapterTypes.ChildNode[] {
  return "childNodes" in node ? node.childNodes : [];
}

function isElement(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.Element {
  return "tagName" in node;
}

function isTextNode(node: DefaultTreeAdapterTypes.Node): node is DefaultTreeAdapterTypes.TextNode {
  return node.nodeName === "#text" && "value" in node;
}

function attribute(node: DefaultTreeAdapterTypes.Element, name: string): string {
  return node.attrs.find((entry) => entry.name === name)?.value ?? "";
}

function normalizeExtractedLines(lines: string[]): string[] {
  const result: string[] = [];
  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+/g, " ").trim();
    if (!line) continue;
    if (result.at(-1) === line) continue;
    result.push(line);
  }
  return result;
}

function normalizeContentType(value: string | null): string {
  return value?.split(";", 1)[0]?.trim().toLocaleLowerCase() ?? "";
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}
