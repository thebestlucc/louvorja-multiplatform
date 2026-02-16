export interface StreamingUrls {
  music: string;
  bible: string;
  returnMonitor: string;
}

export interface StreamingInfo {
  isRunning: boolean;
  ip: string | null;
  port: number;
  urls: StreamingUrls | null;
  connections: number;
  broadcastEnabled: boolean;
}
