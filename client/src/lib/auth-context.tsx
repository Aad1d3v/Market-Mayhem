import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api.js";
import type { AuthUser } from "@aadiinvest/shared";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.get<AuthUser>("/api/me");
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.post("/api/auth/logout");
    queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  return (
    <AuthContext.Provider
      value={{ user: data ?? null, isLoading, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
