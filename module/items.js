import { GFL5R_CONFIG } from "./config.js";

const ItemSheet = foundry.appv1.sheets.ItemSheet;

/**
 * Shared helpers for item sheets to keep default options DRY.
 */
class GFL5RBaseItemSheet extends ItemSheet {
  static buildDefaultOptions(width, height) {
    const opts = super.defaultOptions;
    return foundry.utils.mergeObject(opts, {
      classes: ["sheet", "item"],
      width,
      height
    });
  }
}

class GFL5RSkillSheet extends GFL5RBaseItemSheet {
  async getData(options) {
    const context = await super.getData(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RAbilitySheet extends GFL5RSkillSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 500); }
  get template() { return "systems/gfl5r/templates/item-ability.html"; }
}

export class GFL5RWeaponSheet extends GFL5RSkillSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 600); }
  get template() { return "systems/gfl5r/templates/item-weapon.html"; }
}

export class GFL5RArmorSheet extends GFL5RBaseItemSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 500); }
  get template() { return "systems/gfl5r/templates/item-armor.html"; }
}

export class GFL5RNarrativeSheet extends GFL5RBaseItemSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 500); }
  get template() { return "systems/gfl5r/templates/item-narrative.html"; }
}

export class GFL5RItemSheet extends GFL5RBaseItemSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 450); }
  get template() { return "systems/gfl5r/templates/item-item.html"; }
}

export class GFL5RDisciplineSheet extends GFL5RSkillSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 600); }
  get template() { return "systems/gfl5r/templates/item-discipline.html"; }

  async getData(options) {
    const context = await super.getData(options);
    const skills = context.item?.system?.associatedSkills;
    context.associatedSkills = Array.isArray(skills) ? skills : [];
    return context;
  }
}

export class GFL5RModuleSheet extends GFL5RBaseItemSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 550); }
  get template() { return "systems/gfl5r/templates/item-module.html"; }
}

export class GFL5RConditionSheet extends GFL5RBaseItemSheet {
  static get defaultOptions() { return this.buildDefaultOptions(600, 500); }
  get template() { return "systems/gfl5r/templates/item-condition.html"; }
}

export function registerItemSheets() {
  const Items = foundry.documents.collections.Items;
  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RWeaponSheet, { types: ["weaponry"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RNarrativeSheet, { types: ["narrative"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RItemSheet, { types: ["item"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RDisciplineSheet, { types: ["discipline"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RModuleSheet, { types: ["module"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RConditionSheet, { types: ["condition"], makeDefault: true });
}
