export interface Settings {
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
  width: number;
  height: number;
  is_primary: boolean;
}
