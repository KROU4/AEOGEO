import { useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CustomFile } from "@/types/brand";

interface StepUploadFilesProps {
  files: CustomFile[];
  isUploading: boolean;
  onUpload: (files: File[]) => void;
  onRemove: (fileId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileStatusBadge({
  status = "ready",
}: {
  status?: "processing" | "ready" | "error";
}) {
  const { t } = useTranslation("onboarding");

  switch (status) {
    case "processing":
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("uploadFiles.processing")}
        </Badge>
      );
    case "ready":
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t("uploadFiles.ready")}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
          <AlertCircle className="h-3 w-3" />
          {t("uploadFiles.error")}
        </Badge>
      );
    default:
      return null;
  }
}

export function StepUploadFiles({
  files,
  isUploading,
  onUpload,
  onRemove,
}: StepUploadFilesProps) {
  const { t } = useTranslation("onboarding");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        onUpload(droppedFiles);
      }
    },
    [onUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 0) {
      onUpload(selected);
    }
    // Reset the input so the same file can be selected again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("uploadFiles.title")}</CardTitle>
        <CardDescription>{t("uploadFiles.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            "hover:border-teal-400 hover:bg-teal-50/50 dark:hover:bg-teal-950/30",
            isUploading && "pointer-events-none opacity-60"
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
          {isUploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              {isUploading ? t("uploadFiles.uploading") : t("uploadFiles.dropzone")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("uploadFiles.dropzoneHint")}
            </p>
          </div>
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">
              {t("uploadFiles.fileCount", { count: files.length })}
            </p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.file_size)} &middot; {file.file_type}
                    </p>
                  </div>
                  <FileStatusBadge />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onRemove(file.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {files.length === 0 && (
          <p className="text-sm text-muted-foreground text-center">
            {t("uploadFiles.emptyState")}
          </p>
        )}

        <p className="text-sm text-muted-foreground">
          {t("uploadFiles.skipHint")}
        </p>
      </CardContent>
    </Card>
  );
}
