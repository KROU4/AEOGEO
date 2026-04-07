import { useEffect, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  Archive,
  CheckCircle2,
  FilePenLine,
  Loader2,
  RotateCcw,
  Send,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api-client";
import {
  useApproveContent,
  useArchiveContent,
  useContentTemplates,
  useCreateContent,
  useRejectContent,
  useSubmitForReview,
  useUpdateContent,
} from "@/hooks/use-content";
import { ContentStatusBadge } from "@/components/content/content-status-badge";
import { JsonLdPreview } from "@/components/content/json-ld-preview";
import type { Content, ContentType } from "@/types/content";
import type { Project } from "@/types/project";

const CONTENT_TYPES: ContentType[] = [
  "faq",
  "blog",
  "comparison",
  "buyer_guide",
  "pricing_clarifier",
  "glossary",
];

const errorKeyByCode: Record<string, string> = {
  "ai.usage_limit_reached": "errors.usage.limit_reached",
  "ai.rate_limited": "errors.usage.rate_limited",
  "ai.no_api_key": "errors.ai_key.not_found",
};

interface ContentEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: Content | null;
  projects: Project[];
  initialProjectId?: string;
  onSaved?: (content: Content) => void;
  onStatusChanged?: (content: Content) => void;
}

function getErrorMessage(error: unknown, t: TFunction<"common">): string {
  if (error instanceof ApiError) {
    const key = errorKeyByCode[error.code] ?? `errors.${error.code}`;
    const translated = t(key);
    return translated === key ? t("errors.unknown") : translated;
  }

  return t("errors.unknown");
}

export function ContentEditorDialog({
  open,
  onOpenChange,
  content,
  projects,
  initialProjectId,
  onSaved,
  onStatusChanged,
}: ContentEditorDialogProps) {
  const { t } = useTranslation("content");
  const { t: tCommon } = useTranslation("common");
  const { data: templates = [] } = useContentTemplates();
  const createMutation = useCreateContent();
  const updateMutation = useUpdateContent();
  const submitMutation = useSubmitForReview();
  const approveMutation = useApproveContent();
  const rejectMutation = useRejectContent();
  const archiveMutation = useArchiveContent();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contentType, setContentType] = useState<ContentType>("blog");
  const resetCreate = createMutation.reset;
  const resetUpdate = updateMutation.reset;
  const resetSubmit = submitMutation.reset;
  const resetApprove = approveMutation.reset;
  const resetReject = rejectMutation.reset;
  const resetArchive = archiveMutation.reset;

  const isEditing = content !== null;
  const isBusy =
    createMutation.isPending ||
    updateMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    archiveMutation.isPending;

  useEffect(() => {
    if (!open) {
      return;
    }

    resetCreate();
    resetUpdate();
    resetSubmit();
    resetApprove();
    resetReject();
    resetArchive();

    setTitle(content?.title ?? "");
    setBody(content?.body ?? "");
    setProjectId(content?.project_id ?? initialProjectId ?? projects[0]?.id ?? "");
    setContentType((content?.content_type as ContentType | undefined) ?? "blog");
  }, [
    open,
    content,
    initialProjectId,
    projects,
    resetCreate,
    resetUpdate,
    resetSubmit,
    resetApprove,
    resetReject,
    resetArchive,
  ]);

  const activeError =
    createMutation.error ??
    updateMutation.error ??
    submitMutation.error ??
    approveMutation.error ??
    rejectMutation.error ??
    archiveMutation.error;

  const templateName = content?.template_id
    ? templates.find((template) => template.id === content.template_id)?.name
    : undefined;
  const projectName =
    projects.find((project) => project.id === (content?.project_id ?? projectId))
      ?.name ?? t("editor.unknownProject");
  const canSave = title.trim().length > 0 && projectId.length > 0;

  function handleSave() {
    if (!canSave) {
      return;
    }

    const trimmedTitle = title.trim();

    if (!isEditing) {
      createMutation.mutate(
        {
          title: trimmedTitle,
          body,
          content_type: contentType,
          project_id: projectId,
        },
        {
          onSuccess: (createdContent) => {
            onSaved?.(createdContent);
          },
        }
      );
      return;
    }

    updateMutation.mutate(
      {
        id: content.id,
        data: {
          title: trimmedTitle,
          body,
        },
      },
      {
        onSuccess: (updatedContent) => {
          onSaved?.(updatedContent);
        },
      }
    );
  }

  function handleStatusChange(action: "review" | "published" | "draft" | "archived") {
    if (!content) {
      return;
    }

    const mutation =
      action === "review"
        ? submitMutation
        : action === "published"
          ? approveMutation
          : action === "draft"
            ? rejectMutation
            : archiveMutation;

    mutation.mutate(content.id, {
      onSuccess: (nextContent) => {
        onStatusChanged?.(nextContent);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FilePenLine className="h-5 w-5 text-teal-600" />
            {isEditing ? t("editor.editTitle") : t("editor.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editor.editDescription") : t("editor.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] overflow-y-auto min-h-0">
          <div className="space-y-4">
            {!isEditing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="content-project">{t("editor.project")}</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger id="content-project">
                      <SelectValue placeholder={t("editor.projectPlaceholder")} />
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

                <div className="space-y-2">
                  <Label htmlFor="content-type">{t("editor.contentType")}</Label>
                  <Select
                    value={contentType}
                    onValueChange={(value) => setContentType(value as ContentType)}
                  >
                    <SelectTrigger id="content-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {tCommon(`contentType.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="content-title">{t("editor.titleLabel")}</Label>
              <Input
                id="content-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("editor.titlePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content-body">{t("editor.bodyLabel")}</Label>
              <Textarea
                id="content-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t("editor.bodyPlaceholder")}
                className="min-h-[320px]"
              />
            </div>

            {activeError && (
              <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {getErrorMessage(activeError, tCommon)}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t("editor.metadata")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t("editor.project")}</p>
                  <p className="font-medium">{projectName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t("editor.contentType")}</p>
                  <p className="font-medium">
                    {tCommon(
                      `contentType.${content?.content_type ?? contentType}`,
                      { defaultValue: content?.content_type ?? contentType }
                    )}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t("editor.status")}</p>
                  <ContentStatusBadge status={content?.status ?? "draft"} />
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">{t("editor.template")}</p>
                  <p className="font-medium">
                    {templateName ?? t("editor.noTemplate")}
                  </p>
                </div>
                {content?.reviewer_notes && (
                  <div className="space-y-1">
                    <p className="text-muted-foreground">
                      {t("editor.reviewerNotes")}
                    </p>
                    <p className="whitespace-pre-wrap rounded-md bg-muted/40 px-3 py-2">
                      {content.reviewer_notes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {content?.json_ld && <JsonLdPreview jsonLd={content.json_ld} compact />}
          </div>
        </div>

        <DialogFooter className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {content?.status === "draft" && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange("review")}
                disabled={isBusy}
              >
                <Send className="h-4 w-4" />
                {t("actions.submitForReview")}
              </Button>
            )}
            {content?.status === "review" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("draft")}
                  disabled={isBusy}
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("actions.returnToDraft")}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleStatusChange("published")}
                  disabled={isBusy}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {t("actions.publish")}
                </Button>
              </>
            )}
            {content && content.status !== "archived" && (
              <Button
                variant="outline"
                onClick={() => handleStatusChange("archived")}
                disabled={isBusy}
              >
                <Archive className="h-4 w-4" />
                {t("actions.archive")}
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isBusy}>
              {tCommon("actions.close")}
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isBusy}>
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEditing ? t("actions.saveDraft") : t("actions.createDraft")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
