// module/dice.js
/* GFL5R Custom Dice + Roller UI */

export class GFLBlackDie extends Die {
  static DENOMINATION = "b";
  constructor(termData) {
    super({ faces: 6, ...termData });
    this.options.colorset = "dark";
  }
  constructor(termData) {
    super({faces: 6, ...termData});
    this.options.colorset = "dark"; // purely cosmetic if you use dice so nice
  }
  /** Map each face to a semantic payload */
  getResultLabel(result) {
    // 1 Blank
    // 2 Opportunity + Strife
    // 3 Opportunity
    // 4 Success + Strife
    // 5 Success
    // 6 Explosive Success + Strife
    const map = {
      1: {s:0, o:0, r:0, x:false, text:"Blank"},
      2: {s:0, o:1, r:1, x:false, text:"Opp+Strife"},
      3: {s:0, o:1, r:0, x:false, text:"Opportunity"},
      4: {s:1, o:0, r:1, x:false, text:"Success+Strife"},
      5: {s:1, o:0, r:0, x:false, text:"Success"},
      6: {s:1, o:0, r:1, x:true,  text:"Explosive+Strife"}
    };
    return map[result.result];
  }
  /** Inject semantic data so the roller app can read it */
  getResultLabelHTML(r) { return this.getResultLabel(r); }
  roll({minimize=false, maximize=false}={}) {
    const rr = super.roll({minimize, maximize});
    const info = this.getResultLabel(rr);
    rr.success = info.s; rr.opportunity = info.o; rr.strife = info.r; rr.explosive = info.x;
    rr.label = info.text;
    return rr;
  }
}

export class GFLWhiteDie extends Die {
  static DENOMINATION = "w";
  constructor(termData) {
    super({ faces: 12, ...termData });
    this.options.colorset = "light";
  }
  constructor(termData) {
    super({faces: 12, ...termData});
    this.options.colorset = "light";
  }
  getResultLabel(result) {
    // faces 1..12, per spec
    const map = {
      1:  {s:0,o:0,r:0,x:false, text:"Blank"},
      2:  {s:0,o:0,r:0,x:false, text:"Blank"},
      3:  {s:0,o:1,r:0,x:false, text:"Opportunity"},
      4:  {s:0,o:1,r:0,x:false, text:"Opportunity"},
      5:  {s:0,o:1,r:0,x:false, text:"Opportunity"},
      6:  {s:1,o:0,r:1,x:false, text:"Success+Strife"},
      7:  {s:1,o:0,r:1,x:false, text:"Success+Strife"},
      8:  {s:1,o:0,r:0,x:false, text:"Success"},
      9:  {s:1,o:0,r:0,x:false, text:"Success"},
      10: {s:1,o:1,r:0,x:false, text:"Success+Opportunity"},
      11: {s:1,o:0,r:1,x:true,  text:"Explosive+Strife"},
      12: {s:1,o:0,r:0,x:true,  text:"Explosive"}
    };
    return map[result.result];
  }
  getResultLabelHTML(r) { return this.getResultLabel(r); }
  roll({minimize=false, maximize=false}={}) {
    const rr = super.roll({minimize, maximize});
    const info = this.getResultLabel(rr);
    rr.success = info.s; rr.opportunity = info.o; rr.strife = info.r; rr.explosive = info.x;
    rr.label = info.text;
    return rr;
  }
}

/** Register terms */
export function registerDiceTerms() {
  CONFIG.Dice.terms.b = GFLBlackDie;
  CONFIG.Dice.terms.w = GFLWhiteDie;
  CONFIG.Dice.terms.B = GFLBlackDie;  // usage: B
  CONFIG.Dice.terms.W = GFLWhiteDie;  // usage: W
}

/* ============================
   ROLLER APP
   ============================ */

