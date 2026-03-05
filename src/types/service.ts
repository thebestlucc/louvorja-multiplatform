import type { Service, ServiceItem, ServiceWithItems } from "../lib/bindings";

export type { Service, ServiceItem, ServiceWithItems };

export type ServiceItemType =
  | "hymn"
  | "bible"
  | "presentation"
  | "annotation"
  | "url"
  | "file";
