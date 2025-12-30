import { GFL5R_CONFIG } from "../config.js";

export function resolveDropTarget(event) {
  const dropAbilities = event.target?.closest?.("[data-drop-target='abilities']");
  const dropNarrativePos = event.target?.closest?.("[data-drop-target='narrative-positive']");
  const dropNarrativeNeg = event.target?.closest?.("[data-drop-target='narrative-negative']");
  const dropInventory = event.target?.closest?.("[data-drop-target='inventory']");
  const dropModules = event.target?.closest?.("[data-drop-target='modules']");
  const dropCondition = event.target?.closest?.("[data-drop-target='condition']");
  const dropDiscipline = event.target?.closest?.("[data-drop-target='discipline']");
  const dropDisciplineAbility = event.target?.closest?.("[data-drop-target='discipline-ability']");

  const dropTarget =
    dropAbilities ||
    dropNarrativePos ||
    dropNarrativeNeg ||
    dropInventory ||
    dropModules ||
    dropCondition ||
    dropDiscipline ||
    dropDisciplineAbility;

  return {
    dropTarget,
    dropAbilities,
    dropNarrativePos,
    dropNarrativeNeg,
    dropInventory,
    dropModules,
    dropCondition,
    dropDiscipline,
    dropDisciplineAbility,
  };
}

export async function handleDisciplineDrop(actor, dropTarget, itemDoc, rawItemData) {
  const slotKey = dropTarget?.dataset?.slotKey;
  if (!slotKey) return;

  const itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
  itemData.type = "discipline";

  const disciplines = foundry.utils.duplicate(actor.system.disciplines ?? {});
  disciplines[slotKey] ??= { disciplineId: null, xp: 0, rank: 1, abilities: [] };

  const toDelete = [];
  if (disciplines[slotKey].disciplineId) {
    const oldDiscipline = actor.items.get(disciplines[slotKey].disciplineId);
    if (oldDiscipline) toDelete.push(disciplines[slotKey].disciplineId);
  }
  if (disciplines[slotKey].abilities?.length) {
    disciplines[slotKey].abilities.forEach((abilityId) => {
      if (actor.items.get(abilityId)) toDelete.push(abilityId);
    });
  }
  if (toDelete.length) {
    await actor.deleteEmbeddedDocuments("Item", toDelete);
  }

  const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
  if (!createdItem) return;

  disciplines[slotKey].disciplineId = createdItem.id;
  disciplines[slotKey].abilities = [];
  await actor.update({ "system.disciplines": disciplines });

  flashDropTarget(dropTarget);
}

export async function handleDisciplineAbilityDrop(actor, dropTarget, itemDoc, availableXP) {
  const slotKey = dropTarget?.dataset?.slotKey;
  if (!slotKey) return;

  const disciplines = foundry.utils.duplicate(actor.system.disciplines ?? {});
  if (!disciplines[slotKey]) return;

  const cost = 3;
  if (availableXP < cost) {
    dropTarget.classList.add("border", "border-danger", "bg-danger-subtle");
    setTimeout(() => dropTarget.classList.remove("border-danger", "bg-danger-subtle"), 500);
    ui.notifications?.warn("Not enough XP to add an ability to this discipline (costs 3 XP).");
    return;
  }

  const itemData = itemDoc.toObject?.() ?? {};
  itemData.type = "ability";

  const [createdItem] = await actor.createEmbeddedDocuments("Item", [itemData]);
  if (!createdItem) return;

  disciplines[slotKey].abilities ||= [];
  disciplines[slotKey].abilities.push(createdItem.id);

  const updatedXP = Number(disciplines[slotKey].xp ?? 0) + cost;
  disciplines[slotKey].xp = updatedXP;
  disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(updatedXP);

  await actor.update({
    "system.xp": availableXP - cost,
    "system.disciplines": disciplines,
  });

  flashDropTarget(dropTarget);
}

export function prepareGenericDropItem(itemDoc, rawItemData, dropCtx) {
  const itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
  itemData.system ??= {};

  if (dropCtx.dropAbilities) {
    itemData.type = "ability";
    itemData.system.description ??= itemDoc.system?.description ?? "";
  } else if (dropCtx.dropNarrativePos || dropCtx.dropNarrativeNeg) {
    itemData.type = "narrative";
    itemData.system.description ??= itemDoc.system?.description ?? "";
    if (dropCtx.dropNarrativePos && !itemData.system.narrativeType) {
      itemData.system.narrativeType = "distinction";
    } else if (dropCtx.dropNarrativeNeg && !itemData.system.narrativeType) {
      itemData.system.narrativeType = "adversity";
    }
  } else if (dropCtx.dropModules) {
    itemData.type = "module";
    itemData.system.description ??= itemDoc.system?.description ?? "";
  } else if (dropCtx.dropCondition) {
    itemData.type = "condition";
    itemData.system.description ??= itemDoc.system?.description ?? "";
    itemData.system.duration ??= itemDoc.system?.duration ?? "";
    itemData.system.tags ??= itemDoc.system?.tags ?? "";
  } else if (dropCtx.dropInventory) {
    itemData.system.description ??= itemDoc.system?.description ?? "";
  } else {
    return null;
  }

  return itemData;
}

export function flashDropTarget(el) {
  if (!el) return;
  el.classList.add("border", "border-success", "bg-success-subtle");
  setTimeout(() => el.classList.remove("border-success", "bg-success-subtle"), 400);
}

console.log("GFL5R | actor-sheet-drops.js loaded");
