import { createCompositeDefinitionReader } from "./compositeDefinitionReader.js";
import { createJsonDefinitionReader, type JsonDefinitionReaderOptions } from "./jsonDefinitionReader.js";
import {
  createReaderGameDataCatalog,
  type ManagedGameDataCatalog
} from "./readerCatalog.js";
import { createSqliteDefinitionReader } from "./sqliteDefinitionReader.js";
import { createSqliteSearchIndex } from "./sqliteSearchIndex.js";
import type { GameDataSearchIndex } from "./searchIndex.js";

export type SqliteGameDataCatalogOptions = {
  databasePath: string;
  searchIndexPath: string;
  secondarySearchIndexPaths?: string[];
  manifestVersion?: string;
  language?: string;
  cacheSize?: number;
  jsonSupplement?: JsonDefinitionReaderOptions;
};

export function createSqliteGameDataCatalog(
  options: SqliteGameDataCatalogOptions
): ManagedGameDataCatalog {
  const sqliteReader = createSqliteDefinitionReader({
    databasePath: options.databasePath,
    cacheSize: options.cacheSize
  });
  const supplement = options.jsonSupplement
    ? createJsonDefinitionReader(options.jsonSupplement)
    : null;
  const reader = supplement
    ? createCompositeDefinitionReader(sqliteReader, supplement)
    : sqliteReader;
  const openedSearchIndexes: ReturnType<typeof createSqliteSearchIndex>[] = [];
  try {
    const primarySearchIndex = createSqliteSearchIndex({
      databasePath: options.searchIndexPath,
      expectedManifestVersion: options.manifestVersion,
      expectedLanguage: options.language
    });
    openedSearchIndexes.push(primarySearchIndex);
    const secondarySearchIndexes = (options.secondarySearchIndexPaths ?? []).map((databasePath) => {
      const index = createSqliteSearchIndex({
        databasePath,
        expectedManifestVersion: options.manifestVersion
      });
      openedSearchIndexes.push(index);
      return index;
    });
    const searchIndex: GameDataSearchIndex = secondarySearchIndexes.length
      ? {
          search(kind, terms, limit) {
            const hashes = new Set(primarySearchIndex.search(kind, terms, limit));
            for (const index of secondarySearchIndexes) {
              for (const hash of index.search(kind, terms, limit)) {
                hashes.add(hash);
                if (hashes.size >= limit) break;
              }
            }
            return [...hashes].slice(0, limit);
          },
          getItemVersionHashes: primarySearchIndex.getItemVersionHashes,
          getWeaponIdentityRelations: primarySearchIndex.getWeaponIdentityRelations,
          getRelatedItemSummary: primarySearchIndex.getRelatedItemSummary,
          getRelatedItemPage: primarySearchIndex.getRelatedItemPage,
          getPlugHashes: primarySearchIndex.getPlugHashes,
          getEnumHashes: primarySearchIndex.getEnumHashes,
          close() {
            try {
              primarySearchIndex.close();
            } finally {
              for (const index of secondarySearchIndexes) index.close();
            }
          }
        }
      : primarySearchIndex;
    return createReaderGameDataCatalog({ reader, searchIndex });
  } catch (error) {
    try {
      for (const index of openedSearchIndexes) index.close();
    } finally {
      reader.close();
    }
    throw error;
  }
}
