// module/sheets/actor-sheets.js
import { GFL5R_CONFIG } from "../config.js";
import { computeDerivedStats } from "../utils/derived.js";
import { resolveItemFromDropData, getDragEventDataSafe } from "../utils/drop.js";
import { buildCollapse, resolvePreparedState, buildOriginDisplay, buildDisciplineSlots, buildItemCollections } from "./actor-sheet-data.js";
import {
  resolveDropTarget,
  handleDisciplineDrop,
  handleDisciplineAbilityDrop,
  prepareGenericDropItem,
  flashDropTarget,
} from "./actor-sheet-drops.js";

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

    context.collapse = buildCollapse(context.approachesList, data);
    context.preparedState = resolvePreparedState(data.prepared);

    context.characterType = data.characterType ?? "human";
    context.showModules = (context.characterType === "doll" || context.characterType === "transhumanist");

    context.originDisplay = buildOriginDisplay(context.characterType, data);

    context.skills = data.skills ?? {};
    context.skillGroups = GFL5R_CONFIG.skillGroups;

    const { slots, disciplineAbilityIds, disciplineIds } = buildDisciplineSlots(this.actor, data.disciplines ?? {});
    context.disciplineSlots = slots;
    const collections = buildItemCollections(this.actor, disciplineAbilityIds, disciplineIds);
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

  _onRender(...args) {
    super._onRender?.(...args);
    const root = this.element;
    if (!root) return;
    const html = $(root);

    this.#renderAbort?.abort();
    this.#renderAbort = new AbortController();
    const { signal } = this.#renderAbort;

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
    const { GFLDicePickerDialog } = await import("../dice-picker-dialog.js");
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

  /** Accept dropped Items (from compendia or sidebar) into the drop zones */
  async _onDrop(event) {
    sheetDebug("ActorSheet#_onDrop", { target: event.target?.dataset?.dropTarget });
    const data = getDragEventDataSafe(event);
    const dropCtx = resolveDropTarget(event);
    if (!dropCtx.dropTarget) return super._onDrop(event);

    const { item: itemDoc, itemData: rawItemData } = await resolveItemFromDropData(data);
    if (!itemDoc) {
      ui.notifications?.warn("Drop an Item from the sidebar or compendium.");
      return;
    }

    if (dropCtx.dropDiscipline) {
      await handleDisciplineDrop(this.actor, dropCtx.dropTarget, itemDoc, rawItemData);
      return;
    }

    if (dropCtx.dropDisciplineAbility) {
      await handleDisciplineAbilityDrop(this.actor, dropCtx.dropTarget, itemDoc, this.#getAvailableXP());
      return;
    }

    const itemData = prepareGenericDropItem(itemDoc, rawItemData, dropCtx);
    if (!itemData) return;

    await this.actor.createEmbeddedDocuments("Item", [itemData]);
    flashDropTarget(dropCtx.dropTarget);
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

console.log("GFL5R | actor-sheets.js loaded");
