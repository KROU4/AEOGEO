import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useTeamMembers } from "@/hooks/use-team";
import { useProjects, useProject, useUpdateProject } from "@/hooks/use-projects";
import {
  useAnalyticsIntegrations,
  useCreateAnalyticsIntegration,
  useDeleteAnalyticsIntegration,
  useTestAnalyticsConnection,
  useSyncTraffic,
  type AnalyticsIntegration,
} from "@/hooks/use-analytics";
import { InviteMemberDialog } from "@/components/settings/invite-member-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  User,
  Users,
  Key,
  Bell,
  Puzzle,
  Plus,
  AlertTriangle,
  Globe,
  Sliders,
  ExternalLink,
  Check,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsPage,
});


function ProfileTab() {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { data: user } = useCurrentUser();
  const { locale, setLocale } = useLocale();

  const userName = user?.name ?? "User";
  const userEmail = user?.email ?? "user@example.com";
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.title")}</CardTitle>
          <CardDescription>{t("profile.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-teal-600 text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">
                {tc("roles.owner")}
              </p>
              <button className="text-xs text-primary hover:underline mt-1">
                {t("profile.changeAvatar")}
              </button>
            </div>
          </div>

          <Separator />

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="full-name">{t("profile.fullName")}</Label>
            <Input id="full-name" defaultValue={userName} />
          </div>

          {/* Email (disabled) */}
          <div className="space-y-2">
            <Label htmlFor="email-address">{t("profile.emailAddress")}</Label>
            <Input id="email-address" defaultValue={userEmail} disabled />
            <p className="text-xs text-muted-foreground">
              {t("profile.emailHelp")}
            </p>
          </div>

          <Button>{tc("actions.save")}</Button>
        </CardContent>
      </Card>

      {/* Language Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            {t("profile.language")}
          </CardTitle>
          <CardDescription>{t("profile.languageDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 max-w-sm">
            <button
              onClick={() => setLocale("en")}
              className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                locale === "en"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">EN</span>
                <span className="text-sm font-medium text-foreground">
                  English
                </span>
              </div>
              {locale === "en" && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
            <button
              onClick={() => setLocale("ru")}
              className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                locale === "ru"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">RU</span>
                <span className="text-sm font-medium text-foreground">
                  Русский
                </span>
              </div>
              {locale === "ru" && (
                <Check className="w-4 h-4 text-primary" />
              )}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

const ALL_ENGINES = [
  { id: "chatgpt", name: "ChatGPT" },
  { id: "gemini", name: "Gemini" },
  { id: "perplexity", name: "Perplexity" },
  { id: "claude", name: "Claude" },
  { id: "copilot", name: "Copilot" },
];

function ProjectSettingsTab() {
  const { t } = useTranslation("settings");
  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  useEffect(() => {
    const first = projects[0];
    if (!selectedProjectId && first) {
      setSelectedProjectId(first.id);
    }
  }, [selectedProjectId, projects]);

  const { data: projectData } = useProject(selectedProjectId ?? "");
  const updateProject = useUpdateProject(selectedProjectId ?? "");

  const contentLocale = projectData?.content_locale ?? "en";

  const [defaultEngines, setDefaultEngines] = useState<Set<string>>(
    new Set(["chatgpt", "gemini", "perplexity"])
  );
  const [sampleCount, setSampleCount] = useState(5);

  function toggleEngine(engineId: string) {
    setDefaultEngines((prev) => {
      const next = new Set(prev);
      if (next.has(engineId)) {
        next.delete(engineId);
      } else {
        next.add(engineId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">
          {t("projectSettings.selectProject")}
        </span>
        <Select
          value={selectedProjectId ?? ""}
          onValueChange={(value) => setSelectedProjectId(value)}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder={t("projectSettings.selectProjectPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedProjectId && projectData && (
        <>
          {/* Content Language */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t("projectSettings.contentLocaleTitle")}
              </CardTitle>
              <CardDescription>{t("projectSettings.contentLocaleDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 max-w-sm">
                <button
                  onClick={() => updateProject.mutate({ content_locale: "en" })}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                    contentLocale === "en"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">EN</span>
                    <span className="text-sm font-medium text-foreground">
                      English
                    </span>
                  </div>
                  {contentLocale === "en" && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
                <button
                  onClick={() => updateProject.mutate({ content_locale: "ru" })}
                  className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                    contentLocale === "ru"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">RU</span>
                    <span className="text-sm font-medium text-foreground">
                      Русский
                    </span>
                  </div>
                  {contentLocale === "ru" && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Default Engines */}
          <Card>
            <CardHeader>
              <CardTitle>{t("projectSettings.enginesTitle")}</CardTitle>
              <CardDescription>
                {t("projectSettings.enginesDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {ALL_ENGINES.map((engine) => (
                  <label
                    key={engine.id}
                    className="flex items-center gap-2.5 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50 transition-colors has-[button[data-state=checked]]:border-primary has-[button[data-state=checked]]:bg-primary/5"
                  >
                    <Checkbox
                      checked={defaultEngines.has(engine.id)}
                      onCheckedChange={() => toggleEngine(engine.id)}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {engine.name}
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("projectSettings.enginesHint", {
                  count: defaultEngines.size,
                })}
              </p>
            </CardContent>
          </Card>

          {/* Default Sample Count */}
          <Card>
            <CardHeader>
              <CardTitle>{t("projectSettings.sampleTitle")}</CardTitle>
              <CardDescription>
                {t("projectSettings.sampleDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <div className="px-1">
                  <Slider
                    value={[sampleCount]}
                    onValueChange={([v]) => setSampleCount(v ?? 5)}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">1</span>
                  <span className="text-sm font-semibold text-foreground">
                    {sampleCount}
                  </span>
                  <span className="text-xs text-muted-foreground">10</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("projectSettings.sampleHint", { count: sampleCount })}
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function TeamTab() {
  const { t } = useTranslation("settings");
  const { data: members = [], isLoading } = useTeamMembers();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("team.title")}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("team.subtitle")}
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("team.inviteMember")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("team.member")}</TableHead>
                <TableHead>{t("team.status")}</TableHead>
                <TableHead>{t("team.role")}</TableHead>
                <TableHead>{t("team.projects")}</TableHead>
                <TableHead className="text-right">{t("team.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("team.loading")}
                  </TableCell>
                </TableRow>
              )}
              {!isLoading &&
                members.map((member) => {
                  const initials = (member.name || member.email)
                    .split(" ")
                    .map((segment) => segment[0] || "")
                    .join("")
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback className="text-xs font-semibold bg-teal-600 text-white">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {member.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            member.status === "active" ? "default" : "secondary"
                          }
                        >
                          {member.status === "active"
                            ? t("team.activeStatus")
                            : t("team.pendingStatus")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {member.roles.length > 0 ? (
                            member.roles.map((role) => (
                              <Badge key={role} variant="outline">
                                {role}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {t("team.noRole")}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {member.projects.length > 0 ? (
                          <div className="space-y-1">
                            {member.projects.map((project) => (
                              <div key={`${member.user_id}-${project.project_id}`} className="text-sm text-foreground">
                                {project.project_name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            {t("team.noProjects")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-xs text-muted-foreground">
                          {member.is_current_user
                            ? t("team.you")
                            : member.status === "pending"
                              ? t("team.pendingAction")
                              : t("team.activeAction")}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              {!isLoading && members.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("team.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite hint */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {t("team.inviteTitle")}
          </p>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
            {t("team.inviteHint")}
          </p>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("team.inviteMember")}
          </Button>
        </CardContent>
      </Card>

      <InviteMemberDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  );
}

function ApiKeysTab() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {t("apiKeys.warningTitle")}
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
            {t("apiKeys.warningText")}
          </p>
        </div>
      </div>

      {/* AI Keys management link */}
      <Card>
        <CardHeader>
          <CardTitle>{t("apiKeys.aiKeysTitle")}</CardTitle>
          <CardDescription>{t("apiKeys.aiKeysDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link to="/admin/ai-keys">
            <Button variant="outline">
              <Key className="w-4 h-4" />
              {t("apiKeys.manageAiKeys")}
              <ExternalLink className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* API key generation */}
      <Card>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Key className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {t("apiKeys.emptyTitle")}
            </h3>
            <p className="text-sm text-muted-foreground max-w-[320px] mb-4">
              {t("apiKeys.emptyText")}
            </p>
            <Button>
              <Plus className="w-4 h-4" />
              {t("apiKeys.generate")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  const { t } = useTranslation("settings");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.title")}</CardTitle>
        <CardDescription>
          {t("notifications.subtitle")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.weeklyReports")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.weeklyReportsDesc")}
            </p>
          </div>
          <Switch defaultChecked />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.citationAlerts")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.citationAlertsDesc")}
            </p>
          </div>
          <Switch defaultChecked />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.competitorMovements")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.competitorMovementsDesc")}
            </p>
          </div>
          <Switch />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.contentPublished")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.contentPublishedDesc")}
            </p>
          </div>
          <Switch defaultChecked />
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.teamActivity")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("notifications.teamActivityDesc")}
            </p>
          </div>
          <Switch />
        </div>
      </CardContent>
    </Card>
  );
}

function AnalyticsProviderCard({
  provider,
  projectId,
  existing,
}: {
  provider: "google_analytics" | "yandex_metrica";
  projectId: string;
  existing: AnalyticsIntegration | undefined;
}) {
  const { t } = useTranslation("settings");
  const prefix = provider === "google_analytics" ? "integrations.ga" : "integrations.ym";
  const isGA = provider === "google_analytics";

  const [externalId, setExternalId] = useState(existing?.external_id ?? "");
  const [credentials, setCredentials] = useState("");

  const createMutation = useCreateAnalyticsIntegration(projectId);
  const deleteMutation = useDeleteAnalyticsIntegration(projectId);
  const testMutation = useTestAnalyticsConnection(projectId);
  const syncMutation = useSyncTraffic(projectId);

  useEffect(() => {
    setExternalId(existing?.external_id ?? "");
    setCredentials("");
  }, [existing]);

  const handleSave = () => {
    if (!externalId || !credentials) return;
    createMutation.mutate(
      { provider, external_id: externalId, credentials },
      {
        onSuccess: () => {
          toast.success(t("integrations.saved"));
          setCredentials("");
        },
      },
    );
  };

  const handleDisconnect = () => {
    if (!existing) return;
    deleteMutation.mutate(existing.id, {
      onSuccess: () => {
        toast.success(t("integrations.deleted"));
        setExternalId("");
      },
    });
  };

  const handleTest = () => {
    if (!existing) return;
    testMutation.mutate(existing.id, {
      onSuccess: (data) => {
        if (data.success) {
          toast.success(t("integrations.testResult.success"));
        } else {
          toast.error(t("integrations.testResult.failure"));
        }
      },
    });
  };

  const isConnected = !!existing;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-muted-foreground">
                {isGA ? "GA" : "YM"}
              </span>
            </div>
            <div>
              <CardTitle className="text-base">{t(`${prefix}.title`)}</CardTitle>
              <CardDescription>{t(`${prefix}.description`)}</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              isConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-muted text-muted-foreground"
            }
          >
            {isConnected
              ? t("integrations.status.connected")
              : t("integrations.status.disconnected")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* External ID */}
        <div className="space-y-1.5">
          <Label>{t(isGA ? `${prefix}.propertyId` : `${prefix}.counterId`)}</Label>
          <Input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder={t(
              isGA ? `${prefix}.propertyIdPlaceholder` : `${prefix}.counterIdPlaceholder`,
            )}
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground">
            {t(isGA ? `${prefix}.propertyIdHint` : `${prefix}.counterIdHint`)}
          </p>
        </div>

        {/* Credentials */}
        {!isConnected && (
          <div className="space-y-1.5">
            <Label>{t(isGA ? `${prefix}.credentials` : `${prefix}.oauthToken`)}</Label>
            {isGA ? (
              <Textarea
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder={t(`${prefix}.credentialsPlaceholder`)}
                rows={4}
                className="font-mono text-xs"
              />
            ) : (
              <Input
                type="password"
                value={credentials}
                onChange={(e) => setCredentials(e.target.value)}
                placeholder={t(`${prefix}.oauthTokenPlaceholder`)}
              />
            )}
            <p className="text-xs text-muted-foreground">
              {t(isGA ? `${prefix}.credentialsHint` : `${prefix}.oauthTokenHint`)}
            </p>
          </div>
        )}

        {/* Last synced */}
        {isConnected && existing?.last_synced_at && (
          <p className="text-xs text-muted-foreground">
            {t("integrations.status.lastSynced", {
              time: new Date(existing.last_synced_at).toLocaleString(),
            })}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {isConnected ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTest}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending && (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                )}
                {t("integrations.actions.testConnection")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
              >
                {syncMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                )}
                {syncMutation.isPending
                  ? t("integrations.actions.syncing")
                  : t("integrations.actions.syncNow")}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t("integrations.actions.disconnect")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!externalId || !credentials || createMutation.isPending}
            >
              {createMutation.isPending && (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              )}
              {t("integrations.actions.save")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  const { t } = useTranslation("settings");
  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: integrations } = useAnalyticsIntegrations(
    selectedProjectId || undefined,
  );

  useEffect(() => {
    const first = projects[0];
    if (first && !selectedProjectId) {
      setSelectedProjectId(first.id);
    }
  }, [projects, selectedProjectId]);

  const gaIntegration = integrations?.find(
    (i) => i.provider === "google_analytics",
  );
  const ymIntegration = integrations?.find(
    (i) => i.provider === "yandex_metrica",
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t("integrations.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("integrations.subtitle")}
        </p>
      </div>

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("integrations.noProjects")}
        </p>
      ) : (
        <>
          {/* Project selector */}
          <div className="space-y-1.5">
            <Label>{t("integrations.selectProject")}</Label>
            <Select
              value={selectedProjectId}
              onValueChange={setSelectedProjectId}
            >
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue
                  placeholder={t("integrations.selectProjectPlaceholder")}
                />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProjectId && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AnalyticsProviderCard
                provider="google_analytics"
                projectId={selectedProjectId}
                existing={gaIntegration}
              />
              <AnalyticsProviderCard
                provider="yandex_metrica"
                projectId={selectedProjectId}
                existing={ymIntegration}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      {/* Vertical tabs layout using flex */}
      <Tabs defaultValue="profile" orientation="vertical">
        <div className="flex gap-6">
          {/* Left: Vertical tab list */}
          <TabsList
            variant="line"
            className="flex-col w-56 shrink-0 items-stretch h-auto"
          >
            <TabsTrigger value="profile" className="justify-start gap-2">
              <User className="w-4 h-4" />
              {t("tabs.profile")}
            </TabsTrigger>
            <TabsTrigger value="project" className="justify-start gap-2">
              <Sliders className="w-4 h-4" />
              {t("tabs.project")}
            </TabsTrigger>
            <TabsTrigger value="team" className="justify-start gap-2">
              <Users className="w-4 h-4" />
              {t("tabs.team")}
            </TabsTrigger>
            <TabsTrigger value="api-keys" className="justify-start gap-2">
              <Key className="w-4 h-4" />
              {t("tabs.apiKeys")}
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="justify-start gap-2"
            >
              <Bell className="w-4 h-4" />
              {t("tabs.notifications")}
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className="justify-start gap-2"
            >
              <Puzzle className="w-4 h-4" />
              {t("tabs.integrations")}
            </TabsTrigger>
          </TabsList>

          {/* Right: Content area */}
          <div className="flex-1 min-w-0">
            <TabsContent value="profile">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="project">
              <ProjectSettingsTab />
            </TabsContent>
            <TabsContent value="team">
              <TeamTab />
            </TabsContent>
            <TabsContent value="api-keys">
              <ApiKeysTab />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
            <TabsContent value="integrations">
              <IntegrationsTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
