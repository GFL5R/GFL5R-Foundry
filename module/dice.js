
// module/dice.js
/* GFL5R Dice Roller — using native d6 (black) and d12 (white)
  Now updates a chat message at each step! */

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
// GFL5R Dice & Roll (ported from gfl5r, themed for GFL)
import { GFL5R_CONFIG } from "./config.js";
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const PATHS = {
  get templates() {
    return `systems/${systemId()}/templates/`;
  },
  get assets() {
    return `systems/${systemId()}/assets/`;
  },
};
// Preserve the base Roll.fromData so we can avoid recursion when patching
const BASE_ROLL_FROM_DATA = Roll.fromData;

// Global Roll.fromData patch to tolerate RollGFL5R even before init hooks run
function patchRollFromData() {
  if (Roll._gfl5rPatched) return;
  const originalFromData = BASE_ROLL_FROM_DATA;
  Roll.fromData = function patchedRollFromData(data) {
    const targetCls =
      game?.gfl5r?.RollGFL5R ??
      CONFIG?.Dice?.rolls?.RollGFL5R ??
      CONFIG?.Dice?.rolls?.rollgfl5r ??
      RollGFL5R ??
      null;
    // Ensure our custom dice terms are registered before parsing
    CONFIG.Dice.terms ??= {};
    if (!CONFIG.Dice.terms["r"]) CONFIG.Dice.terms["r"] = RingDie;
    if (!CONFIG.Dice.terms["s"]) CONFIG.Dice.terms["s"] = AbilityDie;

    if (data?.class && data.class.toLowerCase() === "rollgfl5r" && targetCls) {
      try {
        return targetCls.fromData(data);
      } catch (err) {
        console.warn("GFL5R | Roll.fromData fallback for RollGFL5R", err, data);
        try {
          return new targetCls(data?.formula || "0", data?.data || {}, data?.options || {});
        } catch (e2) {
          console.warn("GFL5R | Roll.fromData ultimate fallback failed", e2);
        }
      }
    }
    return originalFromData.call(this, data);
  };
  Roll._gfl5rPatched = true;
}

patchRollFromData();

const dieKeyFromFlags = ({ success, opportunity, strife, explosive }) => {
  if (!success && !opportunity && !strife && !explosive) return "blank";
  if (explosive && strife) return "explosive-strife";
  if (explosive) return "explosive";
  if (success && opportunity) return "success-opp";
  if (success && strife) return "success-strife";
  if (success) return "success";
  if (opportunity && strife) return "opp-strife";
  if (opportunity) return "opp";
  return "blank";
};

/**
 * Base L5R die
 */
export class L5rBaseDie extends foundry.dice.terms.DiceTerm {
  static DENOMINATION = "";
  static FACES = {};

  constructor(termData) {
    super(termData);
    this.gfl5r = { success: 0, explosive: 0, opportunity: 0, strife: 0 };
  }

  /** total success (success + explosive) */
  get totalSuccess() {
    return this.gfl5r.success + this.gfl5r.explosive;
  }

  /** Expression string */
  get expression() {
    return `${this.number}d${this.constructor.DENOMINATION}${this.modifiers.join("")}`;
  }

  /** Return standardized formula */
  get formula() {
    return this.expression;
  }

  /** Face label (icon) */
  getResultLabel(result) {
    const val = typeof result === "object" ? result?.result : result;
    const face = this.constructor.FACES[val];
    if (!face) return "";
    const key = dieKeyFromFlags({
      success: face.success,
      opportunity: face.opportunity,
      strife: face.strife,
      explosive: face.explosive,
    });
    const folder = this.faces === 6 ? "black" : "white";
    return `<img src="${PATHS.assets}dice/${folder}/${key}.png" alt="${result}" />`;
  }

  /** Face url helper */
  static getResultSrc(result) {
    const face = this.FACES[result];
    if (!face) return "";
    const key = dieKeyFromFlags({
      success: face.success,
      opportunity: face.opportunity,
      strife: face.strife,
      explosive: face.explosive,
    });
    const folder = this === game.gfl5r?.RingDie ? "black" : "white";
    return `${PATHS.assets}dice/${folder}/${key}.png`;
  }

  /** L5R dice contribute no numeric total */
  get total() {
    return 0;
  }

  async evaluate({ minimize = false, maximize = false } = {}) {
    if (this._evaluated) throw new Error(`This ${this.constructor.name} has already been evaluated and is immutable`);

    for (let n = 1; n <= this.number; n++) {
      await this.roll({ minimize, maximize });
    }

    this._evaluateModifiers();
    this._l5rSummary();

    this._evaluated = true;
    this.result = 0;
    return this;
  }

  _l5rSummary() {
    this.gfl5r = { success: 0, explosive: 0, opportunity: 0, strife: 0 };
    this.results.forEach((term) => {
      const face = this.constructor.FACES[term.result];
      ["success", "explosive", "opportunity", "strife"].forEach((prop) => {
        this.gfl5r[prop] += Number(face[prop]) || 0;
      });
      if (face.explosive) term.exploded = true;
    });
  }

  roll(options = { minimize: false, maximize: false }) {
    return super.roll(options);
  }

  static fromData(data) {
    const roll = BASE_ROLL_FROM_DATA.call(this, data);
    roll.gfl5r = data.gfl5r;
    return roll;
  }

  toJSON() {
    const json = super.toJSON();
    json.gfl5r = this.gfl5r;
    return json;
  }
}

export class AbilityDie extends L5rBaseDie {
  static DENOMINATION = "s";
  static FACES = {
    1: { success: 0, explosive: 0, opportunity: 0, strife: 0 },
    2: { success: 0, explosive: 0, opportunity: 0, strife: 0 },
    3: { success: 0, explosive: 0, opportunity: 1, strife: 0 },
    4: { success: 0, explosive: 0, opportunity: 1, strife: 0 },
    5: { success: 0, explosive: 0, opportunity: 1, strife: 0 },
    6: { success: 1, explosive: 0, opportunity: 0, strife: 1 },
    7: { success: 1, explosive: 0, opportunity: 0, strife: 1 },
    8: { success: 1, explosive: 0, opportunity: 0, strife: 0 },
    9: { success: 1, explosive: 0, opportunity: 0, strife: 0 },
    10: { success: 1, explosive: 0, opportunity: 1, strife: 0 },
    11: { success: 0, explosive: 1, opportunity: 0, strife: 1 },
    12: { success: 0, explosive: 1, opportunity: 0, strife: 0 },
  };