export class GFLRollerApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["gfl5r", "sheet", "gfl-roller"],
      width: 620,
      height: "auto",
      template: `systems/${game.system.id}/templates/roller.html`,
      title: "GFL5R Roll"
    });
  }

  /**
   * @param {object} opts
   * - actor: Actor
   * - skillKey: string
   * - skillLabel: string
   * - approach: number
   * - approachName: string
   * - tn: number|null (null if hidden)
   * - hiddenTN: boolean
   */
  constructor(opts) {
    super(opts);
    this.actor = opts.actor;
    this.skillKey = opts.skillKey;
    this.skillLabel = opts.skillLabel;
    this.approach = opts.approach;
    this.approachName = opts.approachName;
    this.tn = opts.tn;
    this.hiddenTN = !!opts.hiddenTN;

    // State
    this.keepLimit = this.approach;
    this.pool = [];          // all current rolled dice for the step
    this.kept = [];          // dice kept this step (persist across steps)
    this.discarded = [];
    this.toReroll = [];
    this.pendingExplosions = []; // dice {type:"B"|"W"} to roll next step (do not count vs keep)
    this.tally = {s:0, o:0, r:0};
  }

  /* ---------- RENDER ---------- */
  async getData() {
    return {
      skillLabel: this.skillLabel,
      approachName: this.approachName,
      keepLimit: this.keepLimit,
      keptCount: this.kept.length,
      tn: this.hiddenTN ? null : (this.tn ?? 0),
      hiddenTN: this.hiddenTN,
      pool: this.pool,
      kept: this.kept,
      discarded: this.discarded,
      toReroll: this.toReroll,
      tally: this.tally
    };
  }

  activateListeners(html) {
    super.activateListeners(html);

    // drag & drop dice chips
    html[0].querySelectorAll(".gfl-die").forEach(node => {
      node.addEventListener("dragstart", ev => {
        ev.dataTransfer.setData("text/plain", node.dataset.id);
      });
    });

    const makeDrop = (selector, dest) => {
      const el = html[0].querySelector(selector);
      if (!el) return;
      el.addEventListener("dragover", e => e.preventDefault());
      el.addEventListener("drop", e => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain");
        this._moveDie(id, dest);
      });
    };

    makeDrop(".gfl-pool", "pool");
    makeDrop(".gfl-keep", "kept");
    makeDrop(".gfl-reroll", "reroll");
    makeDrop(".gfl-discard", "discard");

    html.find(".gfl-continue").on("click", () => this._continue());
    html.find(".gfl-cancel").on("click", () => this.close());
    html.find(".gfl-finish").on("click", () => this._finish());
  }

  /* ---------- FLOW ---------- */
  async start() {
    // Hidden TN bonus fortune
    if (this.hiddenTN) {
      const curr = this.actor.system?.resources?.fortunePoints ?? 0;
      await this.actor.update({"system.resources.fortunePoints": curr + 1});
      ui.notifications?.info("Hidden TN: +1 Fortune Point gained.");
    }
    await this._initialRoll();
    return this.render(true);
  }

  async _initialRoll() {
    const blacks = this.approach;
    // derive skill value from actor
    const whiteCount = foundry.utils.getProperty(this.actor.system, `skills.${this.skillKey}`) ?? 0;

    const roll = await (new Roll(`${blacks}B + ${whiteCount}W`)).roll({async: true});
    this.pool = this._expandDice(roll);
  }

  _expandDice(roll) {
    // Turn into uniform objects we can render & move
    const arr = [];
    for (const d of roll.dice) {
      for (const r of d.results) {
        arr.push({
          id: randomID(),
          type: (d instanceof GFLBlackDie) ? "B" : "W",
          face: r.result,
          label: r.label ?? "",
          success: r.success ?? 0,
          opportunity: r.opportunity ?? 0,
          strife: r.strife ?? 0,
          explosive: !!r.explosive
        });
      }
    }
    return arr;
  }

  _moveDie(id, dest) {
    // move from any bucket into target
    const pull = (list) => {
      const i = list.findIndex(d => d.id === id);
      if (i >= 0) return list.splice(i,1)[0];
      return null;
    };
    const die = pull(this.pool) || pull(this.kept) || pull(this.discarded) || pull(this.toReroll);
    if (!die) return;

    if (dest === "kept") {
      const keptNonExplosive = this.kept.filter(d => !d._counted).length;
      if (keptNonExplosive >= this.keepLimit) {
        ui.notifications?.warn(`Keep limit reached (${this.keepLimit}).`);
        return;
      }
      // count vs limit only if this die is not from explosion
      die._counted = true;
      this.kept.push(die);
      if (die.explosive) this.pendingExplosions.push({type: die.type});
    } else if (dest === "discard") {
      this.discarded.push(die);
    } else if (dest === "reroll") {
      this.toReroll.push(die);
    } else {
      this.pool.push(die);
    }
    this.render(false);
  }

  async _continue() {
    // Tally current kept
    this._recomputeTally();

    // Reroll dice in toReroll; keep and discarded remain
    const b = this.toReroll.filter(d => d.type === "B").length;
    const w = this.toReroll.filter(d => d.type === "W").length;
    this.toReroll = [];

    // Explosions generate extra dice to roll (do not count against keep limit)
    const eb = this.pendingExplosions.filter(e => e.type === "B").length;
    const ew = this.pendingExplosions.filter(e => e.type === "W").length;
    this.pendingExplosions = [];

    const countB = b + eb;
    const countW = w + ew;
    if (countB === 0 && countW === 0) {
      // no more rolls to make, allow finish
      return this.render(false);
    }

    const roll = await (new Roll(`${countB}B + ${countW}W`)).roll({async: true});
    const next = this._expandDice(roll);
    // New results appear back in the pool
    this.pool.push(...next);
    this.render(false);
  }

  _recomputeTally() {
    const t = {s:0,o:0,r:0};
    for (const d of this.kept) {
      t.s += d.success;
      t.o += d.opportunity;
      t.r += d.strife;
    }
    this.tally = t;
  }

  async _finish() {
    this._recomputeTally();
    const s = this.tally.s;
    const o = this.tally.o;
    const r = this.tally.r;

    const tnText = this.hiddenTN ? "(Hidden TN)" : `TN ${this.tn ?? 0}`;
    const pass = this.hiddenTN ? null : (s >= (this.tn ?? 0));
    const flavor = `<strong>${this.actor.name}</strong> rolls <em>${this.skillLabel}</em> with <em>${this.approachName}</em> — ${tnText}`;

    const html = `
    <div class="gfl-roll-card">
      <div class="gfl-roll-summary">
        <div><b>Successes:</b> ${s}</div>
        <div><b>Opportunity:</b> ${o}</div>
        <div><b>Strife:</b> ${r}</div>
        ${pass === null ? "" : `<div><b>Result:</b> ${pass ? "✅ Success" : "❌ Fail"}</div>`}
      </div>
    </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({actor: this.actor}),
      content: html,
      flavor
    });
    this.close();
  }
}
