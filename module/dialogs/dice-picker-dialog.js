// L5R5E-style dice picker dialog adapted for GFL5R; on submit it launches the existing GFLRollerApp flow.
import { GFL5R_CONFIG } from "../config.js";
import { GFLRollerApp } from "../dice.js";

const FormApplicationV1 = foundry.applications?.FormApplication ?? globalThis.FormApplication;

export class GFL5RPickerDialog extends FormApplicationV1 {
  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
    this.skillKey = options.skillKey;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["gfl5r", "dice-picker"],
      template: `systems/gfl5r/templates/dice/dice-picker-dialog.html`,
      id: "gfl5r-dice-picker-dialog",
      title: "Roll Dice",
      width: 520,
      resizable: true
    });
  }

  getData() {
    const approaches = this.actor?.system?.approaches ?? {};
    const skills = this.actor?.system?.skills ?? {};
    const skillGroups = GFL5R_CONFIG.skillGroups ?? [];

    const ringsList = Object.entries(approaches).map(([id, val]) => ({
      id,
      label: GFL5R_CONFIG.getApproachLabel(id),
      value: Number(val || 0)
    }));

    // Flatten skills with category
    const skillList = skillGroups.flatMap((grp) =>
      (grp.items || []).map((it) => ({
        id: it.key,
        label: it.label,
        cat: grp.title,
        value: Number(skills[it.key] ?? 0)
      }))
    );

    const skill = skillList.find((s) => s.id === this.skillKey) || skillList[0] || { id: this.skillKey, label: this.skillKey, value: 0, cat: "" };
    const defaultRing = ringsList[0] || { id: "power", label: "Power", value: 0 };
    skill.ring = defaultRing.id;
    skill.ringValue = defaultRing.value;

    return {
      actor: this.actor,
      ringsList,
      skill,
      skillList,
      difficulty: 2,
      keep: Math.max(1, defaultRing.value || 1),
      voidPointUsed: false,
      difficultyHidden: false
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", ".adjust-up", (ev) => {
      const input = ev.currentTarget.parentElement.querySelector("input");
      input.value = Number(input.value || 0) + 1;
    });
    html.on("click", ".adjust-down", (ev) => {
      const input = ev.currentTarget.parentElement.querySelector("input");
      input.value = Math.max(0, Number(input.value || 0) - 1);
    });
  }

  async _updateObject(event, formData) {
    // Gather form data
    const ringId = formData.approach;
    const ringLabel = GFL5R_CONFIG.getApproachLabel(ringId);
    const ringVal = Number(formData.ring || 0);
    const skillId = formData.skill;
    const skillLabel = GFL5R_CONFIG.getSkillLabel(skillId) || skillId;
    const tnHidden = !!formData.difficultyHidden;
    const tnVal = tnHidden ? null : Number(formData.difficulty || 0);

    // Launch existing roller app so RNK routing stays intact
    const app = new GFLRollerApp({
      actor: this.actor,
      skillKey: skillId,
      skillLabel,
      approach: ringVal,
      approachName: ringLabel,
      tn: tnVal,
      hiddenTN: tnHidden
    });
    await app.start();
  }
}

export function showPickerForActor(actor, skillKey) {
  const dlg = new GFL5RPickerDialog(actor, { skillKey });
  dlg.render(true);
  return dlg;
}
