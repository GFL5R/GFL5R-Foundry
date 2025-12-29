import { GFL5R_CONFIG } from "../config.js";
import { HUMAN_BACKGROUNDS, HUMAN_NATIONALITIES, TDOLL_FRAMES } from "../actor-data.js";

export function buildCollapse(approachesList, data) {
  const collapseCurrent = Number(data.resources?.collapse ?? 0);
  const totalApproaches = approachesList.reduce((sum, a) => sum + (Number(a.value ?? 0)), 0);
  const collapseCapacity = Math.max(0, totalApproaches * 5);
  const collapsePercent = collapseCapacity > 0 ? Math.min(1, Math.max(0, collapseCurrent / collapseCapacity)) : 0;
  const collapseHue = 120 - collapsePercent * 120;
  return {
    current: collapseCurrent,
    capacity: collapseCapacity,
    percent: collapsePercent,
    barWidth: `${(collapsePercent * 100).toFixed(1)}%`,
    barColor: `hsl(${collapseHue}, 70%, 45%)`,
  };
}

export function resolvePreparedState(preparedFlag) {
  const preparedDefaultSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
  if (typeof preparedFlag === "boolean") return preparedFlag;
  if (preparedFlag === "true") return true;
  if (preparedFlag === "false") return false;
  return preparedDefaultSetting === "true";
}

export function buildOriginDisplay(characterType, data) {
  if (characterType === "human" && (data.nationality || data.background)) {
    const nat = HUMAN_NATIONALITIES.find((n) => n.key === data.nationality);
    const bg = HUMAN_BACKGROUNDS.find((b) => b.key === data.background);
    const parts = [];
    if (nat) parts.push(nat.label);
    if (bg) parts.push(bg.label);
    return parts.join(" ƒ?› ");
  }
  if (characterType === "doll" && data.frame) {
    const frame = TDOLL_FRAMES.find((f) => f.key === data.frame);
    if (frame) {
      const manufacturerShort = frame.manufacturer.split("(")[0].trim();
      return `${manufacturerShort} ${frame.model}`;
    }
  }
  return "";
}

export function buildDisciplineSlots(actor, disciplinesData) {
  const slots = [];
  const disciplineAbilityIds = new Set();
  const disciplineIds = new Set();

  for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
    const slotKey = `slot${i}`;
    const slotData = disciplinesData[slotKey] ?? { disciplineId: null, xp: 0, rank: 1, abilities: [] };

    const disciplineItem = slotData.disciplineId ? actor.items.get(slotData.disciplineId) : null;

    const associatedSkills = Array.isArray(disciplineItem?.system?.associatedSkills)
      ? disciplineItem.system.associatedSkills
      : [];
    const associatedSkillLabels = associatedSkills
      .map((key) => GFL5R_CONFIG.getSkillLabel(key))
      .filter(Boolean);

    const disciplineAbilities = (slotData.abilities ?? [])
      .map((abilityId) => actor.items.get(abilityId))
      .filter(Boolean);

    const xpForNextRank = GFL5R_CONFIG.getXPForNextRank(slotData.rank ?? 1);
    const xpRemaining = xpForNextRank ? xpForNextRank - (slotData.xp ?? 0) : null;

    if (disciplineItem) disciplineIds.add(disciplineItem.id);
    disciplineAbilities.forEach((ability) => disciplineAbilityIds.add(ability.id));

    slots.push({
      slotKey,
      slotNumber: i,
      discipline: disciplineItem
        ? {
            id: disciplineItem.id,
            name: disciplineItem.name,
            img: disciplineItem.img,
            system: disciplineItem.system ?? {},
          }
        : null,
      xp: slotData.xp ?? 0,
      rank: slotData.rank ?? 1,
      xpForNext: xpForNextRank,
      xpRemaining: xpRemaining > 0 ? xpRemaining : null,
      abilities: disciplineAbilities.map((a) => ({
        id: a.id,
        name: a.name,
        img: a.img,
        system: a.system ?? {},
      })),
      associatedSkills,
      associatedSkillText: associatedSkillLabels.join(", "),
    });
  }

  return { slots, disciplineAbilityIds, disciplineIds };
}

export function buildItemCollections(actor, disciplineAbilityIds, disciplineIds) {
  const items = actor.items ?? [];
  const abilities = items
    .filter((i) => i.type === "ability" && !disciplineAbilityIds.has(i.id))
    .map((i) => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));

  const narrativeItems = items.filter((i) => i.type === "narrative");
  const narrativePositive = narrativeItems
    .filter((i) => i.system.narrativeType === "distinction" || i.system.narrativeType === "passion")
    .map((i) => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));
  const narrativeNegative = narrativeItems
    .filter((i) => i.system.narrativeType === "adversity" || i.system.narrativeType === "anxiety")
    .map((i) => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));

  const conditions = items.filter((i) => i.type === "condition").map((i) => ({
    id: i.id,
    name: i.name,
    img: i.img,
    system: i.system ?? {},
  }));
  const weapons = items.filter((i) => i.type === "weaponry").map((i) => ({
    id: i.id,
    name: i.name,
    img: i.img,
    system: i.system ?? {},
  }));
  const armor = items.filter((i) => i.type === "armor").map((i) => ({
    id: i.id,
    name: i.name,
    img: i.img,
    system: i.system ?? {},
  }));
  const modules = items.filter((i) => i.type === "module").map((i) => ({
    id: i.id,
    name: i.name,
    img: i.img,
    system: i.system ?? {},
  }));

  const inventory = items
    .filter(
      (i) =>
        i.type !== "discipline" &&
        i.type !== "narrative" &&
        i.type !== "module" &&
        i.type !== "condition" &&
        !disciplineIds.has(i.id) &&
        !disciplineAbilityIds.has(i.id)
    )
    .map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      img: i.img,
      system: i.system ?? {},
    }));

  return { abilities, narrativePositive, narrativeNegative, conditions, weapons, armor, modules, inventory };
}

console.log("GFL5R | actor-sheet-data.js loaded");
