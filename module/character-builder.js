import { GFL5R_CONFIG } from "./config.js";
import { APPROACH_LABELS, FLAVOR_DEFAULTS, HUMAN_BACKGROUNDS, HUMAN_NATIONALITIES, TDOLL_FRAMES, flattenSkillList } from "./actor-data.js";
import { resolveItemFromDropData, getDragEventDataSafe } from "./utils/drop.js";

const SHEET_DEBUG = false;
const sheetDebug = (...args) => {
  if (!SHEET_DEBUG) return;
  console.debug("GFL5R | Sheet", ...args);
};

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";

export class CharacterBuilderApp extends FormApplication {
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
      modules: [],
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
      template: `systems/${systemId()}/templates/character-builder.html`,
      width: 800,
      height: 600,
      resizable: true,
      minWidth: 600,
      minHeight: 400,
      classes: ["sheet", "gfl5r-builder", "actor"],
      submitOnChange: false
    });
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

    const startingCredits = 60000;
    const totalCost = (this.builderState.modules || []).reduce((sum, m) => sum + (m.system?.urncCredits || 0), 0);
    const remainingCredits = Math.max(0, startingCredits - totalCost);
    const selectedModules = (this.builderState.modules || []).map(m => ({
      name: m.name,
      img: m.img ?? "icons/svg/upgrade.svg",
      description: m.system?.description ?? "",
      cost: m.system?.urncCredits ?? 0,
      moduleType: m.system?.moduleType ?? "",
      targetSkill: m.system?.targetSkill ?? "",
      targetApproach: m.system?.targetApproach ?? ""
    }));

    const skills = GFL5R_CONFIG.skillGroups.flatMap(group => group.items);
    const approaches = Object.keys(GFL5R_CONFIG.approachLabels).map(key => ({ key, label: GFL5R_CONFIG.approachLabels[key] }));

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
      remainingCredits,
      selectedModules,
      skills,
      approaches,
      formValues
    };
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

    html.on("click", "[data-action='remove-module']", ev => {
      ev.preventDefault();
      const index = parseInt(ev.currentTarget.dataset.index);
      if (this.builderState.modules && this.builderState.modules[index] !== undefined) {
        this.builderState.modules.splice(index, 1);
        this._persistBuilderState();
        this.render();
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
    if (!dropTarget) return;

    const kind = dropTarget.dataset.dropTarget;
    const data = getDragEventDataSafe(event);

    const { item: itemDoc, uuid: sourceUuid, itemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or a compendium.");
      return;
    }

    const dropData = itemData ?? itemDoc.toObject?.() ?? null;

    if (kind === "discipline") {
      if (itemDoc.type !== "discipline") {
        ui.notifications?.warn("Drop a Discipline item here.");
        return;
      }
      this.builderState.discipline = {
        name: itemDoc.name,
        uuid: sourceUuid ?? itemDoc.uuid ?? null,
        type: "discipline",
        data: dropData
      };
      this.render(false);
      this._persistBuilderState();
      return;
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
        return;
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
      return;
    }

    if (kind === "module") {
      if (itemDoc.type !== "module") {
        ui.notifications?.warn("Drop a Module item here.");
        return;
      }
      if (!this.builderState.modules) this.builderState.modules = [];

      // Check for duplicates using _id or name as fallback
      const moduleId = dropData._id ?? dropData.name;
      const existing = this.builderState.modules.find(m => (m._id ?? m.name) === moduleId);
      if (existing) {
        ui.notifications?.info("This module is already added.");
        return;
      }

      // Check credit limit
      const startingCredits = 60000;
      const currentCost = this.builderState.modules.reduce((sum, m) => sum + (m.system?.urncCredits || 0), 0);
      const moduleCost = dropData.system?.urncCredits || 0;
      if (currentCost + moduleCost > startingCredits) {
        ui.notifications?.warn(`Not enough credits! This module costs ${moduleCost} but you only have ${startingCredits - currentCost} remaining.`);
        return;
      }

      this.builderState.modules.push(dropData);
      this._persistBuilderState();
      this.render();
      return;
    }
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

    const { humanityDelta, viewDollsNote } = this.#applyViewDollsBonuses(viewDolls, viewDollsSkill, skills, ensureSkillAtLeast);
    updates["system.humanity"] = humanityDelta;

    if (newName) updates["name"] = newName;

    const advantageName = await this._ensureNarrativeFromBuilder("advantage", "distinction");
    const disadvantageName = await this._ensureNarrativeFromBuilder("disadvantage", "adversity");
    const passionName = await this._ensureNarrativeFromBuilder("passion", "passion");
    const anxietyName = await this._ensureNarrativeFromBuilder("anxiety", "anxiety");

    const notesBlock = this.#buildHumanNotes({
      nationalityLabel: nationality.label,
      backgroundLabel: background.label,
      disciplineLabel,
      advantageName,
      disadvantageName,
      passionName,
      anxietyName,
      viewDollsNote,
      goal,
      nameMeaning,
      storyEnd,
      additionalNotes
    });
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

    const startingCredits = 60000;
    const totalCost = (this.builderState.modules || []).reduce((sum, m) => sum + (m.system?.urncCredits || 0), 0);
    const remainingCredits = Math.max(0, startingCredits - totalCost);

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

    const { humanityDelta, fameDelta } = this.#applyNameOriginBonuses(nameOrigin, skills, ensureSkillAtLeast);
    updates["system.humanity"] = humanityDelta;
    updates["system.fame"] = fameDelta;
    updates["system.urncCredits"] = remainingCredits;

    if (newName) updates["name"] = newName;

    const advantageName = await this._ensureNarrativeFromBuilder("advantage", "distinction");
    const disadvantageName = await this._ensureNarrativeFromBuilder("disadvantage", "adversity");
    const passionName = await this._ensureNarrativeFromBuilder("passion", "passion");
    const anxietyName = await this._ensureNarrativeFromBuilder("anxiety", "anxiety");

    const notesBlock = this.#buildTdollNotes({
      frame,
      disciplineLabel,
      nameOrigin,
      metCommander,
      goal,
      storyEnd,
      additionalNotes,
      advantageName,
      disadvantageName,
      passionName,
      anxietyName
    });
    updates["system.notes"] = notesBlock;

    await this.actor.update(updates);

    // Create module items
    for (const moduleData of this.builderState.modules || []) {
      const itemData = {
        name: moduleData.name,
        type: "module",
        system: moduleData.system || {}
      };
      await this.actor.createEmbeddedDocuments("Item", [itemData]);
    }

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

    const associatedSkills = (() => {
      if (Array.isArray(source?.system?.associatedSkills)) return [...source.system.associatedSkills];
      if (Array.isArray(drop.data?.system?.associatedSkills)) return [...drop.data.system.associatedSkills];
      return [];
    })();

    if (!source) return { label: drop.name || "", associatedSkills };

    let targetId = null;
    let createdName;

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

    if (!targetId) return { label: createdName ?? drop.name ?? "", associatedSkills };

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

  #applyViewDollsBonuses(viewDolls, viewDollsSkill, skills, ensureSkillAtLeast) {
    let humanityDelta = 0;
    let viewDollsNote = "";

    if (viewDolls === "favor") {
      humanityDelta += 5;
      viewDollsNote = "Views Dolls as partners (+5 Humanity)";
    } else if (viewDolls === "tools" && viewDollsSkill) {
      ensureSkillAtLeast(viewDollsSkill, 1);
      viewDollsNote = `Views Dolls as tools (Skill: ${GFL5R_CONFIG.getSkillLabel(viewDollsSkill)} to 1)`;
    }

    return { humanityDelta, viewDollsNote };
  }

  #applyNameOriginBonuses(nameOrigin, skills, ensureSkillAtLeast) {
    let humanityDelta = 0;
    let fameDelta = 0;

    switch (nameOrigin) {
      case "human":
        humanityDelta += 5;
        break;
      case "callsign":
        fameDelta += 5;
        break;
      case "weapon":
        ensureSkillAtLeast("firearms", (skills["firearms"] ?? 0) + 1);
        humanityDelta -= 5;
        break;
      case "weird":
        fameDelta -= 5;
        // +1 Upgrade Module point (not yet implemented in system)
        break;
      default:
        break;
    }

    return { humanityDelta, fameDelta };
  }

  #buildHumanNotes({
    nationalityLabel,
    backgroundLabel,
    disciplineLabel,
    advantageName,
    disadvantageName,
    passionName,
    anxietyName,
    viewDollsNote,
    goal,
    nameMeaning,
    storyEnd,
    additionalNotes
  }) {
    const notesPieces = [`Nationality: ${nationalityLabel}`, `Background: ${backgroundLabel}`];
    if (disciplineLabel) notesPieces.push(`Discipline: ${disciplineLabel}`);
    if (advantageName) notesPieces.push(`Advantage: ${advantageName}`);
    if (disadvantageName) notesPieces.push(`Disadvantage: ${disadvantageName}`);
    if (passionName) notesPieces.push(`Passion: ${passionName}`);
    if (anxietyName) notesPieces.push(`Anxiety: ${anxietyName}`);
    if (viewDollsNote) notesPieces.push(viewDollsNote);
    if (goal) notesPieces.push(`Goal: ${goal}`);
    if (nameMeaning) notesPieces.push(`Name meaning: ${nameMeaning}`);
    if (storyEnd) notesPieces.push(`Story end: ${storyEnd}`);
    if (additionalNotes) notesPieces.push(additionalNotes);

    return `Character Creation (Human)\n${notesPieces.join("\n")}`;
  }

  #buildTdollNotes({
    frame,
    disciplineLabel,
    nameOrigin,
    metCommander,
    goal,
    storyEnd,
    additionalNotes,
    advantageName,
    disadvantageName,
    passionName,
    anxietyName
  }) {
    const notesPieces = [`Frame: ${frame.manufacturer} ${frame.model}`];

    if (disciplineLabel) notesPieces.push(`Weapon Imprint: ${disciplineLabel}`);
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

    return `Character Creation (T-Doll)\n${notesPieces.join("\n")}`;
  }
}