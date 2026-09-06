import { ipcMain } from "electron";
import type { AccountItemSummary } from "@d2-tools/core/account/summary";
import {
  createLoadoutTemplate,
  deleteLoadoutTemplate,
  listLoadoutTemplates,
  renameLoadoutTemplate,
  type CreateLoadoutTemplateInput,
  type LoadoutTemplate
} from "@d2-tools/services/loadouts/templates";
import {
  createLocalLoadoutPlan,
  deleteLocalLoadoutPlan,
  listLocalLoadoutPlans,
  updateLocalLoadoutPlan
} from "@d2-tools/services/loadouts/plans";
import { previewDimLoadoutImport } from "@d2-tools/services/loadouts/dimImport";
import type {
  CreateLocalLoadoutPlanInput,
  UpdateLocalLoadoutPlanInput
} from "../../contracts/loadouts.js";
import { createLoadoutTemplateTransferPlan } from "@d2-tools/core/loadouts/plan";
import { loadConfig } from "@d2-tools/services/config/store";

export function registerLoadoutIpcHandlers(): void {
  ipcMain.handle("loadouts:list", () => {
    const config = loadConfig();
    return listLoadoutTemplates(config.data.data_dir);
  });

  ipcMain.handle("loadouts:create", (_event, input: CreateLoadoutTemplateInput) => {
    const config = loadConfig();
    return createLoadoutTemplate(config.data.data_dir, input);
  });

  ipcMain.handle("loadouts:rename", (_event, input: { id: string; name: string }) => {
    const config = loadConfig();
    return renameLoadoutTemplate(config.data.data_dir, input.id, input.name);
  });

  ipcMain.handle("loadouts:delete", (_event, id: string) => {
    const config = loadConfig();
    return deleteLoadoutTemplate(config.data.data_dir, id);
  });

  ipcMain.handle("loadouts:plans:list", () => {
    const config = loadConfig();
    return listLocalLoadoutPlans(config.data.data_dir);
  });

  ipcMain.handle("loadouts:plans:create", (_event, input: CreateLocalLoadoutPlanInput) => {
    const config = loadConfig();
    return createLocalLoadoutPlan(config.data.data_dir, input);
  });

  ipcMain.handle("loadouts:plans:update", (_event, input: {
    id: string;
    plan: UpdateLocalLoadoutPlanInput;
  }) => {
    const config = loadConfig();
    return updateLocalLoadoutPlan(config.data.data_dir, input.id, input.plan);
  });

  ipcMain.handle("loadouts:plans:delete", (_event, id: string) => {
    const config = loadConfig();
    return deleteLocalLoadoutPlan(config.data.data_dir, id);
  });

  ipcMain.handle("loadouts:dim:preview", (_event, url: string) => previewDimLoadoutImport(url));

  ipcMain.handle("loadouts:transfer-plan", (_event, input: {
    template: LoadoutTemplate;
    target_character_id: string;
    available_items: AccountItemSummary[];
    equipped_items: AccountItemSummary[];
  }) => {
    return createLoadoutTemplateTransferPlan(input);
  });
}
