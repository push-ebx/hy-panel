export interface Client {
  id: string;
  userId: string;
  serverId: string;
  name: string;
  password: string;
  uploadLimit: number;
  downloadLimit: number;
  totalLimit: number;
  expiresAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateClientDto {
  userId: string;
  serverId: string;
  name: string;
  password?: string;
  uploadLimit?: number;
  downloadLimit?: number;
  totalLimit?: number;
  expiresAt?: Date;
}

export interface UpdateClientDto {
  name?: string;
  password?: string;
  uploadLimit?: number;
  downloadLimit?: number;
  totalLimit?: number;
  expiresAt?: Date | null;
  enabled?: boolean;
}

export interface ClientStats {
  clientId: string;
  bytesIn: number;
  bytesOut: number;
  lastConnectedAt: Date | null;
}

export interface ClientConnection {
  clientId: string;
  clientName: string;
  srcAddr: string;
  destAddr: string;
  connectedAt: Date;
  bytesIn: number;
  bytesOut: number;
}
