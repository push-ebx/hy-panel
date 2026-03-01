export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const DEFAULT_HY2_PORT = 443;

export const TRAFFIC_UNITS = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
  TB: 1024 * 1024 * 1024 * 1024,
} as const;

export const API_ROUTES = {
  AUTH: {
    LOGIN: "/api/auth/login",
    LOGOUT: "/api/auth/logout",
    ME: "/api/auth/me",
  },
  USERS: "/api/users",
  SERVERS: "/api/servers",
  CLIENTS: "/api/clients",
  STATS: "/api/stats",
} as const;
