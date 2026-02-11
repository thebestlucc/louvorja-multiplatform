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
  createdAt: string;
  updatedAt: string;
}

export interface ServiceItem {
  id: number;
  serviceId: number;
  itemType: ServiceItemType;
  itemId: number | null;
  title: string;
  itemOrder: number;
  notes: string | null;
}

export interface ServiceWithItems {
  service: Service;
  items: ServiceItem[];
}
