// module/dice.js
/* GFL5R Dice Roller — using native d6 (black) and d12 (white)
  Now updates a chat message at each step! */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";

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

function _dieKeyFromFlags({ success, opportunity, strife, explosive }) {
  if (!success && !opportunity && !strife && !explosive) return "blank";
  if (explosive && strife) return "explosive-strife";
  if (explosive) return "explosive";
  if (success && opportunity) return "success-opp";
  if (success && strife) return "success-strife";
  if (success) return "success";
  if (opportunity && strife) return "opp-strife";
  if (opportunity) return "opp";
  return "blank";
}

function _iconPathForDie(type, flags) {
  // type: "B" or "W"
  const base = `systems/${game.system.id}/assets/dice`;
  const folder = type === "B" ? "black" : "white";
  const key = _dieKeyFromFlags(flags);
  return `${base}/${folder}/${key}.png`;
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
      const dieObj = {
        id: randomID(),
        type: m.type,                   // "B" | "W"
        face: r.result,
        label: m.label,
        success: m.success,
        opportunity: m.opportunity,
        strife: m.strife,
        explosive: m.explosive
      };
      dieObj.icon = _iconPathForDie(dieObj.type, dieObj);
      out.push(dieObj);
    }
  }
  return out;
}

/* ============================
   ROLLER APP
   ============================ */

