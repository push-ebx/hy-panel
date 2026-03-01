import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { User, AuthResponse } from "@hy2-panel/shared";

interface AuthState {
  user: Omit<User, "password"> | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,

      login: async (email: string, password: string) => {
        const data = await api.post<AuthResponse>("/api/auth/login", {
          email,
          password,
        });
        api.setToken(data.token);
        set({ user: data.user, token: data.token });
      },

      logout: () => {
        api.setToken(null);
        set({ user: null, token: null });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) return;

        try {
          api.setToken(token);
          const user = await api.get<Omit<User, "password">>("/api/auth/me");
          set({ user });
        } catch {
          get().logout();
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }),
    }
  )
);
