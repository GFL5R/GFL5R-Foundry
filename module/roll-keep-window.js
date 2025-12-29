// module/roll-keep-window.js
// Simple window to display rolled dice faces in a grid.

import { RING_DIE_FACES, SKILL_DIE_FACES } from "./dice.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DragDrop = foundry.applications.ux.DragDrop.implementation;
const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

export class GFLDiceResultWindow extends HandlebarsApplicationMixin(ApplicationV2) {
  #dragDrop;

  constructor(options = {}) {
    super(options);
    this.results = options.results ?? [];
    this.skillLabel = options.skillLabel ?? "";
    this.approachLabel = options.approachLabel ?? "";
    this.tn = options.tn ?? 0;
    this.discarded = options.discarded ?? [];
    this.rerolled = options.rerolled ?? [];
    this.kept = options.kept ?? [];
    this.originalRingCount = this.results.filter(d => d.type === 'ring').length;
    this.chatMessageId = options.chatMessageId || null;
    this.#dragDrop = this.#createDragDropHandlers();
    if (!this.chatMessageId) {
      this._createChatMessage();
    }
  }

  static DEFAULT_OPTIONS = {
    id: "gfl5r-dice-results",
    classes: ["gfl5r", "dialog", "dice-results"],
    width: "auto",
    height: "auto",
    resizable: false,
    title: "Roll & Keep",
    dragDrop: [{ dragSelector: '[data-drag-die]', dropSelector: '[data-drop-die-index], [data-drop-discard], [data-drop-reroll], [data-drop-keep]' }]
  };

  static PARTS = {
    form: {
      template: templatePath("templates/dice-roll-grid.html"),
      scrollable: []
    }
  };

