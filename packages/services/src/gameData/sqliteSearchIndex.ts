import { mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { WeaponIdentityRelation, WeaponVariantKind } from "@d2-tools/core/community-perks";
import type { DefinitionRecord } from "@d2-tools/core/manifest/definitions";
import { toSignedHash, toUnsignedHash } from "./definitionReader.js";
import { buildWeaponIdentityRelations } from "./weaponIdentity.js";
import type {
  GameDataSearchIndex,
  GameDataSearchIndexBuildResult,
  GameDataSearchKind
} from "./searchIndex.js";

export type BuildSqliteSearchIndexOptions = {
  sourceDatabasePath: string;
  indexDatabasePath: string;
  manifestVersion: string;
  language: string;
};

type SourceRow = {
  id: number | bigint;
  json: Uint8Array | string;
};

type IndexedItem = {
  hash: number;
  canonicalKey: string;
  versionKey: string;
  rank: number;
};

const nonEquipmentItemTypes = new Set([0, 19, 20, 30]);
const searchIndexSchemaVersion = "4";

export function buildSqliteSearchIndex(
  options: BuildSqliteSearchIndexOptions
): GameDataSearchIndexBuildResult {
  mkdirSync(dirname(options.indexDatabasePath), { recursive: true });
  rmSync(options.indexDatabasePath, { force: true });

  const source = new DatabaseSync(options.sourceDatabasePath, {
    readOnly: true,
    timeout: 5_000
  });
  const index = new DatabaseSync(options.indexDatabasePath, { timeout: 5_000 });
  try {
    index.exec(`
      PRAGMA journal_mode = OFF;
      PRAGMA synchronous = OFF;
      PRAGMA temp_store = MEMORY;
    `);
    createSchema(index);

    const insertMetadata = index.prepare(
      "INSERT INTO metadata(key, value) VALUES (?, ?)"
    );
    insertMetadata.run("manifest_version", options.manifestVersion);
    insertMetadata.run("language", options.language.trim().toLowerCase());
    insertMetadata.run("schema_version", searchIndexSchemaVersion);

    const insertDocument = index.prepare(`
      INSERT INTO search_documents(kind, hash, canonical_key, name, search_text, rank)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const insertPerkPlug = index.prepare(
      "INSERT OR IGNORE INTO perk_plugs(perk_hash, plug_hash) VALUES (?, ?)"
    );
    const insertRelation = index.prepare(
      "INSERT OR IGNORE INTO perk_related_items(perk_hash, item_hash) VALUES (?, ?)"
    );
    const insertEnumDefinition = index.prepare(`
      INSERT OR REPLACE INTO definition_enums(kind, enum_value, hash)
      VALUES (?, ?, ?)
    `);
    const insertItemVersionRelation = index.prepare(`
      INSERT INTO item_version_relation(
        item_hash,
        canonical_hash,
        relation_key,
        rank
      ) VALUES (?, ?, ?, ?)
    `);
    const insertWeaponIdentityRelation = index.prepare(`
      INSERT INTO weapon_identity_relation(
        item_hash,
        family_key,
        release_group_key,
        variant_kind,
        variant_tags,
        canonical_item_hash,
        release_label,
        relation_evidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const plugPerks = new Map<number, number[]>();
    const indexedItems: IndexedItem[] = [];
    const weaponDefinitions: DefinitionRecord[] = [];
    let itemCount = 0;
    let perkCount = 0;
    let relationCount = 0;

    runTransaction(index, () => {
      for (const row of iterateTable(source, "DestinyInventoryItemDefinition")) {
        const definition = parseSourceRow(row);
        const hash = definitionHash(definition, row.id);
        const name = definition.displayProperties?.name?.trim();
        if (name && isSearchableEquipment(definition)) {
          const canonicalKey = equipmentCanonicalKey(definition, hash);
          const rank = equipmentDefinitionScore(definition);
          insertDocument.run(
            "item",
            toSignedHash(hash),
            canonicalKey,
            name,
            normalizeSearchText(name),
            rank
          );
          indexedItems.push({
            hash,
            canonicalKey,
            versionKey: equipmentVersionKey(definition, hash),
            rank
          });
          itemCount += 1;
        }
        if (name && isWeaponDefinition(definition)) weaponDefinitions.push(definition);

        const perkHashes = uniqueNumbers(
          (definition.perks ?? [])
            .map((perk) => perk.perkHash)
            .filter((perkHash): perkHash is number => typeof perkHash === "number")
        );
        if (perkHashes.length) {
          plugPerks.set(hash, perkHashes);
          for (const perkHash of perkHashes) {
            insertPerkPlug.run(toSignedHash(perkHash), toSignedHash(hash));
          }
        }
      }

      for (const row of iterateTable(source, "DestinySandboxPerkDefinition")) {
        const definition = parseSourceRow(row);
        const name = definition.displayProperties?.name?.trim();
        if (!name) {
          continue;
        }
        const description = definition.displayProperties?.description?.trim() ?? "";
        insertDocument.run(
          "perk",
          toSignedHash(definitionHash(definition, row.id)),
          `perk:${definitionHash(definition, row.id)}`,
          name,
          normalizeSearchText(`${name}\n${description}`),
          Number(definition.index ?? 0)
        );
        perkCount += 1;
      }

      for (const [kind, table] of [
        ["breaker", "DestinyBreakerTypeDefinition"],
        ["damage", "DestinyDamageTypeDefinition"]
      ] as const) {
        for (const row of iterateTable(source, table)) {
          const definition = parseSourceRow(row);
          const enumValue = Number(definition.enumValue);
          if (Number.isFinite(enumValue)) {
            insertEnumDefinition.run(
              kind,
              enumValue,
              toSignedHash(definitionHash(definition, row.id))
            );
          }
        }
      }
    });

    const canonicalItems = selectCanonicalItems(indexedItems);
    runTransaction(index, () => {
      for (const item of indexedItems) {
        insertItemVersionRelation.run(
          toSignedHash(item.hash),
          toSignedHash(canonicalItems.get(item.canonicalKey)?.hash ?? item.hash),
          item.versionKey,
          item.rank
        );
      }
      for (const relation of buildWeaponIdentityRelations(weaponDefinitions)) {
        insertWeaponIdentityRelation.run(
          toSignedHash(relation.item_hash),
          relation.family_key,
          relation.release_group_key,
          relation.variant_kind,
          JSON.stringify(relation.variant_tags),
          toSignedHash(relation.canonical_item_hash),
          relation.release_label ?? "",
          relation.relation_evidence
        );
      }
    });

    const plugSets = loadPlugSets(source);
    runTransaction(index, () => {
      for (const row of iterateTable(source, "DestinyInventoryItemDefinition")) {
        const definition = parseSourceRow(row);
        if (!definition.displayProperties?.name?.trim() || !isSearchableEquipment(definition)) {
          continue;
        }
        const itemHash = definitionHash(definition, row.id);
        const relatedPerks = new Set<number>();
        for (const plugHash of collectItemPlugHashes(definition, plugSets)) {
          for (const perkHash of plugPerks.get(plugHash) ?? []) {
            relatedPerks.add(perkHash);
          }
        }
        for (const perkHash of relatedPerks) {
          const result = insertRelation.run(toSignedHash(perkHash), toSignedHash(itemHash));
          relationCount += Number(result.changes);
        }
      }
    });

    index.exec(`
      CREATE INDEX search_documents_kind_name_idx
        ON search_documents(kind, name);
      CREATE INDEX perk_related_items_perk_idx
        ON perk_related_items(perk_hash, item_hash);
      CREATE INDEX perk_plugs_perk_idx
        ON perk_plugs(perk_hash, plug_hash);
      CREATE INDEX item_version_relation_group_idx
        ON item_version_relation(relation_key, canonical_hash, rank);
      CREATE INDEX weapon_identity_relation_release_idx
        ON weapon_identity_relation(release_group_key, item_hash);
      CREATE INDEX weapon_identity_relation_family_idx
        ON weapon_identity_relation(family_key, release_group_key);
    `);
    index.exec("PRAGMA optimize;");

    return { itemCount, perkCount, relationCount };
  } finally {
    index.close();
    source.close();
  }
}

export type SqliteSearchIndexOptions = {
  databasePath: string;
  expectedManifestVersion?: string;
  expectedLanguage?: string;
};

export function createSqliteSearchIndex(
  options: SqliteSearchIndexOptions
): GameDataSearchIndex {
  const database = new DatabaseSync(options.databasePath, {
    readOnly: true,
    timeout: 5_000
  });
  try {
    database.exec("PRAGMA query_only = ON;");
    assertIndexCompatibility(database, options);
  } catch (error) {
    database.close();
    throw error;
  }
  let closed = false;

  return {
    search(kind, terms, limit) {
      return searchHashes(database, kind, terms, limit);
    },

    getItemVersionHashes(itemHashes, limit) {
      return queryItemVersionHashes(database, itemHashes, limit);
    },

    getWeaponIdentityRelations(itemHashes) {
      return queryWeaponIdentityRelations(database, itemHashes);
    },

    getRelatedItemSummary(perkHashes) {
      const result = queryCanonicalRelatedItems(database, perkHashes);
      return {
        total: result.total,
        hashes: result.items.map((item) => item.hash)
      };
    },

    getRelatedItemPage(perkHashes, offset, limit) {
      return queryCanonicalRelatedItems(database, perkHashes, offset, limit);
    },

    getPlugHashes(perkHashes) {
      return queryMappedHashes(database, "perk_plugs", "plug_hash", perkHashes);
    },

    getEnumHashes(kind, enumValues) {
      const statement = database.prepare(
        "SELECT hash FROM definition_enums WHERE kind = ? AND enum_value = ?"
      );
      const hashes = new Set<number>();
      for (const enumValue of new Set(enumValues)) {
        const row = statement.get(kind, enumValue) as { hash: number } | undefined;
        if (row) {
          hashes.add(toUnsignedHash(row.hash));
        }
      }
      return [...hashes];
    },

    close() {
      if (closed) {
        return;
      }
      closed = true;
      database.close();
    }
  };
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE search_documents (
      kind TEXT NOT NULL CHECK(kind IN ('item', 'perk')),
      hash INTEGER NOT NULL,
      canonical_key TEXT NOT NULL,
      name TEXT NOT NULL,
      search_text TEXT NOT NULL,
      rank INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY(kind, hash)
    );
    CREATE TABLE perk_plugs (
      perk_hash INTEGER NOT NULL,
      plug_hash INTEGER NOT NULL,
      PRIMARY KEY(perk_hash, plug_hash)
    );
    CREATE TABLE perk_related_items (
      perk_hash INTEGER NOT NULL,
      item_hash INTEGER NOT NULL,
      PRIMARY KEY(perk_hash, item_hash)
    );
    CREATE TABLE definition_enums (
      kind TEXT NOT NULL CHECK(kind IN ('breaker', 'damage')),
      enum_value INTEGER NOT NULL,
      hash INTEGER NOT NULL,
      PRIMARY KEY(kind, enum_value)
    );
    CREATE TABLE item_version_relation (
      item_hash INTEGER PRIMARY KEY,
      canonical_hash INTEGER NOT NULL,
      relation_key TEXT NOT NULL,
      rank INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE weapon_identity_relation (
      item_hash INTEGER PRIMARY KEY,
      family_key TEXT NOT NULL,
      release_group_key TEXT NOT NULL,
      variant_kind TEXT NOT NULL CHECK(variant_kind IN (
        'standard', 'adept', 'timelost', 'harrowed', 'holofoil', 'named_variant'
      )),
      variant_tags TEXT NOT NULL,
      canonical_item_hash INTEGER NOT NULL,
      release_label TEXT NOT NULL DEFAULT '',
      relation_evidence TEXT NOT NULL CHECK(relation_evidence IN ('release_trait', 'isolated'))
    );
  `);
}

function searchHashes(
  database: DatabaseSync,
  kind: GameDataSearchKind,
  terms: Iterable<string>,
  requestedLimit: number
): number[] {
  const normalizedTerms = [...new Set(
    [...terms].map(normalizeSearchText).filter(Boolean)
  )].slice(0, 16);
  if (!normalizedTerms.length) {
    return [];
  }

  const conditions = normalizedTerms.map(() => "instr(search_text, ?) > 0").join(" OR ");
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 500));
  const primaryTerm = normalizedTerms[0];
  const rows = database.prepare(`
    SELECT hash
    FROM (
      SELECT
        hash,
        name,
        rank,
        canonical_key,
        row_number() OVER (
          PARTITION BY canonical_key
          ORDER BY rank DESC, hash ASC
        ) AS canonical_rank
      FROM search_documents
      WHERE kind = ? AND (${conditions})
    )
    WHERE canonical_rank = 1
    ORDER BY
      CASE
        WHEN lower(name) = ? THEN 0
        WHEN instr(lower(name), ?) = 1 THEN 1
        ELSE 2
      END,
      rank DESC,
      length(name) ASC,
      hash ASC
    LIMIT ?
  `).all(kind, ...normalizedTerms, primaryTerm, primaryTerm, limit) as Array<{ hash: number }>;

  return rows.map((row) => toUnsignedHash(row.hash));
}

function equipmentCanonicalKey(definition: DefinitionRecord, hash: number): string {
  const name = normalizeSearchText(definition.displayProperties?.name ?? "");
  const icon = definition.displayProperties?.icon?.trim() ?? "";
  if (!name || !icon) {
    return `hash:${hash}`;
  }
  const releaseTraits = (definition.traitIds ?? [])
    .filter((traitId) => traitId.startsWith("releases."))
    .sort()
    .join(",");
  return [
    name,
    icon,
    definition.itemType ?? "",
    definition.classType ?? "",
    definition.inventory?.bucketTypeHash ?? "",
    releaseTraits
  ].join("|");
}

function equipmentVersionKey(definition: DefinitionRecord, hash: number): string {
  const name = normalizeSearchText(definition.displayProperties?.name ?? "");
  if (!name) {
    return `hash:${hash}`;
  }
  return [
    name,
    definition.itemType ?? "",
    definition.classType ?? "",
    definition.inventory?.bucketTypeHash ?? ""
  ].join("|");
}

function selectCanonicalItems(items: IndexedItem[]): Map<string, IndexedItem> {
  const selected = new Map<string, IndexedItem>();
  for (const item of items) {
    const current = selected.get(item.canonicalKey);
    if (
      !current
      || item.rank > current.rank
      || (item.rank === current.rank && toSignedHash(item.hash) < toSignedHash(current.hash))
    ) {
      selected.set(item.canonicalKey, item);
    }
  }
  return selected;
}

function queryItemVersionHashes(
  database: DatabaseSync,
  itemHashes: Iterable<number>,
  requestedLimit: number
): number[] {
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 500));
  const statement = database.prepare(`
    SELECT related.canonical_hash AS hash
    FROM item_version_relation AS source
    JOIN item_version_relation AS related
      ON related.relation_key = source.relation_key
    WHERE source.item_hash = ?
      AND related.item_hash = related.canonical_hash
    ORDER BY related.rank DESC, related.canonical_hash ASC
    LIMIT ?
  `);
  const results = new Set<number>();
  for (const hash of new Set([...itemHashes].map(toUnsignedHash))) {
    const remaining = limit - results.size;
    if (remaining <= 0) break;
    const rows = statement.all(toSignedHash(hash), remaining) as Array<{ hash: number }>;
    if (!rows.length) {
      results.add(hash);
      continue;
    }
    for (const row of rows) {
      results.add(toUnsignedHash(row.hash));
      if (results.size >= limit) break;
    }
  }
  return [...results];
}

function queryWeaponIdentityRelations(
  database: DatabaseSync,
  itemHashes: Iterable<number>
): WeaponIdentityRelation[] {
  const relations = new Map<number, WeaponIdentityRelation>();
  const requestedHashes = [...new Set([...itemHashes].map(toUnsignedHash))];
  for (let offset = 0; offset < requestedHashes.length; offset += 250) {
    const batch = requestedHashes.slice(offset, offset + 250);
    const placeholders = batch.map(() => "?").join(", ");
    const rows = database.prepare(`
      SELECT DISTINCT
        related.item_hash,
        related.family_key,
        related.release_group_key,
        related.variant_kind,
        related.variant_tags,
        related.canonical_item_hash,
        related.release_label,
        related.relation_evidence
      FROM weapon_identity_relation AS source
      JOIN weapon_identity_relation AS related
        ON related.release_group_key = source.release_group_key
      WHERE source.item_hash IN (${placeholders})
      ORDER BY related.item_hash
    `).all(...batch.map(toSignedHash)) as Array<{
      item_hash: number;
      family_key: string;
      release_group_key: string;
      variant_kind: WeaponVariantKind;
      variant_tags: string;
      canonical_item_hash: number;
      release_label: string;
      relation_evidence: "release_trait" | "isolated";
    }>;
    for (const row of rows) {
      const normalizedHash = toUnsignedHash(row.item_hash);
      relations.set(normalizedHash, {
        item_hash: normalizedHash,
        family_key: row.family_key,
        release_group_key: row.release_group_key,
        variant_kind: row.variant_kind,
        variant_tags: parseWeaponVariantTags(row.variant_tags, row.variant_kind),
        canonical_item_hash: toUnsignedHash(row.canonical_item_hash),
        ...(row.release_label ? { release_label: row.release_label } : {}),
        relation_evidence: row.relation_evidence
      });
    }
  }
  return [...relations.values()];
}

function parseWeaponVariantTags(
  value: string,
  fallback: WeaponVariantKind
): WeaponVariantKind[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [fallback];
    const tags = parsed.filter(isWeaponVariantKind);
    return tags.length ? [...new Set(tags)] : [fallback];
  } catch {
    return [fallback];
  }
}

function isWeaponVariantKind(value: unknown): value is WeaponVariantKind {
  return value === "standard"
    || value === "adept"
    || value === "timelost"
    || value === "harrowed"
    || value === "holofoil"
    || value === "named_variant";
}

function queryMappedHashes(
  database: DatabaseSync,
  table: "perk_plugs",
  resultColumn: "plug_hash",
  perkHashes: Iterable<number>,
  limitPerPerk?: number
): number[] {
  const result = new Set<number>();
  const statement = database.prepare(`
    SELECT ${resultColumn} AS hash
    FROM ${table}
    WHERE perk_hash = ?
    ORDER BY ${resultColumn}
    ${limitPerPerk ? "LIMIT ?" : ""}
  `);
  for (const perkHash of new Set([...perkHashes].map(toUnsignedHash))) {
    const rows = (limitPerPerk
      ? statement.all(toSignedHash(perkHash), limitPerPerk)
      : statement.all(toSignedHash(perkHash))) as Array<{ hash: number }>;
    for (const row of rows) {
      result.add(toUnsignedHash(row.hash));
    }
  }
  return [...result];
}

function queryCanonicalRelatedItems(
  database: DatabaseSync,
  perkHashes: Iterable<number>,
  requestedOffset?: number,
  requestedLimit?: number
): { total: number; items: Array<{ hash: number; perk_hashes: number[] }> } {
  const normalizedHashes = [...new Set([...perkHashes].map(toUnsignedHash))];
  if (!normalizedHashes.length) return { total: 0, items: [] };

  const placeholders = normalizedHashes.map(() => "?").join(", ");
  const parameters = normalizedHashes.map(toSignedHash);
  const relatedCte = `
    WITH related AS (
      SELECT DISTINCT versions.canonical_hash AS hash, relations.perk_hash
      FROM perk_related_items AS relations
      JOIN item_version_relation AS versions
        ON versions.item_hash = relations.item_hash
      WHERE relations.perk_hash IN (${placeholders})
    ), grouped AS (
      SELECT hash, group_concat(DISTINCT perk_hash) AS perk_hashes
      FROM related
      GROUP BY hash
    )
  `;
  const totalRow = database.prepare(`
    ${relatedCte}
    SELECT count(*) AS total FROM grouped
  `).get(...parameters) as { total: number } | undefined;
  const total = Number(totalRow?.total ?? 0);

  if (requestedLimit === undefined) {
    const rows = database.prepare(`
      ${relatedCte}
      SELECT hash, perk_hashes FROM grouped ORDER BY hash
    `).all(...parameters) as Array<{ hash: number; perk_hashes: string }>;
    return { total, items: rows.map(normalizeRelatedItemRow) };
  }

  const offset = Math.max(0, Math.trunc(requestedOffset ?? 0));
  const limit = Math.max(1, Math.min(Math.trunc(requestedLimit), 100));
  const rows = database.prepare(`
    ${relatedCte}
    SELECT grouped.hash, grouped.perk_hashes
    FROM grouped
    LEFT JOIN search_documents AS documents
      ON documents.kind = 'item' AND documents.hash = grouped.hash
    LEFT JOIN item_version_relation AS versions
      ON versions.item_hash = grouped.hash
    ORDER BY lower(documents.name), versions.rank DESC, grouped.hash ASC
    LIMIT ? OFFSET ?
  `).all(...parameters, limit, offset) as Array<{ hash: number; perk_hashes: string }>;
  return { total, items: rows.map(normalizeRelatedItemRow) };
}

function normalizeRelatedItemRow(row: { hash: number; perk_hashes: string }): {
  hash: number;
  perk_hashes: number[];
} {
  return {
    hash: toUnsignedHash(row.hash),
    perk_hashes: row.perk_hashes
      .split(",")
      .map(Number)
      .filter(Number.isFinite)
      .map(toUnsignedHash)
      .sort((left, right) => left - right)
  };
}

function assertIndexCompatibility(
  database: DatabaseSync,
  options: SqliteSearchIndexOptions
): void {
  const metadata = Object.fromEntries(
    (database.prepare("SELECT key, value FROM metadata").all() as Array<{ key: string; value: string }>)
      .map((row) => [row.key, row.value])
  );
  if (metadata.schema_version !== searchIndexSchemaVersion) {
    throw new Error("Search index schema version is not current");
  }
  if (options.expectedManifestVersion && metadata.manifest_version !== options.expectedManifestVersion) {
    throw new Error("Search index Manifest version does not match the active database");
  }
  if (
    options.expectedLanguage
    && metadata.language !== options.expectedLanguage.trim().toLowerCase()
  ) {
    throw new Error("Search index language does not match the active database");
  }
}

function loadPlugSets(database: DatabaseSync): Map<number, number[]> {
  const plugSets = new Map<number, number[]>();
  for (const row of iterateTable(database, "DestinyPlugSetDefinition")) {
    const definition = parseSourceRow(row);
    plugSets.set(
      definitionHash(definition, row.id),
      uniqueNumbers(
        (definition.reusablePlugItems ?? [])
          .map((item) => item.plugItemHash)
          .filter((hash): hash is number => typeof hash === "number")
      )
    );
  }
  return plugSets;
}

function collectItemPlugHashes(
  definition: DefinitionRecord,
  plugSets: Map<number, number[]>
): number[] {
  return uniqueNumbers((definition.sockets?.socketEntries ?? []).flatMap((entry) => [
    ...(typeof entry.singleInitialItemHash === "number" ? [entry.singleInitialItemHash] : []),
    ...(entry.reusablePlugItems ?? [])
      .map((item) => item.plugItemHash)
      .filter((hash): hash is number => typeof hash === "number"),
    ...(typeof entry.reusablePlugSetHash === "number"
      ? plugSets.get(toUnsignedHash(entry.reusablePlugSetHash)) ?? []
      : []),
    ...(typeof entry.randomizedPlugSetHash === "number"
      ? plugSets.get(toUnsignedHash(entry.randomizedPlugSetHash)) ?? []
      : [])
  ]));
}

function iterateTable(database: DatabaseSync, table: string): Iterable<SourceRow> {
  const exists = database.prepare(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?"
  ).get(table) as { found: number } | undefined;
  if (!exists) {
    return [];
  }
  return database.prepare(`SELECT id, json FROM "${table}"`).iterate() as Iterable<SourceRow>;
}

function parseSourceRow(row: SourceRow): DefinitionRecord {
  const json = typeof row.json === "string"
    ? row.json
    : Buffer.from(row.json).toString("utf8");
  return JSON.parse(json) as DefinitionRecord;
}

function definitionHash(definition: DefinitionRecord, rowId: number | bigint): number {
  const hash = Number(definition.hash);
  return Number.isFinite(hash) ? toUnsignedHash(hash) : toUnsignedHash(Number(rowId));
}

function normalizeSearchText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function isSearchableEquipment(definition: DefinitionRecord): boolean {
  return typeof definition.itemType !== "number" || !nonEquipmentItemTypes.has(definition.itemType);
}

function isWeaponDefinition(definition: DefinitionRecord): boolean {
  return definition.itemType === 3;
}

function equipmentDefinitionScore(definition: DefinitionRecord): number {
  return (definition.collectibleHash ? 1_000_000 : 0)
    + (definition.sourceData?.sourceString?.trim() ? 100_000 : 0)
    + Number(definition.index ?? 0);
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.map(toUnsignedHash))];
}

function runTransaction(database: DatabaseSync, operation: () => void): void {
  database.exec("BEGIN IMMEDIATE;");
  try {
    operation();
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}
