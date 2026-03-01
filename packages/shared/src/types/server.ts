export interface Server {
  id: string;
  name: string;
  host: string;
  agentUrl: string;
  agentToken: string;
  status: ServerStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ServerStatus = "online" | "offline" | "error";

export interface CreateServerDto {
  name: string;
  host: string;
  agentUrl: string;
}

export interface UpdateServerDto {
  name?: string;
  host?: string;
  agentUrl?: string;
}
