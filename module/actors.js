// module/actors.js
console.log("GFL5R | actors.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { computeDerivedStats } from "./utils/derived.js";

const SHEET_DEBUG = false;
const sheetDebug = (...args) => {
  if (!SHEET_DEBUG) return;
  console.debug("GFL5R | Sheet", ...args);
};

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const ActorSheet = foundry.appv1.sheets.ActorSheet;

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

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
      title: "Character Creation",
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
      this._persistBuilderState();
      return false;
    }

    return false;
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

    // Overwrite sheet from a clean state
    const allItemIds = this.actor.items.map(i => i.id);
    if (allItemIds.length) await this.actor.deleteEmbeddedDocuments("Item", allItemIds);
    await this.actor.update({ "system.disciplines": {} });

    const approaches = {
      power: 1,
      swiftness: 1,
      resilience: 1,
      precision: 1,
      fortune: 1
    };    const bumpApproach = (key) => {
      if (!key) return;
      approaches[key] = Number(approaches[key] ?? 0) + 1;
    };

    nationality.approaches.forEach(bumpApproach);
    bumpApproach(background.approach);

    // Start from a clean skill slate
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
    updates["system.nationality"] = nationalityKey;
    updates["system.background"] = backgroundKey;

    const currentHumanity = 0;
    updates["system.humanity"] = viewDolls === "favor" ? currentHumanity + 5 : currentHumanity;

    if (newName) updates["name"] = newName;

    const notesPieces = [];
    notesPieces.push(`Nationality: ${nationality.label}`);
    notesPieces.push(`Background: ${background.label}`);

    if (disciplineLabel) notesPieces.push(`Discipline: ${disciplineLabel}`);

    const advantageName = await this._ensureNarrativeFromBuilder("advantage", "distinction");
    const disadvantageName = await this._ensureNarrativeFromBuilder("disadvantage", "adversity");
    const passionName = await this._ensureNarrativeFromBuilder("passion", "passion");
    const anxietyName = await this._ensureNarrativeFromBuilder("anxiety", "anxiety");

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

    const notesBlock = `Character Creation (Human)\n${notesPieces.join("\n")}`;
    updates["system.notes"] = notesBlock;

    await this.actor.update(updates);

    // Keep builder state so the user can tweak and reapply later
    await this._persistBuilderState();

    ui.notifications?.info("Character Creation applied to this actor.");
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

    if (!frame) {
      ui.notifications?.warn("Pick a frame to continue.");
      return;
    }
    if (!this.builderState.discipline) {
      ui.notifications?.warn("Drop a weapon imprint Discipline before applying.");
      this.builderState.step = 2;
      this.render(false);
      return;
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

    let currentHumanity = 0;
    let currentFame = 0;

    // Apply name origin bonuses
    if (nameOrigin === "human") {
      currentHumanity += 5;
    } else if (nameOrigin === "callsign") {
      currentFame += 5;
    } else if (nameOrigin === "weapon") {
      ensureSkillAtLeast("firearms", (skills["firearms"] ?? 0) + 1);
      currentHumanity -= 5;
    } else if (nameOrigin === "weird") {
      currentFame -= 5;
      // +1 Upgrade Module point (not yet implemented in system)
    }

    updates["system.humanity"] = currentHumanity;
    updates["system.fame"] = currentFame;

    if (newName) updates["name"] = newName;

    const notesPieces = [];
    notesPieces.push(`Frame: ${frame.manufacturer} ${frame.model}`);

    if (disciplineLabel) notesPieces.push(`Weapon Imprint: ${disciplineLabel}`);

    const advantageName = await this._ensureNarrativeFromBuilder("advantage", "distinction");
    const disadvantageName = await this._ensureNarrativeFromBuilder("disadvantage", "adversity");
    const passionName = await this._ensureNarrativeFromBuilder("passion", "passion");
    const anxietyName = await this._ensureNarrativeFromBuilder("anxiety", "anxiety");

    if (advantageName) notesPieces.push(`Advantage: ${advantageName}`);
    if (disadvantageName) notesPieces.push(`Disadvantage: ${disadvantageName}`);
    if (passionName) notesPieces.push(`Passion: ${passionName}`);
    if (anxietyName) notesPieces.push(`Anxiety: ${anxietyName}`);

    const nameOriginLabels = {
      human: "Human Name (+5 Humanity)",
      callsign: "Callsign (+5 Fame)",
      weapon: "Weapon Imprint (+1 Firearms, -5 Humanity)",
      weird: "Weird Name (-5 Fame, +1 Module point)"
    };
    notesPieces.push(`Name Origin: ${nameOriginLabels[nameOrigin] ?? nameOrigin}`);

    if (metCommander) notesPieces.push(`Met Commander: ${metCommander}`);
    if (goal) notesPieces.push(`Goal: ${goal}`);
    if (storyEnd) notesPieces.push(`Story end: ${storyEnd}`);
    if (additionalNotes) notesPieces.push(additionalNotes);

    const notesBlock = `Character Creation (T-Doll)\n${notesPieces.join("\n")}`;
    updates["system.notes"] = notesBlock;

    await this.actor.update(updates);

    await this._persistBuilderState();

    ui.notifications?.info("T-Doll Character Creation applied to this actor.");
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

export class GFL5RActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "gfl5r-actor-sheet",
    classes: ["sheet", "actor"],
    position: { width: 860, height: 700 },
    window: { title: "Character", resizable: true }
  };

  get title() {
    const actor = this.document ?? this.actor;
    const name = actor?.name ?? "Actor";
    const typeLabel = actor?.type === "npc" ? "NPC" : "Character";
    return `${typeLabel}: ${name}`;
  }

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/actor-sheet.html"), scrollable: [".sheet-body"] }
    };
  }

  onDeleteItemClick(ev) {
    const id = ev.currentTarget?.dataset?.itemId;
    if (!id) return;
    return this.actor.deleteEmbeddedDocuments("Item", [id]);
  }

  onEditItemClick(ev) {
    const id = ev.currentTarget?.dataset?.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (item) item.sheet.render(true);
  }

  static get eventListeners() {
    return [
      { event: "click", selector: "[data-action='roll-skill']", callback: "onRollSkillClick", part: "sheet" },
      { event: "click", selector: "[data-skill-card]", callback: "onSkillCardClick", part: "sheet" },
      { event: "click", selector: "[data-item-id][data-action='delete-item']", callback: "onDeleteItemClick", part: "sheet" },
      { event: "click", selector: "[data-item-id][data-action='edit-item']", callback: "onEditItemClick", part: "sheet" },
    ];
  }

  #renderAbort = null;

  async _prepareContext(options) {
    sheetDebug("ActorSheet#_prepareContext", { actor: this.actor?.id, name: this.actor?.name });
    const context = (await super._prepareContext(options)) ?? {};
    const actor = this.document ?? this.actor;
    context.actor ??= actor?.toObject?.() ?? actor;
    const data = context.actor?.system ?? actor?.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);
    context.availableXP = Number(data.xp ?? 0);

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

    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");

    let originDisplay = "";
    if (context.characterType === "human" && (data.nationality || data.background)) {
      const nat = HUMAN_NATIONALITIES.find(n => n.key === data.nationality);
      const bg = HUMAN_BACKGROUNDS.find(b => b.key === data.background);
      const parts = [];
      if (nat) parts.push(nat.label);
      if (bg) parts.push(bg.label);
      originDisplay = parts.join(" • ");
    } else if (context.characterType === "doll" && data.frame) {
      const frame = TDOLL_FRAMES.find(f => f.key === data.frame);
      if (frame) {
        const manufacturerShort = frame.manufacturer.split("(")[0].trim();
        originDisplay = `${manufacturerShort} ${frame.model}`;
      }
    }
    context.originDisplay = originDisplay;

    context.skills = data.skills ?? {};
    context.skillGroups = GFL5R_CONFIG.skillGroups;

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

      const disciplineAbilities = (slotData.abilities ?? [])
        .map(abilityId => this.actor.items.get(abilityId))
        .filter(a => a);

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

    const disciplineAbilityIds = new Set();
    context.disciplineSlots.forEach(slot => {
      if (slot.abilities) {
        slot.abilities.forEach(ability => disciplineAbilityIds.add(ability.id));
      }
    });

    context.abilities = this.actor.items
      .filter(i => i.type === "ability" && !disciplineAbilityIds.has(i.id))
      .map(i => ({
        id: i.id,
        name: i.name,
        img: i.img,
        system: i.system ?? {}
      }));

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

    context.modules = this.actor.items.filter(i => i.type === "module").map(i => ({
      id: i.id,
      name: i.name,
      img: i.img,
      system: i.system ?? {}
    }));

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

  _onRender(...args) {
    super._onRender?.(...args);
    const root = this.element;
    if (!root) return;
    const html = $(root);

    this.#renderAbort?.abort();
    this.#renderAbort = new AbortController();
    const { signal } = this.#renderAbort;

    // Delete item (abilities, weapons, etc.) - scoped to elements that carry an item id
    // (item edit/delete now handled via eventListeners)

    const flashSkillCard = (element, danger = false) => {
      if (!element) return;
      element.classList.add(danger ? "xp-flash-danger" : "xp-flash");
      setTimeout(() => element.classList.remove("xp-flash", "xp-flash-danger"), 450);
    };

    // Fallback delegations for skill clicks so we can see events even if V2 wiring fails
    root.addEventListener("click", (event) => {
      const btn = event.target.closest?.("[data-action='roll-skill']");
      if (btn && root.contains(btn)) {
        const key = btn.dataset.skill;
        const label = (btn.textContent || "").trim() || key;
        console.log("GFL5R | Skill click (delegate button)", { key, label });
        if (key) this.#rollSkill(key, label);
      }

      const card = event.target.closest?.("[data-skill-card]");
      if (card && root.contains(card) && !event.target.closest("button")) {
        const key = card.dataset.skillKey;
        const label = card.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
        console.log("GFL5R | Skill click (delegate card)", { key, label });
        if (key) this.#rollSkill(key, label);
      }
    }, { signal });

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

      const tabEl = ev.target.closest(".nav-link[data-tab]");
      if (tabEl && root.contains(tabEl)) {
        ev.preventDefault();
        this.activateTab(tabEl.dataset.tab);
      }

      const clickedSkillCard = ev.target.closest("[data-skill-card]");
      if (clickedSkillCard && root.contains(clickedSkillCard)) {
        if (ev.target.closest("button")) return;
        const key = clickedSkillCard.dataset.skillKey;
        const label = clickedSkillCard.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
        if (key) this.#rollSkill(key, label);
      }

      const itemContainer = ev.target.closest("[data-item-id]");
      if (itemContainer && root.contains(itemContainer) && !ev.target.closest("button")) {
        const itemId = itemContainer.dataset.itemId;
        if (itemId) this.#maybeRollItem(itemId);
      }
    }, { signal });

    root.addEventListener("change", (event) => {
      const target = event.target;
      const action = target.dataset?.action;
      if (!action) return;
      switch (action) {
        case "discipline-xp":
          this.#updateDisciplineXP(target);
          break;
        case "discipline-rank":
          this.#updateDisciplineRank(target);
          break;
        default:
          break;
      }
    }, { signal });

    root.addEventListener("dragover", (event) => {
      event.preventDefault();
    }, { signal });

    root.addEventListener("drop", (event) => {
      event.preventDefault();
      this._onDrop(event);
    }, { signal });
  }

  async close(options) {
    this.#renderAbort?.abort();
    return super.close(options);
  }

  async #handleAction(action, target, event) {
    switch (action) {
      case "open-character-builder":
        new CharacterBuilderApp(this.actor).render(true);
        break;
      case "delete-item":
        await this.#deleteItem(target);
        break;
      case "edit-item":
        await this.#editItem(target);
        break;
      case "skill-increase":
        await this.#changeSkill(target, 1);
        break;
      case "skill-decrease":
        await this.#changeSkill(target, -1);
        break;
      case "approach-increase":
        await this.#changeApproach(target, 1);
        break;
      case "approach-decrease":
        await this.#changeApproach(target, -1);
        break;
      case "remove-discipline":
        await this.#removeDiscipline(target);
        break;
      case "remove-discipline-ability":
        await this.#removeDisciplineAbility(target);
        break;
      case "roll-skill":
        await this.#rollSkill(target.dataset.skill, target.textContent.trim());
        break;
      default:
        break;
    }
  }

  #flashSkillCard(element, danger = false) {
    if (!element) return;
    element.classList.add(danger ? "xp-flash-danger" : "xp-flash");
    setTimeout(() => element.classList.remove("xp-flash", "xp-flash-danger"), 450);
  }

  #getAvailableXP() {
    const formXP = this.element?.querySelector?.("[name='system.xp']")?.value;
    const parsed = Number(formXP);
    return Number.isNaN(parsed) ? Number(this.actor.system?.xp ?? 0) : parsed;
  }

  async #rollSkill(key, skillLabel) {
    const approaches = this.actor.system?.approaches ?? {};
    const { GFLDicePickerDialog } = await import("./dice-picker-dialog.js");
    const pickerOpts = {
      actor: this.actor,
      skillKey: key,
      skillLabel,
      approaches,
      defaultTN: 2,
      defaultApproach: Object.keys(approaches || {})[0]
    };
    new GFLDicePickerDialog(pickerOpts).render(true);
  }

  async onRollSkillClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const el = event.currentTarget;
    const key = el.dataset.skill;
    const label = (el.textContent || "").trim() || key;
    console.log("GFL5R | Skill click", { key, label, via: "button" });
    if (!key) return;
    await this.#rollSkill(key, label);
  }

  async onSkillCardClick(event) {
    if (event.target.closest("button")) return;
    if (event.target.closest("[data-action='roll-skill']")) return;
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget;
    const key = card.dataset.skillKey;
    const label = card.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
    console.log("GFL5R | Skill click", { key, label, via: "card" });
    if (!key) return;
    await this.#rollSkill(key, label);
  }

  async #deleteItem(target) {
    const id = target?.dataset?.itemId;
    if (!id) return;
    await this.actor.deleteEmbeddedDocuments("Item", [id]);
  }

  async #editItem(target) {
    const id = target?.dataset?.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (item) item.sheet.render(true);
  }

  async #changeSkill(target, delta) {
    const key = target?.dataset?.skill;
    if (!key) return;

    const skillCard = target.closest?.("[data-skill-card]");
    const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
    const currentRank = Number(skills[key] ?? 0);
    const nextRank = currentRank + delta;

    if (nextRank < 0) return;

    const cost = 2 * (delta > 0 ? nextRank : currentRank);
    const availableXP = this.#getAvailableXP();

    if (delta > 0 && availableXP < cost) {
      this.#flashSkillCard(skillCard, true);
      ui.notifications?.warn("Not enough XP to increase this skill.");
      return;
    }

    skills[key] = nextRank;
    const updatedDisciplines = this._applyDisciplineSkillXP(key, delta > 0 ? cost : -cost);
    const updateData = {
      [`system.skills.${key}`]: nextRank,
      "system.xp": delta > 0 ? availableXP - cost : availableXP + cost
    };

    if (updatedDisciplines) {
      updateData["system.disciplines"] = updatedDisciplines;
    }

    await this.actor.update(updateData);
    this.#flashSkillCard(skillCard);
  }

  async #changeApproach(target, delta) {
    const key = target?.dataset?.approach;
    if (!key) return;

    const card = target.closest?.("[data-approach-card]");
    const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
    const currentRank = Number(approaches[key] ?? 0);
    const nextRank = currentRank + delta;
    if (nextRank < 0) return;

    const cost = 3 * (delta > 0 ? nextRank : currentRank);
    const availableXP = this.#getAvailableXP();

    if (delta > 0 && availableXP < cost) {
      this.#flashSkillCard(card, true);
      ui.notifications?.warn("Not enough XP to increase this approach.");
      return;
    }

    approaches[key] = nextRank;
    await this.actor.update({
      [`system.approaches.${key}`]: nextRank,
      "system.xp": delta > 0 ? availableXP - cost : availableXP + cost
    });
    this.#flashSkillCard(card);
  }

  async #removeDiscipline(target) {
    const slotKey = target?.dataset?.slotKey;
    if (!slotKey) return;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    if (!disciplines[slotKey]) return;

    const toDelete = [];
    const disciplineId = disciplines[slotKey].disciplineId;
    if (disciplineId && this.actor.items.get(disciplineId)) {
      toDelete.push(disciplineId);
    }

    if (disciplines[slotKey].abilities?.length) {
      for (const abilityId of disciplines[slotKey].abilities) {
        if (this.actor.items.get(abilityId)) {
          toDelete.push(abilityId);
        }
      }
    }

    await this.actor.update({ "system.disciplines": disciplines });
  }

  async #updateDisciplineXP(input) {
    const slotKey = input?.dataset?.slotKey;
    const xp = Number(input?.value) || 0;
    if (!slotKey) return;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    if (disciplines[slotKey]) {
      disciplines[slotKey].xp = xp;
      disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(xp);
      await this.actor.update({ "system.disciplines": disciplines });
    }
  }

  async #updateDisciplineRank(input) {
    const slotKey = input?.dataset?.slotKey;
    const rank = Number(input?.value) || 1;
    if (!slotKey) return;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    if (disciplines[slotKey]) {
      disciplines[slotKey].rank = rank;
      await this.actor.update({ "system.disciplines": disciplines });
    }
  }

  async #removeDisciplineAbility(target) {
    const slotKey = target?.dataset?.slotKey;
    const abilityId = target?.dataset?.abilityId;
    if (!slotKey || !abilityId) return;

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    const slot = disciplines[slotKey];
    if (slot?.abilities) {
      slot.abilities = slot.abilities.filter(id => String(id) !== String(abilityId));
    }

    await this.actor.update({ "system.disciplines": disciplines });

    if (this.actor.items.get(abilityId)) {
      await this.actor.deleteEmbeddedDocuments("Item", [abilityId]);
    }
  }

  async #maybeRollItem(itemId) {
    const item = this.actor.items.get(itemId);
    if (!item) return;
    if ((item.type === "ability" || item.type === "weaponry") && item.system.skill) {
      await this.#rollSkill(item.system.skill, item.name);
    }
  }

  activateTab(tabId) {
    const root = this.element;
    if (!root) return;

    const navLinks = Array.from(root.querySelectorAll(".nav-link[data-tab]"));
    navLinks.forEach(link => {
      link.classList.toggle("active", link.dataset.tab === tabId);
    });

    const panes = Array.from(root.querySelectorAll(".tab[data-tab][data-group='primary']"));
    panes.forEach(pane => {
      const isActive = pane.dataset.tab === tabId;
      pane.classList.toggle("active", isActive);
      pane.classList.toggle("show", isActive);
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

      const availableXP = this.#getAvailableXP();
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

export class GFL5RNPCSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "gfl5r-npc-sheet",
    classes: ["sheet", "actor", "npc"],
    position: { width: 700, height: 600 },
    window: { title: "NPC", resizable: true }
  };

  get title() {
    const actor = this.document ?? this.actor;
    const name = actor?.name ?? "NPC";
    return `NPC: ${name}`;
  }

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/npc-sheet.html"), scrollable: [".sheet-body"] }
    };
  }

  static get eventListeners() {
    return [];
  }

  #renderAbort = null;

  async _prepareContext(options) {
    const context = (await super._prepareContext(options)) ?? {};
    const actor = this.document ?? this.actor;
    context.actor ??= actor?.toObject?.() ?? actor;
    const data = context.actor?.system ?? actor?.system ?? {};

    context.derived = computeDerivedStats(data.approaches, data.resources);
    context.skills = data.skills ?? {};
    context.features = this.actor.items.map(i => ({
      id: i.id,
      name: i.name,
      type: i.type,
      img: i.img,
      system: i.system ?? {}
    }));

    return context;
  }

  _onRender() {
    const root = this.element;
    if (!root) return;

    this.#renderAbort?.abort();
    this.#renderAbort = new AbortController();
    const { signal } = this.#renderAbort;

    root.addEventListener("click", (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl || !root.contains(actionEl)) return;
      event.preventDefault();
      const action = actionEl.dataset.action;
      if (action === "delete-item") {
        const id = actionEl.dataset.itemId;
        if (id) this.actor.deleteEmbeddedDocuments("Item", [id]);
      } else if (action === "edit-item") {
        const id = actionEl.dataset.itemId;
        if (id) {
          const item = this.actor.items.get(id);
          if (item) item.sheet.render(true);
        }
      }
    }, { signal });

    const dropZone = root.querySelector("[data-drop-zone='features']");
    if (dropZone) {
      dropZone.addEventListener("dragover", (event) => event.preventDefault(), { signal });
      dropZone.addEventListener("drop", async (event) => {
        event.preventDefault();
        await this._onDropItem(event, getDragEventDataSafe(event));
      }, { signal });
    }
  }

  async close(options) {
    this.#renderAbort?.abort();
    return super.close(options);
  }

  async _onDropItem(event, data) {
    if (!this.actor.isOwner) return false;

    const itemData = await Item.fromDropData(data);
    if (!itemData) return false;

    await this.actor.createEmbeddedDocuments("Item", [itemData]);

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