  constructor(termData) {
    super(termData);
    this.faces = 12;
  }
}

export class RingDie extends L5rBaseDie {
  static DENOMINATION = "r";
  static FACES = {
    1: { success: 0, explosive: 0, opportunity: 0, strife: 0 },
    2: { success: 0, explosive: 0, opportunity: 1, strife: 1 },
    3: { success: 0, explosive: 0, opportunity: 1, strife: 0 },
    4: { success: 1, explosive: 0, opportunity: 0, strife: 1 },
    5: { success: 1, explosive: 0, opportunity: 0, strife: 0 },
    6: { success: 0, explosive: 1, opportunity: 0, strife: 1 },
  };

  constructor(termData) {
    super(termData);
    this.faces = 6;
  }
}

/**
 * Roll with L5R dice
 */
export class RollGFL5R extends Roll {
  static CHAT_TEMPLATE = "dice/chat-roll.html";
  static TOOLTIP_TEMPLATE = "dice/tooltip.html";

  gfl5r = {
    actor: null,
    dicesTypes: { std: false, l5r: false },
    difficulty: 2,
    difficultyHidden: false,
    history: null,
    initialFormula: null,
    isInitiativeRoll: false,
    baseInitiative: 0,
    initiativeCombatantId: null,
    item: null,
    keepLimit: null,
    rnkEnded: false,
    skillAssistance: 0,
    skillCatId: "",
    skillId: "",
    stance: "",
    strifeApplied: 0,
    summary: {
      totalSuccess: 0,
      totalBonus: 0,
      success: 0,
      explosive: 0,
      opportunity: 0,
      strife: 0,
    },
    target: null,
    voidPointUsed: false,
  };

  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);

    const flavors = Array.from(formula.matchAll(/\d+d([sr])\[([^\]]+)\]/gmu));
    flavors.forEach((res) => {
      if (res[1] === "r" && !!res[2] && this.gfl5r.stance === "") this.gfl5r.stance = res[2];
      if (res[1] === "s" && !!res[2] && this.gfl5r.skillId === "") this.gfl5r.skillId = res[2];
    });

    if (!this.gfl5r.skillCatId && this.gfl5r.skillId) {
      const entry = GFL5R_CONFIG.getSkillsMap?.().get(this.gfl5r.skillId);
      if (entry) this.gfl5r.skillCatId = entry.groupId || entry.group || "";
    }

    const targetToken = Array.from(game.user.targets).values().next()?.value?.document;
    if (targetToken) this.target = targetToken;
  }

  set actor(actor) {
    this.gfl5r.actor = actor instanceof Actor ? actor : null;
  }

  set target(targetToken) {
    this.gfl5r.target = targetToken || null;
  }

  async evaluate({ minimize = false, maximize = false } = {}) {
    if (this._evaluated) throw new Error("This Roll object has already been rolled.");
    if (this.terms.length < 1) throw new Error("This Roll object need dice to be rolled.");

    this.terms = this.constructor.simplifyTerms(this.terms);
    this._total = 0;

    await super.evaluate({ minimize, maximize });
    this._evaluated = true;

    if (!this.gfl5r.initialFormula) this.gfl5r.initialFormula = this.formula;
    this.l5rSummary();
    return this;
  }

  l5rSummary() {
    const summary = this.gfl5r.summary;
    summary.success = 0;
    summary.explosive = 0;
    summary.opportunity = 0;
    summary.strife = 0;
    summary.totalSuccess = 0;

    // Collect L5R die faces from results
    const l5rFaces = [];
    this.dice.forEach((term) => {
      if (!(term instanceof game.gfl5r.L5rBaseDie)) return;
      term.results.forEach((res) => {
        const face = term.constructor.FACES[res.result];
        l5rFaces.push(face);
      });
    });

    if (!this.gfl5r.keepLimit) {
      this.gfl5r.keepLimit =
        this.dice.reduce((acc, term) => (term instanceof game.gfl5r.RingDie ? acc + term.number : acc), 0) +
        Math.max(0, this.gfl5r.skillAssistance || 0);
      if (!this.gfl5r.keepLimit) {
        this.gfl5r.keepLimit = this.dice.reduce(
          (acc, term) => (term instanceof game.gfl5r.AbilityDie ? acc + term.number : acc),
          0
        );
      }
    }

    const keepCount = Math.max(0, this.gfl5r.keepLimit || l5rFaces.length);
    const kept = l5rFaces
      .map((f) => ({
        ...f,
        score: (f.success + f.explosive) * 100 + f.opportunity * 10 - f.strife,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, keepCount);

    kept.forEach((face) => {
      summary.success += Number(face.success) || 0;
      summary.explosive += Number(face.explosive) || 0;
      summary.opportunity += Number(face.opportunity) || 0;
      summary.strife += Number(face.strife) || 0;
    });
    summary.totalSuccess = summary.success + summary.explosive;

    this.gfl5r.dicesTypes.std = this.dice.some(
      (term) => term instanceof foundry.dice.terms.DiceTerm && !(term instanceof game.gfl5r.L5rBaseDie)
    );
    this.gfl5r.dicesTypes.l5r = this.dice.some((term) => term instanceof game.gfl5r.L5rBaseDie);
    summary.totalBonus = Math.max(0, summary.totalSuccess - this.gfl5r.difficulty);

    if (this.gfl5r.history) {
      this.gfl5r.rnkEnded = !this.gfl5r.history[this.gfl5r.history.length - 1].some(
        (e) => !!e && e.choice === null
      );
    }

    // Seed initial history for Roll & Keep dialog
    if (!this.gfl5r.history && this.gfl5r.dicesTypes.l5r) {
      const firstStep = [];
      this.terms.forEach((term) => {
        if (!(term instanceof game.gfl5r.L5rBaseDie)) return;
        term.results.forEach((res) => {
          firstStep.push({
            type: term.constructor.name,
            face: res.result,
            choice: RollnKeepDialog?.CHOICES?.nothing ?? null,
          });
        });
      });
      this.gfl5r.history = [firstStep];
    }
  }

  _l5rTermSummary(term) {
    if (!(term instanceof game.gfl5r.L5rBaseDie)) return;
    ["success", "explosive", "opportunity", "strife"].forEach((props) => {
      this.gfl5r.summary[props] += parseInt(term.gfl5r[props]);
    });
    this.gfl5r.summary.totalSuccess += term.totalSuccess;
  }

  get total() {
    if (this.gfl5r.dicesTypes.l5r) return null;
    if (!this._evaluated) return null;
    let total = "";
    if (this.gfl5r.dicesTypes.std) total = this._total;
    return total;
  }

  getTooltip(contexte = null) {
    const parts = this.dice.map((term) => {
      const cls = term.constructor;
      const isL5rDie = term instanceof game.gfl5r.L5rBaseDie;
      return {
        formula: term.formula,
        total: term.total,
        faces: term.faces,
        flavor: term.options.flavor,
        isDieL5r: isL5rDie,
        isDieStd: !isL5rDie,
        display: !isL5rDie || contexte?.from !== "render",
        rolls: term.results.map((r) => ({
          result: term.getResultLabel(r),
          classes: [
            cls.name.toLowerCase(),
            "d" + term.faces,
            isL5rDie && r.swapped ? "swapped" : null,
            r.rerolled ? "rerolled" : null,
            r.exploded ? "exploded" : null,
            !isL5rDie && r.discarded ? "discarded" : null,
            !isL5rDie && r.result === 1 ? "min" : null,
            !isL5rDie && r.result === term.faces ? "max" : null,
          ]
            .filter((c) => !!c)
            .join(" "),
        })),
      };
    });
    parts.addedResults = this.addedResults;

    const chatData = { parts, gfl5r: this.gfl5r, displaySummary: contexte?.from !== "render" };
    return foundry.applications.handlebars.renderTemplate(PATHS.templates + this.constructor.TOOLTIP_TEMPLATE, {
      chatData,
    });
  }

  async render(chatOptions = {}) {
    chatOptions = foundry.utils.mergeObject(
      {
        user: game.user.id,
        flavor: null,
        template: PATHS.templates + this.constructor.CHAT_TEMPLATE,
        blind: false,
      },
      chatOptions
    );
    const isPrivate = chatOptions.isPrivate;

    if (!this._evaluated) await this.roll();

    const chatData = {
      formula: isPrivate ? "???" : this._formula,
      flavor: isPrivate ? null : chatOptions.flavor || this.options.flavor,
      user: chatOptions.user,
      isPublicRoll: !isPrivate,
      tooltip: isPrivate ? "" : await this.getTooltip({ from: "render" }),
      total: isPrivate ? "?" : this.total,
      profileImg: this.gfl5r.actor?.img || "icons/svg/mystery-man.svg",
      noTargetDisclosure: false,
      useGfl: true,
      gfl5r: isPrivate
        ? {}
        : {
            ...this.gfl5r,
            dices: this.dice.map((term) => {
              const isL5rDie = term instanceof game.gfl5r.L5rBaseDie;
              return {
                diceTypeL5r: isL5rDie,
                rolls: term.results.map((r) => ({
                  result: term.getResultLabel(r),
                  classes: [
                    isL5rDie && r.swapped ? "swapped" : null,
                    r.rerolled ? "rerolled" : null,
                    r.exploded ? "exploded" : null,
                  ]
                    .filter((c) => !!c)
                    .join(" "),
                })),
              };
            }),
          },
    };

    return foundry.applications.handlebars.renderTemplate(chatOptions.template, chatData);
  }

  async toMessage(messageData = {}, { rollMode = null } = {}) {
    if (!this._evaluated) await this.evaluate();

    // Ensure history exists for RnK consumers
    if (!this.gfl5r.history && this.gfl5r.dicesTypes.l5r) {
      const firstStep = [];
      const sourceTerms = this.dice?.length ? this.dice : this.terms;
      sourceTerms.forEach((term) => {
        if (!(term instanceof game.gfl5r.L5rBaseDie)) return;
        (term.results || []).forEach((res) => {
          firstStep.push({
            type: term.constructor.name,
            face: res.result,
            choice: RollnKeepDialog?.CHOICES?.nothing ?? null,
          });
        });
      });
      this.gfl5r.history = [firstStep];
    }

    const rMode = rollMode || messageData.rollMode || game.settings.get("core", "rollMode");
    if (rMode) messageData = ChatMessage.applyRollMode(messageData, rMode);

    const content = this.gfl5r.dicesTypes.l5r ? await this.render({}) : this.total;

    // Fallback actor info for display if missing
    if (!this.gfl5r.actor) {
      this.gfl5r.actor = {
        name: messageData.speaker?.alias || this.options?.flavor || "Unknown",
        img: "icons/svg/mystery-man.svg",
      };
    }

    messageData = foundry.utils.mergeObject(
      {
        user: game.user.id,
        content,
        sound: CONFIG.sounds.dice,
        speaker: {
          actor: this.gfl5r.actor?.id || null,
          token: this.gfl5r.actor?.token || null,
          alias: this.gfl5r.actor?.name || null,
        },
      },
      messageData
    );
    messageData.rolls = [this];

    const msg = await ChatMessage.implementation.create(messageData, { rollMode: rMode });
    // Auto-open R&K for L5R dice
    if (this.gfl5r.dicesTypes?.l5r && game.gfl5r?.RollnKeepDialog) {
      const delay = game.dice3d ? 1200 : 0;
      setTimeout(() => {
        try {
          const dlg = new game.gfl5r.RollnKeepDialog(msg.id);
          game.gfl5r._rnkCache = game.gfl5r._rnkCache || {};
          game.gfl5r._rnkCache[msg.id] = dlg;
          dlg.render(true);
        } catch (err) {
          console.warn("GFL5R | Unable to auto-open R&K dialog", err);
        }
      }, delay);
    }

    await this._applyInitiative();
    return msg;
  }

  async _applyInitiative() {
    if (!this.gfl5r.initiativeCombatantId || !game.combat) return;
    const combatant = game.combat.combatants.get(this.gfl5r.initiativeCombatantId);
    if (!combatant) return;

    const successes = this.gfl5r.summary.totalSuccess;
    const meetsTN = this.gfl5r.difficultyHidden || successes >= (this.gfl5r.difficulty ?? 0);
    const initiativeBonus = meetsTN ? successes : 0;
    const finalInitiative = (this.gfl5r.baseInitiative || 0) + initiativeBonus;
    await combatant.update({ initiative: finalInitiative });
  }

  static fromData(data) {
    if (!data || typeof data !== "object") {
      return new RollGFL5R("0", {}, {});
    }
    try {
      const roll = BASE_ROLL_FROM_DATA.call(this, data);
      roll.data = foundry.utils.duplicate(data.data);
      roll.gfl5r = foundry.utils.duplicate(data.gfl5r);

      if (data.gfl5r?.actor) {
        if (data.gfl5r.actor instanceof Actor) {
          roll.gfl5r.actor = data.gfl5r.actor;
        } else if (data.gfl5r.actor.uuid) {
          const tmpItem = fromUuidSync(data.gfl5r.actor.uuid);
          if (tmpItem instanceof Actor) roll.gfl5r.actor = tmpItem;
          else if (tmpItem instanceof TokenDocument) roll.gfl5r.actor = tmpItem.actor;
        } else if (data.gfl5r.actor.id) {
          const actor = game.actors.get(data.gfl5r.actor.id);
          if (actor) roll.gfl5r.actor = actor;
        }
      }

      if (data.gfl5r?.item) {
        if (data.gfl5r.item instanceof Item) {
          roll.gfl5r.item = data.gfl5r.item;
        } else if (data.gfl5r.item.uuid) {
          const tmpItem = fromUuidSync(data.gfl5r.item.uuid);
          if (tmpItem) roll.gfl5r.item = tmpItem;
        }
      }

      if (data.gfl5r?.target) {
        if (data.gfl5r.target instanceof TokenDocument) {
          roll.gfl5r.target = data.gfl5r.target;
        } else if (data.gfl5r.target.uuid) {
          const tmpItem = fromUuidSync(data.gfl5r.target.uuid);
          if (tmpItem) roll.gfl5r.target = tmpItem;
        }
      }

      return roll;
    } catch (err) {
      console.warn("GFL5R | RollGFL5R.fromData fell back to safe roll", err);
      const fallback = new RollGFL5R(data.formula || "0", data.data || {}, data.options || {});
      fallback.gfl5r = foundry.utils.mergeObject(fallback.gfl5r || {}, foundry.utils.duplicate(data.gfl5r || {}), {
        inplace: true,
      });
      return fallback;
    }
  }

  toJSON() {
    const json = super.toJSON();
    json.class = "RollGFL5R";
    json.data = foundry.utils.duplicate(this.data);
    json.gfl5r = foundry.utils.duplicate(this.gfl5r);

    if (json.gfl5r.actor && this.gfl5r.actor?.uuid) {
      json.gfl5r.actor = { uuid: this.gfl5r.actor.uuid };
    }
    if (json.gfl5r.item && this.gfl5r.item?.uuid) {
      json.gfl5r.item = { uuid: this.gfl5r.item.uuid };
    }
    if (json.gfl5r.target && this.gfl5r.target?.uuid) {
      json.gfl5r.target = { uuid: this.gfl5r.target.uuid };
    }
    return json;
  }
}

/**
 * Roll & Keep dialog (ported from l5r5e flow, namespaced for gfl5r)
 */
export class RollnKeepDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /**
   * Player choice list
   */
  static CHOICES = {
    discard: "discard",
    keep: "keep",
    nothing: null,
    reroll: "reroll",
    swap: "swap",
  };
  /**
   * The current ChatMessage where we come from
   * @param {ChatMessage} message
   */
  _message = null;

  /**
   * The current Roll
   * @param {RollGFL5R} roll
   */
  roll = null;

  /**
   * Payload Object
   */
  object = {
    currentStep: 0,
    strifeApplied: 0,
    submitDisabled: false,
    swapDiceFaces: {
      rings: [],
      skills: [],
    },
    dicesList: [[]],
  };

  static DEFAULT_OPTIONS = {
    id: "gfl5r-roll-n-keep-dialog",
    classes: ["gfl5r", "roll-n-keep-dialog"],
    window: { title: "Roll & Keep", resizable: true },
    position: { width: "auto", height: "auto" },
  };

  static PARTS = {
    main: {
      template: PATHS.templates + "dice/roll-n-keep-dialog.html",
      scrollable: [],
    },
  };

  static get eventListeners() {
    return [
      { event: "submit", selector: "form", callback: "onSubmit", preventDefault: true },
      { event: "click", selector: "#undo-step", callback: "onUndoClick", preventDefault: true, stopPropagation: true },
      { event: "click", selector: "#finalize", callback: "onFinalizeClick", preventDefault: true, stopPropagation: true },
      { event: "click", selector: ".faces-change", callback: "onFacesChange" },
      { event: "input", selector: "#strife-applied", callback: "onStrifeRangeChange" },
      { event: "change", selector: "#strife-applied", callback: "onStrifeRangeChange" },
      { event: "input", selector: "input[name='strifeApplied'][type='number']", callback: "onStrifeNumberChange" },
      { event: "change", selector: "input[name='strifeApplied'][type='number']", callback: "onStrifeNumberChange" },
    ];
  }

  /**
   * Define a unique and dynamic element ID for the rendered application
   */
  get id() {
    return `gfl5r-roll-n-keep-dialog-${this._message.id}`;
  }

  /**
   * ChatMessage
   * @param {ChatMessage} msg
   */
  set message(msg) {
    this._message = msg instanceof ChatMessage ? msg : null;
  }

  /**
   * ChatMessage
   * @returns {ChatMessage}
   */
  get message() {
    return this._message;
  }

  /**
   * Current (first) Roll in ChatMessage
   * @returns {RollGFL5R}
   */
  get messageRoll() {
    return this._message?.rolls?.[0] || null;
  }

  /**
   * Return true if this actor has right on this roll
   * @return {boolean}
   */
  get isOwner() {
    return this._message?.isAuthor || this.messageRoll?.gfl5r?.actor?.isOwner || this._message?.isOwner || false;
  }

  get isEditable() {
    return this._editable !== false;
  }

  /**
   * Gather form data similar to FormApplication behavior
   * @param {Event} event
   * @returns {object}
   * @private
   */
  _collectFormData(event) {
    const form =
      event?.currentTarget?.closest?.("form") ||
      (this.element ? this.element.querySelector("form") : null);
    if (!form) return {};
    const fd = new FormData(form);
    return foundry.utils.expandObject(Object.fromEntries(fd.entries()));
  }

  /**
   * Event: submit form
   */
  async onSubmit(event) {
    const data = this._collectFormData(event);
    await this._updateObject(event, data);
  }

  async onUndoClick(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!this.isEditable) return;
    await this._undoLastStepChoices();
  }

  async onFinalizeClick(event) {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!this.isEditable) return;
    if (this.object.submitDisabled) return;
    const data = this._collectFormData(event);
    await this._updateObject(event, data);
  }

  onFacesChange(event) {
    if (!this.isEditable) return;
    const type = event.currentTarget?.dataset?.die;
    const face = Number(event.currentTarget?.dataset?.face);
    if (!type || Number.isNaN(face)) return;
    this.object.dicesList[this.object.currentStep]?.forEach((dice) => {
      if (dice && dice.choice === RollnKeepDialog.CHOICES.swap && dice.type === type) {
        dice.newFace = face;
      }
    });
    this.render(false);
  }

  _syncStrife(val) {
    const clamped = Math.max(
      0,
      Math.min(Number(this.element?.querySelector("#strife-applied")?.max || 0), Number(val) || 0)
    );
    const range = this.element?.querySelector("#strife-applied");
    const number = this.element?.querySelector("input[name='strifeApplied'][type='number']");
    if (range) range.value = clamped;
    if (number) number.value = clamped;
    if (this.roll?.gfl5r) this.roll.gfl5r.strifeApplied = clamped;
  }

  onStrifeRangeChange(event) {
    if (!this.isEditable) return;
    this._syncStrife(event?.currentTarget?.value);
  }

  onStrifeNumberChange(event) {
    if (!this.isEditable) return;
    this._syncStrife(event?.currentTarget?.value);
  }

  /**
   * Create the Roll n Keep dialog
   * @param {number} messageId
   * @param {FormApplicationOptions} options
   */
  constructor(messageId, options = {}) {
    super(options);
    this.message = game.messages.get(messageId);
    this._strifeInitial = null;
    this._editable = this.isOwner;

    this._initializeDiceFaces();
    this._initializeHistory();
  }

  /**
   * Refresh data (used from socket)
   */
  async refresh() {
    if (!this._message) {
      return;
    }
    this._initializeHistory();
    this.render(false);
  }

  /**
   * Render
   * @param {boolean} force
   * @param  {{left?: number, top?: number, width?: number, height?: number, scale?: number, focus?: boolean, renderContext?: string, renderData?: Object}} options
   * @returns {Application}
   * @override
   */
  render(force = false, options = {}) {
    if (!this._message) {
      return;
    }
    return super.render(force, options);
  }

  /**
   * Initialize the dice history list
   * @private
   */
  _initializeHistory() {
    if (!this._message) {
      return;
    }

    // Get the roll
    this.roll = this.messageRoll;
    if (!this.roll) return;
    if (typeof this.roll.l5rSummary === "function") {
      this.roll.l5rSummary();
    }

    // Already history
    if (Array.isArray(this.roll.gfl5r?.history) && this.roll.gfl5r.history.length) {
      this.object.dicesList = foundry.utils.duplicate(this.roll.gfl5r.history);

      let currentStep = this.object.dicesList.length - 1;
      if (!this._haveChoice(currentStep, RollnKeepDialog.CHOICES.nothing)) {
        currentStep += 1;
      }
      this.object.currentStep = currentStep;
      return;
    }

    // New
    this.object.dicesList = [[]];
    const sourceTerms = this.roll.dice?.length ? this.roll.dice : this.roll.terms;
    sourceTerms.forEach((term) => {
      if (!(term instanceof game.gfl5r.L5rBaseDie)) {
        return;
      }
      (term.results || []).forEach((res) => {
        this.object.dicesList[0].push({
          type: term.constructor.name,
          face: res.result,
          choice: RollnKeepDialog.CHOICES.nothing,
        });
      });
    });
    this.roll.gfl5r.history = this.object.dicesList;
  }

  /**
   * Fill the dices faces
   * @private
   */
  _initializeDiceFaces() {
    this.object.swapDiceFaces.rings = Object.keys(game.gfl5r.RingDie.FACES);
    this.object.swapDiceFaces.skills = [1, 3, 6, 8, 10, 11, 12];
  }

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @return An array of DragDrop handlers
   */
  _createDragDropHandlers() {
    return [
      new foundry.applications.ux.DragDrop.implementation({
        dragSelector: ".dice.draggable",
        dropSelector: ".dropbox",
        permissions: { dragstart: this.isEditable, drop: this.isEditable },
        callbacks: { dragstart: this._onDragStart.bind(this), drop: this._onDropItem.bind(this) },
      }),
    ];
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event	The originating DragEvent
   */
  _onDragStart(event) {
    const target = $(event.currentTarget);
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        step: target.data("step"),
        die: target.data("die"),
      })
    );
  }

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @param options
   * @return {Object}
   */
  async _prepareContext(options = null) {
    const rollData = this.roll?.gfl5r ?? {};

    // Disable submit / edition
    let classes = (this.options.classes || []).filter((e) => e !== "finalized");
    let editable = this._editable !== false;
    this.object.submitDisabled = false;

    if (this._checkKeepCount(this.object.currentStep)) {
      const kept = this._getKeepCount(this.object.currentStep);
      this.object.submitDisabled = kept < 1 || (rollData.keepLimit ? kept > rollData.keepLimit : false);
    }

    const hasStrife = (rollData.summary?.strife || 0) > 0;
    const actorIsCharacter = rollData.actor?.type === "character";
    const showStrifeBt = editable && hasStrife && rollData.rnkEnded && actorIsCharacter;
    if (showStrifeBt && this._strifeInitial === null) {
      this._strifeInitial = Number(rollData.strifeApplied || 0);
    }
    if (!this.object.dicesList[this.object.currentStep] && !this._checkKeepCount(this.object.currentStep)) {
      editable = this.isOwner && (hasStrife || false);
      classes = [...classes, "finalized"];
      this.object.submitDisabled = false;
    }
    this._editable = editable;

    return {
      isGM: game.user.isGM,
      showChoices: editable && !rollData.rnkEnded,
      showStrifeBt,
      cssClass: classes.join(" "),
      data: this.object,
      gfl5r: rollData,
    };
  }

  /**
   * Bind DragDrop handlers (other events handled via eventListeners)
   * @param {HTMLElement|jQuery} html
   */
  activateListeners(html) {
    const root = html instanceof HTMLElement ? html : html?.[0];
    super.activateListeners?.(html);
    if (!root || !this.isEditable) return;
    this._dragDrop = this._dragDrop || this._createDragDropHandlers();
    for (const dd of this._dragDrop) {
      try {
        dd.bind(root);
      } catch (err) {
        console.warn("GFL5R | RNK dragdrop bind failed", err);
      }
    }
  }

  /**
   * Handle dropped items
   */
  async _onDropItem(event) {
    // *** Everything below here is only needed if the sheet is editable ***
    if (!this.isEditable) {
      return;
    }

    const target = event.currentTarget;
    const type = target?.dataset?.type;
    const json = event.dataTransfer?.getData("text/plain");
    if (!json || !Object.values(RollnKeepDialog.CHOICES).some((e) => !!e && e === type)) {
      return;
    }

    const data = JSON.parse(json);
    if (!data) {
      return;
    }

    const current = this.object.dicesList[data.step]?.[data.die];
    if (!current) {
      return;
    }
    delete current.newFace;

    switch (type) {
      case RollnKeepDialog.CHOICES.swap: {
        // Dice Type Ring/Skill
        const diceType = target?.dataset?.die;
        const diceNewFace = target?.dataset?.face ? Number(target.dataset.face) : undefined;

        if (current.type !== diceType || current.face === diceNewFace || Number.isNaN(diceNewFace)) {
          current.choice = RollnKeepDialog.CHOICES.nothing;
          this.render(false);
          return false;
        }

        current.newFace = diceNewFace;
        this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.keep);
        break;
      }

      case RollnKeepDialog.CHOICES.reroll:
        // If reroll, we need to keep all the line by default
        this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.keep);
        break;
    }

    current.choice = type;

    // Little time saving : if we reach the max kept dices, discard all dices without a choice
    if (
      this._checkKeepCount(this.object.currentStep) &&
      this._getKeepCount(this.object.currentStep) === (this.roll?.gfl5r?.keepLimit ?? 0)
    ) {
      this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.discard);
    }

    this.render(false);
    return false;
  }

  /**
   * Return the current number of dices kept
   * @private
   */
  _getKeepCount(step) {
    return this.object.dicesList[step].reduce((acc, die) => {
      if (
        !!die &&
        [RollnKeepDialog.CHOICES.keep, RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap].includes(
          die.choice
        )
      ) {
        acc = acc + 1;
      }
      return acc;
    }, 0);
  }

  /**
   * Return true if a "_getKeepCount" is needed
   * @param {number} step
   * @returns {boolean}
   * @private
   */
  _checkKeepCount(step) {
    return (
      !this._haveChoice(step, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]) &&
      (step === 0 || this._haveChoice(step - 1, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]))
    );
  }

  /**
   * Return true if this choice exist in the current step
   * @param {number}          currentStep
   * @param {string|string[]} choices
   * @return {boolean}
   * @private
   */
  _haveChoice(currentStep, choices) {
    if (!Array.isArray(choices)) {
      choices = [choices];
    }
    return (
      this.object.dicesList[currentStep] &&
      this.object.dicesList[currentStep].some((e) => !!e && choices.includes(e.choice))
    );
  }

  /**
   * Discard all dices without a choice for the current step
   * @param {string} newChoice
   * @private
   */
  _forceChoiceForDiceWithoutOne(newChoice) {
    const current = this.object.dicesList?.[this.object.currentStep];
    if (!Array.isArray(current)) return;
    current
      .filter((e) => !!e)
      .map((e) => {
        if (e.choice === RollnKeepDialog.CHOICES.nothing) {
          e.choice = newChoice;
        }
        return e;
      });
  }

  /**
   * Initialize dice array for "step" if needed
   * @param {number} step
   * @private
   */
  _initializeDicesListStep(step) {
    if (!this.object.dicesList[step]) {
      this.object.dicesList[step] = Array(this.object.dicesList[0].length).fill(null);
    }
  }

  /**
   * Apply all choices to build the next step
   * @returns {Promise<void>}
   * @private
   */
  async _applyChoices() {
    let nextStep = this.object.currentStep + 1;
    const haveReroll = this._haveChoice(this.object.currentStep, [
      RollnKeepDialog.CHOICES.reroll,
      RollnKeepDialog.CHOICES.swap,
    ]);

    // Foreach kept dices, apply choices
    const newRolls = {};
    this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
      if (!die) {
        return;
      }

      const currentRow = this.object.dicesList[this.object.currentStep][idx];

      switch (die.choice) {
        case RollnKeepDialog.CHOICES.keep:
          if (haveReroll) {
            // Reroll line add all kept into a new line
            this._initializeDicesListStep(nextStep);
            this.object.dicesList[nextStep][idx] = foundry.utils.duplicate(currentRow);
            this.object.dicesList[nextStep][idx].choice = RollnKeepDialog.CHOICES.nothing;
            currentRow.choice = RollnKeepDialog.CHOICES.discard;
          } else if (game.gfl5r[die.type].FACES[die.face].explosive) {
            // Exploding dice : add a new dice in the next step
            if (!newRolls[die.type]) {
              newRolls[die.type] = 0;
            }
            newRolls[die.type] += 1;
          }
          break;

        case RollnKeepDialog.CHOICES.reroll:
          // Reroll : add a new dice in the next step
          if (!newRolls[die.type]) {
            newRolls[die.type] = 0;
          }
          newRolls[die.type] += 1;
          break;

        case RollnKeepDialog.CHOICES.swap:
          // FaceSwap : add a new dice with selected face in next step
          this._initializeDicesListStep(nextStep);
          this.object.dicesList[nextStep][idx] = {
            type: currentRow.type,
            face: currentRow.newFace,
            choice: RollnKeepDialog.CHOICES.nothing,
          };
          delete currentRow.newFace;
          break;
      }
    });

    // If new rolls, roll and add them
    if (Object.keys(newRolls).length > 0) {
      const newRollsResults = await this._newRoll(newRolls);
      this._initializeDicesListStep(nextStep);

      this.object.dicesList[this.object.currentStep].forEach((die, idx) => {
        if (!die) {
          return;
        }
        if (
          die.choice === RollnKeepDialog.CHOICES.reroll ||
          (!haveReroll &&
            die.choice === RollnKeepDialog.CHOICES.keep &&
            game.gfl5r[die.type].FACES[die.face].explosive)
        ) {
          this.object.dicesList[nextStep][idx] = newRollsResults[die.type].shift();
        }
      });
    }
  }

  /**
   * Transform a array (of int or object) into a formula ring/skill
   * @param rolls
   * @returns {string}
   * @private
   */
  _arrayToFormula(rolls) {
    const formula = [];
    if (rolls["RingDie"]) {
      const rings = Array.isArray(rolls["RingDie"]) ? rolls["RingDie"].length : rolls["RingDie"];
      formula.push(rings + "dr");
    }
    if (rolls["AbilityDie"]) {
      const skills = Array.isArray(rolls["AbilityDie"]) ? rolls["AbilityDie"].length : rolls["AbilityDie"];
      formula.push(skills + "ds");
    }
    if (formula.length < 1) {
      return "";
    }
    return formula.join("+");
  }

  /**
   * Roll all new dice at once (better performance) and return the result
   * @private
   */
  async _newRoll(newRolls) {
    const out = {
      RingDie: [],
      AbilityDie: [],
    };

    const roll = await new game.gfl5r.RollGFL5R(this._arrayToFormula(newRolls));
    await roll.evaluate();

    // Show DsN dice for the new roll
    if (game.dice3d !== undefined) {
      await game.dice3d.showForRoll(
        roll,
        game.user,
        true,
        this._message?.whisper?.length === 0 ? null : this._message?.whisper,
        this._message?.blind
      );
    }

    roll.terms.forEach((term) => {
      if (!(term instanceof game.gfl5r.L5rBaseDie)) {
        return;
      }
      term.results.forEach((res) => {
        out[term.constructor.name].push({
          type: term.constructor.name,
          face: res.result,
          choice: RollnKeepDialog.CHOICES.nothing,
        });
      });
    });

    return out;
  }

  /**
   * Rebuild the message roll
   * @param {boolean} forceKeep If true keep all dice regardless their choice
   * @returns {Promise<void>}
   * @private
   */
  async _rebuildRoll(forceKeep = false) {
    // Get all kept dices + new (choice null)
    const diceList = this.object.dicesList.reduce((acc, step, stepIdx) => {
      const haveReroll =
        stepIdx > 0 &&
        this._haveChoice(stepIdx - 1, [RollnKeepDialog.CHOICES.reroll, RollnKeepDialog.CHOICES.swap]);
      step.forEach((die, idx) => {
        if (
          !!die &&
          (forceKeep ||
            die.choice === RollnKeepDialog.CHOICES.keep ||
            (haveReroll && die.choice === RollnKeepDialog.CHOICES.nothing))
        ) {
          if (!acc[die.type]) {
            acc[die.type] = [];
          }
          // Check previous dice, to add html classes in chat
          if (stepIdx > 0 && this.object.dicesList[stepIdx - 1][idx]) {
            switch (this.object.dicesList[stepIdx - 1][idx].choice) {
              case RollnKeepDialog.CHOICES.reroll:
                die.class = "rerolled";
                break;
              case RollnKeepDialog.CHOICES.swap:
                die.class = "swapped";
                break;
            }
          }
          acc[die.type].push(die);
        }
      });
      return acc;
    }, {});

    const baseData = foundry.utils.duplicate(this.roll?.gfl5r ?? {});
    const roll = await new game.gfl5r.RollGFL5R(this._arrayToFormula(diceList));
    roll.gfl5r = {
      ...baseData,
      summary: roll.gfl5r.summary,
      history: this.object.dicesList,
      initialFormula: baseData.initialFormula ?? this.roll?.gfl5r?.initialFormula ?? this.roll?.formula,
    };

    // Fill the data
    await roll.evaluate();

    // Modify results
    roll.terms.map((term) => {
      if (term instanceof game.gfl5r.L5rBaseDie) {
        term.results.map((res) => {
          const die = diceList[term.constructor.name].shift();
          res.result = die.face;

          // add class to term result
          if (die.class) {
            res[die.class] = true;
          }
          return res;
        });
        if (typeof term._l5rSummary === "function") {
          term._l5rSummary();
        }
      }
      return term;
    });

    // Recompute summary
    roll.l5rSummary();

    // Add roll & history to message
    this.roll = roll;
  }

  /**
   * Send the new roll in chat and delete the old message
   * @returns {Promise<void>}
   * @private
   */
  async _toChatMessage() {
    const oldMsgId = this._message?.id;
    const rollMode = this._message?.rollMode ?? game.settings.get("core", "rollMode");
    const msgOptions = {
      flavor: this._message?.flavor,
      flags: this._message?.flags,
      whisper: this._message?.whisper,
      blind: this._message?.blind,
    };

    // Try to update the existing chat message in place
    if (oldMsgId) {
      try {
        const content = await this.roll.render({});
        const updateData = {
          "content": content,
          "rolls": [this.roll],
          "flags.gfl5r.rnkHistory": this.roll.gfl5r.history,
        };
        await ChatMessage.implementation.updateDocuments([{ _id: oldMsgId, ...updateData }]);
        this.message = game.messages.get(oldMsgId);
      } catch (err) {
        console.warn("GFL5R | Failed in-place update, creating new message", err);
        this.message = await this.roll.toMessage(msgOptions, { rollMode });
      }
    } else {
      this.message = await this.roll.toMessage(msgOptions, { rollMode });
    }

    // Refresh cache
    game.gfl5r = game.gfl5r || {};
    game.gfl5r._rnkCache = game.gfl5r._rnkCache || {};
    if (oldMsgId) delete game.gfl5r._rnkCache[oldMsgId];
    if (this.message?.id) game.gfl5r._rnkCache[this.message.id] = this;

    // Broadcast refresh to other clients
    try {
      game.socket?.emit("system.gfl5r", {
        action: "rnk-refresh",
        id: this.message?.id || oldMsgId,
        strifeApplied: this.roll?.gfl5r?.strifeApplied ?? null,
      });
    } catch (err) {
      console.warn("GFL5R | Socket broadcast failed", err);
    }

    // Delete old chat message if setting enabled and we created a new one
    if (oldMsgId && this.message?.id && oldMsgId !== this.message.id && game.settings.get("gfl5r", "rnk-deleteOldMessage")) {
      const message = game.messages.get(oldMsgId);
      if (message) {
        try {
          await message.delete();
        } catch (err) {
          console.warn("GFL5R | Unable to delete previous roll message", err);
        }
      }
    }
  }

  /**
   * This method is called upon form submission after form data is validated
   * @param event    The initial triggering submission event
   * @param formData The object of validated form data with which to update the object
   * @returns        A Promise which resolves once the update operation has completed
   * @override
   */
  async _updateObject(event, formData) {
    if (!this.isEditable) {
      return;
    }

    // Final strife application step
    if (this.roll?.gfl5r?.rnkEnded && formData.strifeApplied !== undefined) {
      const actor = (() => {
        const a = this.roll.gfl5r.actor;
        if (a instanceof Actor) return a;
        if (a?.uuid) {
          const doc = fromUuidSync(a.uuid);
          if (doc instanceof Actor) return doc;
          if (doc instanceof TokenDocument) return doc.actor;
        }
        const speaker = this._message?.speaker || {};
        if (speaker.actor) {
          const doc = game.actors.get(speaker.actor);
          if (doc) return doc;
        }
        if (speaker.token) {
          const scene = speaker.scene ? game.scenes.get(speaker.scene) : canvas?.scene;
          const tokDoc = scene?.tokens?.get(speaker.token) || canvas?.tokens?.get(speaker.token)?.document;
          if (tokDoc?.actor) return tokDoc.actor;
        }
        return null;
      })();
      if (actor?.isOwner && actor.type === "character" && actor.system?.resources) {
        const currentApplied = Number.isFinite(Number(this._strifeInitial ?? this.roll.gfl5r.strifeApplied))
          ? Number(this._strifeInitial ?? this.roll.gfl5r.strifeApplied)
          : 0;
        const maxStrife = Math.max(0, Number(this.roll.gfl5r.summary?.strife ?? 0));
        const composureCap = (() => {
          const approaches = actor.system?.approaches || {};
          const resilience = Number(approaches.resilience ?? 0);
          const swiftness = Number(approaches.swiftness ?? 0);
          const cap = (resilience + swiftness) * 2;
          return Number.isFinite(cap) && cap > 0 ? cap : maxStrife || 0;
        })();
        const requestedRaw = Number(formData.strifeApplied ?? this.roll.gfl5r.strifeApplied ?? 0);
        const requested = Math.max(
          0,
          Math.min(
            maxStrife || 0,
            composureCap || maxStrife || 0,
            Number.isFinite(requestedRaw) ? requestedRaw : 0
          )
        );
        const delta = requested - currentApplied;
        const cur = Number(actor.system.resources?.strife ?? 0);
        const newStrife = Math.max(0, Number.isFinite(cur + delta) ? cur + delta : cur || 0);
        await actor.update({ "system.resources.strife": newStrife });
        this.roll.gfl5r.strifeApplied = requested;
        this._strifeInitial = requested;
        await this._toChatMessage();
      }
      return this.close();
    }

    // Discard all dices without a choice for the current step
    this._forceChoiceForDiceWithoutOne(RollnKeepDialog.CHOICES.discard);

    // Apply all choices to build the next step
    await this._applyChoices();

    // *** Below this the current step become the next step ***
    this.object.currentStep++;

    // Rebuild the roll
    await this._rebuildRoll(false);

    // Send the new roll in chat and delete the old message
    await this._toChatMessage();

    // If a next step exist, rerender, else close
    if (this.object.dicesList[this.object.currentStep] || this.roll?.gfl5r?.summary?.strife > 0) {
      return this.render(false);
    }
    return this.close();
  }

  /**
   * Undo the last step choice
   * @returns {Promise<Application|any>}
   * @private
   */
  async _undoLastStepChoices() {
    // Find the step to work to
    this.object.currentStep = this.object.dicesList[this.object.currentStep]
      ? this.object.currentStep
      : Math.max(0, this.object.currentStep - 1);

    // If all clear, delete this step
    if (this._haveChoice(this.object.currentStep, RollnKeepDialog.CHOICES.nothing)) {
      if (this.object.currentStep === 0) {
        return;
      }
      this.object.dicesList.pop();
      this.object.dicesList = this.object.dicesList.filter((e) => !!e);
      this.object.currentStep--;
    }

    // Clear choices
    this.object.dicesList[this.object.currentStep]
      .filter((e) => !!e)
      .map((e) => {
        e.choice = RollnKeepDialog.CHOICES.nothing;
        return e;
      });

    this._editable = this.isOwner;
    await this._rebuildRoll(true);
    await this._toChatMessage();
    return this.render(false);
  }

  /**
   * Handle execution of a chat card action via a click event on the RnK button
   * @param {Event} event The originating click event
   * @returns {Promise}   A promise which resolves once the handler workflow is complete
   */
  static async onChatAction(event) {
    event.preventDefault();
    event.stopPropagation();

    // Extract card data
    const button = $(event.currentTarget);
    button.attr("disabled", true);
    const card = button.parents(".item-display.dices-l5r");
    const messageId = card.parents(".chat-message").data("message-id");
    if (!messageId) {
      button.attr("disabled", false);
      return;
    }

    // Already open ? close it
    game.gfl5r = game.gfl5r || {};
    game.gfl5r._rnkCache = game.gfl5r._rnkCache || {};
    const app = game.gfl5r._rnkCache[messageId];
    if (app) {
      app.close();
      delete game.gfl5r._rnkCache[messageId];
    } else {
      const dlg = new RollnKeepDialog(messageId);
      game.gfl5r._rnkCache[messageId] = dlg;
      dlg.render(true);
    }

    // Re-enable the button
    button.attr("disabled", false);
  }

  static async #onContinueAction(event) {
    event.preventDefault();
    await this._continue();
  }

  static async #onFinishAction(event) {
    event.preventDefault();
    await this._finish();
  }

  static #onCancelAction(event) {
    event.preventDefault();
    this.close();
  }
}

