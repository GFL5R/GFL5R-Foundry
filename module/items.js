import { GFL5R_CONFIG } from "./config.js";

export class GFL5RAbilitySheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
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
      classes: ["sheet", "item"],
      width: 600,
      height: 600
    });
  }
  get template() { return "systems/gfl5r/templates/item-weapon.html"; }
}

export class GFL5RArmorSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width: 600,
      height: 500
    });
  }
  get template() { return "systems/gfl5r/templates/item-armor.html"; }
}

export class GFL5RNarrativeSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width: 600,
      height: 500
    });
  }
  get template() { return "systems/gfl5r/templates/item-narrative.html"; }
}

export class GFL5RItemSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width: 600,
      height: 450
    });
  }
  get template() { return "systems/gfl5r/templates/item-item.html"; }
}

export class GFL5RDisciplineSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width: 600,
      height: 600
    });
  }
  get template() { return "systems/gfl5r/templates/item-discipline.html"; }

  async getData(options) {
    const context = await super.getData(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    const skills = context.item?.system?.associatedSkills;
    context.associatedSkills = Array.isArray(skills) ? skills : [];
    return context;
  }
}

export class GFL5RModuleSheet extends ItemSheet {
  static get defaultOptions() {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width: 600,
      height: 550
    });
  }
  get template() { return "systems/gfl5r/templates/item-module.html"; }
}

export function registerItemSheets() {
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RWeaponSheet, { types: ["weaponry"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RNarrativeSheet, { types: ["narrative"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RItemSheet, { types: ["item"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RDisciplineSheet, { types: ["discipline"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RModuleSheet, { types: ["module"], makeDefault: true });
}
