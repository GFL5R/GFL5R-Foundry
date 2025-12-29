export function createDragDropHandlers(dialog, isEditable) {
  const DragDropCls =
    foundry.applications.api?.DragDrop?.implementation ||
    foundry.applications.api?.DragDrop ||
    foundry.applications.ux?.DragDrop?.implementation ||
    foundry.applications.ux?.DragDrop;
  return [
    new DragDropCls({
      dragSelector: ".dice.draggable",
      dropSelector: ".dropbox",
      permissions: { dragstart: isEditable, drop: isEditable },
      callbacks: {
        dragstart: dialog._onDragStart.bind(dialog),
        drop: dialog._onDropItem.bind(dialog),
      },
    }),
  ];
}

export function handleDragStart(event) {
  const target = $(event.currentTarget);
  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify({
      step: target.data("step"),
      die: target.data("die"),
    })
  );
}

export function handleDropItem(dialog, event) {
  if (!dialog.isEditable) return;

  const target = event.currentTarget;
  const type = target?.dataset?.type;
  const json = event.dataTransfer?.getData("text/plain");
  if (!json || !Object.values(dialog.constructor?.CHOICES || {}).some((e) => !!e && e === type)) return;

  const data = JSON.parse(json);
  if (!data) return;

  const current = dialog.object.dicesList[data.step]?.[data.die];
  if (!current) return;
  delete current.newFace;

  switch (type) {
    case dialog.constructor.CHOICES.swap: {
      const diceType = target?.dataset?.die;
      const diceNewFace = target?.dataset?.face ? Number(target.dataset.face) : undefined;

      if (current.type !== diceType || current.face === diceNewFace || Number.isNaN(diceNewFace)) {
        current.choice = dialog.constructor.CHOICES.nothing;
        dialog.render(false);
        return false;
      }

      current.newFace = diceNewFace;
      dialog._forceChoiceForDiceWithoutOne(dialog.constructor.CHOICES.keep);
      break;
    }

    case dialog.constructor.CHOICES.reroll:
      dialog._forceChoiceForDiceWithoutOne(dialog.constructor.CHOICES.keep);
      break;
  }

  current.choice = type;

  if (
    dialog._checkKeepCount(dialog.object.currentStep) &&
    dialog._getKeepCount(dialog.object.currentStep) === (dialog.roll?.gfl5r?.keepLimit ?? 0)
  ) {
    dialog._forceChoiceForDiceWithoutOne(dialog.constructor.CHOICES.discard);
  }

  dialog.render(false);
  return false;
}

console.log("GFL5R | rnk-dragdrop.js loaded");
