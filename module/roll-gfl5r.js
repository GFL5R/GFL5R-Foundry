/**
 * GFL5R Roll class (lightly adapted from l5r5e RollL5r5e).
 * Tracks keep/reroll history and summary for RNK workflows.
 */
export class RollGFL5R extends Roll {
  static get CHAT_TEMPLATE() {
    const systemId = game?.system?.id ?? "gfl5r";
    return `systems/${systemId}/templates/dice/chat-roll.html`;
  }

  static get TOOLTIP_TEMPLATE() {
    const systemId = game?.system?.id ?? "gfl5r";
    return `systems/${systemId}/templates/dice/tooltip.html`;
  }

  /** Face metadata keyed by result number */
  static RING_FACES = {
    1: { s: 0, o: 0, r: 0, x: false, key: "blank" },
    2: { s: 0, o: 1, r: 1, x: false, key: "opp-strife" },
    3: { s: 0, o: 1, r: 0, x: false, key: "opp" },
    4: { s: 1, o: 0, r: 1, x: false, key: "success-strife" },
    5: { s: 1, o: 0, r: 0, x: false, key: "success" },
    6: { s: 1, o: 0, r: 1, x: true, key: "explosive-strife" }
  };

  static ABILITY_FACES = {
    1: { s: 0, o: 0, r: 0, x: false, key: "blank" },
    2: { s: 0, o: 0, r: 0, x: false, key: "blank" },
    3: { s: 0, o: 1, r: 0, x: false, key: "opp" },
    4: { s: 0, o: 1, r: 0, x: false, key: "opp" },
    5: { s: 0, o: 1, r: 0, x: false, key: "opp" },
    6: { s: 1, o: 0, r: 1, x: false, key: "success-strife" },
    7: { s: 1, o: 0, r: 1, x: false, key: "success-strife" },
    8: { s: 1, o: 0, r: 0, x: false, key: "success" },
    9: { s: 1, o: 0, r: 0, x: false, key: "success" },
    10:{ s: 1, o: 1, r: 0, x: false, key: "success-opp" },
    11:{ s: 1, o: 0, r: 1, x: true,  key: "explosive-strife" },
    12:{ s: 1, o: 0, r: 0, x: true,  key: "explosive" }
  };