  /**
   * Create drag-and-drop workflow handlers for this Application
   * @returns {DragDrop[]}     An array of DragDrop handlers
   * @private
   */
  #createDragDropHandlers() {
    return this.options.dragDrop.map((d) => {
      d.permissions = {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this),
      };
      d.callbacks = {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this),
      };
      return new DragDrop(d);
    });
  }

  /**
   * Actions performed after any render of the Application.
   * Post-render steps are not awaited by the render process.
   * @param {ApplicationRenderContext} context      Prepared context data
   * @param {RenderOptions} options                 Provided render options
   * @protected
   */
  _onRender(context, options) {
    this.#dragDrop.forEach((d) => d.bind(this.element));
    // Add dragleave listeners for visual feedback
    this.element.querySelectorAll('[data-drop-die-index], [data-drop-discard], [data-drop-reroll], [data-drop-keep]').forEach(el => {
      el.addEventListener('dragleave', () => {
        el.classList.remove('border', 'border-primary', 'border-danger', 'rounded');
      });
    });
    // Add continue button listener
    const continueBtn = this.element.querySelector('[data-action="continue"]');
    if (continueBtn) continueBtn.addEventListener('click', this._onContinue.bind(this));
    // Add finalize button listener
    const finalizeBtn = this.element.querySelector('[data-action="finalize"]');
    if (finalizeBtn) finalizeBtn.addEventListener('click', this._onFinalize.bind(this));
  }

  /**
   * Define whether a user is able to begin a dragstart workflow for a given drag selector
   * @param {string} selector       The candidate HTML selector for dragging
   * @returns {boolean}             Can the current user drag this selector?
   * @protected
   */
  _canDragStart(selector) {
    return true; // Allow dragging for all users
  }

  /**
   * Define whether a user is able to conclude a drag-and-drop workflow for a given drop selector
   * @param {string} selector       The candidate HTML selector for the drop target
   * @returns {boolean}             Can the current user drop on this selector?
   * @protected
   */
  _canDragDrop(selector) {
    return true; // Allow dropping for all users
  }

  /**
   * Callback actions which occur at the beginning of a drag start workflow.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragStart(event) {
    const el = event.currentTarget;
    const data = {
      type: el.dataset.dieType,
      key: el.dataset.dieKey,
      label: el.dataset.dieLabel,
      icon: el.dataset.dieIcon,
      s: Number(el.dataset.dieS) || 0,
      o: Number(el.dataset.dieO) || 0,
      r: Number(el.dataset.dieR) || 0,
      explosive: el.dataset.dieExplosive === "true",
      index: Number(el.dataset.dieIndex) || 0,
      from: el.dataset.from
    };
    event.dataTransfer.setData('text/plain', JSON.stringify(data));
  }

  /**
   * Callback actions which occur when a dragged element is over a drop target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  _onDragOver(event) {
    event.preventDefault();
    const el = event.currentTarget;
    let borderClass = 'border-primary';
    if (el.dataset.dropKeep && this.kept.filter(d => !d.explosion).length >= this.originalRingCount) {
      borderClass = 'border-danger';
    }
    el.classList.add('border', borderClass, 'rounded');
  }

  /**
   * Callback actions which occur when a dragged element is dropped on a target.
   * @param {DragEvent} event       The originating DragEvent
   * @protected
   */
  async _onDrop(event) {
    const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
    const el = event.currentTarget;
    // Get the die from the source array
    let die;
    if (data.from) {
      const sourceArray = this[data.from];
      if (!Array.isArray(sourceArray) || data.index < 0 || data.index >= sourceArray.length) return;
      die = sourceArray.splice(data.index, 1)[0];
    } else {
      // From swap bars
      die = {
        type: data.type,
        key: data.key,
        label: data.label,
        icon: data.icon,
        s: Number(data.s) || 0,
        o: Number(data.o) || 0,
        r: Number(data.r) || 0,
        explosive: Boolean(data.explosive),
        hasExploded: false
      };
    }
    // Now add to the target
    if (el.dataset.dropDieIndex !== undefined) {
      const index = Number(el.dataset.dropDieIndex);
      if (data.from === undefined) {
        // From swap, replace the slot
        if (index >= 0 && index < this.results.length) {
          this.results[index] = die;
        }
      } else {
        // From middle areas, add to the list
        this.results.push(die);
      }
    } else if (el.dataset.dropDiscard !== undefined) {
      this.discarded.push(die);
    } else if (el.dataset.dropReroll !== undefined) {
      this.rerolled.push(die);
    } else if (el.dataset.dropKeep !== undefined) {
      const nonExplosionKept = this.kept.filter(d => !d.explosion).length;
      if (die.explosion || nonExplosionKept < this.originalRingCount) {
        this.kept.push(die);
      } else {
        // Put back into dice tray
        this.results.push(die);
      }
    }
    this.render(false);
  }

  /**
   * Handle the continue button click.
   * @protected
   */
  async _onContinue() {
    // Ensure hasExploded is set
    this.kept.forEach(d => d.hasExploded = d.hasExploded || false);
    this.results.forEach(d => d.hasExploded = d.hasExploded || false);
    this.discarded.forEach(d => d.hasExploded = d.hasExploded || false);
    this.rerolled.forEach(d => d.hasExploded = d.hasExploded || false);

    // Reroll dice in reroll
    const newRolls = [];
    const newKept = [];
    for (const d of this.rerolled) {
      const faces = d.type === 'ring' ? RING_DIE_FACES : SKILL_DIE_FACES;
      const randomFace = faces[Math.floor(Math.random() * faces.length)];
      const newDie = { ...randomFace, explosion: d.explosion || false, hasExploded: false };
      if (d.explosion) {
        newKept.push(newDie);
      } else {
        newRolls.push(newDie);
      }
    }
    this.results.push(...newRolls);
    this.kept.push(...newKept);
    this.rerolled = [];

    // Clear discarded
    this.discarded = [];

    // Handle explosions in kept
    const explosions = [];
    for (const d of this.kept) {
      if (d.explosive && !d.hasExploded) {
        const faces = d.type === 'ring' ? RING_DIE_FACES : SKILL_DIE_FACES;
        const randomFace = faces[Math.floor(Math.random() * faces.length)];
        explosions.push({ ...randomFace, explosion: true, hasExploded: false });
        d.hasExploded = true;
      }
    }
    this.kept.push(...explosions);

    // Ensure explosion property is set
    this.kept.forEach(d => d.explosion = d.explosion || false);
    this.results.forEach(d => d.explosion = d.explosion || false);
    this.discarded.forEach(d => d.explosion = d.explosion || false);
    this.rerolled.forEach(d => d.explosion = d.explosion || false);

    await this._updateChatMessage();
    this.render(false);
  }

  /**
   * Create the initial chat message.
   * @private
   */
  async _createChatMessage() {
    const content = this._generateInitialContent();
    const message = await ChatMessage.create({
      content: content,
      speaker: ChatMessage.getSpeaker()
    });
    this.chatMessageId = message.id;
  }

  /**
   * Update the chat message.
   * @private
   */
  async _updateChatMessage() {
    if (this.chatMessageId) {
      const content = this._generateKeptContent();
      await ChatMessage.updateDocuments([{ _id: this.chatMessageId, content: content }]);
    }
  }

  /**
   * Generate the initial chat message content.
   * @private
   */
  _generateInitialContent() {
    const diceIcons = this.results.map(d => `<img src="${d.icon}" alt="${d.label}" style="width:32px; height:32px; margin:2px;">`).join('');
    return `<h3>Roll & Keep: ${this.skillLabel} via ${this.approachLabel} (TN ${this.tn})</h3><p style="white-space: nowrap;">Rolled: ${diceIcons}</p>`;
  }

  /**
   * Generate the kept chat message content.
   * @private
   */
  _generateKeptContent() {
    const keptIcons = this.kept.map(d => {
      let icon = `<img src="${d.icon}" alt="${d.label}" style="width:32px; height:32px; margin:2px;">`;
      if (d.explosion) {
        icon += `<span style="position:relative; top:-10px; left:-5px; font-size:16px;">✨</span>`;
      }
      return icon;
    }).join('');
    const totalSuccesses = this.kept.reduce((sum, d) => sum + d.s + (d.explosive ? 1 : 0), 0);
    const totalStrife = this.kept.reduce((sum, d) => sum + d.r, 0);
    const totalOpportunity = this.kept.reduce((sum, d) => sum + d.o, 0);
    const isSuccess = totalSuccesses >= this.tn;
    const bonusSuccesses = Math.max(0, totalSuccesses - this.tn);
    return `<h3>Roll & Keep: ${this.skillLabel} via ${this.approachLabel} (TN ${this.tn})</h3><p style="white-space: nowrap;">Kept: ${keptIcons}</p><p>Success: ${isSuccess ? 'Yes' : 'No'} | Bonus Successes: ${bonusSuccesses} | Strife: ${totalStrife} | Opportunity: ${totalOpportunity}</p>`;
  }

  /**
   * Handle the finalize button click.
   * @protected
   */
  async _onFinalize() {
    await this._updateChatMessage();
    this.close();
  }

  async _prepareContext(options) {
    const dedupeFaces = (faces) => {
      const seen = new Set();
      return faces.filter((face) => {
        const key = `${face.key}-${face.icon}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    return {
      skillLabel: this.skillLabel || "Skill",
      approachLabel: this.approachLabel || "Approach",
      tn: Number(this.tn) || 0,
      results: this.results ?? [],
      discarded: this.discarded ?? [],
      rerolled: this.rerolled ?? [],
      kept: this.kept ?? [],
      canContinue: this.results.length === 0,
      maxKeep: this.originalRingCount,
      isFinalize: this.discarded.length === 0 && this.rerolled.length === 0 && this.kept.filter(d => d.explosive && !d.hasExploded).length === 0 && this.results.length === 0,
      ringFaces: dedupeFaces(RING_DIE_FACES),
      skillFaces: dedupeFaces(SKILL_DIE_FACES)
    };
  }
}

console.log("GFL5R | roll-keep-window.js loaded");
