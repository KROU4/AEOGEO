import { useEffect, useState } from "react";
import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useParams,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ArrowLeft, Globe, Trash2 } from "lucide-react";
import { useQuickStartRun } from "@/hooks/use-runs";
import { useProject, useDeleteProject } from "@/hooks/use-projects";
import { formatVisibilityScore } from "@/lib/report";
import { writeStoredAnalyticsProjectId } from "@/lib/overview-project";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_dashboard/projects/$projectId")({
  component: ProjectDetailLayout,
});

function ProjectDetailLayout() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId",
  });
  const location = useLocation();
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const { data: project, isLoading } = useProject(projectId);
  const deleteProject = useDeleteProject();
  const rerunAnalytics = useQuickStartRun(projectId);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    writeStoredAnalyticsProjectId(projectId);
  }, [projectId]);

  const isProjectRoot =
    location.pathname === `/projects/${projectId}` ||
    location.pathname === `/projects/${projectId}/`;

  if (isProjectRoot) {
    return (
      <Navigate
        to="/projects/$projectId/site-audit"
        params={{ projectId }}
        replace
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="py-12 text-center text-muted-foreground">{t("errorLoad")}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-xs" asChild>
            <Link to="/projects">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
              {project.visibility_score != null && (
                <Badge
                  variant="outline"
                  className="border-teal-200 bg-teal-50 font-semibold text-teal-700 dark:border-teal-800 dark:bg-teal-950 dark:text-teal-300"
                >
                  {formatVisibilityScore(project.visibility_score)}/10
                </Badge>
              )}
            </div>
            {project.domain && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Globe className="h-3 w-3" />
                {project.domain}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={rerunAnalytics.isPending}
            onClick={() =>
              rerunAnalytics.mutate(undefined, {
                onError: () =>
                  toast.error(t("visibilityAnalytics.rerunFailed")),
              })
            }
          >
            {rerunAnalytics.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Play className="h-4 w-4" aria-hidden />
            )}
            {t("visibilityAnalytics.rerunAnalytics")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
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

      <Outlet />
    </div>
  );
}
