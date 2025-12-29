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
        dragenter: (event) => handleDragEnterLeave(event, true),
        dragleave: (event) => handleDragEnterLeave(event, false),
        dragover: handleDragOver,
        drop: dialog._onDropItem.bind(dialog),
      },
    }),
  ];
}

export function handleDragStart(event, fallbackPayload = null) {
  const target = $(event.currentTarget);
  const payload =
    fallbackPayload ??
    {
      step: target.data("step"),
      die: target.data("die"),
    };
  // Use console.log so messages show even when debug is filtered out.
  console.log?.("GFL5R | RNK dragstart payload", payload);
  if (event?.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
  }
  event.dataTransfer.setData(
    "text/plain",
    JSON.stringify(payload)
  );
}

export function handleDragOver(event) {
  event?.preventDefault?.();
  if (event?.dataTransfer) {
    event.dataTransfer.dropEffect = "move";
  }
  return false;
}

function handleDragEnterLeave(event, add) {
  const box = event?.target?.closest?.(".dropbox");
  if (!box) return;
  if (add) {
    box.classList.add("drag-over");
  } else {
    box.classList.remove("drag-over");
  }
}

export function handleDropItem(dialog, event) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  console.log?.("GFL5R | RNK drop", {
    editable: dialog.isEditable,
    target: event?.currentTarget,
    raw: event,
  });
  if (!dialog.isEditable) return;
  const dropTarget = event?.currentTarget?.closest?.(".dropbox");
  dropTarget?.classList?.remove?.("drag-over");

  const target = dropTarget || event.currentTarget;
  const type = target?.dataset?.type || event?.target?.closest?.(".dropbox")?.dataset?.type;
  const json = event.dataTransfer?.getData("text/plain");
  if (!Object.values(dialog.constructor?.CHOICES || {}).some((e) => !!e && e === type)) return;

  let data = json ? JSON.parse(json) : null;
  if ((!data || data.step === undefined || data.die === undefined) && dialog._dragPayload) {
    data = dialog._dragPayload;
  }
  console.log?.("GFL5R | RNK drop payload", { data, type });
  if (!data) return;

  const stepIdx = Number(data.step);
  const dieIdx = Number(data.die);
  const current = dialog.object.dicesList?.[stepIdx]?.[dieIdx];
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
  dialog._dragPayload = null;
  return false;
}

console.log("GFL5R | rnk-dragdrop.js loaded");
