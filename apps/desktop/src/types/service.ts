// Backward-compatibility re-exports during bindings.ts transition.
// After running `pnpm tauri dev` (which regenerates bindings.ts with Liturgy types),
// these aliases can be replaced with direct imports from bindings.
import type { Liturgy as _Service, LiturgyItem as _ServiceItem, LiturgyWithItems as _ServiceWithItems } from "../lib/bindings";

export type Liturgy = _Service;
export type LiturgyItem = _ServiceItem;
export type LiturgyWithItems = _ServiceWithItems;

// Keep old names as aliases for import compatibility during transition
export type { _Service as Service, _ServiceItem as ServiceItem, _ServiceWithItems as ServiceWithItems };

export type LiturgyItemType =
  | "hymn"
  | "bible"
  | "presentation"
  | "annotation"
  | "url"
  | "file"
  | "scheduled_category"
  | "online_video"
  | "category";

/** @deprecated Use LiturgyItemType */
export type ServiceItemType = LiturgyItemType;

export interface CategoryGroup {
  category: LiturgyItem | null; // null = top-level ungrouped items
  items: LiturgyItem[];
}
