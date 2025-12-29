// module/actors.js
console.log("GFL5R | actors.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { computeDerivedStats } from "./utils/derived.js";
import { GFL5RPickerDialog } from "./dialogs/dice-picker-dialog.js";

const SHEET_DEBUG = false;
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

const TDOLL_FRAMES = [
  { 
    key: "iop-ssd62", 
    manufacturer: "IOP (Kyiv, Ukraine)", 
    model: "SSD-62",
    description: "Designed as general-purpose companions, equally comfortable in a civilian home or a security detail.",
    approaches: { power: 2, swiftness: 2, resilience: 2, precision: 2, fortune: 2 },
    skills: ["firearms", "negotiation"]
  },
  { 
    key: "iop-sst05", 
    manufacturer: "IOP (Kyiv, Ukraine)", 
    model: "SST-05",
    description: "Agile frontline combat Dolls, optimized for firearms and battlefield adaptability.",
    approaches: { power: 3, swiftness: 3, resilience: 2, precision: 2, fortune: 1 },
    skills: ["firearms", "tactics"]
  },
  { 
    key: "svarog-crar", 
    manufacturer: "Svarog Heavy Industries (Moscow, Russia)", 
    model: "CRAR",
    description: "A heavy industrial frame retrofitted for combat. Strong, armored, and reliable, but sluggish compared to other Dolls.",
    approaches: { power: 3, swiftness: 1, resilience: 3, precision: 2, fortune: 1 },
    skills: ["conditioning", "mechanics"]
  },
  { 
    key: "svarog-dmtx", 
    manufacturer: "Svarog Heavy Industries (Moscow, Russia)", 
    model: "DMT-X",
    description: "Originally designed to repair other Dolls in hazardous environments, these frames excel in precision tasks and technical support.",
    approaches: { power: 1, swiftness: 1, resilience: 3, precision: 4, fortune: 1 },
    skills: ["mechanics", "medicine"]
  },
  { 
    key: "sangvis-dsi8", 
    manufacturer: "Sangvis Ferri (Romania)", 
    model: "DSI-8",
    description: "Infiltration frames optimized for deception and tactical operations. They can blend into human spaces surprisingly well, too.",
    approaches: { power: 2, swiftness: 2, resilience: 2, precision: 3, fortune: 1 },
    skills: ["stealth", "subterfuge"]
  },
  { 
    key: "sangvis-ppd02", 
    manufacturer: "Sangvis Ferri (Romania)", 
    model: "PPD-02",
    description: "Originally a law enforcement design, later adapted for private security and paramilitary use. Balanced and authoritative, but rarely trusted outside official capacities.",
    approaches: { power: 1, swiftness: 2, resilience: 2, precision: 3, fortune: 2 },
    skills: ["insight", "command"]
  }
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

const resolveItemFromDropData = async (data = {}) => {
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
    const saved = actor.getFlag("gfl5r", "builderState") ?? null;
    this.builderState = saved ?? {
      step: 0,
      buildType: "human",
      discipline: null,
      advantage: null,
      disadvantage: null,
      passion: null,
      anxiety: null,
      formValues: { human: {}, tdoll: {} }
    };
  }

  async _persistBuilderState() {
    try {
      await this.actor.setFlag("gfl5r", "builderState", this.builderState);
    } catch (err) {
      console.warn("GFL5R | Unable to persist builder state", err);
    }
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

    const selectedCards = {};
    const disciplineSel = this.builderState.discipline;
    if (disciplineSel) {
      const associated = Array.isArray(disciplineSel.data?.system?.associatedSkills)
        ? disciplineSel.data.system.associatedSkills
        : [];
      const associatedLabels = associated
        .map(key => GFL5R_CONFIG.getSkillLabel(key))
        .filter(Boolean);
      selectedCards.discipline = {
        name: disciplineSel.name,
        img: disciplineSel.data?.img ?? "icons/svg/book.svg",
        associatedLabels,
        description: disciplineSel.data?.system?.description ?? ""
      };
    }

    const mapNarrative = (key) => {
      const sel = this.builderState[key];
      if (!sel) return null;
      return {
        name: sel.name,
        narrativeType: sel.narrativeType,
        img: sel.data?.img ?? "icons/svg/book.svg",
        description: sel.data?.system?.description ?? ""
      };
    };

    selectedCards.advantage = mapNarrative("advantage");
    selectedCards.disadvantage = mapNarrative("disadvantage");
    selectedCards.passion = mapNarrative("passion");
    selectedCards.anxiety = mapNarrative("anxiety");

    const steps = [
      { num: 1, label: this.builderState.buildType === "tdoll" ? "Frame" : "Nationality" },
      { num: 2, label: this.builderState.buildType === "tdoll" ? "Weapon" : "Background" },
      { num: 3, label: this.builderState.buildType === "tdoll" ? "Upgrades & Traits" : "Discipline & Traits" },
      { num: 4, label: "Motivation" }
    ];

    const formValues = this.builderState.formValues ?? { human: {}, tdoll: {} };
    formValues.human ??= {};
    formValues.tdoll ??= {};
    if (!formValues.human.viewDolls) formValues.human.viewDolls = "favor";
    if (!formValues.tdoll.nameOrigin) formValues.tdoll.nameOrigin = "human";

    return {
      actorName: this.actor.name,
      flavor,
      buildType: this.builderState.buildType,
      humanNationalities: HUMAN_NATIONALITIES.map(n => ({
        ...n,
        approachesText: n.approaches.map(a => APPROACH_LABELS[a] ?? a).join(" & ")
      })),
      humanBackgrounds: HUMAN_BACKGROUNDS.map(bg => ({
        ...bg,
        approachLabel: APPROACH_LABELS[bg.approach] ?? bg.approach,
        skillLabel: GFL5R_CONFIG.getSkillLabel(bg.skill)
      })),
      tdollFrames: TDOLL_FRAMES.map(f => ({
        ...f,
        approachesText: Object.entries(f.approaches)
          .map(([k, v]) => `${APPROACH_LABELS[k]} ${v}`)
          .join(", "),
        skillsText: f.skills.map(s => GFL5R_CONFIG.getSkillLabel(s)).join(", ")
      })),
      skillOptions,
      existingDisciplines,
      step: this.builderState.step,
      steps,
      selections: this.builderState,
      selectedCards,
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

  _buildApproachList(approachesData = {}) {
    const src = approachesData ?? {};
    return [
      { key: "power", label: "Power", value: Number(src.power ?? 0) },
      { key: "swiftness", label: "Swiftness", value: Number(src.swiftness ?? 0) },
      { key: "resilience", label: "Resilience", value: Number(src.resilience ?? 0) },
      { key: "precision", label: "Precision", value: Number(src.precision ?? 0) },
      { key: "fortune", label: "Fortune", value: Number(src.fortune ?? 0) }
    ];
  }

  _buildCollapse(approachesList, resources = {}) {
    const collapseCurrent = Number(resources?.collapse ?? 0);
    const totalApproaches = (approachesList ?? []).reduce((sum, a) => sum + Number(a.value ?? 0), 0);
    const collapseCapacity = Math.max(0, totalApproaches * 5);
    const collapsePercent = collapseCapacity > 0 ? Math.min(1, Math.max(0, collapseCurrent / collapseCapacity)) : 0;
    const collapseHue = 120 - (collapsePercent * 120);
    return {
      current: collapseCurrent,
      capacity: collapseCapacity,
      percent: collapsePercent,
      barWidth: `${(collapsePercent * 100).toFixed(1)}%`,
      barColor: `hsl(${collapseHue}, 70%, 45%)`
    };
  }

  _buildPreparedState(preparedFlag) {
    const preparedDefaultSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
    if (typeof preparedFlag === "boolean") return preparedFlag;
    if (preparedFlag === "true") return true;
    if (preparedFlag === "false") return false;
    return preparedDefaultSetting === "true";
  }

  _buildOriginDisplay(characterType, data) {
    if (characterType === "human" && (data.nationality || data.background)) {
      const nat = HUMAN_NATIONALITIES.find(n => n.key === data.nationality);
      const bg = HUMAN_BACKGROUNDS.find(b => b.key === data.background);
      const parts = [];
      if (nat) parts.push(nat.label);
      if (bg) parts.push(bg.label);
      return parts.join(" / ");
    }
    if (characterType === "doll" && data.frame) {
      const frame = TDOLL_FRAMES.find(f => f.key === data.frame);
      if (frame) {
        const manufacturerShort = frame.manufacturer.split("(")[0].trim();
        return `${manufacturerShort} ${frame.model}`;
      }
    }
    return "";
  }

  _buildDisciplineSlots(disciplinesData) {
    const slots = [];
    for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
      const slotKey = `slot${i}`;
      const slotData = disciplinesData[slotKey] ?? {
        disciplineId: null,
        xp: 0,
        rank: 1,
        abilities: []
      };

      const disciplineItem = slotData.disciplineId ? this.actor.items.get(slotData.disciplineId) : null;
      const associatedSkills = Array.isArray(disciplineItem?.system?.associatedSkills)
        ? disciplineItem.system.associatedSkills
        : [];
      const associatedSkillLabels = associatedSkills
        .map((key) => GFL5R_CONFIG.getSkillLabel(key))
        .filter(Boolean);

      const disciplineAbilities = (slotData.abilities ?? [])
        .map((abilityId) => this.actor.items.get(abilityId))
        .filter(Boolean);

      const xpForNextRank = GFL5R_CONFIG.getXPForNextRank(slotData.rank ?? 1);
      const xpRemaining = xpForNextRank ? (xpForNextRank - (slotData.xp ?? 0)) : null;

      slots.push({
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
    return slots;
  }

  _collectDisciplineAbilityIds(slots) {
    const ids = new Set();
    (slots ?? []).forEach(slot => {
      (slot.abilities ?? []).forEach(ability => ids.add(ability.id));
    });
    return ids;
  }

  _mapItemsByType(type, predicate = () => true) {
    return this.actor.items
      .filter(i => i.type === type && predicate(i))
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));
  }

  _filterNarratives(items, allowedTypes) {
    return items
      .filter(i => allowedTypes.includes(i.system?.narrativeType))
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));
  }

  _buildInventory(disciplineIds, disciplineAbilityIds) {
    return this.actor.items
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
  }

  activateListeners(html) {
    super.activateListeners(html);
    sheetDebug("CharacterBuilderApp#activateListeners");

    html.on("change", "[name='characterType']", ev => {
      const selectedType = ev.currentTarget.value;
      if (selectedType && this.builderState.buildType !== selectedType) {
        this.builderState.buildType = selectedType;
        this._persistBuilderState();
        this.render();
      }
    });

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
    const prevHuman = foundry.utils.duplicate(this.builderState?.formValues?.human ?? {});
    const prevTdoll = foundry.utils.duplicate(this.builderState?.formValues?.tdoll ?? {});
    const human = { ...prevHuman };
    const tdoll = { ...prevTdoll };
    for (const [key, value] of fd.entries()) {
      if (key.startsWith("human.")) {
        human[key.slice(6)] = value;
      } else if (key.startsWith("tdoll.")) {
        tdoll[key.slice(6)] = value;
      }
    }
    this.builderState.formValues = { human, tdoll };
    this._persistBuilderState();
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
      this._persistBuilderState();
      return true;
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
      this._persistBuilderState();
      return true;
    }

    return true;
  }

  _changeStep(delta) {
    const total = 4;
    const next = Math.min(total, Math.max(0, this.builderState.step + delta));
    if (next !== this.builderState.step) {
      this.builderState.step = next;
      this.render(false);
      this._persistBuilderState();
    }
  }

  async _updateObject(event, formData) {
    sheetDebug("CharacterBuilderApp#_updateObject", { formData });
    const buildType = this.builderState.buildType ?? formData["buildType"] ?? formData.buildType ?? "human";
    
    if (buildType === "tdoll") {
      return await this._applyTdollBuilder(formData);
    } else {
      return await this._applyHumanBuilder(formData);
    }
  }

  async _applyHumanBuilder(formData) {
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

    if (!this._validateHumanBuilder(nationality, background)) return;

    await this._resetActorForBuilder();

    const approaches = this._initHumanApproaches(nationality, background);
    const skills = this._initHumanSkills(background, viewDolls, viewDollsSkill);

    const { label: disciplineLabel, associatedSkills } = await this._applyDisciplineFromBuilder();
    [...new Set(Array.isArray(associatedSkills) ? associatedSkills : [])]
      .forEach(skillKey => this._addSkillRanks(skills, skillKey, 1));

    const updates = this._buildHumanUpdates(approaches, skills, {
      nationalityKey,
      backgroundKey,
      viewDolls,
      newName
    });

    const notesBlock = await this._buildHumanNotes({
      nationality,
      background,
      disciplineLabel,
      viewDolls,
      viewDollsSkill,
      goal,
      nameMeaning,
      storyEnd,
      additionalNotes
    });
    updates["system.notes"] = notesBlock;

    await this.actor.update(updates);

    // Keep builder state so the user can tweak and reapply later
    await this._persistBuilderState();

    ui.notifications?.info("Character builder applied to this actor.");
  }

  _validateHumanBuilder(nationality, background) {
    if (!nationality) {
      ui.notifications?.warn("Pick a nationality to continue.");
      return false;
    }
    if (!background) {
      ui.notifications?.warn("Pick a background to continue.");
      return false;
    }
    if (!this.builderState.discipline) {
      ui.notifications?.warn("Drop a starting Discipline before applying.");
      this.builderState.step = 3;
      this.render(false);
      return false;
    }
    return true;
  }

  async _resetActorForBuilder() {
    const allItemIds = this.actor.items.map(i => i.id);
    if (allItemIds.length) await this.actor.deleteEmbeddedDocuments("Item", allItemIds);
    await this.actor.update({ "system.disciplines": {} });
  }

  _initHumanApproaches(nationality, background) {
    const approaches = { power: 1, swiftness: 1, resilience: 1, precision: 1, fortune: 1 };
    const bump = (key) => {
      if (!key) return;
      approaches[key] = Number(approaches[key] ?? 0) + 1;
    };
    nationality.approaches.forEach(bump);
    bump(background.approach);
    return approaches;
  }

  _initHumanSkills(background, viewDolls, viewDollsSkill) {
    const skills = {};
    const ensureSkillAtLeast = (key, min) => {
      if (!key) return;
      const current = Number(skills[key] ?? 0);
      if (current < min) skills[key] = min;
    };
    ensureSkillAtLeast(background.skill, 1);
    if (viewDolls === "tools" && viewDollsSkill) {
      ensureSkillAtLeast(viewDollsSkill, 1);
    }
    return skills;
  }

  _addSkillRanks(skills, key, delta = 1) {
    if (!key || !delta) return;
    const current = Number(skills[key] ?? 0);
    skills[key] = current + delta;
  }

  _buildHumanUpdates(approaches, skills, meta) {
    const updates = {};
    for (const [k, v] of Object.entries(approaches)) {
      updates[`system.approaches.${k}`] = v;
    }
    updates["system.skills"] = skills;
    updates["system.characterType"] = "human";
    updates["system.nationality"] = meta.nationalityKey;
    updates["system.background"] = meta.backgroundKey;
    updates["system.humanity"] = meta.viewDolls === "favor" ? 5 : 0;
    if (meta.newName) updates["name"] = meta.newName;
    return updates;
  }

  _buildHumanNotes({
    nationality,
    background,
    disciplineLabel,
    viewDolls,
    viewDollsSkill,
    goal,
    nameMeaning,
    storyEnd,
    additionalNotes
  }) {
    const notesPieces = [
      `Nationality: ${nationality.label}`,
      `Background: ${background.label}`
    ];
    if (disciplineLabel) notesPieces.push(`Discipline: ${disciplineLabel}`);

    const narratives = [
      { label: "Advantage", key: "advantage", type: "distinction" },
      { label: "Disadvantage", key: "disadvantage", type: "adversity" },
      { label: "Passion", key: "passion", type: "passion" },
      { label: "Anxiety", key: "anxiety", type: "anxiety" }
    ];

    const narrativePromises = narratives.map(cfg => this._ensureNarrativeFromBuilder(cfg.key, cfg.type)
      .then(value => (value ? `${cfg.label}: ${value}` : "")));

    // This helper is synchronous to keep complexity low in the caller; async narratives handled there.
    const addDynamicNotes = async () => {
      const narrativeStrings = await Promise.all(narrativePromises);
      narrativeStrings.filter(Boolean).forEach(str => notesPieces.push(str));
    };

    const addViewDollsNote = () => {
      if (viewDolls === "favor") {
        notesPieces.push("Views Dolls as partners (+5 Humanity)");
      } else if (viewDollsSkill) {
        notesPieces.push(`Views Dolls as tools (Skill: ${GFL5R_CONFIG.getSkillLabel(viewDollsSkill)} to 1)`);
      }
    };

    const addOptionalText = () => {
      [
        ["Goal", goal],
        ["Name meaning", nameMeaning],
        ["Story end", storyEnd],
        ["", additionalNotes]
      ].forEach(([label, value]) => {
        if (!value) return;
        notesPieces.push(label ? `${label}: ${value}` : value);
      });
    };

    // Compose notes
    const build = async () => {
      await addDynamicNotes();
      addViewDollsNote();
      addOptionalText();
      return `Character Builder (Human)\n${notesPieces.join("\n")}`;
    };

    // Caller awaits this function, so return a promise.
    return build();
  }

  async _applyTdollBuilder(formData) {
    const formTdoll = formData.tdoll ?? {};
    const storedTdoll = this.builderState?.formValues?.tdoll ?? {};
    const getTdoll = (key) => formTdoll[key] ?? formData[`tdoll.${key}`] ?? storedTdoll[key];

    const frameKey = getTdoll("frame");
    const nameOrigin = getTdoll("nameOrigin") || "human";
    const metCommander = (getTdoll("metCommander") || "").trim();
    const goal = (getTdoll("goal") || "").trim();
    const newName = (getTdoll("name") || "").trim();
    const storyEnd = (getTdoll("storyEnd") || "").trim();
    const additionalNotes = (getTdoll("additionalNotes") || "").trim();

    const frame = TDOLL_FRAMES.find(f => f.key === frameKey);

    if (!frame) return ui.notifications?.warn("Pick a frame to continue.");
    if (!this.builderState.discipline) {
      ui.notifications?.warn("Drop a weapon imprint Discipline before applying.");
      this.builderState.step = 2;
      return this.render(false);
    }

    // Overwrite sheet from a clean state
    const allItemIds = this.actor.items.map(i => i.id);
    if (allItemIds.length) await this.actor.deleteEmbeddedDocuments("Item", allItemIds);
    await this.actor.update({ "system.disciplines": {} });

    const approaches = { ...frame.approaches };

    const skills = {};
    const ensureSkillAtLeast = (key, min) => {
      const current = skills[key] ?? 0;
      if (current < min) skills[key] = min;
    };

    frame.skills.forEach(sk => ensureSkillAtLeast(sk, 1));

    const { label: disciplineLabel, associatedSkills } = await this._applyDisciplineFromBuilder();
    const uniqueAssociatedSkills = [...new Set(Array.isArray(associatedSkills) ? associatedSkills : [])];
    uniqueAssociatedSkills.forEach(skillKey => {
      skills[skillKey] = (skills[skillKey] ?? 0) + 1;
    });

    const updates = {};
    for (const [k, v] of Object.entries(approaches)) {
      updates[`system.approaches.${k}`] = v;
    }
    updates["system.skills"] = skills;
    updates["system.characterType"] = "doll";
    updates["system.frame"] = frameKey;

    const { humanityDelta, fameDelta, note: nameOriginNote } = (() => {
      switch (nameOrigin) {
        case "human":
          return { humanityDelta: 5, fameDelta: 0, note: "Human Name (+5 Humanity)" };
        case "callsign":
          return { humanityDelta: 0, fameDelta: 5, note: "Callsign (+5 Fame)" };
        case "weapon":
          ensureSkillAtLeast("firearms", (skills["firearms"] ?? 0) + 1);
          return { humanityDelta: -5, fameDelta: 0, note: "Weapon Imprint (+1 Firearms, -5 Humanity)" };
        case "weird":
          return { humanityDelta: 0, fameDelta: -5, note: "Weird Name (-5 Fame, +1 Module point)" };
        default:
          return { humanityDelta: 0, fameDelta: 0, note: "" };
      }
    })();

    updates["system.humanity"] = humanityDelta;
    updates["system.fame"] = fameDelta;

    if (newName) updates["name"] = newName;

    const notesPieces = [`Frame: ${frame.manufacturer} ${frame.model}`];
    if (disciplineLabel) notesPieces.push(`Weapon Imprint: ${disciplineLabel}`);
    if (nameOriginNote) notesPieces.push(nameOriginNote);

    const narrativeConfigs = [
      { label: "Advantage", key: "advantage", type: "distinction" },
      { label: "Disadvantage", key: "disadvantage", type: "adversity" },
      { label: "Passion", key: "passion", type: "passion" },
      { label: "Anxiety", key: "anxiety", type: "anxiety" }
    ];
    for (const cfg of narrativeConfigs) {
      const value = await this._ensureNarrativeFromBuilder(cfg.key, cfg.type);
      if (value) notesPieces.push(`${cfg.label}: ${value}`);
    }

    [
      ["Met Commander", metCommander],
      ["Goal", goal],
      ["Story end", storyEnd],
      ["", additionalNotes]
    ].forEach(([label, value]) => {
      if (!value) return;
      notesPieces.push(label ? `${label}: ${value}` : value);
    });

    const notesBlock = `Character Builder (T-Doll)\n${notesPieces.join("\n")}`;
    updates["system.notes"] = notesBlock;

    await this.actor.update(updates);

    await this._persistBuilderState();

    ui.notifications?.info("T-Doll character builder applied to this actor.");
  }

  async _applyDisciplineFromBuilder() {
    const drop = this.builderState.discipline;
    if (!drop) return { label: "", associatedSkills: [] };

    const source = await this._resolveDisciplineSource(drop);
    const associatedSkills = this._collectAssociatedSkills(source, drop);
    if (!source) return { label: drop.name || "", associatedSkills };

    const targetId = await this._ensureDisciplineItemOnActor(source);
    if (!targetId) return { label: source.name || drop.name || "", associatedSkills };

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    const slotKey = "slot1";
    const slot = disciplines[slotKey] ?? { disciplineId: null, xp: 0, rank: 1, abilities: [] };

    if (slot.disciplineId && slot.disciplineId !== targetId) {
      await this._removeDisciplineSlotItems(slot);
    }

    disciplines[slotKey] = {
      disciplineId: targetId,
      xp: 0,
      rank: 1,
      abilities: []
    };

    await this.actor.update({ "system.disciplines": disciplines });
    return { label: source.name || drop.name || "", associatedSkills };
  }

  async _resolveDisciplineSource(drop) {
    if (drop.uuid) {
      try {
        return await fromUuid(drop.uuid);
      } catch (err) {
        console.error(err);
      }
    }
    if (drop.data) {
      const ItemCls = Item.implementation ?? Item;
      return new ItemCls(foundry.utils.duplicate(drop.data), { temporary: true });
    }
    return null;
  }

  _collectAssociatedSkills(source, drop) {
    if (Array.isArray(source?.system?.associatedSkills)) {
      return [...source.system.associatedSkills];
    }
    if (Array.isArray(drop.data?.system?.associatedSkills)) {
      return [...drop.data.system.associatedSkills];
    }
    return [];
  }

  async _ensureDisciplineItemOnActor(source) {
    if (source.parent === this.actor) return source.id;

    const itemData = source.toObject();
    itemData.type = "discipline";
    const [created] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    return created?.id ?? null;
  }

  async _removeDisciplineSlotItems(slot) {
    const ids = [slot.disciplineId, ...(slot.abilities ?? [])]
      .filter(id => id && this.actor.items.has(id));
    if (ids.length) {
      await this.actor.deleteEmbeddedDocuments("Item", ids);
    }
  }

  async _ensureNarrativeFromBuilder(key, narrativeType) {
    const drop = this.builderState[key];
    const name = (drop?.name || "").trim();
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

  /**
   * Reuse builder helper methods for the sheet context.
   */
  _buildApproachList(approachesData = {}) {
    return CharacterBuilderApp.prototype._buildApproachList.call(this, approachesData);
  }

  _buildCollapse(approachesList, resources = {}) {
    return CharacterBuilderApp.prototype._buildCollapse.call(this, approachesList, resources);
  }

  _buildPreparedState(preparedFlag) {
    return CharacterBuilderApp.prototype._buildPreparedState.call(this, preparedFlag);
  }

  _buildOriginDisplay(characterType, data) {
    return CharacterBuilderApp.prototype._buildOriginDisplay.call(this, characterType, data);
  }

  _buildDisciplineSlots(disciplinesData) {
    return CharacterBuilderApp.prototype._buildDisciplineSlots.call(this, disciplinesData);
  }

  _collectDisciplineAbilityIds(slots) {
    return CharacterBuilderApp.prototype._collectDisciplineAbilityIds.call(this, slots);
  }

  _mapItemsByType(type, predicate = () => true) {
    return CharacterBuilderApp.prototype._mapItemsByType.call(this, type, predicate);
  }

  _filterNarratives(items, allowedTypes) {
    return CharacterBuilderApp.prototype._filterNarratives.call(this, items, allowedTypes);
  }

  _buildInventory(disciplineIds, disciplineAbilityIds) {
    return CharacterBuilderApp.prototype._buildInventory.call(this, disciplineIds, disciplineAbilityIds);
  }

  async getData(options) {
    sheetDebug("ActorSheet#getData", { actor: this.actor?.id, name: this.actor?.name });
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);
    context.availableXP = Number(data.xp ?? 0);
    context.approachesList = this._buildApproachList(data.approaches);
    context.collapse = this._buildCollapse(context.approachesList, data.resources);
    context.preparedState = this._buildPreparedState(data.prepared);

    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");
    context.originDisplay = this._buildOriginDisplay(context.characterType, data);

    context.skills = data.skills ?? {};
    context.skillGroups = GFL5R_CONFIG.skillGroups;

    context.disciplineSlots = this._buildDisciplineSlots(data.disciplines ?? {});
    const disciplineAbilityIds = this._collectDisciplineAbilityIds(context.disciplineSlots);
    context.abilities = this._mapItemsByType("ability", (i) => !disciplineAbilityIds.has(i.id));

    const narrativeItems = this.actor.items.filter(i => i.type === "narrative");
    context.narrativePositive = this._filterNarratives(narrativeItems, ["distinction", "passion"]);
    context.narrativeNegative = this._filterNarratives(narrativeItems, ["adversity", "anxiety"]);

    context.conditions = this._mapItemsByType("condition");
    context.weapons = this._mapItemsByType("weaponry");
    context.armor = this._mapItemsByType("armor");
    context.modules = this._mapItemsByType("module");

    const disciplineIds = new Set(
      context.disciplineSlots.filter(slot => slot.discipline).map(slot => slot.discipline.id)
    );
    context.inventory = this._buildInventory(disciplineIds, disciplineAbilityIds);

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
      const dlg = new GFL5RPickerDialog(this.actor, { skillKey: key });
      dlg.render(true);
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
      const slot = disciplines[slotKey];
      if (!slot) return;

      const toDelete = [];
      const disciplineId = slot.disciplineId;
      if (disciplineId && this.actor.items.has(disciplineId)) {
        toDelete.push(disciplineId);
      }

      (slot.abilities ?? []).forEach(id => {
        if (this.actor.items.has(id)) toDelete.push(id);
      });

      if (toDelete.length) {
        await this.actor.deleteEmbeddedDocuments("Item", toDelete);
      }

      disciplines[slotKey] = {
        disciplineId: null,
        xp: 0,
        rank: 1,
        abilities: []
      };

      await this.actor.update({ "system.disciplines": disciplines });
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
      ev.preventDefault();
      ev.stopPropagation();
      const labelEl = ev.currentTarget;
      const key = labelEl.dataset.skill;            // e.g. "blades"
      const skillLabel = labelEl.textContent.trim();
      await rollSkill(key, skillLabel);
    });

    // Click anywhere on the skill card to roll (unless clicking buttons)
    html.on("click", "[data-skill-card]", async ev => {
      if (ev.target.closest("button")) return;
      if (ev.target.closest("[data-action='roll-skill']")) return;
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

  _flashDropTarget(el) {
    if (!el) return;
    el.classList.add("border", "border-success", "bg-success-subtle");
    setTimeout(() => el.classList.remove("border-success", "bg-success-subtle"), 400);
  }

  _getDropTarget(event) {
    const finder = (selector) => event.target?.closest?.(selector);
    const targets = [
      ["abilities", "[data-drop-target='abilities']"],
      ["narrative-positive", "[data-drop-target='narrative-positive']"],
      ["narrative-negative", "[data-drop-target='narrative-negative']"],
      ["inventory", "[data-drop-target='inventory']"],
      ["modules", "[data-drop-target='modules']"],
      ["condition", "[data-drop-target='condition']"],
      ["discipline", "[data-drop-target='discipline']"],
      ["discipline-ability", "[data-drop-target='discipline-ability']"]
    ];

    for (const [type, selector] of targets) {
      const target = finder(selector);
      if (target) return { target, type };
    }
    return { target: null, type: null };
  }

  async _applyDisciplineDrop(slotKey, itemDoc, rawItemData) {
    if (!slotKey) return false;
    let itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
    itemData.type = "discipline";

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    disciplines[slotKey] ??= { disciplineId: null, xp: 0, rank: 1, abilities: [] };

    const current = disciplines[slotKey];
    if (current.disciplineId) {
      const toDelete = [current.disciplineId, ...(current.abilities ?? [])].filter(id => this.actor.items.has(id));
      if (toDelete.length) await this.actor.deleteEmbeddedDocuments("Item", toDelete);
    }

    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!createdItem) return false;

    disciplines[slotKey] = {
      disciplineId: createdItem.id,
      xp: 0,
      rank: 1,
      abilities: []
    };

    await this.actor.update({ "system.disciplines": disciplines });
    return true;
  }

  async _applyDisciplineAbilityDrop(slotKey, itemDoc, dropTarget) {
    if (!slotKey) return false;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    const slot = disciplines[slotKey];
    if (!slot) return false;

    const availableXP = Number(this.actor.system?.xp ?? 0);
    const cost = 3;
    if (availableXP < cost) {
      dropTarget?.classList.add("border", "border-danger", "bg-danger-subtle");
      setTimeout(() => dropTarget?.classList.remove("border-danger", "bg-danger-subtle"), 500);
      ui.notifications?.warn("Not enough XP to add an ability to this discipline (costs 3 XP).");
      return false;
    }

    const itemData = itemDoc.toObject?.() ?? {};
    itemData.type = "ability";
    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!createdItem) return false;

    slot.abilities ||= [];
    slot.abilities.push(createdItem.id);

    const updatedXP = Number(slot.xp ?? 0) + cost;
    slot.xp = updatedXP;
    slot.rank = GFL5R_CONFIG.getRankFromXP(updatedXP);

    await this.actor.update({
      "system.xp": availableXP - cost,
      "system.disciplines": disciplines
    });
    return true;
  }

  _cloneItemDataForDrop(itemDoc, rawItemData, targetType) {
    const itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
    itemData.system ??= {};

    if (targetType === "abilities") {
      itemData.type = "ability";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (targetType === "narrative-positive" || targetType === "narrative-negative") {
      itemData.type = "narrative";
      itemData.system.description ??= itemDoc.system?.description ?? "";
      if (!itemData.system.narrativeType) {
        itemData.system.narrativeType = targetType === "narrative-positive" ? "distinction" : "adversity";
      }
    } else if (targetType === "modules") {
      itemData.type = "module";
      itemData.system.description ??= itemDoc.system?.description ?? "";
    } else if (targetType === "condition") {
      itemData.type = "condition";
      itemData.system.description ??= itemDoc.system?.description ?? "";
      itemData.system.duration ??= itemDoc.system?.duration ?? "";
      itemData.system.tags ??= itemDoc.system?.tags ?? "";
    } else if (targetType === "inventory") {
      itemData.system.description ??= itemDoc.system?.description ?? "";
    }
    return itemData;
  }

  /** Accept dropped Items (from compendia or sidebar) into the drop zones */
  async _onDrop(event) {
    sheetDebug("ActorSheet#_onDrop", { target: event.target?.dataset?.dropTarget });
    const { target: dropTarget, type: targetType } = this._getDropTarget(event);
    if (!dropTarget || !targetType) return super._onDrop(event);

    const data = getDragEventDataSafe(event);
    const { item: itemDoc, itemData: rawItemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or compendium.");
      return false;
    }

    if (targetType === "discipline") {
      const slotKey = dropTarget.dataset.slotKey;
      const handled = await this._applyDisciplineDrop(slotKey, itemDoc, rawItemData);
      if (handled) this._flashDropTarget(dropTarget);
      return handled;
    }

    if (targetType === "discipline-ability") {
      const slotKey = dropTarget.dataset.slotKey;
      const handled = await this._applyDisciplineAbilityDrop(slotKey, itemDoc, dropTarget);
      if (handled) this._flashDropTarget(dropTarget);
      return handled;
    }

    const itemData = this._cloneItemDataForDrop(itemDoc, rawItemData, targetType);
    await this.actor.createEmbeddedDocuments("Item", [itemData]);
    this._flashDropTarget(dropTarget);
    return true;
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
    // Reuse the primary actor sheet data builder for NPCs
    return GFL5RActorSheet.prototype.getData.call(this, options);
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

