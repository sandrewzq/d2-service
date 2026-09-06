export type GuideSourceSection = {
  id: string;
  heading?: string;
  body: string;
  start_line: number;
  end_line: number;
};

export type GuideSourceReadPreview = {
  source_url: string;
  final_url: string;
  title?: string;
  author?: string;
  tags?: string[];
  body: string;
  sections: GuideSourceSection[];
  content_type: string;
  fetched_at: string;
  byte_length: number;
  warnings: string[];
  reader?: "static-html" | "dynamic-page";
  completeness?: "complete" | "text-only" | "partial";
  media_count?: number;
};

export function isSupportedGuideSourceUrl(value: string | undefined): boolean {
  if (!value?.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function createGuideSourceSections(body: string): GuideSourceSection[] {
  const lines = body.split(/\r?\n/);
  const sections: GuideSourceSection[] = [];
  let heading: string | undefined;
  let startLine = 1;
  let content: string[] = [];
  const flush = (endLine: number) => {
    const sectionBody = content.join("\n").trim();
    if (sectionBody) {
      sections.push({
        id: `section-${sections.length + 1}`,
        heading,
        body: sectionBody,
        start_line: startLine,
        end_line: endLine
      });
    }
    content = [];
  };
  lines.forEach((line, index) => {
    const match = line.match(/^#{1,6}\s+(.+)$/);
    if (match?.[1]) {
      flush(index);
      heading = match[1].trim();
      startLine = index + 2;
    } else {
      content.push(line);
    }
  });
  flush(lines.length);
  return sections.length ? sections : [{
    id: "section-1",
    body,
    start_line: 1,
    end_line: Math.max(1, lines.length)
  }];
}
