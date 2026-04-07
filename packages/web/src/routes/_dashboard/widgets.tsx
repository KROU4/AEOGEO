import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Layout,
  Trash2,
  Loader2,
  ArrowLeft,
  Eye,
  Code,
  LayoutGrid,
  Rss,
  MousePointerClick,
} from "lucide-react";
import {
  useWidgets,
  useCreateWidget,
  useUpdateWidget,
  useDeleteWidget,
  useEmbedCode,
  useWidgetAnalytics,
} from "@/hooks/use-widgets";
import { useProjects } from "@/hooks/use-projects";
import { WidgetConfigurator } from "@/components/widgets/widget-configurator";
import { EmbedCodeTabs } from "@/components/widgets/embed-code-tabs";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";
import { buildWidgetEmbedUrl } from "@/lib/widget-embed";
import type { Widget, WidgetCreate, WidgetUpdate } from "@/types/widget";

export const Route = createFileRoute("/_dashboard/widgets")({
  component: WidgetsPage,
});

// ── Widget Card ─────────────────────────────────────────────────

function WidgetCard({
  widget,
  projectName,
  onClick,
}: {
  widget: Widget;
  projectName: string;
  onClick: () => void;
}) {
  const { t } = useTranslation("widgets");
  const { locale } = useLocale();

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20 group"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {widget.mode === "faq" ? (
                <LayoutGrid className="w-4 h-4" />
              ) : (
                <Rss className="w-4 h-4" />
              )}
            </div>
            <div>
              <CardTitle className="text-base">{widget.name}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {projectName}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={
              widget.theme === "dark"
                ? "bg-zinc-900 text-zinc-100 border-zinc-700"
                : "bg-white text-zinc-800 border-zinc-200"
            }
          >
            {widget.theme === "dark" ? t("config.themeDark") : t("config.themeLight")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              {widget.mode === "faq" ? t("config.modeFaq") : t("config.modeBlogFeed")}
            </span>
            <span>{t("config.maxItems")}: {widget.max_items}</span>
          </div>
          <span>{formatDate(widget.created_at, locale)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Empty State ─────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  const { t } = useTranslation("widgets");

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-4">
          <Layout className="w-6 h-6 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t("emptyState.title")}
        </h3>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
          {t("emptyState.description")}
        </p>
        <Button onClick={onCreateClick}>
          <Plus className="w-4 h-4" />
          {t("createWidget")}
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Create Widget Dialog ────────────────────────────────────────

function CreateWidgetDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("widgets");
  const { data: projectsData } = useProjects();
  const createWidget = useCreateWidget();
  const projects = projectsData?.items ?? [];

  const handleSave = (data: WidgetCreate | WidgetUpdate) => {
    createWidget.mutate(data as WidgetCreate, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("createWidget")}</DialogTitle>
          <DialogDescription>{t("createWidgetDescription")}</DialogDescription>
        </DialogHeader>
        <WidgetConfigurator
          projects={projects}
          onSave={handleSave}
          isSaving={createWidget.isPending}
        />
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Confirmation Dialog ──────────────────────────────────

function DeleteWidgetDialog({
  widget,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  widget: Widget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation("widgets");
  const { t: tc } = useTranslation("common");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deleteWidget.title")}</DialogTitle>
          <DialogDescription>
            {t("deleteWidget.description", { name: widget?.name })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
            {tc("actions.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Widget Detail View ──────────────────────────────────────────

function WidgetDetail({
  widget,
  projectName,
  onBack,
  onDelete,
}: {
  widget: Widget;
  projectName: string;
  onBack: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("widgets");
  const updateWidget = useUpdateWidget(widget.id);
  const { data: embedCodeData } = useEmbedCode(widget.id);
  const { data: analyticsData, isLoading: analyticsLoading } = useWidgetAnalytics(widget.id);
  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];

  const handleSave = (data: WidgetCreate | WidgetUpdate) => {
    updateWidget.mutate(data as WidgetUpdate);
  };

  return (
    <div className="space-y-6">
      {/* Detail header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h3 className="text-xl font-semibold text-foreground">
              {widget.name}
            </h3>
            <p className="text-sm text-muted-foreground">{projectName}</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
          {t("deleteWidget.button")}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Configurator */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{t("config.title")}</CardTitle>
              <CardDescription>{t("config.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              <WidgetConfigurator
                widget={widget}
                projects={projects}
                onSave={handleSave}
                isSaving={updateWidget.isPending}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Preview + Embed code */}
        <div className="lg:col-span-2 space-y-6">
          {/* Preview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {t("preview.title")}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div
                className="overflow-hidden border border-border bg-muted/30"
                style={{ borderRadius: `${widget.border_radius}px` }}
              >
                <iframe
                  src={buildWidgetEmbedUrl(widget.embed_token)}
                  className="w-full h-64 border-0"
                  title={widget.name}
                  sandbox="allow-scripts allow-same-origin"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {t("preview.modeTheme", {
                  mode: widget.mode === "faq" ? t("config.modeFaq") : t("config.modeBlogFeed"),
                  theme: widget.theme === "dark" ? t("config.themeDark") : t("config.themeLight"),
                })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MousePointerClick className="w-4 h-4" />
                {t("analytics.title")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsLoading ? (
                <div className="space-y-3">
                  <div className="h-10 rounded bg-muted animate-pulse" />
                  <div className="h-10 rounded bg-muted animate-pulse" />
                </div>
              ) : analyticsData ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("analytics.impressions")}
                      </p>
                      <p className="text-2xl font-semibold text-foreground mt-1">
                        {analyticsData.impressions}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">
                        {t("analytics.interactions")}
                      </p>
                      <p className="text-2xl font-semibold text-foreground mt-1">
                        {analyticsData.item_interactions}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      {t("analytics.topContent")}
                    </p>
                    {analyticsData.top_content.length > 0 ? (
                      <div className="space-y-2">
                        {analyticsData.top_content.map((item) => (
                          <div
                            key={item.content_id}
                            className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                          >
                            <span className="text-sm text-foreground truncate pr-3">
                              {item.title}
                            </span>
                            <Badge variant="secondary">
                              {item.interaction_count}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("analytics.empty")}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("analytics.empty")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Embed code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                {t("embed.title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EmbedCodeTabs
                widget={widget}
                embedCode={embedCodeData}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ── Main Widgets Page ───────────────────────────────────────────

function WidgetsPage() {
  const { t } = useTranslation("widgets");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Widget | null>(null);

  const { data: widgets, isLoading } = useWidgets();
  const { data: projectsData } = useProjects();
  const deleteWidget = useDeleteWidget();

  const projects = projectsData?.items ?? [];
  const projectMap = new Map(projects.map((p) => [p.id, p.name]));

  const selectedWidget = widgets?.find((w) => w.id === selectedWidgetId);

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteWidget.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null);
          // If we were viewing this widget, go back to list
          if (selectedWidgetId === deleteTarget.id) {
            setSelectedWidgetId(null);
          }
        },
      });
    }
  };

  // Detail view
  if (selectedWidget) {
    return (
      <div className="space-y-8">
        {/* Page header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>

        <WidgetDetail
          widget={selectedWidget}
          projectName={projectMap.get(selectedWidget.project_id) ?? "—"}
          onBack={() => setSelectedWidgetId(null)}
          onDelete={() => setDeleteTarget(selectedWidget)}
        />

        <DeleteWidgetDialog
          widget={deleteTarget}
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          isDeleting={deleteWidget.isPending}
        />
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("createWidget")}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!widgets || widgets.length === 0) && (
        <EmptyState onCreateClick={() => setCreateDialogOpen(true)} />
      )}

      {/* Widget grid */}
      {!isLoading && widgets && widgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {widgets.map((widget) => (
            <WidgetCard
              key={widget.id}
              widget={widget}
              projectName={projectMap.get(widget.project_id) ?? "—"}
              onClick={() => setSelectedWidgetId(widget.id)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateWidgetDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />

      {/* Delete dialog */}
      <DeleteWidgetDialog
        widget={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={deleteWidget.isPending}
      />
    </div>
  );
}
