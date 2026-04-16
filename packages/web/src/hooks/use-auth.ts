import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { useSessionAuth } from "@/lib/session-auth";
import type {
  BootstrapRequest,
  MessageResponse,
  User,
} from "@/types/auth";

export function useCurrentUser() {
  const { isLoaded, isSignedIn } = useSessionAuth();

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<User>("/auth/me"),
    enabled: isLoaded && isSignedIn,
    retry: false,
  });
}

export function useBootstrap() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: BootstrapRequest) =>
      apiPost<User>("/auth/bootstrap", data),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<MessageResponse>("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
