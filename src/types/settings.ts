export interface Setting {
  key: string;
  value: string;
}

export type MonitorRole = "operator" | "projector" | "return";

export interface MonitorConfig {
  id: number;
  monitor_id: string;
  role: MonitorRole;
  enabled: boolean;
}

export interface MonitorInfo {
  id: string;
  name: string;
  friendly_name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  connection_type?: "integrated" | "external" | "unknown" | null;
  width: number;
  height: number;
  is_primary: boolean;
  x: number;
  y: number;
  scale_factor: number;
}
