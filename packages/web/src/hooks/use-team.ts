import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type {
  InviteRequest,
  InviteResponse,
  Role,
  TeamMember,
} from "@/types/api";

export function useTeamMembers() {
  return useQuery({
    queryKey: ["auth", "team"],
    queryFn: () => apiGet<TeamMember[]>("/auth/team"),
  });
}

export function useTenantRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGet<Role[]>("/roles/"),
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteRequest) =>
      apiPost<InviteResponse>("/auth/invite", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth", "team"] });
    },
  });
}