export class GFLRollerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "gfl5r-roller",
    classes: ["sheet", "roller"],
    position: { width: 620, height: "auto" },
    window: { title: "GFL5R Roll" },
    title: "GFL5R Roll",
    actions: {
      "continue-roll": GFLRollerApp.#onContinueAction,
      "finish-roll": GFLRollerApp.#onFinishAction,
      "cancel-roll": GFLRollerApp.#onCancelAction
    }
  };

  static get PARTS() {
    return {
      roller: {
        template: `systems/${systemId()}/templates/roller.html`
      }
    };
  }

  #renderAbort = null;

  /**
   * @param {object} opts
   * - actor: Actor
   * - skillKey: string
   * - skillLabel: string
   * - approach: number
   * - approachName: string
   * - tn: number|null (null if hidden)
   * - hiddenTN: boolean
   * - initiativeCombatantId: string (optional, for initiative rolls)
   * - baseInitiative: number (optional, base initiative value for initiative rolls)
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
    this.initiativeCombatantId = opts.initiativeCombatantId;
    this.baseInitiative = opts.baseInitiative ?? 0;

    // State
    this.keepLimit = this.approach;
    this.pool = [];            // current-step rolled dice
    this.kept = [];            // accumulated kept dice (counted vs limit unless explosion bonus)
    this.discarded = [];
    this.toReroll = [];
    this.pendingExplosions = []; // {type:"B"|"W"} to roll next
    this.tally = { s:0, o:0, r:0 };
    
    // Chat message tracking
    this.chatMessageId = null;
    this.stepNumber = 0;
  }

  async _prepareContext() {
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

  _onRender() {
    const root = this.element;
    if (!root) return;

    this.#renderAbort?.abort();
    this.#renderAbort = new AbortController();
    const { signal } = this.#renderAbort;

    // Enable dragging on any existing dice
    root.querySelectorAll("[data-die-id]").forEach(node => {
      node.addEventListener("dragstart", ev => {
        const dieId = node.dataset.dieId;
        if (!dieId) return;
        ev.dataTransfer?.setData("text/plain", dieId);
      }, { signal });
    });

    this.#bindDropZone(root, "[data-zone='pool']", "pool", signal);
    this.#bindDropZone(root, "[data-zone='keep']", "kept", signal);
    this.#bindDropZone(root, "[data-zone='reroll']", "reroll", signal);
    this.#bindDropZone(root, "[data-zone='discard']", "discard", signal);
  }

  #bindDropZone(root, selector, dest, signal) {
    const el = root.querySelector(selector);
    if (!el) return;
    el.addEventListener("dragover", event => event.preventDefault(), { signal });
    el.addEventListener("drop", event => {
      event.preventDefault();
      const id = event.dataTransfer?.getData("text/plain");
      if (id) this._moveDie(id, dest);
    }, { signal });
  }

  async close(options) {
    this.#renderAbort?.abort();
    return super.close(options);
  }

  async start() {
    // Hidden TN bonus
    if (this.hiddenTN) {
      const curr = this.actor.system?.resources?.fortunePoints ?? 0;
      await this.actor.update({ "system.resources.fortunePoints": curr + 1 });
      ui.notifications?.info("Hidden TN: +1 Fortune Point gained.");
    }
    await this._initialRoll();
    await this._updateChatMessage(); // Create initial message
    await this.render(true);
    return this;
  }

  async _initialRoll() {
    this.stepNumber = 1;
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

    this.render();
    this._updateChatMessage(); // Update after each move
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

  _generateChatContent() {
    this._recomputeTally();
    
    const tnText = this.hiddenTN ? "(Hidden TN)" : `TN ${this.tn ?? 0}`;
    
    // Helper to render dice icons
    const renderDice = (dice, label) => {
      if (dice.length === 0) return "";
      const icons = dice.map(d => {
        const bonus = d._fromExplosion ? "<span class=\"ms-1 text-warning\">✨</span>" : "";
        return `<div class="d-inline-flex align-items-center border rounded p-1 me-1 mb-1" title="${d.label}${d._fromExplosion ? ' (Explosion Bonus)' : ''}" data-die-id="${d.id}"><img src="${d.icon}" alt="${d.label}" style="width:32px;height:32px;">${bonus}</div>`;
      }).join("");
      return `<div class="mb-2"><strong>${label}:</strong><div class="d-flex flex-wrap mt-1">${icons}</div></div>`;
    };

    return `
      <div class="card mb-2">
        <div class="card-body">
          <div class="fw-semibold mb-1">${this.actor.name} rolls <em>${this.skillLabel}</em> with <em>${this.approachName}</em> — ${tnText}</div>
          <div class="text-muted mb-2"><strong>Step ${this.stepNumber}</strong> · Keep Limit: ${this.keepLimit} (${this.kept.filter(d => d._counted).length} used)</div>
          ${renderDice(this.pool, "Pool")}
          ${renderDice(this.kept, "Kept")}
          ${renderDice(this.toReroll, "To Reroll")}
          ${renderDice(this.discarded, "Discarded")}
          ${this.pendingExplosions.length > 0 ? `<div class="mb-2"><strong>Pending Explosions:</strong> ${this.pendingExplosions.length}</div>` : ""}
          <div class="border-top pt-2 mt-2 d-flex flex-column gap-1">
            <div><strong>Current Successes:</strong> ${this.tally.s}</div>
            <div><strong>Current Opportunity:</strong> ${this.tally.o}</div>
            <div><strong>Current Strife:</strong> ${this.tally.r}</div>
          </div>
        </div>
      </div>`;
  }

  async _updateChatMessage() {
    const content = this._generateChatContent();
    
    if (!this.chatMessageId) {
      // Create new message
      const msg = await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        content,
        flavor: `<strong>GFL5R Roll in Progress...</strong>`
      });
      this.chatMessageId = msg.id;
    } else {
      // Update existing message
      const msg = game.messages.get(this.chatMessageId);
      if (msg) {
        await msg.update({ content });
      }
    }
  }

  async _continue() {
    this._recomputeTally();

    // Track rerolls that were originally explosions
    const bR = this.toReroll.filter(d => d.type === "B" && !d._fromExplosion).length;
    const wR = this.toReroll.filter(d => d.type === "W" && !d._fromExplosion).length;
    const bRE = this.toReroll.filter(d => d.type === "B" && d._fromExplosion).length;
    const wRE = this.toReroll.filter(d => d.type === "W" && d._fromExplosion).length;
    this.toReroll = [];

    const bE = this.pendingExplosions.filter(e => e.type === "B").length;
    const wE = this.pendingExplosions.filter(e => e.type === "W").length;
    this.pendingExplosions = [];

    const countB = bR + bRE + bE;
    const countW = wR + wRE + wE;

    if (countB === 0 && countW === 0) {
      // Nothing more to roll
      await this._updateChatMessage();
      return this.render();
    }

    this.stepNumber++;

    const expr = [
      countB > 0 ? `${countB}d6` : null,
      countW > 0 ? `${countW}d12` : null
    ].filter(Boolean).join(" + ") || "0";

    const roll = await (new Roll(expr)).evaluate({ async:true });
    const next = expandRoll(roll);

    // Mark explosion dice so they don't count against keep limit when kept
    // This includes both new explosions and rerolled explosions
    let remainingBE = bE + bRE;
    let remainingWE = wE + wRE;
    for (const d of next) {
      if (d.type === "B" && remainingBE > 0) { 
        d._fromExplosion = true; 
        remainingBE--; 
      } else if (d.type === "W" && remainingWE > 0) { 
        d._fromExplosion = true; 
        remainingWE--; 
      }
    }

    // Auto-keep dice that came FROM explosions, put others in pool
    for (const d of next) {
      if (d._fromExplosion) {
        d._counted = false; // Explosion bonus dice don't count against keep limit
        this.kept.push(d);
        // If this die is also explosive, add to pending explosions
        if (d.explosive) {
          this.pendingExplosions.push({ type: d.type });
        }
      } else {
        this.pool.push(d);
      }
    }
    
    await this._updateChatMessage();
    this.render();
  }

  async _finish() {
    this._recomputeTally();

    const s = this.tally.s;
    const o = this.tally.o;
    const r = this.tally.r;

    // Handle initiative rolls
    if (this.initiativeCombatantId) {
      const combatant = game.combat.combatants.get(this.initiativeCombatantId);
      if (combatant) {
        // For initiative, add successes only if the roll meets the TN
        const meetsTN = this.hiddenTN || s >= (this.tn ?? 0);
        const initiativeBonus = meetsTN ? s : 0;
        const finalInitiative = this.baseInitiative + initiativeBonus;
        
        // Update combatant initiative
        await combatant.update({ initiative: finalInitiative });
      }
    }

    const tnText = this.hiddenTN ? "(Hidden TN)" : `TN ${this.tn ?? 0}`;
    const pass = this.hiddenTN ? null : (s >= (this.tn ?? 0));
    const flavor = `<strong>${this.actor.name}</strong> rolls <em>${this.skillLabel}</em> with <em>${this.approachName}</em> — ${tnText}`;

    const html = `
      <div class="card">
        <div class="card-body d-flex flex-column gap-1">
          <div><b>Final Successes:</b> ${s}</div>
          <div><b>Final Opportunity:</b> ${o}</div>
          <div><b>Final Strife:</b> ${r}</div>
          ${pass === null ? "" : `<div><b>Result:</b> ${pass ? "Success" : "Fail"}</div>`}
        </div>
      </div>`;

    // Update the existing message with final results
    const msg = game.messages.get(this.chatMessageId);
    if (msg) {
      await msg.update({
        content: html,
        flavor: `${flavor} — <strong>COMPLETE</strong>`
      });
    }

    this.close();
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

/* No custom dice to register, but leave the export for consistency */
export function registerDiceTerms() {
  // Intentionally empty (we use d6/d12 and map faces)
}
