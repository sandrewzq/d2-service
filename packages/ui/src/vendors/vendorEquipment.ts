import type { VendorInventoryItemView } from "./VendorsPageContentView.js";

export type VendorEquipmentKind = "weapon" | "armor";

export function getVendorEquipmentKind(item: VendorInventoryItemView): VendorEquipmentKind | null {
  if (item.equipmentKind) return item.equipmentKind;
  if (/头盔|面罩|臂铠|手套|胸甲|胸部护甲|法袍|腿甲|腿部护甲|战靴|职业物品|披风|印记|臂环|helmet|gauntlet|chest armor|leg armor|class item/i.test(item.itemType)) {
    return "armor";
  }
  if (/自动步枪|战斗弓|弓箭|弓|脉冲步枪|斥候步枪|手炮|冲锋枪|手枪|融合步枪|线性融合步枪|霰弹枪|狙击步枪|狙击枪|榴弹发射器|火箭发射器|火箭筒|机枪|刀剑|剑|长柄武器|偃月|追踪步枪|auto rifle|combat bow|pulse rifle|scout rifle|hand cannon|submachine gun|sidearm|fusion rifle|shotgun|sniper rifle|grenade launcher|rocket launcher|machine gun|sword|glaive|trace rifle/i.test(item.itemType)) {
    return "weapon";
  }
  return null;
}
