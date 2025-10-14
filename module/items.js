export class GFL5RAbilitySheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "item"],
      width: 600,
      height: 500
    });
  }

  get template() {
    return "systems/gfl5r/templates/item-ability.html";
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = context.item.system ?? {};
    return context;
  }
}

export function registerItemSheets() {
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
}
