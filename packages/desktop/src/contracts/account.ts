import type {
  AccountItemDetail,
  AccountItemSummary,
  AccountMaterialSummary,
  AccountSnapshot,
  AccountSummary as CoreAccountSummary,
  CharacterEquipmentGroup,
  CharacterLoadoutSlotSummary,
  CharacterSummary
} from "@d2-tools/core/account/summary";
import type { AuthLoginResult } from "@d2-tools/core/oauth/login";
import type { CachedAccountSnapshot } from "@d2-tools/services/account/snapshotStore";
import type { DataResource } from "@d2-tools/services/account/resource";
import type { AccountPursuitSummary } from "@d2-tools/core/account/pursuits";
export type {
  DataResource,
  DataResourceError,
  DataResourceSource,
  DataResourceStatus
} from "@d2-tools/services/account/resource";

export type AccountApi = {
  loginBungie(): Promise<AuthLoginResult>;
  getAccountSummary(options?: AccountSummaryRequestOptions): Promise<AccountSummary>;
  onAccountSnapshotChanged(callback: (snapshot: AccountSummary) => void): () => void;
  getCachedAccountSnapshot(): Promise<CachedAccountSnapshot | null>;
  getAccountItemDetail(instanceId: string, options?: AccountItemDetailRequestOptions): Promise<AccountItemDetail>;
  getAccountSnapshotResource(options?: AccountResourceRequestOptions): Promise<AccountSnapshotResource>;
  getAccountItemDetailResource(instanceId: string, options?: AccountResourceRequestOptions): Promise<AccountItemDetailResource>;
  getAccountPursuitResource(options?: AccountResourceRequestOptions): Promise<AccountPursuitResource>;
};

export const accountSnapshotChangedChannel = "account:snapshot:changed";

export type AccountResourceRequestOptions = { force?: boolean };
export type AccountSnapshotResource = DataResource<AccountSnapshot>;
export type AccountItemDetailResource = DataResource<AccountItemDetail>;
export type AccountPursuitResource = DataResource<AccountPursuitSummary>;

export type AccountSummaryRequestOptions = {
  force?: boolean;
  authoritative?: boolean;
};

export type AccountItemDetailRequestOptions = {
  force?: boolean;
};

export type AccountSummary = CoreAccountSummary;

export type {
  AccountItemDetail,
  AccountItemSummary,
  AccountPursuitSummary,
  AccountMaterialSummary,
  AccountSnapshot,
  AuthLoginResult,
  CachedAccountSnapshot,
  CharacterEquipmentGroup,
  CharacterLoadoutSlotSummary,
  CharacterSummary
};
