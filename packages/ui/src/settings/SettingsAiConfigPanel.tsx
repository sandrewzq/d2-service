import { useEffect, useMemo, useState } from "react";
import {
  normalizeAiSettings,
  protocolLabel,
  type AiSettings
} from "@d2-tools/core/ai/settings";
import { SettingsButton } from "./SettingsButton.js";

export type SettingsAiAdapter = {
  load: () => Promise<AiSettings>;
  save: (settings: AiSettings) => Promise<void>;
  listModels: (settings: AiSettings) => Promise<{ models: string[]; message: string }>;
  testConnection: () => Promise<{ protocol: string; model: string; message: string }>;
  onSaved?: () => void;
};

export function SettingsAiConfigPanel(props: { adapter: SettingsAiAdapter }) {
  const [protocol, setProtocol] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [modelInputMode, setModelInputMode] = useState<"select" | "manual">("select");
  const [modelListMessage, setModelListMessage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const settings = useMemo(() => normalizeAiSettings({
    protocol,
    api_key: apiKey,
    model,
    base_url: baseUrl
  }), [apiKey, baseUrl, model, protocol]);
  const isConfigured = Boolean(settings.protocol && settings.api_key);
  const isBusy = isLoading || isSaving || isTesting;

  useEffect(() => {
    let cancelled = false;
    void props.adapter.load().then((config) => {
      if (cancelled) return;
      const loaded = normalizeAiSettings(config);
      setProtocol(loaded.protocol);
      setApiKey(loaded.api_key);
      setModel(loaded.model);
      setBaseUrl(loaded.base_url);
    }).catch((loadError) => {
      if (!cancelled) setError(loadError instanceof Error ? loadError.message : "AI 配置读取失败");
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [props.adapter]);

  useEffect(() => {
    if (!isConfigured) {
      setModelOptions([]);
      setModelListMessage("");
      return;
    }
    let cancelled = false;
    setIsLoadingModels(true);
    setModelListMessage("");
    void props.adapter.listModels(settings).then((result) => {
      if (cancelled) return;
      setModelOptions(result.models);
      setModelListMessage(result.message);
      if (modelInputMode === "select" && model && !result.models.includes(model)) setModel("");
    }).catch(() => {
      if (!cancelled) {
        setModelOptions([]);
        setModelListMessage("目标服务未返回模型列表，请手动填写模型 ID。");
      }
    }).finally(() => {
      if (!cancelled) setIsLoadingModels(false);
    });
    return () => { cancelled = true; };
  }, [isConfigured, model, modelInputMode, props.adapter, settings]);

  async function refreshModels() {
    if (!isConfigured) return;
    setIsLoadingModels(true);
    setModelListMessage("");
    try {
      const result = await props.adapter.listModels(settings);
      setModelOptions(result.models);
      setModelListMessage(result.message);
      if (modelInputMode === "select" && model && !result.models.includes(model)) setModel("");
    } catch {
      setModelOptions([]);
      setModelListMessage("目标服务未返回模型列表，请手动填写模型 ID。");
    } finally {
      setIsLoadingModels(false);
    }
  }

  async function save() {
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      await props.adapter.save(settings);
      setMessage("AI 配置已保存。");
      props.adapter.onSaved?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "AI 配置保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAndTest() {
    setIsTesting(true);
    setMessage("");
    setError("");
    try {
      await props.adapter.save(settings);
      const result = await props.adapter.testConnection();
      setMessage(`${result.message} ${protocolLabel(result.protocol)} / ${result.model}`);
      props.adapter.onSaved?.();
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : "AI 连接测试失败");
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <div className="settings-ai-form" data-reference-id="settings.ai.form">
      <label data-info-priority="support" data-text-tone="primary">API 格式
        <select data-ui-kind="field" disabled={isBusy} value={protocol} onChange={(event) => setProtocol(event.target.value)}>
          <option value="">不启用 AI</option>
          <option value="openai_chat_completions">OpenAI Chat Completions</option>
          <option value="openai_responses">OpenAI Responses</option>
          <option value="anthropic_messages">Anthropic Messages</option>
        </select>
      </label>
      <label data-info-priority="support" data-text-tone="primary">API Key
        <input data-ui-kind="field" disabled={isBusy || !settings.protocol} placeholder="填写你的 AI API Key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
      </label>
      <label data-info-priority="support" data-text-tone="primary">Base URL
        <input data-ui-kind="field" disabled={isBusy || !settings.protocol} placeholder="支持填写服务根地址，或完整接口地址" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
      </label>
      <p className="settings-muted" data-ui-part="detail" data-info-priority="reading" data-text-tone="body">根地址和完整接口地址都兼容。程序会按当前 API 格式识别或补齐 /chat/completions、/responses 或 /messages 请求地址。</p>
      <label data-info-priority="support" data-text-tone="primary">模型
        <div className="settings-actions">
          {modelInputMode === "select" ? (
            <select className="settings-model-select" data-ui-kind="field" disabled={isBusy || !settings.protocol} value={modelOptions.includes(model) ? model : ""} onChange={(event) => setModel(event.target.value)}>
              <option value="">{modelOptions.length ? "请选择模型" : "先刷新模型列表"}</option>
              {modelOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ) : <input data-ui-kind="field" disabled={isBusy || !settings.protocol} placeholder="输入模型 ID，例如 gpt-5.4" value={model} onChange={(event) => setModel(event.target.value)} />}
          <SettingsButton data-control-variant="secondary" disabled={isBusy || isLoadingModels || !isConfigured} onClick={() => void refreshModels()}>{isLoadingModels ? "刷新中..." : "刷新模型"}</SettingsButton>
          <SettingsButton data-control-variant="secondary" disabled={isBusy || !settings.protocol} onClick={() => setModelInputMode((current) => current === "select" ? "manual" : "select")}>{modelInputMode === "select" ? "手动输入模型 ID" : "改为下拉选择"}</SettingsButton>
        </div>
      </label>
      <p className="settings-muted" data-ui-part="detail" data-info-priority="reading" data-text-tone="body">{modelListMessage || "模型列表会在 API 格式、Key 或 Base URL 变化后重新读取；服务未返回列表时可手动填写模型 ID。"}</p>
      <div className="settings-actions settings-action-row">
        <SettingsButton data-control-variant="secondary" disabled={isBusy} onClick={() => void save()}>{isSaving ? "保存中..." : "保存 AI 配置"}</SettingsButton>
        <SettingsButton data-control-variant="primary" disabled={isBusy || !settings.protocol} onClick={() => void saveAndTest()}>{isTesting ? "测试中..." : "保存并测试连接"}</SettingsButton>
      </div>
      {error ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="error" role="alert">{error}</p> : null}
      {message ? <p className="settings-feedback" data-ui-kind="callout" data-ui-part="state" data-info-priority="decision" data-text-tone="status" data-status="success" role="status" aria-live="polite">{message}</p> : null}
    </div>
  );
}
