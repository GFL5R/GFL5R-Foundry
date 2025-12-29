// module/actors.js
console.log("GFL5R | actors.js loaded");

import { GFL5R_CONFIG } from "./config.js";
import { computeDerivedStats } from "./utils/derived.js";
import { HUMAN_BACKGROUNDS, HUMAN_NATIONALITIES, TDOLL_FRAMES } from "./actor-data.js";
import { resolveItemFromDropData, getDragEventDataSafe } from "./utils/drop.js";

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

export class GFL5RActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "gfl5r-actor-sheet",
    classes: ["sheet", "actor"],
    position: { width: 1000, height: 720 },
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

  static get actions() {
    return {
      "roll-skill": "onRollSkillClick"
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

    context.collapse = this.#buildCollapse(context.approachesList, data);
    context.preparedState = this.#resolvePreparedState(data.prepared);

    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");

    context.originDisplay = this.#buildOriginDisplay(context.characterType, data);

    context.skills = data.skills ?? {};
    context.skillGroups = GFL5R_CONFIG.skillGroups;

    const { slots, disciplineAbilityIds, disciplineIds } = this.#buildDisciplineSlots(data.disciplines ?? {});
    context.disciplineSlots = slots;
    const collections = this.#buildItemCollections(disciplineAbilityIds, disciplineIds);
    context.abilities = collections.abilities;
    context.narrativePositive = collections.narrativePositive;
    context.narrativeNegative = collections.narrativeNegative;
    context.conditions = collections.conditions;
    context.weapons = collections.weapons;
    context.armor = collections.armor;
    context.modules = collections.modules;
    context.inventory = collections.inventory;

    return context;
  }

  #buildCollapse(approachesList, data) {
    const collapseCurrent = Number(data.resources?.collapse ?? 0);
    const totalApproaches = approachesList.reduce((sum, a) => sum + (Number(a.value ?? 0)), 0);
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

  #resolvePreparedState(preparedFlag) {
    const preparedDefaultSetting = game.settings.get("gfl5r", "initiative-prepared-character") || "true";
    if (typeof preparedFlag === "boolean") return preparedFlag;
    if (preparedFlag === "true") return true;
    if (preparedFlag === "false") return false;
    return preparedDefaultSetting === "true";
  }

  #buildOriginDisplay(characterType, data) {
    if (characterType === "human" && (data.nationality || data.background)) {
      const nat = HUMAN_NATIONALITIES.find(n => n.key === data.nationality);
      const bg = HUMAN_BACKGROUNDS.find(b => b.key === data.background);
      const parts = [];
      if (nat) parts.push(nat.label);
      if (bg) parts.push(bg.label);
      return parts.join(" • ");
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

  #buildDisciplineSlots(disciplinesData) {
    const slots = [];
    const disciplineAbilityIds = new Set();
    const disciplineIds = new Set();

    for (let i = 1; i <= GFL5R_CONFIG.maxDisciplineSlots; i++) {
      const slotKey = `slot${i}`;
      const slotData = disciplinesData[slotKey] ?? { disciplineId: null, xp: 0, rank: 1, abilities: [] };

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

      if (disciplineItem) disciplineIds.add(disciplineItem.id);
      disciplineAbilities.forEach((ability) => disciplineAbilityIds.add(ability.id));

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

    return { slots, disciplineAbilityIds, disciplineIds };
  }

  #buildItemCollections(disciplineAbilityIds, disciplineIds) {
    const items = this.actor.items ?? [];
    const abilities = items
      .filter(i => i.type === "ability" && !disciplineAbilityIds.has(i.id))
      .map(i => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));

    const narrativeItems = items.filter(i => i.type === "narrative");
    const narrativePositive = narrativeItems
      .filter(i => i.system.narrativeType === "distinction" || i.system.narrativeType === "passion")
      .map(i => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));
    const narrativeNegative = narrativeItems
      .filter(i => i.system.narrativeType === "adversity" || i.system.narrativeType === "anxiety")
      .map(i => ({ id: i.id, name: i.name, img: i.img, system: i.system ?? {} }));

    const conditions = items.filter(i => i.type === "condition").map(i => ({
      id: i.id, name: i.name, img: i.img, system: i.system ?? {}
    }));
    const weapons = items.filter(i => i.type === "weaponry").map(i => ({
      id: i.id, name: i.name, img: i.img, system: i.system ?? {}
    }));
    const armor = items.filter(i => i.type === "armor").map(i => ({
      id: i.id, name: i.name, img: i.img, system: i.system ?? {}
    }));
    const modules = items.filter(i => i.type === "module").map(i => ({
      id: i.id, name: i.name, img: i.img, system: i.system ?? {}
    }));

    const inventory = items
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

    return { abilities, narrativePositive, narrativeNegative, conditions, weapons, armor, modules, inventory };
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

    // Fallback delegations for skill clicks so we can see events even if V2 wiring fails
    root.addEventListener("click", (event) => {
      const nav = event.target.closest(".nav-link[data-tab]");
      if (nav && root.contains(nav)) {
        event.preventDefault();
        this.activateTab(nav.dataset.tab);
        return;
      }

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
        this.#flashSkillCard(skillCard, true);
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

  #resolveDropTarget(event) {
    const dropAbilities = event.target?.closest?.("[data-drop-target='abilities']");
    const dropNarrativePos = event.target?.closest?.("[data-drop-target='narrative-positive']");
    const dropNarrativeNeg = event.target?.closest?.("[data-drop-target='narrative-negative']");
    const dropInventory = event.target?.closest?.("[data-drop-target='inventory']");
    const dropModules = event.target?.closest?.("[data-drop-target='modules']");
    const dropCondition = event.target?.closest?.("[data-drop-target='condition']");
    const dropDiscipline = event.target?.closest?.("[data-drop-target='discipline']");
    const dropDisciplineAbility = event.target?.closest?.("[data-drop-target='discipline-ability']");

    const dropTarget =
      dropAbilities || dropNarrativePos || dropNarrativeNeg || dropInventory || dropModules || dropCondition || dropDiscipline || dropDisciplineAbility;

    return {
      dropTarget,
      dropAbilities,
      dropNarrativePos,
      dropNarrativeNeg,
      dropInventory,
      dropModules,
      dropCondition,
      dropDiscipline,
      dropDisciplineAbility
    };
  }

  async #handleDisciplineDrop(dropTarget, itemDoc, rawItemData) {
    const slotKey = dropTarget?.dataset?.slotKey;
    if (!slotKey) return;

    const itemData = itemDoc.toObject?.() ?? foundry.utils.duplicate(rawItemData) ?? {};
    itemData.type = "discipline";

    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    disciplines[slotKey] ??= { disciplineId: null, xp: 0, rank: 1, abilities: [] };

    const toDelete = [];
    if (disciplines[slotKey].disciplineId) {
      const oldDiscipline = this.actor.items.get(disciplines[slotKey].disciplineId);
      if (oldDiscipline) toDelete.push(disciplines[slotKey].disciplineId);
    }
    if (disciplines[slotKey].abilities?.length) {
      disciplines[slotKey].abilities.forEach((abilityId) => {
        if (this.actor.items.get(abilityId)) toDelete.push(abilityId);
      });
    }
    if (toDelete.length) {
      await this.actor.deleteEmbeddedDocuments("Item", toDelete);
    }

    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!createdItem) return;

    disciplines[slotKey].disciplineId = createdItem.id;
    disciplines[slotKey].abilities = [];
    await this.actor.update({ "system.disciplines": disciplines });

    this.#flashDropTarget(dropTarget);
  }

  async #handleDisciplineAbilityDrop(dropTarget, itemDoc) {
    const slotKey = dropTarget?.dataset?.slotKey;
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

    const itemData = itemDoc.toObject?.() ?? {};
    itemData.type = "ability";

    const [createdItem] = await this.actor.createEmbeddedDocuments("Item", [itemData]);
    if (!createdItem) return;

    disciplines[slotKey].abilities ||= [];
    disciplines[slotKey].abilities.push(createdItem.id);

    const updatedXP = Number(disciplines[slotKey].xp ?? 0) + cost;
    disciplines[slotKey].xp = updatedXP;
    disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(updatedXP);

    await this.actor.update({
      "system.xp": availableXP - cost,
      "system.disciplines": disciplines
    });

    this.#flashDropTarget(dropTarget);
  }

  #prepareGenericDropItem(itemDoc, rawItemData, dropCtx) {
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

    this.#flashDropTarget(dropCtx.dropTarget);
    return itemData;
  }

  #flashDropTarget(el) {
    if (!el) return;
    el.classList.add("border", "border-success", "bg-success-subtle");
    setTimeout(() => el.classList.remove("border-success", "bg-success-subtle"), 400);
  }

  /** Accept dropped Items (from compendia or sidebar) into the drop zones */
  async _onDrop(event) {
    sheetDebug("ActorSheet#_onDrop", { target: event.target?.dataset?.dropTarget });
    const data = getDragEventDataSafe(event);
    const dropCtx = this.#resolveDropTarget(event);
    if (!dropCtx.dropTarget) return super._onDrop(event);

    const { item: itemDoc, itemData: rawItemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or compendium.");
      return;
    }

    if (dropCtx.dropDiscipline) {
      await this.#handleDisciplineDrop(dropCtx.dropTarget, itemDoc, rawItemData);
      return;
    }

    if (dropCtx.dropDisciplineAbility) {
      await this.#handleDisciplineAbilityDrop(dropCtx.dropTarget, itemDoc);
      return;
    }

    const itemData = this.#prepareGenericDropItem(itemDoc, rawItemData, dropCtx);
    if (!itemData) return;

    await this.actor.createEmbeddedDocuments("Item", [itemData]);
    this.#flashDropTarget(dropCtx.dropTarget);
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
