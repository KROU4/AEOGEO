import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";
import type { Project, ProjectCreate, ProjectUpdate, ProjectMember } from "@/types/project";
import type { PaginatedResponse } from "@/types/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiGet<PaginatedResponse<Project>>("/projects/"),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => apiGet<Project>(`/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectCreate) =>
      apiPost<Project>("/projects/", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ProjectUpdate) =>
      apiPut<Project>(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projects", id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectMembers(id: string) {
  return useQuery({
    queryKey: ["projects", id, "members"],
    queryFn: () => apiGet<ProjectMember[]>(`/projects/${id}/members`),
    enabled: !!id,
  });
}
