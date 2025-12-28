// GFL5R Dice Picker Dialog (Application V2)
import { GFL5R_CONFIG } from "./config.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const getSystemId = () => CONFIG?.system?.id ?? game?.system?.id ?? "gfl5r";

export class GFLDicePickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor || null;
    this.skillKey = options.skillKey || "";
    this.skillLabel = options.skillLabel || "";
    this.skillList = Array.isArray(options.skillList) ? options.skillList : options.skillList ? String(options.skillList).split(",").map((s) => s.trim()).filter(Boolean) : null;
    this.skillCatId = options.skillCatId || "";
    this.approaches = options.approaches || {};
    this.defaultTN = options.defaultTN ?? 2;
    this.defaultApproach = options.defaultApproach || Object.keys(this.approaches || {})[0] || "";
    this.defaultHiddenTN = options.defaultHiddenTN ?? false;
    this.lockHiddenTN = options.lockHiddenTN ?? false;
    this.isInitiativeRoll = !!options.isInitiativeRoll;
    this.baseInitiative = options.baseInitiative ?? 0;
    this.initiativeCombatantId = options.initiativeCombatantId ?? null;
    this.item = options.item || null;
    this.itemUuid = options.itemUuid || null;
    this.target = options.target || null;
    this.targetUuid = options.targetUuid || null;
    this.onComplete = typeof options.onComplete === "function" ? options.onComplete : null;
    this._completed = false;
    this._hiddenAwarded = false;

    this._normalizeCat = (s) => (s || "").toString().toLowerCase().replace(/[^a-z0-9]/g, "");

    // Local adjustments (let user tweak dice without changing actor)
    this.ringAdjust = 0;
    this.skillAdjust = 0;
    this.assistance = 0;

    // Build skill options from config, optionally constrained by provided list
    const targetCat = this._normalizeCat(this.skillCatId);
    const allSkills = Array.isArray(GFL5R_CONFIG?.skillGroups)
      ? GFL5R_CONFIG.skillGroups.flatMap((grp) => {
          const grpSlug = this._normalizeCat(grp.title);
          return grp.items.map((item) => ({ key: item.key, label: item.label, group: grp.title, groupSlug: grpSlug }));
        })
      : [];
    if (this.skillList && !Array.isArray(this.skillList[0])) {
      const keys = this.skillList.map((s) => (typeof s === "string" ? s : s.key || s.id)).filter(Boolean);
      this.skillList = allSkills.filter((s) => keys.includes(s.key));
    } else if (!this.skillList || this.skillList.length === 0) {
      this.skillList = targetCat ? allSkills.filter((s) => s.groupSlug === targetCat) : allSkills;
    } else if (targetCat) {
      this.skillList = this.skillList.filter((s) => this._normalizeCat(s.group || "") === targetCat);
    }

    // Default skill from list if provided
    if (!this.skillKey && this.skillList?.length) {
      this.skillKey = this.skillList[0].key || this.skillList[0].id || "";
      this.skillLabel = this.skillList[0].label || this.skillLabel;
    }

    const assignCategoryFromSkill = () => {
      const found = this.skillList?.find((s) => s.key === this.skillKey || s.id === this.skillKey);
      if (found) {
        this.skillLabel ||= found.label || this.skillLabel;
        this.skillCatId ||= found.groupSlug || found.groupId || this._normalizeCat(found.group || "");
      }
    };
    assignCategoryFromSkill();

    // Resolve item/target from uuid or current selection
    if (!this.item && this.itemUuid) {
      try {
        const it = fromUuidSync(this.itemUuid);
        if (it) this.item = it;
      } catch (err) {
        console.warn("GFL5R | Unable to resolve item uuid", err);
      }
    }
    if (!this.target && this.targetUuid) {
      try {
        const t = fromUuidSync(this.targetUuid);
        if (t) this.target = t;
      } catch (err) {
        console.warn("GFL5R | Unable to resolve target uuid", err);
      }
    }
    if (!this.target) {
      const targetToken = Array.from(game.user.targets).values().next()?.value?.document;
      if (targetToken) this.target = targetToken;
      // Fallback to actor's controlled/linked token if no explicit target
      if (!this.target && this.actor) {
        const actorTokens = this.actor.getActiveTokens?.() || [];
        const firstTok = actorTokens.find((t) => !!t.document)?.document;
        if (firstTok) this.target = firstTok;
      }
    }

    // If an item was provided and has a skill, use it as default
    if (this.item?.system?.skill && !this.skillKey) {
      this.skillKey = this.item.system.skill;
      this.skillLabel = this.item.name || this.skillLabel;
    }
    assignCategoryFromSkill();
  }

  static DEFAULT_OPTIONS = {
    id: "gfl5r-dice-picker-dialog",
    classes: ["sheet", "gfl5r", "dice-picker-dialog"],
    window: { title: "Roll Dice", resizable: true },
    position: { width: 420, height: "auto" },
  };

  static PARTS = {
    picker: {
      template: `systems/${getSystemId()}/templates/dice/dice-picker-dialog.html`,
      scrollable: []
    }
  };

  static get eventListeners() {
    return [
      { event: "submit", selector: "form", callback: "onSubmit", preventDefault: true, stopPropagation: true },
      { event: "click", selector: "[data-action='ring-minus']", callback: "onRingMinus" },
      { event: "click", selector: "[data-action='ring-plus']", callback: "onRingPlus" },
      { event: "click", selector: "[data-action='skill-minus']", callback: "onSkillMinus" },
      { event: "click", selector: "[data-action='skill-plus']", callback: "onSkillPlus" },
      { event: "click", selector: "[data-action='assist-minus']", callback: "onAssistMinus" },
      { event: "click", selector: "[data-action='assist-plus']", callback: "onAssistPlus" },
      { event: "change", selector: "#roll-approach", callback: "onApproachChange" },
      { event: "change", selector: "#roll-skill", callback: "onSkillChange" },
    ];
  }

  async _prepareContext() {
    const skillOptions = Array.isArray(this.skillList)
      ? this.skillList.map((s) => ({
          key: s.key || s.id,
          label: s.label || GFL5R_CONFIG.getSkillLabel?.(s.key || s.id) || (s.key || s.id),
          group: s.group || "",
          groupId: s.groupSlug || s.groupId || this._normalizeCat(s.group || ""),
        }))
      : null;

    const ringValue = Math.max(
      0,
      Number(this.approaches?.[this.defaultApproach] ?? 0) + this.ringAdjust
    );
    const skillValue = Math.max(
      0,
      Number(this.actor?.system?.skills?.[this.skillKey] ?? 0) + this.skillAdjust
    );

    const approachList = Object.entries(this.approaches || {}).map(([key, value]) => ({
      key,
      label: GFL5R_CONFIG.getApproachLabel?.(key) || (key.charAt(0).toUpperCase() + key.slice(1)),
      value: Number(value || 0),
    }));

    return {
      skillLabel: this.skillLabel || this.skillKey,
      skillKey: this.skillKey,
      skillOptions,
      approachList,
      defaultApproach: this.defaultApproach,
      defaultTN: this.defaultTN,
      ringValue,
      skillValue,
      assistance: this.assistance,
      defaultHiddenTN: this.defaultHiddenTN,
      hiddenLocked: this.lockHiddenTN,
      hiddenChecked: this.defaultHiddenTN || this.lockHiddenTN,
    };
  }

  // V2 event callbacks
  onSubmit(ev) {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    const form = ev?.currentTarget ?? ev?.target?.closest?.("form");
    const data = form ? foundry.utils.expandObject(Object.fromEntries(new FormData(form).entries())) : {};
    console.log("GFL5R | Dice picker onSubmit", { data });
    this._updateObject(ev, data);
    return false;
  }
  onRingMinus(ev) { ev.preventDefault(); this.ringAdjust = Math.max(this.ringAdjust - 1, -9); this.render(false); }
  onRingPlus(ev) { ev.preventDefault(); this.ringAdjust = Math.min(this.ringAdjust + 1, 9); this.render(false); }
  onSkillMinus(ev) { ev.preventDefault(); this.skillAdjust = Math.max(this.skillAdjust - 1, -9); this.render(false); }
  onSkillPlus(ev) { ev.preventDefault(); this.skillAdjust = Math.min(this.skillAdjust + 1, 9); this.render(false); }
  onAssistMinus(ev) { ev.preventDefault(); this.assistance = Math.max(this.assistance - 1, 0); this.render(false); }
  onAssistPlus(ev) { ev.preventDefault(); this.assistance = Math.min(this.assistance + 1, 9); this.render(false); }
  onApproachChange(ev) { this.defaultApproach = ev.currentTarget.value; this.render(false); }
  onSkillChange(ev) {
    this.skillKey = ev.currentTarget.value;
    const found = this.skillList?.find((s) => s.key === this.skillKey || s.id === this.skillKey);
    if (found) {
      this.skillLabel = found.label || this.skillLabel;
      this.skillCatId = found.groupSlug || found.groupId || this._normalizeCat(found.group || this.skillCatId || "");
    }
    this.render(false);
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    const root = html instanceof HTMLElement ? html : html?.[0];
    const form = root?.querySelector?.("form");
    if (form) {
      const handler = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        console.log("GFL5R | Dice picker submit intercepted", ev);
        this.onSubmit(ev);
        return false;
      };
      form.addEventListener("submit", handler, { capture: true });
    }
    // Global capture as last resort to stop navigation
    this._globalSubmitHandler = (ev) => {
      if (!(ev.target instanceof HTMLFormElement)) return;
      if (!root || !root.contains(ev.target)) return;
      ev.preventDefault();
      ev.stopPropagation();
      console.log("GFL5R | Dice picker global submit intercepted", ev);
      this.onSubmit(ev);
      return false;
    };
    window.addEventListener("submit", this._globalSubmitHandler, true);
  }

  async _updateObject(event, formData) {
    console.log("GFL5R | Dice picker _updateObject", { formData });
    if (!this.actor || !this.skillKey) {
      await this._finish();
      return;
    }
    const approachName = formData.approach || this.defaultApproach || "";
    const tnHidden =
      this.lockHiddenTN ||
      formData.hiddenTN === "on" ||
      formData.hiddenTN === true ||
      formData.hiddenTN === "true";
    const tnVal = Number(formData.tn || 0);
    const useFortune = formData.useFortune === "on" || formData.useFortune === true || formData.useFortune === "true";

    const approaches = this.actor.system?.approaches ?? {};
    const approachVal = Math.max(0, Number(approaches[approachName] ?? 0) + this.ringAdjust);
    const skillVal = Math.max(0, Number(this.actor.system?.skills?.[this.skillKey] ?? 0) + this.skillAdjust);
    const assistanceVal = Math.max(0, Number(this.assistance || 0));

    // Hidden TN grants +1 Fortune (matches previous behavior), cap at max (fortune approach or stored max)
    if (tnHidden && !this._hiddenAwarded) {
      const currentFortune = Number(this.actor.system?.resources?.fortunePoints ?? 0);
      const fortuneMax =
        Number(this.actor.system?.resources?.fortunePointsMax ?? 0) ||
        Number(this.actor.system?.approaches?.fortune ?? 0) ||
        0;
      const nextFortune = fortuneMax ? Math.min(fortuneMax, currentFortune + 1) : currentFortune + 1;
      if (nextFortune !== currentFortune) {
        await this.actor.update({ "system.resources.fortunePoints": nextFortune });
      }
      ui.notifications?.info("Hidden TN: +1 Fortune Point gained.");
      this._hiddenAwarded = true;
    }

    // Optional Fortune spend acts like Void (+1 ring die, increases keep) but don't go below 0
    if (useFortune) {
      const currentFortune = Number(this.actor.system?.resources?.fortunePoints ?? 0);
      if (currentFortune > 0) {
        await this.actor.update({ "system.resources.fortunePoints": Math.max(0, currentFortune - 1) });
      } else {
        ui.notifications?.warn("No Fortune points left; applying spend anyway.");
      }
    }

    const ringDice = Math.max(0, approachVal + (useFortune ? 1 : 0));
    const skillDice = Math.max(0, skillVal);
    const keepBonus = assistanceVal;

    const parts = [];
    if (ringDice > 0) parts.push(`${ringDice}dr[${approachName}]`);
    if (skillDice > 0) parts.push(`${skillDice}ds[${this.skillKey}]`);
    const formula = parts.join(" + ") || "0";

    const roll = new game.gfl5r.RollGFL5R(formula);
    roll.actor = this.actor;
    if (this.item) roll.gfl5r.item = this.item;
    else if (this.itemUuid) roll.gfl5r.item = { uuid: this.itemUuid };
    if (this.target) roll.gfl5r.target = this.target;
    else if (this.targetUuid) roll.gfl5r.target = { uuid: this.targetUuid };
    roll.gfl5r.difficulty = tnVal;
    roll.gfl5r.difficultyHidden = tnHidden;
    roll.gfl5r.skillId = this.skillKey;
    roll.gfl5r.skillCatId = this.skillCatId || "";
    roll.gfl5r.stance = approachName;
    roll.gfl5r.voidPointUsed = useFortune;
    roll.gfl5r.skillAssistance = assistanceVal;
    if (keepBonus > 0) {
      roll.gfl5r.keepLimit = (roll.gfl5r.keepLimit || ringDice) + keepBonus;
    }
    if (this.isInitiativeRoll) {
      roll.gfl5r.isInitiativeRoll = true;
      roll.gfl5r.baseInitiative = this.baseInitiative || 0;
      roll.gfl5r.initiativeCombatantId = this.initiativeCombatantId || null;
    }

    if (this.isInitiativeRoll && this.actor?.system?.stance !== undefined) {
      try {
        await this.actor.update({ "system.stance": approachName });
      } catch (err) {
        console.warn("GFL5R | Unable to update stance", err);
      }
    }

    const flavor = `<strong>${this.actor.name}</strong> rolls <em>${this.skillLabel || this.skillKey}</em> with <em>${approachName}</em>`;
    console.log("GFL5R | Dice picker sending roll", { formula, flavor, difficulty: tnVal, tnHidden, keepBonus, ringDice, skillDice });
    await roll.toMessage({ flavor });
    console.log("GFL5R | Dice picker roll sent");
    await this._finish();
  }

  async close(options) {
    await this._finish();
    return super.close(options);
  }

  /**
   * Avoid positioning before the element is attached to the DOM.
   */
  setPosition(opts = {}) {
    if (!this.element || !this.element.parentElement) return this;
    return super.setPosition(opts);
  }

  /**
   * Guard position updates when element is not yet in DOM (prevents null offsetWidth errors).
   */
  _updatePosition(...args) {
    if (!this.element || !this.element.parentElement) return;
    try {
      return super._updatePosition(...args);
    } catch (err) {
      console.warn("GFL5R | Picker position update skipped", err);
      return this;
    }
  }

  async _finish() {
    if (this._completed) return;
    if (this._globalSubmitHandler) {
      window.removeEventListener("submit", this._globalSubmitHandler, true);
      this._globalSubmitHandler = null;
    }
    this._completed = true;
    if (this.onComplete) {
      try {
        await this.onComplete();
      } catch (err) {
        console.warn("GFL5R | dice picker onComplete callback error", err);
      }
    }
  }
}
