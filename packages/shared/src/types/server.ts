export interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  status: ServerStatus;
  agentToken: string;
  config: Hy2Config;
  createdAt: Date;
  updatedAt: Date;
}

export type ServerStatus = "online" | "offline" | "error";

export interface Hy2Config {
  listen: string;
  tls: {
    cert: string;
    key: string;
  };
  obfs?: {
    type: "salamander";
    salamander: {
      password: string;
    };
  };
  quic?: {
    initStreamReceiveWindow: number;
    maxStreamReceiveWindow: number;
    initConnReceiveWindow: number;
    maxConnReceiveWindow: number;
  };
  bandwidth?: {
    up: string;
    down: string;
  };
  masquerade?: {
    type: "proxy";
    proxy: {
      url: string;
      rewriteHost: boolean;
    };
  };
}

export interface CreateServerDto {
  name: string;
  host: string;
  port: number;
  config: Hy2Config;
}

export interface UpdateServerDto {
  name?: string;
  host?: string;
  port?: number;
  config?: Partial<Hy2Config>;
}

export interface ServerStats {
  serverId: string;
  uptime: number;
  connections: number;
  bytesIn: number;
  bytesOut: number;
  timestamp: Date;
}
