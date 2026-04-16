import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch } from "@/lib/api-client";

export interface NotificationPreferences {
  weekly_reports: boolean;
  citation_alerts: boolean;
  competitor_movements: boolean;
  content_published: boolean;
  team_activity: boolean;
}

export interface NotificationPreferencesUpdate {
  weekly_reports?: boolean;
  citation_alerts?: boolean;
  competitor_movements?: boolean;
  content_published?: boolean;
  team_activity?: boolean;
}

export interface IntegrationSettings {
  generic_webhook_url: string | null;
  slack_webhook_url: string | null;
  slack_enabled: boolean;
}

export interface IntegrationSettingsUpdate {
  generic_webhook_url?: string | null;
  slack_webhook_url?: string | null;
  slack_enabled?: boolean;
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: ["auth", "notifications"],
    queryFn: () =>
      apiGet<NotificationPreferences>("/auth/me/notifications"),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: NotificationPreferencesUpdate) =>
      apiPatch<NotificationPreferences>("/auth/me/notifications", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "notifications"], data);
    },
  });
}

export function useIntegrationSettings() {
  return useQuery({
    queryKey: ["settings", "integrations"],
    queryFn: () => apiGet<IntegrationSettings>("/settings/integrations"),
  });
}

export function useUpdateIntegrationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: IntegrationSettingsUpdate) =>
      apiPatch<IntegrationSettings>("/settings/integrations", body),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings", "integrations"], data);
    },
  });
}
