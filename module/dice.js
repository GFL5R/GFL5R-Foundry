// module/dice.js
/* GFL5R Dice Roller — using native d6 (black) and d12 (white)
   No custom terms, no parser issues. */

function payloadBlack(face) {
  // 1..6
  switch (face) {
    case 1: return { s:0, o:0, r:0, x:false, text:"Blank" };
    case 2: return { s:0, o:1, r:1, x:false, text:"Opp+Strife" };
    case 3: return { s:0, o:1, r:0, x:false, text:"Opportunity" };
    case 4: return { s:1, o:0, r:1, x:false, text:"Success+Strife" };
    case 5: return { s:1, o:0, r:0, x:false, text:"Success" };
    case 6: return { s:1, o:0, r:1, x:true,  text:"Explosive+Strife" };
    default: return { s:0, o:0, r:0, x:false, text:"Blank" };
  }
}

function payloadWhite(face) {
  // 1..12
  switch (face) {
    case 1:  return { s:0, o:0, r:0, x:false, text:"Blank" };
    case 2:  return { s:0, o:0, r:0, x:false, text:"Blank" };
    case 3:  return { s:0, o:1, r:0, x:false, text:"Opportunity" };
    case 4:  return { s:0, o:1, r:0, x:false, text:"Opportunity" };
    case 5:  return { s:0, o:1, r:0, x:false, text:"Opportunity" };
    case 6:  return { s:1, o:0, r:1, x:false, text:"Success+Strife" };
    case 7:  return { s:1, o:0, r:1, x:false, text:"Success+Strife" };
    case 8:  return { s:1, o:0, r:0, x:false, text:"Success" };
    case 9:  return { s:1, o:0, r:0, x:false, text:"Success" };
    case 10: return { s:1, o:1, r:0, x:false, text:"Success+Opportunity" };
    case 11: return { s:1, o:0, r:1, x:true,  text:"Explosive+Strife" };
    case 12: return { s:1, o:0, r:0, x:true,  text:"Explosive" };
    default: return { s:0, o:0, r:0, x:false, text:"Blank" };
  }
}

function mapResult(dieTerm, result) {
  // dieTerm.faces === 6 -> black ; 12 -> white
  const isBlack = dieTerm.faces === 6;
  const p = isBlack ? payloadBlack(result) : payloadWhite(result);
  return {
    label: p.text,
    success: p.s, opportunity: p.o, strife: p.r, explosive: p.x,
    type: isBlack ? "B" : "W"
  };
}

