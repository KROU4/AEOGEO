import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useTeamMembers } from "@/hooks/use-team";
import { useProjects, useProject, useUpdateProject } from "@/hooks/use-projects";
import { useBillingPlan } from "@/hooks/use-billing-plan";
import {
  useTenantAiKeys,
  useCreateTenantAiKey,
  useRotateTenantAiKey,
  useRevokeTenantAiKey,
  useTestTenantAiKey,
} from "@/hooks/use-tenant-ai-keys";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
  Check,
  Loader2,
  Trash2,
  CreditCard,
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

const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "google", label: "Google AI" },
  { id: "openrouter", label: "OpenRouter" },
] as const;

function ApiKeysTab() {
  const { t } = useTranslation("settings");
  const { data: keys = [], isLoading } = useTenantAiKeys();
  const createKey = useCreateTenantAiKey();
  const rotateKey = useRotateTenantAiKey();
  const revokeKey = useRevokeTenantAiKey();
  const testKey = useTestTenantAiKey();

  const [addOpen, setAddOpen] = useState(false);
  const [rotateForId, setRotateForId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newProvider, setNewProvider] = useState<string>("openai");
  const [newSecret, setNewSecret] = useState("");
  const [rotateSecret, setRotateSecret] = useState("");

  const resetAdd = () => {
    setNewLabel("");
    setNewProvider("openai");
    setNewSecret("");
  };

  const handleAdd = () => {
    if (!newLabel.trim() || !newSecret.trim()) return;
    createKey.mutate(
      {
        provider: newProvider,
        label: newLabel.trim(),
        api_key: newSecret,
      },
      {
        onSuccess: () => {
          toast.success(t("apiKeys.toastAdded"));
          setAddOpen(false);
          resetAdd();
        },
        onError: () => toast.error(t("apiKeys.toastError")),
      },
    );
  };

  const handleRotate = () => {
    if (!rotateForId || !rotateSecret.trim()) return;
    rotateKey.mutate(
      { keyId: rotateForId, newApiKey: rotateSecret.trim() },
      {
        onSuccess: () => {
          toast.success(t("apiKeys.toastRotated"));
          setRotateForId(null);
          setRotateSecret("");
        },
        onError: () => toast.error(t("apiKeys.toastError")),
      },
    );
  };

  return (
    <div className="space-y-6">
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{t("apiKeys.aiKeysTitle")}</CardTitle>
            <CardDescription>{t("apiKeys.aiKeysDesc")}</CardDescription>
          </div>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4" />
            {t("apiKeys.addKey")}
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-6">{t("apiKeys.loading")}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("apiKeys.noneYet")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("apiKeys.colLabel")}</TableHead>
                  <TableHead>{t("apiKeys.colProvider")}</TableHead>
                  <TableHead>{t("apiKeys.colHint")}</TableHead>
                  <TableHead className="text-right">{t("apiKeys.colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.label}</TableCell>
                    <TableCell>{k.provider}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {k.key_hint}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={testKey.isPending && testingId === k.id}
                        onClick={() => {
                          setTestingId(k.id);
                          testKey.mutate(k.id, {
                            onSettled: () => setTestingId(null),
                            onSuccess: (res) => {
                              if (res.success) toast.success(t("apiKeys.testOk"));
                              else toast.error(res.error ?? t("apiKeys.testFail"));
                            },
                          });
                        }}
                      >
                        {testKey.isPending && testingId === k.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          t("apiKeys.test")
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setRotateForId(k.id);
                          setRotateSecret("");
                        }}
                      >
                        {t("apiKeys.rotate")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={revokeKey.isPending}
                        onClick={() =>
                          revokeKey.mutate(k.id, {
                            onSuccess: () => toast.success(t("apiKeys.toastRevoked")),
                          })
                        }
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetAdd(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.addDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("apiKeys.colProvider")}</Label>
              <Select value={newProvider} onValueChange={setNewProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AI_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-label">{t("apiKeys.colLabel")}</Label>
              <Input
                id="key-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={t("apiKeys.labelPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key-secret">{t("apiKeys.secretLabel")}</Label>
              <Input
                id="key-secret"
                type="password"
                autoComplete="off"
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder={t("apiKeys.secretPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              {t("apiKeys.cancel")}
            </Button>
            <Button
              onClick={handleAdd}
              disabled={
                !newLabel.trim() || !newSecret.trim() || createKey.isPending
              }
            >
              {createKey.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {t("apiKeys.saveKey")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!rotateForId}
        onOpenChange={(o) => {
          if (!o) {
            setRotateForId(null);
            setRotateSecret("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.rotateDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="rotate-secret">{t("apiKeys.secretLabel")}</Label>
            <Input
              id="rotate-secret"
              type="password"
              autoComplete="off"
              value={rotateSecret}
              onChange={(e) => setRotateSecret(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRotateForId(null)}>
              {t("apiKeys.cancel")}
            </Button>
            <Button
              onClick={handleRotate}
              disabled={!rotateSecret.trim() || rotateKey.isPending}
            >
              {rotateKey.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {t("apiKeys.saveKey")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

function BillingTab() {
  const { t } = useTranslation("settings");
  const { data, isLoading, isError } = useBillingPlan();
  const q = data?.quota;

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-6">{t("billing.loading")}</p>
    );
  }
  if (isError || !data || !q) {
    return (
      <p className="text-sm text-destructive py-6">{t("billing.loadError")}</p>
    );
  }

  const tokenPct =
    q.tokens_pct != null ? Math.min(100, Math.round(q.tokens_pct)) : 0;
  const costPct =
    q.cost_pct != null ? Math.min(100, Math.round(q.cost_pct)) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t("billing.title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("billing.subtitle")}
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("billing.planLabel")}</CardTitle>
          <Badge variant="secondary" className="capitalize">
            {data.plan}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("billing.tokenBudget")}</span>
              <span className="font-medium tabular-nums">
                {q.tokens_limit != null
                  ? t("billing.xOfY", {
                      current: q.tokens_used.toLocaleString(),
                      max: q.tokens_limit.toLocaleString(),
                    })
                  : t("billing.unlimited")}
              </span>
            </div>
            {q.tokens_limit != null && (
              <Progress value={tokenPct} className="h-2" />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("billing.costBudget")}</span>
              <span className="font-medium tabular-nums">
                {q.cost_limit != null
                  ? t("billing.xOfY", {
                      current: q.cost_used.toFixed(2),
                      max: q.cost_limit.toFixed(2),
                    })
                  : t("billing.unlimited")}
              </span>
            </div>
            {q.cost_limit != null && q.cost_limit > 0 && (
              <Progress value={costPct} className="h-2" />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">{t("billing.requestsToday")}</p>
              <p className="text-lg font-semibold tabular-nums">
                {q.requests_today}
                {q.requests_day_limit != null && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {" "}
                    / {q.requests_day_limit}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t("billing.requestsThisMonth")}
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {q.requests_this_month}
              </p>
            </div>
          </div>

          {q.limit_reached && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {t("billing.limitReached")}
            </div>
          )}
          {q.warning_active && !q.limit_reached && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-3 text-sm text-amber-900 dark:text-amber-200">
              {t("billing.warningMessage")}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function IntegrationsTab() {
  const { t } = useTranslation("settings");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("integrations.title")}</CardTitle>
        <CardDescription>{t("integrations.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("integrations.avopStub")}</p>
      </CardContent>
    </Card>
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
            <TabsTrigger value="billing" className="justify-start gap-2">
              <CreditCard className="w-4 h-4" />
              {t("tabs.billing")}
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
            <TabsContent value="billing">
              <BillingTab />
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
