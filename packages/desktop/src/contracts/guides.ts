import type { GuideSourceReadPreview } from "@d2-tools/core/guides/source";
export type { GuideSourceReadPreview, GuideSourceSection } from "@d2-tools/core/guides/source";

export type GuideSourceApi = {
  readGuideSource(url: string): Promise<GuideSourceReadPreview>;
};