  /** Specific data for GFL5R */
  gfl5r = {
    actor: null,
    difficulty: 2,
    difficultyHidden: false,
    // RNK history: array of steps, each step an array of dice with {face, choice, class?, type}
    history: [],
    initialFormula: null,
    isInitiativeRoll: false,
    item: null,
    keepLimit: null,
    dicesTypes: { l5r: true, std: false },
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
      strife: 0
    },
    target: null,
    voidPointUsed: false
  };

  constructor(formula, data = {}, options = {}) {
    super(formula, data, options);
    const flavors = Array.from(formula.matchAll(/\d+d([sr])\[([^\]]+)\]/gmu));
    flavors.forEach((res) => {
      if (res[1] === "r" && res[2] && !this.gfl5r.stance) this.gfl5r.stance = res[2];
      if (res[1] === "s" && res[2] && !this.gfl5r.skillId) this.gfl5r.skillId = res[2];
    });
    const targetToken = Array.from(game.user.targets).values().next()?.value?.document;
    if (targetToken) this.target = targetToken;
  }

  set actor(actor) {
    this.gfl5r.actor = actor instanceof Actor && actor.isOwner ? actor : null;
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
    this.gflSummary();
    return this;
  }

  _faceMeta(term, result) {
    if (term.faces === 6) return RollGFL5R.RING_FACES[result] || RollGFL5R.RING_FACES[1];
    if (term.faces === 12) return RollGFL5R.ABILITY_FACES[result] || RollGFL5R.ABILITY_FACES[1];
    return { s: 0, o: 0, r: 0, x: false, key: "blank" };
  }

  gflSummary() {
    const summary = this.gfl5r.summary;
    summary.success = 0;
    summary.explosive = 0;
    summary.opportunity = 0;
    summary.strife = 0;
    summary.totalSuccess = 0;

    const tallyTerm = (term) => {
      if (!(term instanceof foundry.dice.terms.Die)) return;
      term.results.forEach((r) => {
        const meta = this._faceMeta(term, r.result);
        summary.success += meta.s;
        summary.explosive += meta.x ? 1 : 0;
        summary.opportunity += meta.o;
        summary.strife += meta.r;
        summary.totalSuccess += meta.s;
      });
    };

    this.terms.forEach(tallyTerm);
    this._dice?.forEach(tallyTerm);

    if (!this.gfl5r.keepLimit) {
      const ringCount = this.dice.reduce((acc, term) => (term.faces === 6 ? acc + term.number : acc), 0);
      this.gfl5r.keepLimit = ringCount + Math.max(0, this.gfl5r.skillAssistance || 0);
      if (!this.gfl5r.keepLimit) {
        this.gfl5r.keepLimit = this.dice.reduce((acc, term) => (term.faces === 12 ? acc + term.number : acc), 0);
      }
    }

    summary.totalBonus = Math.max(0, summary.totalSuccess - this.gfl5r.difficulty);
    if (this.gfl5r.history) {
      const last = this.gfl5r.history[this.gfl5r.history.length - 1] || [];
      this.gfl5r.rnkEnded = !last.some((e) => !!e && e.choice === null);
    }
  }

  get total() {
    // Hide total when using custom dice; RNK uses summary instead.
    return this._evaluated ? this._total : null;
  }

  async getTooltip() {
    try {
      const parts = this.dice.map((term) => ({
        formula: term.formula,
        total: term.total,
        faces: term.faces,
        rolls: term.results.map((r) => ({
          result: this._faceMeta(term, r.result)?.key || r.result,
          classes: []
        }))
      }));
      return foundry.applications.handlebars.renderTemplate(this.constructor.TOOLTIP_TEMPLATE, { parts, gfl5r: this.gfl5r });
    } catch (err) {
      console.warn("GFL5R | Tooltip render failed, falling back", err);
      return "";
    }
  }

  async render(chatOptions = {}) {
    chatOptions = foundry.utils.mergeObject(
      { user: game.user.id, flavor: null, template: this.constructor.CHAT_TEMPLATE, blind: false },
      chatOptions
    );

    if (!this._evaluated) await this.roll();

    const chatData = {
      formula: this._formula,
      flavor: chatOptions.flavor || this.options.flavor,
      user: chatOptions.user,
      tooltip: await this.getTooltip(),
      total: this.total,
      gfl5r: this.gfl5r
    };

    try {
      return await foundry.applications.handlebars.renderTemplate(chatOptions.template, chatData);
    } catch (err) {
      console.warn("GFL5R | Chat render failed, using fallback markup", err);
      return `<div class="gfl5r-roll">${chatData.flavor ?? ""}</div>`;
    }
  }

  async toMessage(messageData = {}, { rollMode = null } = {}) {
    if (!this._evaluated) await this.evaluate();
    const rMode = rollMode || messageData.rollMode || game.settings.get("core", "rollMode");
    if (rMode) messageData = ChatMessage.applyRollMode(messageData, rMode);

    const content = await this.render({});
    messageData = foundry.utils.mergeObject(
      {
        user: game.user.id,
        content,
        sound: CONFIG.sounds.dice,
        speaker: {
          actor: this.gfl5r.actor?.id || null,
          token: this.gfl5r.actor?.token || null,
          alias: this.gfl5r.actor?.name || null
        }
      },
      messageData
    );
    messageData.rolls = [this];
    return ChatMessage.implementation.create(messageData, { rollMode: rMode });
  }

  static fromData(data) {
    const roll = super.fromData(data);
    roll.data = foundry.utils.duplicate(data.data);
    roll.gfl5r = foundry.utils.duplicate(data.gfl5r);

    if (data.gfl5r?.actor?.uuid) {
      const actor = fromUuidSync(data.gfl5r.actor.uuid);
      if (actor instanceof Actor) roll.gfl5r.actor = actor;
    }
    if (data.gfl5r?.target?.uuid) {
      const tgt = fromUuidSync(data.gfl5r.target.uuid);
      if (tgt instanceof TokenDocument) roll.gfl5r.target = tgt;
    }
    return roll;
  }

  toJSON() {
    const json = super.toJSON();
    json.data = foundry.utils.duplicate(this.data);
    json.gfl5r = foundry.utils.duplicate(this.gfl5r);
    if (json.gfl5r?.actor?.uuid) json.gfl5r.actor = { uuid: this.gfl5r.actor.uuid };
    if (json.gfl5r?.target?.uuid) json.gfl5r.target = { uuid: this.gfl5r.target.uuid };
    return json;
  }
}
