// module/actors.js
console.log("GFL5R | actors.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { computeDerivedStats } from "./utils/derived.js";

const SHEET_DEBUG = true;
const sheetDebug = (...args) => {
  if (!SHEET_DEBUG) return;
  console.debug("GFL5R | Sheet", ...args);
};

const ActorSheet = foundry.appv1.sheets.ActorSheet;

const APPROACH_LABELS = {
  power: "Power",
  swiftness: "Swiftness",
  resilience: "Resilience",
  precision: "Precision",
  fortune: "Fortune"
};

const HUMAN_NATIONALITIES = [
  { key: "united-states", label: "United States", approaches: ["swiftness", "power"] },
  { key: "neo-soviet-union", label: "Neo-Soviet Union (NUSSR)", approaches: ["resilience", "power"] },
  { key: "china", label: "China", approaches: ["precision", "fortune"] },
  { key: "latin-america", label: "Latin America Alliance", approaches: ["precision", "power"] },
  { key: "japan", label: "Japan", approaches: ["resilience", "swiftness"] },
  { key: "pan-europe", label: "Pan-European Union", approaches: ["precision", "swiftness"] },
  { key: "yugoslavian-federation", label: "Yugoslavian Federation", approaches: ["fortune", "swiftness"] },
  { key: "north-african-union", label: "North African Union", approaches: ["precision", "resilience"] },
  { key: "australia", label: "Australia", approaches: ["fortune", "resilience"] },
  { key: "yellow-zone", label: "Yellow Zone Native", approaches: ["fortune", "power"] }
];

const HUMAN_BACKGROUNDS = [
  { key: "military", label: "Military", approach: "resilience", skill: "tactics" },
  { key: "pmc-commander", label: "PMC Commander", approach: "power", skill: "command" },
  { key: "corporate-drone", label: "Corporate Drone", approach: "precision", skill: "negotiation" },
  { key: "scavenger", label: "Scavenger", approach: "swiftness", skill: "survival" },
  { key: "technician", label: "Technician", approach: "precision", skill: "mechanics" },
  { key: "medic", label: "Medic", approach: "resilience", skill: "medicine" },
  { key: "criminal", label: "Criminal", approach: "fortune", skill: "stealth" },
  { key: "scholar", label: "Scholar", approach: "swiftness", skill: "computers" }
];

const FLAVOR_DEFAULTS = {
  human: {
    step1: {
      lead1: "In the year 2070 most surviving Green Zones sit under the URNC, but people still hold onto nationality. Where you were born and raised shapes how others see you, and how you see the world.",
      lead2: "Every Commander begins with all Approaches at 1; your nationality grants +1 to two approaches."
    },
    step2: {
      lead1: "Your background defines what you did before bounty hunting—military halls, corporate desks, scavenger runs, or mercenary contracts. It grants +1 to one approach and sets one starting skill."
    },
    step3: {
      lead1: "Sooner or later you chose what kind of Commander you are. Select one Discipline—it's unlocked for you and becomes your starting slot.",
      lead2: "Drop your starting Discipline below; it will occupy slot 1."
    },
    advantage: "Drop one Advantage (Distinction). It's the quality that elevates you above the rest.",
    disadvantage: "Drop one Disadvantage (Adversity). It's the faultline that threatens to crack under pressure.",
    passion: "Drop one Passion. This is the habit, interest, or fixation that marks you as yourself.",
    anxiety: "Drop one Anxiety. It's the shadow you dread most.",
    viewDolls: "Your attitude shapes the bond. Respect makes them partners; seeing them as tools changes how you fight.",
    goal: "Choose a personal goal that drives your Commander.",
    nameMeaning: "Inherited, gifted, earned, or chosen?",
    storyEnd: "No mechanical effect—capture the vision you hold."
  }
};

const resolveItemFromDropData = async (data) => {
  if (!data) return { item: null, uuid: null, itemData: null };

  const documentName = data.documentName ?? data.type;
  if (documentName && documentName !== "Item") return { item: null, uuid: null, itemData: null };

  const uuid = data.uuid ?? (data.pack && data.id ? `Compendium.${data.pack}.${data.id}` : null);
  if (uuid) {
    try {
      const doc = await fromUuid(uuid);
      if (doc?.documentName === "Item") {
        return { item: doc, uuid, itemData: doc.toObject?.() ?? null };
      }
    } catch (err) {
      console.warn("GFL5R | Unable to resolve drop UUID", err);
    }
  }

  const itemData = data.data ? foundry.utils.duplicate(data.data) : null;
  if (itemData) {
    itemData.type ??= data.type ?? itemData.type;
    const ItemCls = Item.implementation ?? Item;
    const item = new ItemCls(itemData, { temporary: true });
    return { item, uuid, itemData };
  }

  return { item: null, uuid, itemData: null };
};

const getDragEventDataSafe = (event) => {
  const evt = event?.originalEvent ?? event;
  const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  if (!(evt instanceof DragEvent)) {
    console.warn("GFL5R | Drop handler received non-DragEvent", evt);
    return {};
  }
  return TextEditorImpl.getDragEventData(evt);
};

const flattenSkillList = () => {
  return GFL5R_CONFIG.skillGroups.flatMap(group => group.items.map(item => ({
    key: item.key,
    label: item.label
  })));
};

class CharacterBuilderApp extends FormApplication {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.builderState = {
      step: 1,
      discipline: null,
      advantage: null,
      disadvantage: null,
      passion: null,
      anxiety: null,
      formValues: { human: {} }
    };
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gfl5r-character-builder",
      title: "Character Builder",
      template: `systems/${game.system.id}/templates/character-builder.html`,
      width: 900,
      height: "auto",
      classes: ["sheet", "gfl5r-builder", "actor"],
      submitOnChange: false
    });
  }

  async getData() {
    sheetDebug("CharacterBuilderApp#getData");
    const flavor = await CharacterBuilderApp.getFlavor();
    const skillOptions = flattenSkillList();
    const existingDisciplines = this.actor.items
      .filter(i => i.type === "discipline")
      .map(i => ({ id: i.id, name: i.name }));

    const steps = [
      { num: 1, label: "Nationality" },
      { num: 2, label: "Background" },
      { num: 3, label: "Discipline & Traits" },
      { num: 4, label: "Motivation" }
    ];

    const formValues = this.builderState.formValues ?? { human: {} };
    formValues.human ??= {};
    if (!formValues.human.viewDolls) formValues.human.viewDolls = "favor";

    return {
      actorName: this.actor.name,
      flavor,
      humanNationalities: HUMAN_NATIONALITIES.map(n => ({
        ...n,
        approachesText: n.approaches.map(a => APPROACH_LABELS[a] ?? a).join(" & ")
      })),
      humanBackgrounds: HUMAN_BACKGROUNDS.map(bg => ({
        ...bg,
        approachLabel: APPROACH_LABELS[bg.approach] ?? bg.approach,
        skillLabel: GFL5R_CONFIG.getSkillLabel(bg.skill)
      })),
      skillOptions,
      existingDisciplines,
      step: this.builderState.step,
      steps,
      selections: this.builderState,
      formValues
    };
  }

  static async getFlavor() {
    if (this.flavorCache) return this.flavorCache;
    const defaults = FLAVOR_DEFAULTS;
    try {
      const url = `systems/${game.system.id}/data/character-builder-flavor.json`;
      const external = await foundry.utils.fetchJsonWithTimeout(url, { cache: "no-cache" });
      this.flavorCache = foundry.utils.mergeObject(foundry.utils.duplicate(defaults), external, { inplace: false });
    } catch (err) {
      console.warn("GFL5R | Unable to load flavor JSON, using defaults", err);
      this.flavorCache = defaults;
    }
    return this.flavorCache;
  }

  activateListeners(html) {
    super.activateListeners(html);
    sheetDebug("CharacterBuilderApp#activateListeners");

    html.on("click", "[data-action='builder-next']", ev => {
      ev.preventDefault();
      this._captureForm(html[0]);
      this._changeStep(1);
    });

    html.on("click", "[data-action='builder-prev']", ev => {
      ev.preventDefault();
      this._captureForm(html[0]);
      this._changeStep(-1);
    });

    html.on("click", "[data-action='clear-drop']", ev => {
      ev.preventDefault();
      const key = ev.currentTarget.dataset.dropKey;
      if (!key) return;
      if (this.builderState[key]) {
        this.builderState[key] = null;
        this.render(false);
      }
    });

    html.on("dragover", "[data-drop-target]", ev => {
      ev.preventDefault();
    });

    html.on("drop", "[data-drop-target]", async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      await this._onDrop(ev);
    });
  }

  _captureForm(formEl) {
    sheetDebug("CharacterBuilderApp#_captureForm");
    if (!formEl) return;
    const fd = new FormData(formEl);
    const human = {};
    for (const [key, value] of fd.entries()) {
      if (key.startsWith("human.")) {
        human[key.slice(6)] = value;
      }
    }
    this.builderState.formValues = { human };
  }

  async _onDrop(event) {
    sheetDebug("CharacterBuilderApp#_onDrop", { dropTarget: event.target?.dataset?.dropTarget });
    event.preventDefault();
    const dropTarget = event.target.closest?.("[data-drop-target]");
    if (!dropTarget) return false;

    const kind = dropTarget.dataset.dropTarget;
    const data = getDragEventDataSafe(event);

    const { item: itemDoc, uuid: sourceUuid, itemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or a compendium.");
      return false;
    }

    const dropData = itemData ?? itemDoc.toObject?.() ?? null;

    if (kind === "discipline") {
      if (itemDoc.type !== "discipline") {
        ui.notifications?.warn("Drop a Discipline item here.");
        return false;
      }
      this.builderState.discipline = {
        name: itemDoc.name,
        uuid: sourceUuid ?? itemDoc.uuid ?? null,
        type: "discipline",
        data: dropData
      };
      this.render(false);
      return false;
    }

    const narrativeKeyMap = {
      advantage: "distinction",
      disadvantage: "adversity",
      passion: "passion",
      anxiety: "anxiety"
    };

    const narrativeType = narrativeKeyMap[kind];
    if (narrativeType) {
      if (itemDoc.type !== "narrative") {
        ui.notifications?.warn("Drop a Narrative item here.");
        return false;
      }
      this.builderState[kind] = {
        name: itemDoc.name,
        uuid: sourceUuid ?? itemDoc.uuid ?? null,
        type: "narrative",
        narrativeType,
        data: dropData
      };
      this.render(false);
      return false;
    }

    return false;
  }

  _changeStep(delta) {
    const total = 4;
    const next = Math.min(total, Math.max(1, this.builderState.step + delta));
    if (next !== this.builderState.step) {
      this.builderState.step = next;
      this.render(false);
    }
  }

  async _updateObject(event, formData) {
    sheetDebug("CharacterBuilderApp#_updateObject", { formData });
    const buildType = formData["buildType"] ?? formData.buildType ?? "human";
    if (buildType !== "human") {
      ui.notifications?.info("T-Doll builder is coming soon.");
      return;
    }

    // Foundry expands dot-notation field names into nested objects; fall back to stored wizard state.
    const formHuman = formData.human ?? {};
    const storedHuman = this.builderState?.formValues?.human ?? {};
    const getHuman = (key) => formHuman[key] ?? formData[`human.${key}`] ?? storedHuman[key];

    const nationalityKey = getHuman("nationality");
    const backgroundKey = getHuman("background");
    const viewDolls = getHuman("viewDolls") || "favor";
    const viewDollsSkill = (getHuman("viewDollsSkill") || "").trim();
    const goal = (getHuman("goal") || "").trim();
    const nameMeaning = (getHuman("nameMeaning") || "").trim();
    const newName = (getHuman("name") || "").trim();
    const storyEnd = (getHuman("storyEnd") || "").trim();
    const additionalNotes = (getHuman("additionalNotes") || "").trim();

    const nationality = HUMAN_NATIONALITIES.find(n => n.key === nationalityKey);
    const background = HUMAN_BACKGROUNDS.find(b => b.key === backgroundKey);

    if (!nationality) {
      ui.notifications?.warn("Pick a nationality to continue.");
      return;
    }
    if (!background) {
      ui.notifications?.warn("Pick a background to continue.");
      return;
    }
    if (!this.builderState.discipline) {
      ui.notifications?.warn("Drop a starting Discipline before applying.");
      this.builderState.step = 3;
      this.render(false);
      return;
    }

    const approaches = {
      power: 1,
      swiftness: 1,
      resilience: 1,
      precision: 1,
      fortune: 1
    };

    const bumpApproach = (key) => {
      if (!key) return;
      approaches[key] = Number(approaches[key] ?? 0) + 1;
    };

    nationality.approaches.forEach(bumpApproach);
    bumpApproach(background.approach);

    const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
    const ensureSkillAtLeast = (key, min) => {
      if (!key) return;
      const current = Number(skills[key] ?? 0);
      if (current < min) skills[key] = min;
    };

    ensureSkillAtLeast(background.skill, 1);
    if (viewDolls === "tools" && viewDollsSkill) {
      ensureSkillAtLeast(viewDollsSkill, 1);
    }

    const addSkillRanks = (key, delta = 1) => {
      if (!key || !delta) return;
      const current = Number(skills[key] ?? 0);
      skills[key] = current + delta;
    };

    const { label: disciplineLabel, associatedSkills } = await this._applyDisciplineFromBuilder();
    const uniqueAssociatedSkills = [...new Set(Array.isArray(associatedSkills) ? associatedSkills : [])];
    uniqueAssociatedSkills.forEach(skillKey => addSkillRanks(skillKey, 1));

    const updates = {};
    for (const [k, v] of Object.entries(approaches)) {
      updates[`system.approaches.${k}`] = v;
    }
    updates["system.skills"] = skills;
    updates["system.characterType"] = "human";

    const currentHumanity = Number(this.actor.system?.humanity ?? 0);
    updates["system.humanity"] = viewDolls === "favor" ? currentHumanity + 5 : currentHumanity;

    if (newName) updates["name"] = newName;

    const notesPieces = [];
    notesPieces.push(`Nationality: ${nationality.label}`);
    notesPieces.push(`Background: ${background.label}`);

    if (disciplineLabel) notesPieces.push(`Discipline: ${disciplineLabel}`);

    const advantageName = await this._ensureNarrativeFromBuilder("advantage", formData["human.advantageText"], "distinction");
    const disadvantageName = await this._ensureNarrativeFromBuilder("disadvantage", formData["human.disadvantageText"], "adversity");
    const passionName = await this._ensureNarrativeFromBuilder("passion", formData["human.passionText"], "passion");
    const anxietyName = await this._ensureNarrativeFromBuilder("anxiety", formData["human.anxietyText"], "anxiety");

    if (advantageName) notesPieces.push(`Advantage: ${advantageName}`);
    if (disadvantageName) notesPieces.push(`Disadvantage: ${disadvantageName}`);
    if (passionName) notesPieces.push(`Passion: ${passionName}`);
    if (anxietyName) notesPieces.push(`Anxiety: ${anxietyName}`);

    if (viewDolls === "favor") {
      notesPieces.push("Views Dolls as partners (+5 Humanity)");
    } else if (viewDollsSkill) {
      notesPieces.push(`Views Dolls as tools (Skill: ${GFL5R_CONFIG.getSkillLabel(viewDollsSkill)} to 1)`);
    }
    if (goal) notesPieces.push(`Goal: ${goal}`);
    if (nameMeaning) notesPieces.push(`Name meaning: ${nameMeaning}`);
    if (storyEnd) notesPieces.push(`Story end: ${storyEnd}`);
    if (additionalNotes) notesPieces.push(additionalNotes);

    const existingNotes = this.actor.system?.notes ?? "";
    const notesBlock = `Character Builder (Human)\n${notesPieces.join("\n")}`;
    updates["system.notes"] = existingNotes ? `${existingNotes}\n\n${notesBlock}` : notesBlock;

    await this.actor.update(updates);

    ui.notifications?.info("Character builder applied to this actor.");
  }

  async _applyDisciplineFromBuilder() {
    const drop = this.builderState.discipline;
    if (!drop) return { label: "", associatedSkills: [] };

    let source = null;
    if (drop.uuid) {
      try {
        source = await fromUuid(drop.uuid);
      } catch (err) {
        console.error(err);
      }
    }

    if (!source && drop.data) {
      const ItemCls = Item.implementation ?? Item;
      source = new ItemCls(foundry.utils.duplicate(drop.data), { temporary: true });
    }

    const associatedSkills = Array.isArray(source?.system?.associatedSkills)
      ? [...source.system.associatedSkills]
      : Array.isArray(drop.data?.system?.associatedSkills)
        ? [...drop.data.system.associatedSkills]
        : [];

    if (!source) return { label: drop.name || "", associatedSkills };

    let targetId = null;
    let createdName = drop.name;

    if (source.parent === this.actor) {
      targetId = source.id;
      createdName = source.name;
    } else {
      const itemData = source.toObject();
      itemData.type = "discipline";
      const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      targetId = created?.id ?? null;
      createdName = created?.name ?? drop.name;
    }

    if (!targetId) return { label: createdName || "", associatedSkills };

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    const slotKey = "slot1";
    const slot = disciplines[slotKey] ?? { disciplineId: null, xp: 0, rank: 1, abilities: [] };

    if (slot.disciplineId && slot.disciplineId !== targetId) {
      const toDelete = [slot.disciplineId, ...(slot.abilities ?? [])].filter(id => this.actor.items.get(id));
      if (toDelete.length) await this.actor.deleteEmbeddedDocuments("Item", toDelete);
    }

    disciplines[slotKey] = {
      disciplineId: targetId,
      xp: 0,
      rank: 1,
      abilities: []
    };

    await this.actor.update({ "system.disciplines": disciplines });
    return { label: createdName, associatedSkills };
  }

  async _ensureNarrativeFromBuilder(key, fallbackName, narrativeType) {
    const drop = this.builderState[key];
    const name = (drop?.name || fallbackName || "").trim();
    if (!name) return "";

    const existing = this.actor.items.find(i => i.type === "narrative" && i.name === name && i.system?.narrativeType === narrativeType);
    if (existing) return existing.name;

    let itemData = null;
    if (drop?.uuid) {
      try {
        const src = await fromUuid(drop.uuid);
        if (src) {
          itemData = src.toObject();
          itemData.type = "narrative";
          itemData.system ||= {};
          itemData.system.narrativeType = narrativeType;
        }
      } catch (err) {
        console.error(err);
      }
    }

    if (!itemData && drop?.data) {
      itemData = foundry.utils.duplicate(drop.data);
      itemData.type = "narrative";
      itemData.system ||= {};
      itemData.system.narrativeType = narrativeType;
    }

    if (!itemData) {
      itemData = {
        name,
        type: "narrative",
        system: {
          narrativeType,
          description: ""
        }
      };
    }

    const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    return created?.name || name;
  }
}

