import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useProjects, useProject, useUpdateProject, useProjectMembers } from "@/hooks/use-projects";
import { useBillingPlan } from "@/hooks/use-billing-plan";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Globe,
  Sliders,
  Check,
  Users,
  CreditCard,
  Bell,
  UserPlus,
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
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-teal-600 text-white text-xl font-bold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">{tc("roles.owner")}</p>
              <button type="button" className="text-xs text-primary hover:underline mt-1">
                {t("profile.changeAvatar")}
              </button>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="full-name">{t("profile.fullName")}</Label>
            <Input id="full-name" defaultValue={userName} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email-address">{t("profile.emailAddress")}</Label>
            <Input id="email-address" defaultValue={userEmail} disabled />
            <p className="text-xs text-muted-foreground">{t("profile.emailHelp")}</p>
          </div>

          <Button>{tc("actions.save")}</Button>
        </CardContent>
      </Card>

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
              type="button"
              onClick={() => setLocale("en")}
              className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                locale === "en" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">EN</span>
                <span className="text-sm font-medium text-foreground">English</span>
              </div>
              {locale === "en" && <Check className="w-4 h-4 text-primary" />}
            </button>
            <button
              type="button"
              onClick={() => setLocale("ru")}
              className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                locale === "ru" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">RU</span>
                <span className="text-sm font-medium text-foreground">Русский</span>
              </div>
              {locale === "ru" && <Check className="w-4 h-4 text-primary" />}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">{t("projectSettings.selectProject")}</span>
        <Select value={selectedProjectId ?? ""} onValueChange={(value) => setSelectedProjectId(value)}>
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
                type="button"
                onClick={() => updateProject.mutate({ content_locale: "en" })}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                  contentLocale === "en" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">EN</span>
                  <span className="text-sm font-medium text-foreground">English</span>
                </div>
                {contentLocale === "en" && <Check className="w-4 h-4 text-primary" />}
              </button>
              <button
                type="button"
                onClick={() => updateProject.mutate({ content_locale: "ru" })}
                className={`flex items-center justify-between gap-2 p-3 rounded-lg border transition-colors cursor-pointer ${
                  contentLocale === "ru" ? "border-primary bg-primary/5" : "border-border hover:bg-accent/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">RU</span>
                  <span className="text-sm font-medium text-foreground">Русский</span>
                </div>
                {contentLocale === "ru" && <Check className="w-4 h-4 text-primary" />}
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TeamTab() {
  const { t } = useTranslation("settings");
  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];
  const [teamProjectId, setTeamProjectId] = useState<string | null>(null);

  useEffect(() => {
    const first = projects[0];
    if (!teamProjectId && first) {
      setTeamProjectId(first.id);
    }
  }, [teamProjectId, projects]);

  const membersQuery = useProjectMembers(teamProjectId ?? "");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-foreground">{t("projectSettings.selectProject")}</span>
        <Select value={teamProjectId ?? ""} onValueChange={(v) => setTeamProjectId(v)}>
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

      <Card>
        <CardHeader>
          <CardTitle>{t("team.title")}</CardTitle>
          <CardDescription>{t("team.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {membersQuery.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (membersQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("team.empty")}</p>
          ) : (
            (membersQuery.data ?? []).map((m) => {
              const initials = m.name
                .split(" ")
                .map((x) => x[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);
              return (
            <div key={m.user_id} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9">
                  <AvatarFallback className="bg-accent text-accent-foreground text-sm">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {m.role}
                </Badge>
              </div>
            </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            {t("team.invite.title")}
          </CardTitle>
          <CardDescription>{t("team.invite.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 flex-wrap">
            <Input placeholder={t("team.invite.emailPlaceholder")} className="flex-1 min-w-[200px]" />
            <Select defaultValue="editor">
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button">{t("team.invite.submit")}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BillingTab() {
  const { t } = useTranslation("settings");
  const plan = useBillingPlan();
  const q = plan.data?.quota;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("billing.planLabel")}</CardTitle>
              <CardDescription>{t("billing.subtitle")}</CardDescription>
            </div>
            {plan.isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 capitalize">
                {plan.data?.plan ?? "—"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : plan.error ? (
            <p className="text-sm text-destructive">{t("billing.loadError")}</p>
          ) : q ? (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#4ae176] shrink-0" />
                {t("billing.tokenBudget")}: {q.tokens_used.toLocaleString()}
                {q.tokens_limit != null ? ` / ${q.tokens_limit.toLocaleString()}` : ` (${t("billing.unlimited")})`}
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#4ae176] shrink-0" />
                {t("billing.requestsToday")}: {q.requests_today}
                {q.requests_day_limit != null ? ` / ${q.requests_day_limit}` : ""}
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#4ae176] shrink-0" />
                {t("billing.requestsThisMonth")}: {q.requests_this_month}
              </li>
              {q.limit_reached ? (
                <li className="col-span-full text-destructive text-xs">{t("billing.limitReached")}</li>
              ) : null}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("billing.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {plan.isLoading || !q ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">{t("billing.tokenBudget")}</span>
                  <span className="font-avop-mono text-foreground">
                    {q.tokens_used.toLocaleString()}
                    {q.tokens_limit != null ? ` / ${q.tokens_limit.toLocaleString()}` : ""}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, q.tokens_pct ?? 0)}%` }}
                  />
                </div>
              </div>
              {q.cost_limit != null ? (
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">{t("billing.costBudget")}</span>
                    <span className="font-avop-mono text-foreground">
                      {q.cost_used.toFixed(2)} / {q.cost_limit.toFixed(2)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${Math.min(100, q.cost_pct ?? 0)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


function NotificationsTab() {
  const { t } = useTranslation("settings");
  const [prefs, setPrefs] = useState({
    weeklyDigest: true,
    citationAlerts: true,
    competitorMovement: false,
    scoreDrops: true,
  });

  const items = [
    { key: "weeklyDigest" as const, label: t("notifications.weeklyReports"), desc: t("notifications.weeklyReportsDesc") },
    { key: "citationAlerts" as const, label: t("notifications.citationAlerts"), desc: t("notifications.citationAlertsDesc") },
    { key: "competitorMovement" as const, label: t("notifications.competitorMovements"), desc: t("notifications.competitorMovementsDesc") },
    {
      key: "scoreDrops" as const,
      label: "Score Drops",
      desc: "Alert when visibility score drops more than 5 points",
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.title")}</CardTitle>
          <CardDescription>{t("notifications.subtitle")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {items.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
              </div>
              <Switch checked={prefs[item.key]} onCheckedChange={(v) => setPrefs((p) => ({ ...p, [item.key]: v }))} />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsPage() {
  const { t } = useTranslation("settings");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="profile" orientation="vertical">
        <div className="flex gap-6">
          <TabsList variant="line" className="flex-col w-56 shrink-0 items-stretch h-auto">
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
            <TabsTrigger value="billing" className="justify-start gap-2">
              <CreditCard className="w-4 h-4" />
              {t("tabs.billing")}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="justify-start gap-2">
              <Bell className="w-4 h-4" />
              {t("tabs.notifications")}
            </TabsTrigger>
          </TabsList>

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
            <TabsContent value="billing">
              <BillingTab />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
