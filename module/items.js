import { GFL5R_CONFIG } from "./config.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

const systemId = () => game?.system?.id ?? CONFIG?.system?.id ?? "gfl5r";
const templatePath = (relativePath) => `systems/${systemId()}/${relativePath}`;

class BaseGFLItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static buildOptions({ width, height }) {
    return {
      classes: ["sheet", "item"],
      position: { width, height },
      tag: "form",
      form: {
        submitOnChange: true,
        closeOnSubmit: false
      },
      window: { resizable: true }
    };
  }

  get title() {
    const item = this.document;
    const type = item?.type ?? "Item";
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    const name = item?.name ?? typeLabel;
    return `${typeLabel}: ${name}`;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    context.item = item;
    context.source = item.toObject();
    context.fields = item.schema.fields;
    context.systemFields = item.system.schema?.fields ?? {};
    return context;
  }
}

export class GFL5RAbilitySheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Ability", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-ability.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RWeaponSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    window: { title: "Weapon", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-weapon.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    return context;
  }
}

export class GFL5RArmorSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Armor", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-armor.html"), scrollable: [""] }
    };
  }
}

export class GFL5RNarrativeSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Narrative", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-narrative.html"), scrollable: [""] }
    };
  }
}

export class GFL5RItemSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 450 }),
    window: { title: "Item", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-sheet.html"), scrollable: [""] }
    };
  }
}

export class GFL5RDisciplineSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 600 }),
    form: {
      handler: GFL5RDisciplineSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    window: { title: "Discipline", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-discipline.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skillGroups = GFL5R_CONFIG.skillGroups;
    const skills = context.item?.system?.associatedSkills;
    context.associatedSkills = Array.isArray(skills) ? skills : [];
    return context;
  }

  static async #onSubmit(event, form, formData) {
    event.preventDefault();
    const data = foundry.utils.expandObject(formData.object);
    
    // Handle checkbox array - get all checked values from the form directly
    const checkboxes = form.querySelectorAll('input[name="system.associatedSkills"]:checked');
    const associatedSkills = Array.from(checkboxes).map(cb => cb.value);
    
    if (data.system) {
      data.system.associatedSkills = associatedSkills;
    } else {
      data.system = { associatedSkills };
    }
    
    await this.document.update(data);
  }
}

export class GFL5RModuleSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 550 }),
    window: { title: "Module", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-module.html"), scrollable: [""] }
    };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.skills = GFL5R_CONFIG.skillGroups.flatMap(group => group.items);
    context.approaches = Object.keys(GFL5R_CONFIG.approachLabels).map(key => ({ key, label: GFL5R_CONFIG.approachLabels[key] }));
    return context;
  }
}

export class GFL5RConditionSheet extends BaseGFLItemSheet {
  static DEFAULT_OPTIONS = {
    ...BaseGFLItemSheet.buildOptions({ width: 600, height: 500 }),
    window: { title: "Condition", resizable: true }
  };

  static get PARTS() {
    return {
      sheet: { template: templatePath("templates/item-condition.html"), scrollable: [""] }
    };
  }
}

export function registerItemSheets() {
  const Items = foundry.documents.collections.Items;
  Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  Items.registerSheet("gfl5r", GFL5RAbilitySheet, { types: ["ability"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RWeaponSheet, { types: ["weaponry"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RArmorSheet, { types: ["armor"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RNarrativeSheet, { types: ["narrative"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RItemSheet, { types: ["item"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RDisciplineSheet, { types: ["discipline"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RModuleSheet, { types: ["module"], makeDefault: true });
  Items.registerSheet("gfl5r", GFL5RConditionSheet, { types: ["condition"], makeDefault: true });
}