export class GFL5RActorSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "actor"],
      width: 860,
      height: 700,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  get template() {
    return `systems/${game.system.id}/templates/actor-sheet.html`;
  }

  async getData(options) {
    sheetDebug("ActorSheet#getData", { actor: this.actor?.id, name: this.actor?.name });
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);
    context.availableXP = Number(data.xp ?? 0);

    // Approaches for card rendering
    const approachesData = data.approaches ?? {};
    context.approachesList = [
      { key: "power", label: "Power", value: Number(approachesData.power ?? 0) },
      { key: "swiftness", label: "Swiftness", value: Number(approachesData.swiftness ?? 0) },
      { key: "resilience", label: "Resilience", value: Number(approachesData.resilience ?? 0) },
      { key: "precision", label: "Precision", value: Number(approachesData.precision ?? 0) },
      { key: "fortune", label: "Fortune", value: Number(approachesData.fortune ?? 0) }
    ];

    const collapseCurrent = Number(data.resources?.collapse ?? 0);
    const collapseCapacity = Math.max(0, context.approachesList.reduce((sum, a) => sum + (Number(a.value ?? 0)), 0) * 5);
    const collapsePercent = collapseCapacity > 0 ? Math.min(1, Math.max(0, collapseCurrent / collapseCapacity)) : 0;
    const collapseHue = 120 - (collapsePercent * 120);
    context.collapse = {
      current: collapseCurrent,
      capacity: collapseCapacity,
      percent: collapsePercent,
      barWidth: `${(collapsePercent * 100).toFixed(1)}%`,
      barColor: `hsl(${collapseHue}, 70%, 45%)`
    };

    const preparedDefaultSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
    const preparedFlag = data.prepared;
    context.preparedState = typeof preparedFlag === "boolean"
      ? preparedFlag
      : (preparedFlag === "true" ? true : (preparedFlag === "false" ? false : preparedDefaultSetting === "true"));

    // Character type for modules visibility
    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");

    // Expose skills and labels for rendering
    context.skills = data.skills ?? {};
    context.skillGroups = GFL5R_CONFIG.skillGroups;

    // Process disciplines
    const disciplinesData = data.disciplines ?? {};
    context.disciplineSlots = [];
    
    for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
      const slotKey = `slot${i}`;
      const slotData = disciplinesData[slotKey] ?? {
        disciplineId: null,
        xp: 0,
        rank: 1,
        abilities: []
      };
      
      let disciplineItem = null;
      if (slotData.disciplineId) {
        disciplineItem = this.actor.items.get(slotData.disciplineId);
      }

      const associatedSkills = Array.isArray(disciplineItem?.system?.associatedSkills)
        ? disciplineItem.system.associatedSkills
        : [];
      const associatedSkillLabels = associatedSkills
        .map(key => GFL5R_CONFIG.getSkillLabel(key))
        .filter(label => label);
      
      // Get abilities for this discipline
      const disciplineAbilities = (slotData.abilities ?? [])
        .map(abilityId => this.actor.items.get(abilityId))
        .filter(a => a); // Remove null entries
      
      // Calculate XP remaining for next rank
      const xpForNextRank = GFL5R_CONFIG.getXPForNextRank(slotData.rank ?? 1);
      const xpRemaining = xpForNextRank ? (xpForNextRank - (slotData.xp ?? 0)) : null;
      
      context.disciplineSlots.push({
        slotKey,
        slotNumber: i,
        discipline: disciplineItem ? {
          id: disciplineItem.id,
          name: disciplineItem.name,
          img: disciplineItem.img,
          system: disciplineItem.system ?? {}
        } : null,
        xp: slotData.xp ?? 0,
        rank: slotData.rank ?? 1,
        xpForNext: xpForNextRank,
        xpRemaining: xpRemaining > 0 ? xpRemaining : null,
        abilities: disciplineAbilities.map(a => ({
          id: a.id,
          name: a.name,
          img: a.img,
          system: a.system ?? {}
        })),
        associatedSkills,
        associatedSkillText: associatedSkillLabels.join(", ")
      });
    }

    // Filter items by type
    // Get all discipline ability IDs to exclude from general abilities
    const disciplineAbilityIds = new Set();
    context.disciplineSlots.forEach(slot => {
      if (slot.abilities) {
        slot.abilities.forEach(ability => disciplineAbilityIds.add(ability.id));
      }
    });
    
    // Only show abilities that are NOT assigned to any discipline
    context.abilities = this.actor.items
      .filter(i => i.type === "ability" && !disciplineAbilityIds.has(i.id))
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));

    // Narrative items - split by type
    const narrativeItems = this.actor.items.filter(i => i.type === "narrative");
    context.narrativePositive = narrativeItems
      .filter(i => i.system.narrativeType === "distinction" || i.system.narrativeType === "passion")
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));
    context.narrativeNegative = narrativeItems
      .filter(i => i.system.narrativeType === "adversity" || i.system.narrativeType === "anxiety")
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));

    context.conditions = this.actor.items.filter(i => i.type === "condition").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

    // Combat tab - weapons and armor
    context.weapons = this.actor.items.filter(i => i.type === "weaponry").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));
    context.armor = this.actor.items.filter(i => i.type === "armor").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

    // Modules tab
    context.modules = this.actor.items.filter(i => i.type === "module").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

    // Inventory - exclude disciplines, their abilities, and narrative items
    const disciplineIds = new Set(
      context.disciplineSlots
        .filter(slot => slot.discipline)
        .map(slot => slot.discipline.id)
    );
    
    context.inventory = this.actor.items
      .filter(i => 
        i.type !== "discipline" && 
        i.type !== "narrative" &&
        i.type !== "module" &&
        i.type !== "condition" &&
        !disciplineIds.has(i.id) && 
        !disciplineAbilityIds.has(i.id)
      )
      .map(i => ({
        id: i.id,
        name: i.name,
        type: i.type,
        img: i.img,
        system: i.system ?? {}
      }));

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    sheetDebug("ActorSheet#activateListeners", { actor: this.actor?.id });

    html.on("click", "[data-action='open-character-builder']", () => {
      new CharacterBuilderApp(this.actor).render(true);
    });

    // Delete item (works for abilities and any other items)
    html.on("click", "[data-action='delete-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Edit item
    html.on("click", "[data-action='edit-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });

    const flashSkillCard = (element, danger = false) => {
      if (!element) return;
      element.classList.add(danger ? "xp-flash-danger" : "xp-flash");
      setTimeout(() => element.classList.remove("xp-flash", "xp-flash-danger"), 450);
    };

    const rollSkill = async (key, skillLabel) => {
      const approaches = this.actor.system?.approaches ?? {};

      const content = await renderTemplate(`systems/${game.system.id}/templates/roll-prompt.html`, {
        approaches,
        defaultTN: 2
      });

      new Dialog({
        title: `Roll ${skillLabel}`,
        content,
        buttons: {
          roll: {
            label: "Roll",
            callback: async (dlg) => {
              const form = dlg[0].querySelector("form");
              const approachName = form.elements["approach"].value;
              const tnHidden = form.elements["hiddenTN"].checked;
              const tnVal = Number(form.elements["tn"].value || 0);
              const approachVal = Number(approaches[approachName] ?? 0);

              const { GFLRollerApp } = await import("./dice.js");
              const app = new GFLRollerApp({
                actor: this.actor,
                skillKey: key,
                skillLabel,
                approach: approachVal,
                approachName,
                tn: tnHidden ? null : tnVal,
                hiddenTN: tnHidden
              });
              await app.start();
            }
          },
          cancel: { label: "Cancel" }
        },
        default: "roll"
      }, {
        classes: ["sheet"]
      }).render(true);
    };

    // Increase skill rank using XP
    html.on("click", "[data-action='skill-increase']", async ev => {
      const key = ev.currentTarget?.dataset?.skill;
      if (!key) return;

      const skillCard = ev.currentTarget.closest?.("[data-skill-card]");
      const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
      const currentRank = Number(skills[key] ?? 0);
      const nextRank = currentRank + 1;
      const cost = 2 * nextRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);

      if (availableXP < cost) {
        flashSkillCard(skillCard, true);
        ui.notifications?.warn("Not enough XP to increase this skill.");
        return;
      }

      skills[key] = nextRank;
      const updatedDisciplines = this._applyDisciplineSkillXP(key, cost);
      const updateData = {
        [`system.skills.${key}`]: nextRank,
        "system.xp": availableXP - cost
      };

      if (updatedDisciplines) {
        updateData["system.disciplines"] = updatedDisciplines;
      }

      await this.actor.update(updateData);
      flashSkillCard(skillCard);
    });

    // Decrease skill rank and refund XP
    html.on("click", "[data-action='skill-decrease']", async ev => {
      const key = ev.currentTarget?.dataset?.skill;
      if (!key) return;

      const skillCard = ev.currentTarget.closest?.("[data-skill-card]");
      const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
      const currentRank = Number(skills[key] ?? 0);
      if (currentRank <= 0) return;

      const refund = 2 * currentRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);
      const newRank = currentRank - 1;

      skills[key] = newRank;
      const updatedDisciplines = this._applyDisciplineSkillXP(key, -refund);
      const updateData = {
        [`system.skills.${key}`]: newRank,
        "system.xp": availableXP + refund
      };

      if (updatedDisciplines) {
        updateData["system.disciplines"] = updatedDisciplines;
      }

      await this.actor.update(updateData);
      flashSkillCard(skillCard);
    });

    // Increase approach rank using XP (cost 3x next rank)
    html.on("click", "[data-action='approach-increase']", async ev => {
      const key = ev.currentTarget?.dataset?.approach;
      if (!key) return;

      const card = ev.currentTarget.closest?.("[data-approach-card]");
      const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
      const currentRank = Number(approaches[key] ?? 0);
      const nextRank = currentRank + 1;
      const cost = 3 * nextRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);

      if (availableXP < cost) {
        flashSkillCard(card, true);
        ui.notifications?.warn("Not enough XP to increase this approach.");
        return;
      }

      approaches[key] = nextRank;
      await this.actor.update({
        [`system.approaches.${key}`]: nextRank,
        "system.xp": availableXP - cost
      });
      flashSkillCard(card);
    });

    // Decrease approach rank and refund XP (refund 3x current rank)
    html.on("click", "[data-action='approach-decrease']", async ev => {
      const key = ev.currentTarget?.dataset?.approach;
      if (!key) return;

      const card = ev.currentTarget.closest?.("[data-approach-card]");
      const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
      const currentRank = Number(approaches[key] ?? 0);
      if (currentRank <= 0) return;

      const refund = 3 * currentRank;
      const availableXP = Number(this.actor.system?.xp ?? 0);
      const newRank = currentRank - 1;

      approaches[key] = newRank;
      await this.actor.update({
        [`system.approaches.${key}`]: newRank,
        "system.xp": availableXP + refund
      });
      flashSkillCard(card);
    });

    // Remove discipline from slot
    html.on("click", "[data-action='remove-discipline']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        const toDelete = [];
        const disciplineId = disciplines[slotKey].disciplineId;
        
        // Check if discipline exists before adding to delete list
        if (disciplineId && this.actor.items.get(disciplineId)) {
          toDelete.push(disciplineId);
        }
        
        // Check if abilities exist before adding to delete list
        if (disciplines[slotKey].abilities?.length) {
          for (const abilityId of disciplines[slotKey].abilities) {
            if (this.actor.items.get(abilityId)) {
              toDelete.push(abilityId);
            }
          }
        }
        
        // Delete all items that exist
        if (toDelete.length > 0) {
          await this.actor.deleteEmbeddedDocuments("Item", toDelete);
        }
        
        // Reset slot
        disciplines[slotKey] = {
          disciplineId: null,
          xp: 0,
          rank: 1,
          abilities: []
        };
        
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Update discipline XP
    html.on("change", "[data-action='discipline-xp']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const xp = Number(ev.currentTarget.value) || 0;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        disciplines[slotKey].xp = xp;
        disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(xp);
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Update discipline rank
    html.on("change", "[data-action='discipline-rank']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const rank = Number(ev.currentTarget.value) || 1;
      if (!slotKey) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]) {
        disciplines[slotKey].rank = rank;
        await this.actor.update({ "system.disciplines": disciplines });
      }
    });

    // Remove ability from discipline
    html.on("click", "[data-action='remove-discipline-ability']", async ev => {
      const slotKey = ev.currentTarget?.dataset?.slotKey;
      const abilityId = ev.currentTarget?.dataset?.abilityId;
      if (!slotKey || !abilityId) return;
      
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (disciplines[slotKey]?.abilities) {
        // Remove from abilities list
        disciplines[slotKey].abilities = disciplines[slotKey].abilities.filter(id => id !== abilityId);
        await this.actor.update({ "system.disciplines": disciplines });
        
        // Delete the ability if it exists
        if (this.actor.items.get(abilityId)) {
          await this.actor.deleteEmbeddedDocuments("Item", [abilityId]);
        }
      }
    });

    // Click skill NAME (label) to roll
    html.on("click", "[data-action='roll-skill']", async ev => {
      const labelEl = ev.currentTarget;
      const key = labelEl.dataset.skill;            // e.g. "blades"
      const skillLabel = labelEl.textContent.trim();
      await rollSkill(key, skillLabel);
    });

    // Click anywhere on the skill card to roll (unless clicking buttons)
    html.on("click", "[data-skill-card]", async ev => {
      if (ev.target.closest("button")) return;
      const card = ev.currentTarget;
      const key = card.dataset.skillKey;
      const label = card.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
      if (!key) return;
      await rollSkill(key, label);
    });

    // Click on discipline ability to roll associated skill
    html.on("click", "[data-item-id]", async ev => {
      if (ev.target.closest("button")) return;
      const container = ev.currentTarget.closest("[data-item-id]");
      if (!container) return;
      const itemId = container.dataset.itemId;
      if (!itemId) return;
      
      const item = this.actor.items.get(itemId);
      if (!item) return;
      
      // Check if this item is an ability or weapon with a skill
      if ((item.type === "ability" || item.type === "weaponry") && item.system.skill) {
        const skillKey = item.system.skill;
        const skillLabel = item.name;
        await rollSkill(skillKey, skillLabel);
      }
    });

  }

  _applyDisciplineSkillXP(skillKey, deltaXP) {
    if (!deltaXP) return null;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    let changed = false;

    for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
      const slotKey = `slot${i}`;
      const slot = disciplines[slotKey];
      if (!slot?.disciplineId) continue;

      const disciplineItem = this.actor.items.get(slot.disciplineId);
      const associated = Array.isArray(disciplineItem?.system?.associatedSkills)
        ? disciplineItem.system.associatedSkills
        : [];

      if (!associated.includes(skillKey)) continue;

      const nextXP = Math.max(0, Number(slot.xp ?? 0) + deltaXP);
      slot.xp = nextXP;
      slot.rank = GFL5R_CONFIG.getRankFromXP(nextXP);
      changed = true;
    }

    return changed ? disciplines : null;
  }

  /** Accept dropped Items (from compendia or sidebar) into the drop zones */
  async _onDrop(event) {
    sheetDebug("ActorSheet#_onDrop", { target: event.target?.dataset?.dropTarget });
    const data = getDragEventDataSafe(event);
    const flashDropTarget = (el) => {
      if (!el) return;
      el.classList.add("border", "border-success", "bg-success-subtle");
      setTimeout(() => el.classList.remove("border-success", "bg-success-subtle"), 400);
    };

    // Check which drop zone was targeted
    const dropAbilities = event.target?.closest?.("[data-drop-target='abilities']");
    const dropNarrativePos = event.target?.closest?.("[data-drop-target='narrative-positive']");
    const dropNarrativeNeg = event.target?.closest?.("[data-drop-target='narrative-negative']");
    const dropInventory = event.target?.closest?.("[data-drop-target='inventory']");
    const dropModules = event.target?.closest?.("[data-drop-target='modules']");
    const dropCondition = event.target?.closest?.("[data-drop-target='condition']");
    
    // Check for discipline slot drops
    const dropDiscipline = event.target?.closest?.("[data-drop-target='discipline']");
    const dropDisciplineAbility = event.target?.closest?.("[data-drop-target='discipline-ability']");
    
    const dropTarget = dropAbilities || dropNarrativePos || dropNarrativeNeg || dropInventory || dropModules || dropCondition || dropDiscipline || dropDisciplineAbility;
    if (!dropTarget) return super._onDrop(event);

    const { item: itemDoc, itemData: rawItemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or compendium.");
      return;
    }

    // Handle discipline slot drops
    if (dropDiscipline) {
      const slotKey = dropTarget.dataset.slotKey;
      if (!slotKey) return;
      
      // Clone the item data
      let itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
      itemData.type = "discipline";
      
      // Update disciplines data
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (!disciplines[slotKey]) {
        disciplines[slotKey] = { disciplineId: null, xp: 0, rank: 1, abilities: [] };
      }
      
      // Remove old discipline if exists
      if (disciplines[slotKey].disciplineId) {
        const oldDiscipline = this.actor.items.get(disciplines[slotKey].disciplineId);
        const toDelete = [];
        
        // Add discipline to delete list if it exists
        if (oldDiscipline) {
          toDelete.push(disciplines[slotKey].disciplineId);
        }
        
        // Add abilities to delete list if they exist
        if (disciplines[slotKey].abilities?.length) {
          for (const abilityId of disciplines[slotKey].abilities) {
            if (this.actor.items.get(abilityId)) {
              toDelete.push(abilityId);
            }
          }
        }
        
        // Delete all items that exist
        if (toDelete.length > 0) {
          await this.actor.deleteEmbeddedDocuments("Item", toDelete);
        }
      }
      
      // Create the discipline item
      const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      
      disciplines[slotKey].disciplineId = createdItem.id;
      disciplines[slotKey].abilities = []; // Reset abilities list
      await this.actor.update({ "system.disciplines": disciplines });
      
      flashDropTarget(dropTarget);
      return;
    }

    // Handle discipline ability drops
    if (dropDisciplineAbility) {
      const slotKey = dropTarget.dataset.slotKey;
      if (!slotKey) return;

      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
      if (!disciplines[slotKey]) return;

      const availableXP = Number(this.actor.system?.xp ?? 0);
      const cost = 3;
      if (availableXP < cost) {
        dropTarget.classList.add("border", "border-danger", "bg-danger-subtle");
        setTimeout(() => dropTarget.classList.remove("border-danger", "bg-danger-subtle"), 500);
        ui.notifications?.warn("Not enough XP to add an ability to this discipline (costs 3 XP).");
        return;
      }

      // Clone the item data
      let itemData = itemDoc.toObject();
      itemData.type = "ability";

      // Create the ability item
      const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
      if (!createdItem) return;

      // Update disciplines data and actor XP
      disciplines[slotKey].abilities ||= [];
      disciplines[slotKey].abilities.push(createdItem.id);

      const updatedXP = Number(disciplines[slotKey].xp ?? 0) + cost;
      disciplines[slotKey].xp = updatedXP;
      disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(updatedXP);

      await this.actor.update({
        "system.xp": availableXP - cost,
        "system.disciplines": disciplines
      });

      flashDropTarget(dropTarget);
      return;
    }

    // Clone the item data
    let itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
    if (!itemData.system) itemData.system = {};

    // Handle different drop zones
    if (dropAbilities) {
      // Force type to ability
      itemData.type = "ability";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (dropNarrativePos || dropNarrativeNeg) {
      // Force type to narrative
      itemData.type = "narrative";
      itemData.system.description ??= itemDoc.system?.description ?? "";
      // Set narrative type based on drop zone
      if (dropNarrativePos && !itemData.system.narrativeType) {
        itemData.system.narrativeType = "distinction";
      } else if (dropNarrativeNeg && !itemData.system.narrativeType) {
        itemData.system.narrativeType = "adversity";
      }
    } else if (dropModules) {
      // Force type to module
      itemData.type = "module";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (dropCondition) {
      // Force type to condition
      itemData.type = "condition";
      itemData.system.description ??= itemDoc.system?.description ?? "";
      itemData.system.duration ??= itemDoc.system?.duration ?? "";
      itemData.system.tags ??= itemDoc.system?.tags ?? "";
    } else if (dropInventory) {
      // Keep original type for inventory (accepts all types)
      itemData.system.description ??= itemDoc.system?.description ?? "";
    }

    // Create on actor
    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Subtle UI feedback
    flashDropTarget(dropTarget);
  }
}

export class GFL5RNPCSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "actor", "npc"],
      width: 700,
      height: 600,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "features" }]
    });
  }

  get template() {
    return `systems/${game.system.id}/templates/npc-sheet.html`;
  }

  async getData(options) {
    console.log("GFL5R | NPC getData()");
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);

    // Expose simplified skills
    context.skills = data.skills ?? {};

    // Features - all items (abilities, weapons, armor, narrative items, etc.)
    context.features = this.actor.items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      img: i.img,
      system: i.system ?? {}
    }));

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log("GFL5R | NPC activateListeners()");

    // Delete item
    html.on("click", "[data-action='delete-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    });

    // Edit item
    html.on("click", "[data-action='edit-item']", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      const item = this.actor.items.get(id);
      if (item) item.sheet.render(true);
    });
  }

  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    // Get the item
    let itemData = await Item.fromDropData(data);
    if (!itemData) return false;

    // Create on actor
    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Subtle UI feedback
    event.currentTarget.classList.add("border", "border-success", "bg-success-subtle");
    setTimeout(() => event.currentTarget.classList.remove("border-success", "bg-success-subtle"), 400);
  }
}

export function registerActorSheets() {
  const Actors = foundry.documents.collections.Actors;
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, {
    makeDefault: true,
    types: ["character"]
  });
  Actors.registerSheet("gfl5r", GFL5RNPCSheet, {
    types: ["npc"]
  });
}
