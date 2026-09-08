import { describe, expect, it } from "vitest";
import {
  equipItem,
  equipItems,
  equipLoadout,
  insertSocketPlug,
  pullFromPostmaster,
  setItemLockState,
  snapshotLoadout,
  transferItem
} from "../../services/src/bungie/actions.js";
import type { D2Config } from "../src/config/schema.js";
import type { BungieOAuthToken } from "../src/oauth/login.js";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

const config: D2Config = {
  bungie: {
    api_key: "api-key",
    client_id: "client",
    client_secret: "secret",
    redirect_uri: "https://127.0.0.1:28780/oauth/callback"
  },
  data: {
    data_dir: "data",
    manifest_language: "zh-chs"
  },
  ai: {
    protocol: "",
    api_key: "",
    model: "",
    base_url: "",
  },
  features: {
    color_mode: "light"
  }
};

const token: BungieOAuthToken = {
  access_token: "access-token",
  token_type: "Bearer",
  expires_in: 3600
};

describe("Bungie item actions", () => {
  it("sets item lock state through the Bungie Actions endpoint", async () => {
    const calls: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push(new Request(input, init));
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await setItemLockState({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemId: "item-1",
      state: true,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(calls[0].url).toBe("https://example.test/Platform/Destiny2/Actions/Items/SetLockState/");
    expect(await calls[0].json()).toEqual({
      state: true,
      itemId: "item-1",
      characterId: "character-1",
      membershipType: 3
    });
  });

  it("equips an item onto a selected character", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await equipItem({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemId: "item-1",
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Items/EquipItem/");
    expect(await request?.json()).toEqual({
      itemId: "item-1",
      characterId: "character-1",
      membershipType: 3
    });
  });

  it("equips multiple items through one Bungie request", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({
        ErrorCode: 1,
        Message: "Ok",
        Response: {
          equipResults: [
            { itemInstanceId: "item-1", equipStatus: 1 },
            { itemInstanceId: "item-2", equipStatus: 1642 }
          ]
        }
      });
    };

    const result = await equipItems({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemIds: ["item-1", "item-2", "item-3"],
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Items/EquipItems/");
    expect(await request?.json()).toEqual({
      itemIds: ["item-1", "item-2", "item-3"],
      characterId: "character-1",
      membershipType: 3
    });
    expect(result.equipResults).toEqual([
      { itemInstanceId: "item-1", equipStatus: 1 },
      { itemInstanceId: "item-2", equipStatus: 1642 }
    ]);
  });

  it("transfers items to and from the vault", async () => {
    const requests: Request[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await transferItem({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemReferenceHash: 123,
      itemId: "item-1",
      transferToVault: true,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(requests[0].url).toBe("https://example.test/Platform/Destiny2/Actions/Items/TransferItem/");
    expect(await requests[0].json()).toEqual({
      itemReferenceHash: 123,
      stackSize: 1,
      transferToVault: true,
      itemId: "item-1",
      characterId: "character-1",
      membershipType: 3
    });
  });

  it("inserts a reusable plug using Bungie's nested plug payload", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await insertSocketPlug({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemId: "item-1",
      socketIndex: 3,
      plugHash: 456,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Items/InsertSocketPlugFree/");
    expect(await request?.json()).toEqual({
      itemId: "item-1",
      plug: {
        socketIndex: 3,
        socketArrayType: 0,
        plugItemHash: 456
      },
      characterId: "character-1",
      membershipType: 3
    });
  });

  it("pulls an item from the postmaster to a character", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await pullFromPostmaster({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      itemId: "item-1",
      itemReferenceHash: 456,
      stackSize: 2,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Items/PullFromPostmaster/");
    expect(await request?.json()).toEqual({
      itemReferenceHash: 456,
      stackSize: 2,
      itemId: "item-1",
      characterId: "character-1",
      membershipType: 3
    });
  });

  it("equips a Bungie in-game loadout slot onto a character", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await equipLoadout({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      loadoutIndex: 5,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Loadouts/EquipLoadout/");
    expect(await request?.json()).toEqual({
      characterId: "character-1",
      membershipType: 3,
      loadoutIndex: 5
    });
  });

  it("snapshots currently equipped items into a Bungie in-game loadout slot", async () => {
    let request: Request | undefined;
    const fetchImpl: typeof fetch = async (input, init) => {
      request = new Request(input, init);
      return jsonResponse({ ErrorCode: 1, Message: "Ok", Response: 0 });
    };

    await snapshotLoadout({
      config,
      token,
      membershipType: 3,
      characterId: "character-1",
      loadoutIndex: 2,
      nameHash: 9001,
      iconHash: 777,
      colorHash: 888,
      baseUrl: "https://example.test/Platform",
      fetchImpl
    });

    expect(request?.url).toBe("https://example.test/Platform/Destiny2/Actions/Loadouts/SnapshotLoadout/");
    expect(await request?.json()).toEqual({
      colorHash: 888,
      iconHash: 777,
      nameHash: 9001,
      characterId: "character-1",
      membershipType: 3,
      loadoutIndex: 2
    });
  });
});
