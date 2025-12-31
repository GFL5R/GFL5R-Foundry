// module/sheets/actor-sheets.js
import { GFL5R_CONFIG } from "../config.js";
import { computeDerivedStats } from "../utils/derived.js";
import { resolveItemFromDropData, getDragEventDataSafe } from "../utils/drop.js";
import { CharacterBuilderApp } from "../character-builder.js";
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

const { HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;
const ActorSheet = foundry.appv1.sheets.ActorSheet;

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

export class GFL5RActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    id: "gfl5r-actor-sheet",
    classes: ["sheet", "actor"],
    position: { width: 1000, height: 720 },
    tag: "form",
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
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

  async onDeleteItemClick(ev) {
    const id = ev.currentTarget?.dataset?.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (!item) return;
    const confirmed = await DialogV2.confirm({
      window: { title: "Delete Item" },
      content: `<p>Are you sure you want to delete ${item.name}?</p>`,
      rejectClose: false,
      modal: true
    });
    if (confirmed) {
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    }
  }

  onEditItemClick(ev) {
    const id = ev.currentTarget?.dataset?.itemId;
    if (!id) return;
    const item = this.actor.items.get(id);
    if (item) item.sheet.render(true);
  }

  onRemoveDisciplineClick(ev) {
    const slotKey = ev.currentTarget?.dataset?.slotKey;
    if (!slotKey) return;
    const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});
    if (disciplines[slotKey]) {
      delete disciplines[slotKey];
      this.actor.update({ "system.disciplines": disciplines });
    }
  }

  async onRemoveDisciplineAbilityClick(ev) {
    const abilityId = ev.currentTarget?.dataset?.abilityId;
    if (!abilityId) return;
    const item = this.actor.items.get(abilityId);
    if (!item) return;

    const confirmed = await DialogV2.confirm({
      window: { title: "Remove Ability" },
      content: `<p>Are you sure you want to remove ${item.name}? This will refund 3 XP.</p>`,
      rejectClose: false,
      modal: true
    });

    if (confirmed) {
      const disciplines = foundry.utils.duplicate(this.actor.system.disciplines ?? {});

      // Find the discipline slot containing this ability
      let slotKey = null;
      for (const key in disciplines) {
        if (disciplines[key].abilities?.includes(abilityId)) {
          slotKey = key;
          break;
        }
      }

      if (slotKey) {
        // Remove the ability from the discipline's abilities array
        disciplines[slotKey].abilities = disciplines[slotKey].abilities.filter(id => id !== abilityId);

        // Subtract 3 XP from the discipline
        const currentDisciplineXP = Number(disciplines[slotKey].xp ?? 0);
        const newDisciplineXP = Math.max(0, currentDisciplineXP - 3);
        disciplines[slotKey].xp = newDisciplineXP;
        disciplines[slotKey].rank = GFL5R_CONFIG.getRankFromXP(newDisciplineXP);
      }

      // Refund XP for abilities (always 3 XP)
      const xpCost = 3;
      const currentXP = Number(this.actor.system.xp ?? 0);
      const newXP = currentXP + xpCost;

      await this.actor.update({
        "system.xp": newXP,
        "system.disciplines": disciplines
      });
      console.log(`GFL5R | Refunded ${xpCost} XP for removing ability ${item.name} and updated discipline XP`);

      // Delete the item
      return this.actor.deleteEmbeddedDocuments("Item", [abilityId]);
    }
  }

  static get eventListeners() {
    return [
      { event: "click", selector: "[data-action='roll-skill']", callback: "onRollSkillClick", part: "sheet" },
      { event: "click", selector: "[data-skill-card]", callback: "onSkillCardClick", part: "sheet" },
      { event: "click", selector: "[data-item-id][data-action='delete-item']", callback: "onDeleteItemClick", part: "sheet" },
      { event: "click", selector: "[data-item-id][data-action='edit-item']", callback: "onEditItemClick", part: "sheet" },
      { event: "click", selector: "[data-action='open-character-builder']", callback: "onOpenCharacterBuilder", part: "sheet" },
      { event: "click", selector: "[data-action='remove-discipline']", callback: "onRemoveDisciplineClick", part: "sheet" },
      { event: "click", selector: "[data-action='remove-discipline-ability']", callback: "onRemoveDisciplineAbilityClick", part: "sheet" },
    ];
  }

  #renderAbort = null;

  async _prepareContext(options) {
    sheetDebug("ActorSheet#_prepareContext", { actor: this.actor?.id, name: this.actor?.name });
    const context = (await super._prepareContext(options)) ?? {};
    const actor = this.document ?? this.actor;
    context.actor = actor;
    const data = actor?.system ?? {};

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

      const builderBtn = event.target.closest?.("[data-action='open-character-builder']");
      if (builderBtn && root.contains(builderBtn)) {
        event.preventDefault();
        this.#openCharacterBuilder();
        return;
      }

      const deleteBtn = event.target.closest?.("[data-action='delete-item']");
      if (deleteBtn && root.contains(deleteBtn)) {
        event.preventDefault();
        this.onDeleteItemClick({ currentTarget: deleteBtn });
        return;
      }

      const removeDisciplineBtn = event.target.closest?.("[data-action='remove-discipline']");
      if (removeDisciplineBtn && root.contains(removeDisciplineBtn)) {
        event.preventDefault();
        this.onRemoveDisciplineClick({ currentTarget: removeDisciplineBtn });
        return;
      }

      const removeAbilityBtn = event.target.closest?.("[data-action='remove-discipline-ability']");
      if (removeAbilityBtn && root.contains(removeAbilityBtn)) {
        event.preventDefault();
        this.onRemoveDisciplineAbilityClick({ currentTarget: removeAbilityBtn });
        return;
      }

      const btn = event.target.closest?.("[data-action='roll-skill']");
      if (btn && root.contains(btn)) {
        const key = btn.dataset.skill;
        const label = (btn.textContent || "").trim() || key;
        const card = btn.closest?.("[data-skill-card]");
        const item = card?.dataset.itemId ? this.actor.items.get(card.dataset.itemId) : null;
        const weapon = item && item.type === 'weaponry' ? item : null;
        console.log("GFL5R | Skill click (delegate button)", { key, label, weapon: weapon?.name });
        if (key) this.#rollSkill(key, label, weapon);
      }

      const card = event.target.closest?.("[data-skill-card]");
      if (card && root.contains(card) && !event.target.closest("button")) {
        const key = card.dataset.skillKey;
        const label = card.querySelector("[data-action='roll-skill']")?.textContent?.trim() || key;
        const item = card.dataset.itemId ? this.actor.items.get(card.dataset.itemId) : null;
        const weapon = item && item.type === 'weaponry' ? item : null;
        console.log("GFL5R | Skill click (delegate card)", { key, label, weapon: weapon?.name });
        if (key) this.#rollSkill(key, label, weapon);
      }
    }, { signal });

    // Spend or refund XP on an approach (ring)
    root.addEventListener("click", async (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl || !root.contains(actionEl)) return;

      const action = actionEl.dataset.action;
      if (action !== "approach-increase" && action !== "approach-decrease") return;

      event.preventDefault();
      event.stopPropagation();

      const approachKey = actionEl.dataset.approach;
      const delta = action === "approach-increase" ? 1 : -1;
      const card = actionEl.closest("[data-approach-card]");

      await this.#adjustApproachRank(approachKey, delta, card);
    }, { signal });

    // Spend or refund XP on a skill
    root.addEventListener("click", async (event) => {
      const actionEl = event.target.closest("[data-action]");
      if (!actionEl || !root.contains(actionEl)) return;

      const action = actionEl.dataset.action;
      if (action !== "skill-increase" && action !== "skill-decrease") return;

      event.preventDefault();
      event.stopPropagation();

      const skillKey = actionEl.dataset.skill;
      const delta = action === "skill-increase" ? 1 : -1;
      const skillCard = actionEl.closest("[data-skill-card]");

      await this.#adjustSkillRank(skillKey, delta, skillCard);
    }, { signal });

    root.addEventListener("change", async (event) => {
      const target = event.target;
      const action = target.dataset?.action;

      // Persist free-typed XP immediately so refreshes keep the value
      if (!action && target.name === "system.xp") {
        const xp = Number(target.value) || 0;
        await this.actor.update({ "system.xp": xp });
        return;
      }

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

    // Drop handling is done by the parent's listener calling our _onDrop
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

  async #adjustApproachRank(approachKey, delta, card) {
    if (!approachKey || !delta) return;

    const approaches = foundry.utils.duplicate(this.actor.system.approaches ?? {});
    const currentRank = Number(approaches[approachKey] ?? 0);

    if (delta < 0 && currentRank <= 0) {
      this.#flashSkillCard(card, true);
      return;
    }

    const nextRank = Math.max(0, currentRank + delta);
    if (nextRank === currentRank) return;

    const availableXP = this.#getAvailableXP();
    const xpDelta = delta > 0 ? 3 * nextRank : -3 * currentRank; // ring costs 3 x new rank

    if (delta > 0 && availableXP < xpDelta) {
      this.#flashSkillCard(card, true);
      ui.notifications?.warn("Not enough XP to increase this approach.");
      return;
    }

    approaches[approachKey] = nextRank;

    const updateData = {
      "system.approaches": approaches,
      "system.xp": availableXP - xpDelta,
    };

    await this.actor.update(updateData);
    this.#flashSkillCard(card, false);
  }

  async #adjustSkillRank(skillKey, delta, skillCard) {
    if (!skillKey || !delta) return;

    const skills = foundry.utils.duplicate(this.actor.system.skills ?? {});
    const currentRank = Number(skills[skillKey] ?? 0);

    if (delta < 0 && currentRank <= 0) {
      this.#flashSkillCard(skillCard, true);
      return;
    }

    const nextRank = Math.max(0, currentRank + delta);
    if (nextRank === currentRank) return;

    const availableXP = this.#getAvailableXP();
    const xpDelta = delta > 0 ? 2 * nextRank : -2 * currentRank; // cost (positive) or refund (negative)

    if (delta > 0 && availableXP < xpDelta) {
      this.#flashSkillCard(skillCard, true);
      ui.notifications?.warn("Not enough XP to increase this skill.");
      return;
    }

    skills[skillKey] = nextRank;

    const updateData = {
      "system.skills": skills,
      "system.xp": availableXP - xpDelta,
    };

    await this.actor.update(updateData);
    this.#flashSkillCard(skillCard, false);
  }

  #getAvailableXP() {
    const formXP = this.element?.querySelector?.("[name='system.xp']")?.value;
    const parsed = Number(formXP);
    return Number.isNaN(parsed) ? Number(this.actor.system?.xp ?? 0) : parsed;
  }

  async #rollSkill(key, skillLabel, weapon = null) {
    const approaches = this.actor.system?.approaches ?? {};
    const { GFLDicePickerDialog } = await import("../dice-picker-dialog.js");
    const pickerOpts = {
      actor: this.actor,
      skillKey: key,
      skillLabel,
      approaches,
      defaultTN: 2,
      defaultApproach: Object.keys(approaches || {})[0],
      weapon
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
    await this.#rollSkill(key, label, null);
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
    await this.#rollSkill(key, label, null);
  }

  onOpenCharacterBuilder(event) {
    event?.preventDefault?.();
    this.#openCharacterBuilder();
  }

  #openCharacterBuilder() {
    try {
      const app = new CharacterBuilderApp(this.actor);
      app.render(true);
    } catch (err) {
      console.error("GFL5R | Failed to open character builder", err);
      ui.notifications?.error("Could not open character builder. Check console for details.");
    }
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
      const weapon = item.type === "weaponry" ? item : null;
      await this.#rollSkill(item.system.skill, item.name, weapon);
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
    tag: "form",
    form: {
      submitOnChange: true,
      closeOnSubmit: false
    },
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
    context.actor = actor;
    const data = actor?.system ?? {};

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