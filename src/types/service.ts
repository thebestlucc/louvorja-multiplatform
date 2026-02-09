export type ServiceItemType =
  | "hymn"
  | "bible"
  | "presentation"
  | "annotation"
  | "url"
  | "file";

export interface Service {
  id: number;
  title: string;
  date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: number;
  service_id: number;
  item_type: ServiceItemType;
  item_id: number | null;
  title: string;
  item_order: number;
  notes: string | null;
}
