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

/** Register the sheet(s) */
export function registerActorSheets() {
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, { makeDefault: true });
}
