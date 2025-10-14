export class GFL5RActorSheet extends ActorSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "actor"],
      width: 640,
      height: 600,
      tabs: [{ navSelector: ".tabs", contentSelector: ".sheet-body", initial: "skills" }]
    });
  }

  get template() {
    return "systems/gfl5r/templates/actor-sheet.html";
  }

  /** v12: async getData */
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
    context.derived = {
      endurance: (power + resilience) * 2,
      composure: (resilience + swiftness) * 2,
      vigilance: Math.ceil((precision + swiftness) / 2),
      focus: power + precision,
      fortunePointsMax: fortune,
      fortunePointsCurrent: Math.floor(fortune / 2)
    };

    // Convenience for templates
    context.skills = data.skills ?? {};
    return context;
  }
}

/** Register the sheet(s) for this system */
export function registerActorSheets() {
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("gfl5r", GFL5RActorSheet, { makeDefault: true });
}
