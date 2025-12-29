export const resolveItemFromDropData = async (data) => {
  if (!data) return { item: null, uuid: null, itemData: null };

  const documentName = data.documentName ?? data.type;
  if (documentName && documentName !== "Item") return { item: null, uuid: null, itemData: null };

  const uuid = data.uuid ?? (data.pack && data.id ? `Compendium.${data.pack}.${data.id}` : null);
  if (uuid) {
    try {
      const doc = await fromUuid(uuid);
      if (doc?.documentName === "Item") {
        return { item: doc, uuid, itemData: doc.toObject?.() ?? null };
      }
    } catch (err) {
      console.warn("GFL5R | Unable to resolve drop UUID", err);
    }
  }

  const itemData = data.data ? foundry.utils.duplicate(data.data) : null;
  if (itemData) {
    itemData.type ??= data.type ?? itemData.type;
    const ItemCls = Item.implementation ?? Item;
    const item = new ItemCls(itemData, { temporary: true });
    return { item, uuid, itemData };
  }

  return { item: null, uuid, itemData: null };
};

export const getDragEventDataSafe = (event) => {
  const evt = event?.originalEvent ?? event;
  const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? TextEditor;
  if (!(evt instanceof DragEvent)) {
    console.warn("GFL5R | Drop handler received non-DragEvent", evt);
    return {};
  }
  return TextEditorImpl.getDragEventData(evt);
};
