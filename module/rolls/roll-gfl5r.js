import { GFL5R_CONFIG } from "../config.js";
import { PATHS } from "../dice-constants.js";

// Preserve the base Roll.fromData so we can avoid recursion when patching
const BASE_ROLL_FROM_DATA = Roll.fromData;

// Global Roll.fromData patch to tolerate RollGFL5R even before init hooks run
export function patchRollFromData() {
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
        } catch (error_) {
          console.warn("GFL5R | Roll.fromData ultimate fallback failed", error_);
        }
      }
    }
    return originalFromData.call(this, data);
  };
  Roll._gfl5rPatched = true;
}

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

  roll(options) {
    const extra = options ?? {};
    const opts = { minimize: false, maximize: false, ...extra };
    return super.roll(opts);
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
            choice: game.gfl5r?.RollnKeepDialog?.CHOICES?.nothing ?? null,
          });
        });
      });
      this.gfl5r.history = [firstStep];
    }
  }

  _l5rTermSummary(term) {
    if (!(term instanceof game.gfl5r.L5rBaseDie)) return;
    ["success", "explosive", "opportunity", "strife"].forEach((props) => {
      this.gfl5r.summary[props] += Number.parseInt(term.gfl5r[props]);
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
            choice: game.gfl5r?.RollnKeepDialog?.CHOICES?.nothing ?? null,
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
    const resolveActor = (ref) => {
      if (!ref) return null;
      if (ref instanceof Actor) return ref;
      if (ref.uuid) {
        const doc = fromUuidSync(ref.uuid);
        if (doc instanceof Actor) return doc;
        if (doc instanceof TokenDocument) return doc.actor;
      }
      if (ref.id) {
        const actor = game.actors.get(ref.id);
        if (actor) return actor;
      }
      return null;
    };

    const resolveItem = (ref) => {
      if (!ref) return null;
      if (ref instanceof Item) return ref;
      if (ref.uuid) {
        const doc = fromUuidSync(ref.uuid);
        if (doc) return doc;
      }
      return null;
    };

    const resolveTarget = (ref) => {
      if (!ref) return null;
      if (ref instanceof TokenDocument) return ref;
      if (ref.uuid) {
        const doc = fromUuidSync(ref.uuid);
        if (doc) return doc;
      }
      return null;
    };

    if (!data || typeof data !== "object") {
      return new RollGFL5R("0", {}, {});
    }
    try {
      const roll = BASE_ROLL_FROM_DATA.call(this, data);
      roll.data = foundry.utils.duplicate(data.data);
      roll.gfl5r = foundry.utils.duplicate(data.gfl5r);
      roll.gfl5r.actor = resolveActor(data.gfl5r?.actor);
      roll.gfl5r.item = resolveItem(data.gfl5r?.item);
      roll.gfl5r.target = resolveTarget(data.gfl5r?.target);
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

console.log("GFL5R | roll-gfl5r.js loaded");
