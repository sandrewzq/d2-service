import {
  createDimLoadoutImportPreview,
  parseDimLoadoutLink,
  type DimLoadoutImportPreview
} from "@d2-tools/core/loadouts/dimImport";

export function previewDimLoadoutImport(url: string): DimLoadoutImportPreview {
  const link = parseDimLoadoutLink(url);
  return createDimLoadoutImportPreview({
    source_url: link.source_url,
    payload: link.inline_loadout
  });
}