function expandRoll(roll) {
  const out = [];
  for (const d of roll.dice) {
    for (const r of d.results) {
      const m = mapResult(d, r.result);
      out.push({
        id: randomID(),
        type: m.type,
        face: r.result,
        label: m.label,
        success: m.success,
        opportunity: m.opportunity,
        strife: m.strife,
        explosive: m.explosive
      });
    }
  }
  return out;
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
    this.approach = opts.approach ?? 0;
    this.approachName = opts.approachName ?? "";
    this.tn = opts.tn;
    this.hiddenTN = !!opts.hiddenTN;

    // State
    this.keepLimit = this.approach;
    this.pool = [];            // current-step rolled dice
    this.kept = [];            // accumulated kept dice (counted vs limit unless explosion bonus)
    this.discarded = [];
    this.toReroll = [];
    this.pendingExplosions = []; // {type:"B"|"W"} to roll next
    this.tally = { s:0, o:0, r:0 };
  }

  async getData() {
    return {
      skillLabel: this.skillLabel,
      approachName: this.approachName,
      keepLimit: this.keepLimit,
      keptCount: this.kept.filter(d => d._counted).length,
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

    // Enable dragging on any existing dice
    const enableDrag = (root) => {
      root.querySelectorAll(".gfl-die").forEach(node => {
        node.addEventListener("dragstart", ev => {
          ev.dataTransfer.setData("text/plain", node.dataset.id);
        });
      });
    };
    enableDrag(html[0]);

    // Handle drops
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

    // Buttons
    html.find(".gfl-continue").on("click", () => this._continue());
    html.find(".gfl-finish").on("click", () => this._finish());
    html.find(".gfl-cancel").on("click", () => this.close());
  }

  async start() {
    // Hidden TN bonus
    if (this.hiddenTN) {
      const curr = this.actor.system?.resources?.fortunePoints ?? 0;
      await this.actor.update({ "system.resources.fortunePoints": curr + 1 });
      ui.notifications?.info("Hidden TN: +1 Fortune Point gained.");
    }
    await this._initialRoll();
    return this.render(true);
  }

  async _initialRoll() {
    const blacks = Math.max(0, Number(this.approach) || 0);
    const whiteCount = Math.max(0, Number(foundry.utils.getProperty(this.actor.system, `skills.${this.skillKey}`)) || 0);

    const expr = [
      blacks > 0 ? `${blacks}d6` : null,
      whiteCount > 0 ? `${whiteCount}d12` : null
    ].filter(Boolean).join(" + ") || "0";

    const roll = await (new Roll(expr)).evaluate({ async:true });
    this.pool = expandRoll(roll);
  }

  _moveDie(id, dest) {
    const take = (arr) => {
      const i = arr.findIndex(d => d.id === id);
      return i >= 0 ? arr.splice(i,1)[0] : null;
    };
    const die = take(this.pool) || take(this.kept) || take(this.discarded) || take(this.toReroll);
    if (!die) return;

    if (dest === "kept") {
      // Only non-explosion dice count against keep limit
      const keptCounted = this.kept.filter(d => d._counted).length;
      if (keptCounted >= this.keepLimit && !die._fromExplosion) {
        ui.notifications?.warn(`Keep limit reached (${this.keepLimit}).`);
        return;
      }
      die._counted = !die._fromExplosion;
      this.kept.push(die);
      if (die.explosive) this.pendingExplosions.push({ type: die.type });
    } else if (dest === "reroll") {
      this.toReroll.push(die);
    } else if (dest === "discard") {
      this.discarded.push(die);
    } else {
      this.pool.push(die);
    }

    this.render(false);
  }

  _recomputeTally() {
    const t = { s:0, o:0, r:0 };
    for (const d of this.kept) {
      t.s += d.success;
      t.o += d.opportunity;
      t.r += d.strife;
    }
    this.tally = t;
  }

  async _continue() {
    this._recomputeTally();

    // Counts for rerolls and explosions
    const bR = this.toReroll.filter(d => d.type === "B").length;
    const wR = this.toReroll.filter(d => d.type === "W").length;
    this.toReroll = [];

    const bE = this.pendingExplosions.filter(e => e.type === "B").length;
    const wE = this.pendingExplosions.filter(e => e.type === "W").length;
    this.pendingExplosions = [];

    const countB = bR + bE;
    const countW = wR + wE;

    if (countB === 0 && countW === 0) {
      // Nothing more to roll
      return this.render(false);
    }

    const expr = [
      countB > 0 ? `${countB}d6` : null,
      countW > 0 ? `${countW}d12` : null
    ].filter(Boolean).join(" + ") || "0";

    const roll = await (new Roll(expr)).evaluate({ async:true });
    const next = expandRoll(roll);

    // Mark explosion dice so they don't count against keep limit when kept
    // (we can't tell which are from explosion vs reroll here, so tag all explosion *results* as fromExplosion=false;
    // the rule is: "Explosives roll an additional die ... which do not count toward keep limit."
    // We know these were bonus dice if they came from bE/wE slice; we can tag the first (bE + wE) items of 'next' by type.
    let remainingBE = bE;
    let remainingWE = wE;
    for (const d of next) {
      if (d.type === "B" && remainingBE > 0) { d._fromExplosion = true; remainingBE--; }
      else if (d.type === "W" && remainingWE > 0) { d._fromExplosion = true; remainingWE--; }
    }

    this.pool.push(...next);
    this.render(false);
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
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: html,
      flavor
    });

    this.close();
  }
}

/* No custom dice to register, but leave the export for consistency */
export function registerDiceTerms() {
  // Intentionally empty (we use d6/d12 and map faces)
}
