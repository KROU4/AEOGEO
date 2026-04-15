import { type ElementType, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/hooks/use-locale";
import { useDeleteProject, useProjects } from "@/hooks/use-projects";
import { formatDate } from "@/lib/format";
import { formatVisibilityScore } from "@/lib/report";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project";
import {
  ArrowUpRight,
  BookOpen,
  ExternalLink,
  FilePenLine,
  FolderOpen,
  Globe,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { KnowledgePackDialog } from "@/components/projects/knowledge-pack-dialog";
import { ProjectEditDialog } from "@/components/projects/project-edit-dialog";

type SortMode = "recent" | "name" | "score";

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDomainForLink(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `https://${value}`;
}

function compareProjects(a: Project, b: Project, sortMode: SortMode) {
  if (sortMode === "name") {
    return a.name.localeCompare(b.name);
  }

  if (sortMode === "score") {
    return (b.visibility_score ?? -1) - (a.visibility_score ?? -1);
  }

  return (
    new Date(b.updated_at ?? b.created_at).getTime() -
    new Date(a.updated_at ?? a.created_at).getTime()
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accentClassName,
}: {
  icon: ElementType;
  label: string;
  value: string;
  accentClassName: string;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="flex items-center gap-4 py-5">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-2xl",
            accentClassName
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectGridCard({
  project,
  onEdit,
  onDelete,
  onOpenKnowledge,
  onOpenQueries,
  onOpenRuns,
  onOpenProject,
}: {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
  onOpenKnowledge: () => void;
  onOpenQueries: () => void;
  onOpenRuns: () => void;
  onOpenProject: () => void;
}) {
  const { t } = useTranslation("projects");
  const { locale } = useLocale();

  return (
    <Card className="group overflow-hidden border-border/70 transition-all duration-200 hover:-translate-y-1 hover:border-teal-200 hover:shadow-xl">
      <CardContent className="p-0">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-4 dark:bg-muted/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar size="lg">
                <AvatarFallback className="bg-teal-600 text-sm font-bold text-white">
                  {getInitials(project.client_name || project.name)}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 space-y-2">
                <div className="space-y-1">
                  <p className="truncate text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {project.client_name}
                  </p>
                  <h3 className="truncate text-lg font-semibold text-foreground">
                    {project.name}
                  </h3>
                </div>

                {project.domain ? (
                  <a
                    href={formatDomainForLink(project.domain)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-sm text-teal-700 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{project.domain}</span>
                  </a>
                ) : (
                  <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Globe className="h-3.5 w-3.5" />
                    <span>{t("grid.noDomain")}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  project.visibility_score != null
                    ? "border-teal-200 bg-teal-50 text-teal-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                )}
              >
                {project.visibility_score != null
                  ? t("grid.visibilityScore", {
                      score: formatVisibilityScore(project.visibility_score),
                    })
                  : t("grid.needsRun")}
              </Badge>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    aria-label={t("grid.projectActions")}
                  >
                    <MoreHorizontal className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>{t("grid.menuLabel")}</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onOpenProject}>
                    <ArrowUpRight className="h-4 w-4" />
                    {t("viewProject")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenKnowledge}>
                    <BookOpen className="h-4 w-4" />
                    {t("grid.menuKnowledge")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenQueries}>
                    <LayoutGrid className="h-4 w-4" />
                    {t("grid.menuQueries")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenRuns}>
                    <PlayCircle className="h-4 w-4" />
                    {t("grid.menuRuns")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onEdit}>
                    <FilePenLine className="h-4 w-4" />
                    {t("grid.menuEdit")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("deleteProject")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          <p className="min-h-12 text-sm leading-6 text-muted-foreground">
            {project.description || t("noDescription")}
          </p>

          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("grid.membersLabel")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {t("member", { count: project.member_count })}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/30 px-3 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("grid.updatedLabel")}
              </p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {formatDate(project.updated_at ?? project.created_at, locale)}
              </p>
            </div>

            <div className="col-span-2 rounded-2xl border border-border/70 bg-muted/30 px-3 py-3 xl:col-span-1">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {t("grid.clientLabel")}
              </p>
              <p className="mt-2 truncate text-sm font-medium text-foreground">
                {project.client_name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
            <Button
              variant="outline"
              className="flex-1 min-w-[150px]"
              onClick={onOpenKnowledge}
            >
              <BookOpen className="h-4 w-4" />
              {t("grid.openKnowledge")}
            </Button>
            <Button className="flex-1 min-w-[150px]" onClick={onOpenProject}>
              <ArrowUpRight className="h-4 w-4" />
              {t("viewProject")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProjectsPage() {
  const { data, isLoading, error } = useProjects();
  const projects = data?.items ?? [];
  const { t } = useTranslation("projects");
  const navigate = useNavigate();
  const deleteProject = useDeleteProject();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [knowledgeTarget, setKnowledgeTarget] = useState<Project | null>(null);
  const sortedProjects = [...projects].sort((a, b) => compareProjects(a, b, "recent"));

  const scoredProjects = projects.filter((project) => project.visibility_score != null);
  const averageScore =
    scoredProjects.length > 0
      ? Math.round(
          scoredProjects.reduce(
            (sum, project) => sum + (project.visibility_score ?? 0),
            0
          ) / scoredProjects.length
        )
      : null;
  const projectsWithDomains = projects.filter((project) => Boolean(project.domain)).length;

  function openProject(projectId: string) {
    navigate({
      to: "/projects/$projectId",
      params: { projectId },
    });
  }

  function openQueries(projectId: string) {
    navigate({
      to: "/projects/$projectId/queries",
      params: { projectId },
    });
  }

  function openRuns(projectId: string) {
    navigate({
      to: "/projects/$projectId/runs",
      params: { projectId },
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link to="/new-project" search={{ step: 1 }}>
            <Plus className="w-4 h-4" />
            {t("newProject")}
          </Link>
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="py-12 text-center text-destructive">
          {t("errorLoad")}
        </div>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="mb-1 text-lg font-semibold text-foreground">
              {t("emptyTitle")}
            </h3>
            <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
              {t("emptyDescription")}
            </p>
            <Button asChild>
              <Link to="/new-project" search={{ step: 1 }}>
                <Plus className="w-4 h-4" />
                {t("newProject")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteConfirmTitle", { name: deleteTarget?.name })}
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
                if (deleteTarget) {
                  deleteProject.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }
              }}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {projects.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <SummaryCard
              icon={LayoutGrid}
              label={t("summary.totalProjects")}
              value={String(projects.length)}
              accentClassName="bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
            <SummaryCard
              icon={Globe}
              label={t("summary.connectedDomains")}
              value={String(projectsWithDomains)}
              accentClassName="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
            />
            <SummaryCard
              icon={Sparkles}
              label={t("summary.avgVisibility")}
              value={
                averageScore == null
                  ? t("summary.avgVisibilityEmpty")
                  : `${formatVisibilityScore(averageScore)}/10`
              }
              accentClassName="bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2 2xl:grid-cols-3">
              {sortedProjects.map((project) => (
                <ProjectGridCard
                  key={project.id}
                  project={project}
                  onEdit={() => setEditTarget(project)}
                  onDelete={() => setDeleteTarget(project)}
                  onOpenKnowledge={() => setKnowledgeTarget(project)}
                  onOpenQueries={() => openQueries(project.id)}
                  onOpenRuns={() => openRuns(project.id)}
                  onOpenProject={() => openProject(project.id)}
                />
              ))}
            </div>
        </>
      )}

      <ProjectEditDialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        project={editTarget}
      />

      <KnowledgePackDialog
        open={!!knowledgeTarget}
        onOpenChange={(open) => !open && setKnowledgeTarget(null)}
        project={knowledgeTarget}
        onEditKnowledge={() => setKnowledgeTarget(null)}
      />
    </div>
  );
}
