export class GFL5RAbilitySheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "item"],
      width: 600,
      height: 500
    });
  }

  get template() { return "systems/gfl5r/templates/item-ability.html"; }
}

export class GFL5RWeaponSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "item"],
      width: 600,
      height: 550
    });
  }

  get template() { return "systems/gfl5r/templates/item-weapon.html"; }
}

export class GFL5RArmorSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["gfl5r", "sheet", "item"],
      width: 600,
      height: 500
    });
  }

  get template() { return "systems/gfl5r/templates/item-armor.html"; }
}

export function registerItemSheets() {
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RWeaponSheet, { types: ["weaponry"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RArmorSheet, { types: ["armor"], makeDefault: true });
}