export function registerDiceTerms() {
  CONFIG.Dice.terms["r"] = RingDie;
  CONFIG.Dice.terms["s"] = AbilityDie;
  if (!Array.isArray(CONFIG.Dice.rolls)) {
    CONFIG.Dice.rolls = [];
  }
  if (!CONFIG.Dice.rolls.includes(RollGFL5R)) {
    CONFIG.Dice.rolls.push(RollGFL5R);
  }
  // also support legacy object-style lookup used by some modules
  CONFIG.Dice.rolls[RollGFL5R.name] = RollGFL5R;
  CONFIG.Dice.rolls["RollGFL5R"] = RollGFL5R;
  CONFIG.Dice.rolls["rollgfl5r"] = RollGFL5R;

  CONFIG.gfl5r = CONFIG.gfl5r || {};
  CONFIG.gfl5r.paths = PATHS;

  game.gfl5r = game.gfl5r || {};
  game.gfl5r.L5rBaseDie = L5rBaseDie;
  game.gfl5r.RingDie = RingDie;
  game.gfl5r.AbilityDie = AbilityDie;
  game.gfl5r.RollGFL5R = RollGFL5R;
  game.gfl5r.RollnKeepDialog = RollnKeepDialog;

  // Ensure Roll.fromData patch exists
  patchRollFromData();
}
