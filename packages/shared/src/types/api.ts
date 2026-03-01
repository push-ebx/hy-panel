export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// Agent API types
export interface AgentHeartbeat {
  serverId: string;
  status: "online" | "offline" | "error";
  stats: {
    uptime: number;
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
}

export interface AgentCommand {
  type: "sync_clients" | "restart" | "update_config";
  payload?: unknown;
}

export interface AgentSyncClientsPayload {
  clients: Array<{
    password: string;
    uploadLimit: number;
    downloadLimit: number;
    totalLimit: number;
    enabled: boolean;
  }>;
}
