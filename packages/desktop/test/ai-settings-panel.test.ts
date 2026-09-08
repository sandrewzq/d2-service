import { describe, expect, it } from "vitest";
import {
  isAiSettingsConfigured,
  normalizeAiSettings
} from "../src/renderer/utils/aiSettings";

describe("AI settings panel helpers", () => {
  it("trims AI settings and keeps an invalid protocol disabled", () => {
    expect(normalizeAiSettings({
      protocol: " openai_responses ",
      api_key: " key ",
      model: " gpt-4.1 ",
      base_url: " https://api.example.com/v1 "
    })).toEqual({
      protocol: "openai_responses",
      api_key: "key",
      model: "gpt-4.1",
      base_url: "https://api.example.com/v1"
    });
    expect(normalizeAiSettings({
      protocol: " none ",
      api_key: " key ",
      model: " model ",
      base_url: " url "
    })).toEqual({ protocol: "", api_key: "", model: "", base_url: "" });
  });

  it("detects whether AI is actually configured for the assistant page", () => {
    expect(isAiSettingsConfigured({
      protocol: " none ",
      api_key: " key ",
      model: " model ",
      base_url: " https://example.test/v1 "
    })).toBe(false);

    expect(isAiSettingsConfigured({
      protocol: " openai_responses ",
      api_key: " key ",
      model: " gpt-4.1-mini ",
      base_url: ""
    })).toBe(true);

    expect(isAiSettingsConfigured({
      protocol: " anthropic_messages ",
      api_key: "",
      model: " claude-sonnet-4-5 ",
      base_url: ""
    })).toBe(false);
  });
});
