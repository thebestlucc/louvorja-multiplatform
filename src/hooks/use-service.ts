import { useCallback } from "react";
import { useService, useUpdateService, useAddServiceItem, useRemoveServiceItem, useReorderServiceItems } from "../lib/queries";
import type { ServiceItem } from "../types/service";

interface UseServiceEditorOptions {
  serviceId: number;
}

export function useServiceEditor({ serviceId }: UseServiceEditorOptions) {
  const { data } = useService(serviceId);
  const updateServiceMutation = useUpdateService();
  const addItemMutation = useAddServiceItem();
  const removeItemMutation = useRemoveServiceItem();
  const reorderMutation = useReorderServiceItems();

  const service = data?.service ?? null;
  const items: ServiceItem[] = data?.items ?? [];

  const updateMeta = useCallback(
    (title: string, date: string | null, notes: string | null) => {
      updateServiceMutation.mutate({ id: serviceId, title, date, notes });
    },
    [serviceId, updateServiceMutation],
  );

  const addItem = useCallback(
    (itemType: string, title: string, itemId: number | null, notes: string | null) => {
      addItemMutation.mutate({ serviceId, itemType, title, itemId, notes });
    },
    [serviceId, addItemMutation],
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

  return {
    service,
    items,
    updateMeta,
    addItem,
    removeItem,
    reorderItems,
  };
}
