import { useState } from "react";
import { createFileRoute, Link, Outlet, useParams, useMatches, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Globe,
  Search,
  Play,
  BarChart3,
  Trash2,
} from "lucide-react";
import { useProject, useDeleteProject } from "@/hooks/use-projects";
import { useQuerySets } from "@/hooks/use-queries";
import { useRuns } from "@/hooks/use-runs";
import { KnowledgePackDialog } from "@/components/projects/knowledge-pack-dialog";
import { formatVisibilityScore } from "@/lib/report";

export const Route = createFileRoute("/_dashboard/projects/$projectId")({
  component: ProjectDetailPage,
});

function ProjectDetailPage() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId",
  });
  const { t } = useTranslation("projects");
  const { t: tq } = useTranslation("queries");
  const { t: tr } = useTranslation("runs");
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const { data: querySetsData } = useQuerySets(projectId);
  const { data: runsData } = useRuns(projectId);
  const deleteProject = useDeleteProject();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showKnowledgeDialog, setShowKnowledgeDialog] = useState(false);

  const matches = useMatches();
  const lastPath = matches[matches.length - 1]?.pathname ?? "";
  const activeTab = lastPath.endsWith("/runs")
    ? "runs"
    : lastPath.endsWith("/queries")
      ? "queries"
      : "overview";

  const querySets = querySetsData?.items ?? [];
  const runs = runsData?.items ?? [];
  const totalQueries = querySets.reduce((sum, qs) => sum + qs.query_count, 0);
  const completedRuns = runs.filter((r) => r.status === "completed").length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        {t("errorLoad")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/projects">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">
                {project.name}
              </h2>
              {project.visibility_score != null && (
                <Badge
                  variant="outline"
                  className="bg-teal-50 text-teal-700 border-teal-200 font-semibold dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
                >
                  {formatVisibilityScore(project.visibility_score)}/10
                </Badge>
              )}
            </div>
            {project.domain && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                <Globe className="w-3 h-3" />
                {project.domain}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowKnowledgeDialog(true)}
          >
            <BookOpen className="w-4 h-4" />
            {t("knowledge.title")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4" />
            {t("deleteProject")}
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { name: project?.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                deleteProject.mutate(projectId, {
                  onSuccess: () => navigate({ to: "/projects" }),
                });
              }}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <KnowledgePackDialog
        open={showKnowledgeDialog}
        onOpenChange={setShowKnowledgeDialog}
        project={project}
        onEditKnowledge={() => {
          setShowKnowledgeDialog(false);
        }}
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950">
                <Search className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {totalQueries}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tq("queryCount", { count: totalQueries })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950">
                <Play className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {runs.length}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr("runHistory")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950">
                <BarChart3 className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {completedRuns}
                </p>
                <p className="text-xs text-muted-foreground">
                  {tr("status.completed")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <Tabs value={activeTab}>
        <TabsList>
          <TabsTrigger value="overview" asChild>
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
            >
              {t("detail.overview")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="queries" asChild>
            <Link
              to="/projects/$projectId/queries"
              params={{ projectId }}
            >
              {tq("title")}
            </Link>
          </TabsTrigger>
          <TabsTrigger value="runs" asChild>
            <Link
              to="/projects/$projectId/runs"
              params={{ projectId }}
            >
              {tr("title")}
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === "overview" ? (
        <OverviewContent
          projectId={projectId}
          project={project}
          querySetCount={querySets.length}
          totalQueries={totalQueries}
          runCount={runs.length}
        />
      ) : (
        <Outlet />
      )}
    </div>
  );
}

function OverviewContent({
  projectId,
  project,
  querySetCount,
  totalQueries,
  runCount,
}: {
  projectId: string;
  project: { name: string; description?: string | null; domain?: string | null; created_at?: string };
  querySetCount: number;
  totalQueries: number;
  runCount: number;
}) {
  const { t } = useTranslation("projects");

  return (
    <div className="space-y-6">
      <ProjectWorkflowCard
        projectId={projectId}
        querySetCount={querySetCount}
        totalQueries={totalQueries}
        runCount={runCount}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardContent className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.projectInfo")}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("detail.labels.name")}</span>
                <span className="font-medium text-foreground text-right">{project.name}</span>
              </div>
              {project.domain && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("detail.labels.domain")}</span>
                  <span className="font-medium text-foreground text-right">{project.domain}</span>
                </div>
              )}
              {project.description && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{t("detail.labels.description")}</span>
                  <span className="font-medium text-foreground text-right max-w-[280px]">
                    {project.description}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("detail.quickSummary")}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("detail.labels.querySets")}</span>
                <span className="font-medium text-foreground">{querySetCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("detail.labels.totalQueries")}</span>
                <span className="font-medium text-foreground">{totalQueries}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">{t("detail.labels.engineRuns")}</span>
                <span className="font-medium text-foreground">{runCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProjectWorkflowCard({
  projectId,
  querySetCount,
  totalQueries,
  runCount,
}: {
  projectId: string;
  querySetCount: number;
  totalQueries: number;
  runCount: number;
}) {
  const { t } = useTranslation("projects");

  const currentStepKey =
    querySetCount === 0
      ? "createSet"
      : totalQueries === 0
        ? "addQueries"
        : runCount === 0
          ? "runEngines"
          : null;

  const steps = [
    {
      key: "createSet",
      title: t("workflow.steps.createSet.title"),
      description: t("workflow.steps.createSet.description"),
      done: querySetCount > 0,
    },
    {
      key: "addQueries",
      title: t("workflow.steps.addQueries.title"),
      description: t("workflow.steps.addQueries.description"),
      done: totalQueries > 0,
    },
    {
      key: "runEngines",
      title: t("workflow.steps.runEngines.title"),
      description: t("workflow.steps.runEngines.description"),
      done: runCount > 0,
    },
  ];

  const primaryAction =
    querySetCount === 0
      ? {
          to: "/projects/$projectId/queries" as const,
          label: t("workflow.actions.createSet"),
        }
      : totalQueries === 0
        ? {
            to: "/projects/$projectId/queries" as const,
            label: t("workflow.actions.addQueries"),
          }
        : runCount === 0
          ? {
              to: "/projects/$projectId/runs" as const,
              label: t("workflow.actions.startRun"),
            }
          : {
              to: "/projects/$projectId/runs" as const,
              label: t("workflow.actions.viewRuns"),
            };

  return (
    <Card className="border-dashed">
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle>{t("workflow.title")}</CardTitle>
            <CardDescription>{t("workflow.description")}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className="w-fit bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800"
          >
            {currentStepKey
              ? t("workflow.currentStep")
              : t("workflow.completed")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => {
            const isCurrent = step.key === currentStepKey;
            return (
              <div
                key={step.key}
                className="rounded-lg border bg-background/60 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
                    {step.done ? (
                      <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          step.done
                            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
                            : isCurrent
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                              : "text-muted-foreground"
                        }
                      >
                        {step.done
                          ? t("workflow.status.done")
                          : isCurrent
                            ? t("workflow.status.next")
                            : t("workflow.status.pending")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="sm:w-auto">
            <Link to={primaryAction.to} params={{ projectId }}>
              {primaryAction.label}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild className="sm:w-auto">
            <Link to="/projects/$projectId/queries" params={{ projectId }}>
              {t("workflow.actions.viewQueries")}
            </Link>
          </Button>
          <Button variant="outline" asChild className="sm:w-auto">
            <Link to="/projects/$projectId/runs" params={{ projectId }}>
              {t("workflow.actions.viewRuns")}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
