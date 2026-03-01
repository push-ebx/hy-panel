import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Server, Client, CreateServerDto, UpdateServerDto, CreateClientDto, UpdateClientDto } from "@hy2-panel/shared";

// ============ Servers ============

export function useServers() {
  return useQuery({
    queryKey: ["servers"],
    queryFn: () => api.get<Server[]>("/api/servers"),
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: ["servers", id],
    queryFn: () => api.get<Server>(`/api/servers/${id}`),
    enabled: !!id,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateServerDto) =>
      api.post<{ id: string; agentToken: string }>("/api/servers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServerDto }) =>
      api.patch(`/api/servers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useDeleteServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/servers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
  });
}

export function useSyncServers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api.post<{ servers: number; clients: number }>("/api/servers/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["servers"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ============ Clients ============

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: () => api.get<Client[]>("/api/clients"),
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: ["clients", id],
    queryFn: () => api.get<Client>(`/api/clients/${id}`),
    enabled: !!id,
  });
}

export function useOnlineClients(refetchInterval = 1500) {
  return useQuery({
    queryKey: ["clients", "online"],
    queryFn: () => api.get<{ online: string[] }>("/api/clients/online"),
    refetchInterval,
  });
}

export function useTraffic(refetchInterval = 30000) {
  return useQuery({
    queryKey: ["clients", "traffic"],
    queryFn: () => api.get<{ traffic: Record<string, { tx: number; rx: number }> }>("/api/clients/traffic"),
    refetchInterval,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientDto) =>
      api.post<{ id: string; password: string }>("/api/clients", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientDto }) =>
      api.patch(`/api/clients/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/clients/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ============ Dashboard Stats ============

export function useDashboardStats() {
  const { data: servers } = useServers();
  const { data: clients } = useClients();

  return {
    serversCount: servers?.length ?? 0,
    serversOnline: servers?.filter((s) => s.status === "online").length ?? 0,
    clientsCount: clients?.length ?? 0,
    clientsEnabled: clients?.filter((c) => c.enabled).length ?? 0,
  };
}
