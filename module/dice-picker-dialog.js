// module/dice-picker-dialog.js
// Lightweight picker dialog for selecting approach, TN, and bonus dice.

import { GFL5R_CONFIG } from "./config.js";
import { rollRingDie, rollSkillDie } from "./dice.js";
import { GFLDiceResultWindow } from "./roll-keep-window.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

export class GFLDicePickerDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.actor = options.actor ?? null;
    this.skillKey = options.skillKey ?? "";
    const resolvedLabel = options.skillLabel?.label ?? options.skillLabel ?? GFL5R_CONFIG.getSkillLabel?.(this.skillKey) ?? this.skillKey;
    this.skillLabel = String(resolvedLabel ?? "");
    this.approaches = options.approaches ?? {};
    this.weapon = options.weapon ?? null;

    const defaultApproach = options.defaultApproach || Object.keys(this.approaches)[0] || "";
    const defaultTN = Number.isFinite(options.defaultTN) ? Number(options.defaultTN) : 2;

    this.#state = {
      selectedApproach: defaultApproach,
      tn: Math.max(0, defaultTN),
      bonusApproachDice: 0,
      bonusSkillDice: 0
    };

    this.onComplete = typeof options.onComplete === "function" ? options.onComplete : null;
  }

  #completed = false;
  #renderAbort = null;
  #state;

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "gfl5r-dice-picker",
      classes: ["gfl5r", "dialog", "dice-picker"],
      tag: "form",
      resizable: false,
      width: 460,
      height: "auto",
      title: "Dice Picker",
      submitOnChange: false,
      closeOnSubmit: false
    });
  }

  static PARTS = {
    form: {
      template: templatePath("templates/dice-picker.html"),
      scrollable: []
    }
  };

  get title() {
    const skill = typeof this.skillLabel === "string" ? this.skillLabel : (this.skillKey || "Skill");
    return `Roll ${skill}`;
  }

  async _prepareContext(options) {
    const skillLabel = typeof this.skillLabel === "string" ? this.skillLabel : String(this.skillKey ?? "");
    const skillRank = Number(this.actor?.system?.skills?.[this.skillKey] ?? 0);
    const approachBase = Number(this.approaches?.[this.#state.selectedApproach] ?? 0);
    const approachLabel = GFL5R_CONFIG.getApproachLabel?.(this.#state.selectedApproach) || this.#state.selectedApproach;

    const approachTotal = Math.max(0, approachBase + this.#state.bonusApproachDice);
    const skillTotal = Math.max(0, skillRank + this.#state.bonusSkillDice);

    return {
      skillKey: this.skillKey,
      skillLabel,
      tn: this.#state.tn,
      approachLabel,
      approachOptions: this.#buildApproachOptions(),
      approachBase,
      bonusApproachDice: this.#state.bonusApproachDice,
      approachTotal,
      skillRank,
      bonusSkillDice: this.#state.bonusSkillDice,
      skillTotal
    };
  }

  async close(options) {
    this.#renderAbort?.abort();
    if (!this.#completed) {
      this.#finish("close");
    }
    return super.close(options);
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#renderAbort?.abort();
    this.#renderAbort = new AbortController();
    const { signal } = this.#renderAbort;
    const root = this.element;
    if (!root) return;

    root.addEventListener("click", (event) => {
      const target = event.target?.closest?.("[data-action]");
      if (!target || !root.contains(target)) return;
      const action = target.dataset.action;
      switch (action) {
        case "select-approach":
          this.#state.selectedApproach = target.dataset.approach || target.value;
          this.render(false);
          break;
        case "tn-inc":
          this.#adjustTN(1);
          break;
        case "tn-dec":
          this.#adjustTN(-1);
          break;
        case "approach-inc":
          this.#adjustApproachBonus(1);
          break;
        case "approach-dec":
          this.#adjustApproachBonus(-1);
          break;
        case "skill-inc":
          this.#adjustSkillBonus(1);
          break;
        case "skill-dec":
          this.#adjustSkillBonus(-1);
          break;
        default:
          break;
      }
    }, { signal });

    root.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#finish("submit");
      this.close();
    }, { signal });
  }

  #buildApproachOptions() {
    const entries = Object.entries(this.approaches ?? {});
    if (!entries.length) return [];

    return entries.map(([key, value]) => ({
      key,
      label: GFL5R_CONFIG.getApproachLabel?.(key) || key,
      value: Number(value) || 0,
      selected: key === this.#state.selectedApproach
    }));
  }

  #adjustTN(delta) {
    const next = Math.max(0, Number(this.#state.tn) + delta);
    this.#state.tn = next;
    this.render(false);
  }

  #adjustApproachBonus(delta) {
    const next = Math.max(0, Number(this.#state.bonusApproachDice) + delta);
    this.#state.bonusApproachDice = next;
    this.render(false);
  }

  #adjustSkillBonus(delta) {
    const next = Math.max(0, Number(this.#state.bonusSkillDice) + delta);
    this.#state.bonusSkillDice = next;
    this.render(false);
  }

  #finish(reason) {
    if (this.#completed) return;
    this.#completed = true;

    const skillLabel = typeof this.skillLabel === "string" ? this.skillLabel : `${this.skillKey ?? ""}`;

    const summary = {
      approach: this.#state.selectedApproach,
      approachValue: Number(this.approaches?.[this.#state.selectedApproach] ?? 0),
      bonusApproachDice: this.#state.bonusApproachDice,
      approachTotal: Math.max(0, Number(this.approaches?.[this.#state.selectedApproach] ?? 0) + this.#state.bonusApproachDice),
      skillKey: this.skillKey,
      skillLabel,
      skillRank: Number(this.actor?.system?.skills?.[this.skillKey] ?? 0),
      bonusSkillDice: this.#state.bonusSkillDice,
      skillTotal: Math.max(0, Number(this.actor?.system?.skills?.[this.skillKey] ?? 0) + this.#state.bonusSkillDice),
      tn: this.#state.tn,
      reason,
      weapon: this.weapon
    };

    console.log("GFL5R | Dice Picker", {
      ringDice: summary.approachTotal,
      skillDice: summary.skillTotal,
      tn: summary.tn,
      skill: summary.skillKey,
      approach: summary.approach
    });

    if (reason === "submit") {
      const results = this.#rollPoolFaces(summary);
      this.#openResultsWindow(summary, results);
    }

    if (this.onComplete) {
      try {
        this.onComplete(summary);
      } catch (err) {
        console.error("GFL5R | Picker onComplete error", err);
      }
    }
  }

  #rollPoolFaces(summary) {
    const faces = [];
    for (let i = 0; i < (summary.approachTotal || 0); i += 1) {
      faces.push({ ...rollRingDie(), order: faces.length + 1 });
    }
    for (let i = 0; i < (summary.skillTotal || 0); i += 1) {
      faces.push({ ...rollSkillDie(), order: faces.length + 1 });
    }
    return faces;
  }

  #openResultsWindow(summary, results) {
    console.log("GFL5R | Opening results window with weapon:", summary.weapon?.name);
    const title = `Roll & Keep: ${summary.skillLabel || summary.skillKey || "Skill"}`;
    new GFLDiceResultWindow({
      title,
      results,
      skillLabel: summary.skillLabel,
      approachLabel: summary.approach,
      tn: summary.tn,
      weapon: summary.weapon
    }).render(true);
  }
}

console.log("GFL5R | dice-picker-dialog.js loaded");
