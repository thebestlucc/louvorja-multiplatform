import { useCallback, useMemo } from "react";
import { useLiturgy, useUpdateLiturgy, useAddLiturgyItem, useRemoveLiturgyItem, useReorderLiturgyItems, useUpdateLiturgyItem, useMoveLiturgyItemToParent } from "../lib/queries";
import type { LiturgyItem, CategoryGroup } from "../types/liturgy";

interface UseLiturgyEditorOptions {
  serviceId: number;
}

export function useLiturgyEditor({ serviceId }: UseLiturgyEditorOptions) {
  const { data } = useLiturgy(serviceId);
  const updateLiturgyMutation = useUpdateLiturgy();
  const addItemMutation = useAddLiturgyItem();
  const removeItemMutation = useRemoveLiturgyItem();
  const reorderMutation = useReorderLiturgyItems();
  const editItemMutation = useUpdateLiturgyItem();
  const reparentItemMutation = useMoveLiturgyItemToParent();

  const service = data?.service ?? null;
  const items: LiturgyItem[] = data?.items ?? [];

  const nestedItems = useMemo(() => {
    const groups: CategoryGroup[] = [];
    let currentUngrouped: CategoryGroup | null = null;

    // Walk items in item_order, preserving interleaving of categories and top-level items
    for (const item of items) {
      const parentId = (item as LiturgyItem & { parentId?: number | null }).parentId;

      if (item.itemType === "category") {
        // Start a new category section; reset the ungrouped accumulator
        currentUngrouped = null;
        groups.push({ category: item, items: [] });
      } else if (parentId) {
        // Child item: find its parent category group
        const parentGroup = groups.find((g) => g.category?.id === parentId);
        if (parentGroup) {
          parentGroup.items.push(item);
        } else {
          // Orphan (parent deleted): add to current ungrouped section
          if (!currentUngrouped) {
            currentUngrouped = { category: null, items: [] };
            groups.push(currentUngrouped);
          }
          currentUngrouped.items.push(item);
        }
      } else {
        // Top-level ungrouped item
        if (!currentUngrouped) {
          currentUngrouped = { category: null, items: [] };
          groups.push(currentUngrouped);
        }
        currentUngrouped.items.push(item);
      }
    }

    // Always return at least one group so the "empty" state is reachable
    if (groups.length === 0) {
      groups.push({ category: null, items: [] });
    }

    return groups;
  }, [items]);

  const updateMeta = useCallback(
    (title: string, date: string | null, notes: string | null) => {
      updateLiturgyMutation.mutate({ id: serviceId, title, date, notes });
    },
    [serviceId, updateLiturgyMutation],
  );

  const addItem = useCallback(
    (itemType: string, title: string, itemId: number | null, notes: string | null, parentId?: number | null) => {
      return addItemMutation.mutateAsync({ serviceId, itemType, title, itemId, notes, parentId });
    },
    [serviceId, addItemMutation],
  );

  const reparentItem = useCallback(
    (itemId: number, parentId: number | null) => {
      reparentItemMutation.mutate({ id: itemId, serviceId, parentId });
    },
    [serviceId, reparentItemMutation],
  );

  /**
   * Single drag-drop handler: updates parentId (if changed) then reorders.
   * Reparent runs first; reorder fires in onSuccess to avoid racing on the same query.
   */
  const dropItem = useCallback(
    (itemId: number, newParentId: number | null, newOrderIds: number[]) => {
      const currentItem = items.find(i => i.id === itemId);
      const parentChanged = (currentItem?.parentId ?? null) !== newParentId;
      if (parentChanged) {
        reparentItemMutation.mutate(
          { id: itemId, serviceId, parentId: newParentId },
          { onSuccess: () => reorderMutation.mutate({ serviceId, itemIds: newOrderIds }) },
        );
      } else {
        reorderMutation.mutate({ serviceId, itemIds: newOrderIds });
      }
    },
    [items, serviceId, reparentItemMutation, reorderMutation],
  );

  const removeItem = useCallback(
    (itemId: number) => {
      removeItemMutation.mutate({ id: itemId, serviceId });
    },
    [serviceId, removeItemMutation],
  );

  const reorderItems = useCallback(
    (from: number, to: number) => {
      const newItems = [...items];
      const [moved] = newItems.splice(from, 1);
      newItems.splice(to, 0, moved);
      const itemIds = newItems.map((i) => i.id);
      reorderMutation.mutate({ serviceId, itemIds });
    },
    [items, serviceId, reorderMutation],
  );

  const reorderByIds = useCallback(
    (itemIds: number[]) => {
      reorderMutation.mutate({ serviceId, itemIds });
    },
    [serviceId, reorderMutation],
  );

  const editItem = useCallback(
    (itemId: number, title: string, notes: string | null) => {
      editItemMutation.mutate({ id: itemId, serviceId, title, notes });
    },
    [serviceId, editItemMutation],
  );

  return {
    service,
    items,
    nestedItems,
    updateMeta,
    addItem,
    removeItem,
    reorderItems,
    reorderByIds,
    editItem,
    reparentItem,
    dropItem,
  };
}

/** @deprecated Use useLiturgyEditor */
export const useServiceEditor = useLiturgyEditor;
