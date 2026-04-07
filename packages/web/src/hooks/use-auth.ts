import { useAuth } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  BootstrapRequest,
  MessageResponse,
  User,
} from "@/types/auth";

export function useCurrentUser() {
  const { isLoaded, isSignedIn } = useAuth();

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
  return useMutation({
    mutationFn: () => apiPost<MessageResponse>("/auth/logout"),
  });
}
