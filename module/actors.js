export class GFL5RActorSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "actor"],
      width: 700,
      height: 650,
      // You kept a single "Skills" tab; header is above .sheet-body, which is fine.
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  get template() {
    return "systems/gfl5r/templates/actor-sheet.html";
  }

  /** v12+: async getData */
  async getData(options) {
    const context = await super.getData(options);
    const data = context.actor.system ?? {};

    // Approaches
    const power = data.approaches?.power ?? 0;
    const swiftness = data.approaches?.swiftness ?? 0;
    const resilience = data.approaches?.resilience ?? 0;
    const precision = data.approaches?.precision ?? 0;
    const fortune = data.approaches?.fortune ?? 0;

    // Derived attributes
    const endurance  = (power + resilience) * 2;
    const composure  = (resilience + swiftness) * 2;
    const vigilance  = Math.ceil((precision + swiftness) / 2);
    const focus      = power + precision;
    const fpMax      = fortune;

    // Current FP is now persistent at system.resources.fortunePoints.
    // If you want a lazy default when the saved value is undefined or null, fall back to half Fortune.
    const fpCurrent  = (data.resources?.fortunePoints ?? Math.floor(fpMax / 2));

    context.derived = {
      endurance,
      composure,
      vigilance,
      focus,
      fortunePointsMax: fpMax,
      fortunePointsCurrent: fpCurrent
    };

    // expose skills for convenience if you loop later
    context.skills = data.skills ?? {};
    return context;
  }
}

activateListeners(html) {
    super.activateListeners(html);
    console.log("GFL5R | activateListeners()");

    // Delete ability
    html.on("click", ".gfl-ability-delete", ev => {
      const id = ev.currentTarget?.dataset?.itemId;
      if (!id) return;
      return this.actor.deleteEmbeddedDocuments("Item", [id]);
    });
  }

  /** Accept dropped Items (from compendia or sidebar) into the drop zone */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    // Only react if dropped on our drop zone (has data-drop-target)
    const dropTarget = event.target?.closest?.("[data-drop-target='abilities']");
    if (!dropTarget) return super._onDrop(event);

    // Resolve a Document from the drop
    let itemDoc;
    try {
      if (data?.uuid) {
        const doc = await fromUuid(data.uuid);
        if (doc?.documentName === "Item") itemDoc = doc;
      }
      if (!itemDoc) {
        // Foundry v12 compat: Item.implementation.fromDropData if present
        const fromDrop = Item.implementation?.fromDropData ?? Item.fromDropData;
        itemDoc = await fromDrop(data);
      }
    } catch (err) {
      ui.notifications?.error("Unable to import dropped item.");
      console.error(err);
      return;
    }
    if (!itemDoc) return;

    // Normalize to type "ability" (clone if needed)
    let itemData = itemDoc.toObject();
    itemData.type = "ability"; // force type for our sheet
    // If compendium item had a description in system, keep it; else try itemDoc.system?.description
    if (!itemData.system) itemData.system = {};
    itemData.system.description ??= itemDoc.system?.description ?? "";

    // Create on actor (duplicates by name are allowed; up to you to dedupe later)
    await this.actor.createEmbeddedDocuments("Item", [itemData]);

    // Subtle UI feedback
    dropTarget.classList.add("gfl-drop-ok");
    setTimeout(() => dropTarget.classList.remove("gfl-drop-ok"), 400);
  }
}

export function registerActorSheets() {
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, { makeDefault: true });
}
