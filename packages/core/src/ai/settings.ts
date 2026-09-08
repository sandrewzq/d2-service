import type { D2Config } from "../config/schema.js";

export type AiProtocol = "openai_responses" | "openai_chat_completions" | "anthropic_messages";
export type AiSettings = D2Config["ai"];

export type NormalizedAiSettings = {
  protocol: "" | AiProtocol;
  api_key: string;
  model: string;
  base_url: string;
};

export const aiProtocolBaseUrls: Record<AiProtocol, string> = {
  openai_responses: "https://api.openai.com/v1",
  openai_chat_completions: "https://api.openai.com/v1",
  anthropic_messages: "https://api.anthropic.com"
};

export function normalizeAiSettings(settings: AiSettings): NormalizedAiSettings {
  const protocol = normalizeAiProtocol(settings);
  if (!protocol) {
    return {
      protocol: "",
      api_key: "",
      model: "",
      base_url: ""
    };
  }

  return {
    protocol,
    api_key: settings.api_key.trim(),
    model: settings.model.trim(),
    base_url: normalizeBaseUrl(settings.base_url, protocol)
  };
}

export function isAiSettingsConfigured(settings: AiSettings): boolean {
  const normalized = normalizeAiSettings(settings);
  return Boolean(normalized.protocol && normalized.api_key && normalized.model);
}

export function protocolLabel(protocol: string): string {
  if (protocol === "openai_chat_completions") return "OpenAI Chat Completions";
  if (protocol === "openai_responses") return "OpenAI Responses";
  if (protocol === "anthropic_messages") return "Anthropic Messages";
  return protocol;
}

function normalizeAiProtocol(settings: AiSettings): "" | AiProtocol {
  const protocol = settings.protocol.trim();
  if (isAiProtocol(protocol)) {
    return protocol;
  }
  return "";
}

function normalizeBaseUrl(baseUrl: string, protocol: AiProtocol): string {
  const trimmed = baseUrl.trim();
  if (trimmed) {
    return trimmed;
  }
  return aiProtocolBaseUrls[protocol];
}

function isAiProtocol(protocol: string): protocol is AiProtocol {
  return protocol === "openai_responses"
    || protocol === "openai_chat_completions"
    || protocol === "anthropic_messages";
}
