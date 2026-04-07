import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Archive,
  CheckCircle2,
  FilePenLine,
  GitCompareArrows,
  BookOpen,
  DollarSign,
  FileText,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import { ContentEditorDialog } from "@/components/content/content-editor-dialog";
import { ContentGenerateDialog } from "@/components/content/content-generate-dialog";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import {
  useApproveContent,
  useArchiveContent,
  useContentList,
  useRejectContent,
  useSubmitForReview,
} from "@/hooks/use-content";
import { useProjects } from "@/hooks/use-projects";
import type { Content, ContentStatus } from "@/types/content";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/content")({
  component: ContentPage,
});

const typeConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  faq: {
    label: "FAQ",
    icon: HelpCircle,
    className:
      "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800",
  },
  blog: {
    label: "Blog",
    icon: FileText,
    className:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  comparison: {
    label: "Comparison",
    icon: GitCompareArrows,
    className:
      "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  buyer_guide: {
    label: "Buyer Guide",
    icon: ShoppingCart,
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  pricing_clarifier: {
    label: "Pricing",
    icon: DollarSign,
    className:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  glossary: {
    label: "Glossary",
    icon: BookOpen,
    className:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  },
};

function ContentTypeBadge({ contentType }: { contentType: string }) {
  const config = typeConfig[contentType];
  if (!config) {
    return (
      <Badge variant="outline" className="text-xs">
        {contentType.replace("_", " ")}
      </Badge>
    );
  }

  const Icon = config.icon;
  return (
    <Badge variant="outline" className={"gap-1 text-xs " + config.className}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
}

function ContentActionsMenu({
  item,
  onOpen,
  onContentChange,
}: {
  item: Content;
  onOpen: (content: Content) => void;
  onContentChange: (content: Content) => void;
}) {
  const { t } = useTranslation("content");
  const submitMutation = useSubmitForReview();
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();
  const archiveMutation = useArchiveContent();

  const isBusy =
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    archiveMutation.isPending;

  function handleStatusChange(action: "review" | "published" | "draft" | "archived") {
    const mutation =
      action === "review"
        ? submitMutation
        : action === "published"
          ? approveMutation
          : action === "draft"
            ? rejectMutation
            : archiveMutation;

    mutation.mutate(item.id, {
      onSuccess: (content) => {
        onContentChange(content);
      },
    });
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
          disabled={isBusy}
        >
          {isBusy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MoreHorizontal className="size-4" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onOpen(item)}>
          <FilePenLine className="mr-2 h-4 w-4" />
          {t("actions.open")}
        </DropdownMenuItem>
        {item.status === "draft" && (
          <DropdownMenuItem onClick={() => handleStatusChange("review")}>
            <Send className="mr-2 h-4 w-4" />
            {t("actions.submitForReview")}
          </DropdownMenuItem>
        )}
        {item.status === "review" && (
          <>
            <DropdownMenuItem onClick={() => handleStatusChange("published")}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              {t("actions.publish")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange("draft")}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {t("actions.returnToDraft")}
            </DropdownMenuItem>
          </>
        )}
        {item.status !== "archived" && (
          <DropdownMenuItem onClick={() => handleStatusChange("archived")}>
            <Archive className="mr-2 h-4 w-4" />
            {t("actions.archive")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ContentTable({
  items,
  isLoading,
  projectNameById,
  onOpen,
  onContentChange,
}: {
  items: Content[];
  isLoading?: boolean;
  projectNameById: Record<string, string>;
  onOpen: (content: Content) => void;
  onContentChange: (content: Content) => void;
}) {
  const { t } = useTranslation("content");
  const { locale } = useLocale();

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.title")}</TableHead>
              <TableHead>{t("table.project")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.author")}</TableHead>
              <TableHead>{t("table.updated")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        className="text-left font-medium text-foreground hover:text-teal-700"
                        onClick={() => onOpen(item)}
                      >
                        {item.title}
                      </button>
                      <ContentTypeBadge contentType={item.content_type} />
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {projectNameById[item.project_id] ?? t("editor.unknownProject")}
                  </TableCell>
                  <TableCell>
                    <ContentStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.author_name || t("table.unknownAuthor")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.updated_at ?? item.created_at, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ContentActionsMenu
                      item={item}
                      onOpen={onOpen}
                      onContentChange={onContentChange}
                    />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("emptyState")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ContentPage() {
  const { t } = useTranslation("content");
  const [generateOpen, setGenerateOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(undefined);
  const [statusTab, setStatusTab] = useState<"all" | ContentStatus>("all");

  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const projects = projectsData?.items ?? [];
  const statusFilter = statusTab === "all" ? undefined : statusTab;
  const { data, isLoading } = useContentList(statusFilter, selectedProjectId);
  const items = data?.items ?? [];
  const projectNameById = Object.fromEntries(
    projects.map((project) => [project.id, project.name])
  );
  const hasProjects = projects.length > 0;

  function openCreateDialog() {
    setSelectedContent(null);
    setEditorOpen(true);
  }

  function openExistingContent(content: Content) {
    setSelectedContent(content);
    setEditorOpen(true);
  }

  function focusContent(content: Content) {
    setSelectedProjectId(content.project_id);
    setStatusTab(content.status as ContentStatus);
    setSelectedContent(content);
    setEditorOpen(true);
  }

  function handleSavedContent(content: Content) {
    setSelectedContent(content);
    setEditorOpen(true);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
          {!hasProjects && !projectsLoading && (
            <p className="mt-2 text-sm text-amber-700">{t("filters.noProjectsHint")}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedProjectId ?? "__all__"}
            onValueChange={(value) =>
              setSelectedProjectId(value === "__all__" ? undefined : value)
            }
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder={t("filters.projectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("filters.allProjects")}</SelectItem>
              {projectsLoading && (
                <SelectItem value="__loading__" disabled>
                  ...
                </SelectItem>
              )}
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="secondary"
            onClick={() => setGenerateOpen(true)}
            disabled={!hasProjects}
          >
            <Sparkles className="h-4 w-4" />
            {t("aiGenerate")}
          </Button>
          <Button onClick={openCreateDialog} disabled={!hasProjects}>
            <Plus className="h-4 w-4" />
            {t("createContent")}
          </Button>
        </div>
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(value) => setStatusTab(value as "all" | ContentStatus)}
      >
        <TabsList>
          <TabsTrigger value="all">{t("tabs.all")}</TabsTrigger>
          <TabsTrigger value="draft">{t("tabs.drafts")}</TabsTrigger>
          <TabsTrigger value="review">{t("tabs.review")}</TabsTrigger>
          <TabsTrigger value="published">{t("tabs.published")}</TabsTrigger>
          <TabsTrigger value="archived">{t("tabs.archived")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <ContentTable
        items={items}
        isLoading={isLoading}
        projectNameById={projectNameById}
        onOpen={openExistingContent}
        onContentChange={(content) => {
          setSelectedContent((current) =>
            current?.id === content.id ? content : current
          );
        }}
      />

      <ContentGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        initialProjectId={selectedProjectId}
        onGenerated={focusContent}
      />

      <ContentEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setSelectedContent(null);
          }
        }}
        content={selectedContent}
        projects={projects}
        initialProjectId={selectedProjectId}
        onSaved={selectedContent === null ? focusContent : handleSavedContent}
        onStatusChanged={focusContent}
      />
    </div>
  );
}
