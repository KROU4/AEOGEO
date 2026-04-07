import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileBarChart, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { useGenerateReport } from "@/hooks/use-reports";
import { ApiError } from "@/lib/api-client";
import type { ReportSummary, ReportType } from "@/types/report";

interface GenerateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: (report: ReportSummary) => void;
}

const REPORT_TYPES: ReportType[] = [
  "visibility_audit",
  "competitive_analysis",
  "content_performance",
];

export function GenerateReportDialog({
  open,
  onOpenChange,
  onGenerated,
}: GenerateReportDialogProps) {
  const { t } = useTranslation("reports");
  const { t: tCommon } = useTranslation("common");
  const [projectId, setProjectId] = useState("");
  const [reportType, setReportType] = useState("");

  const { data: projectsData } = useProjects();
  const projects = projectsData?.items ?? [];
  const generateMutation = useGenerateReport();

  function resetForm() {
    setProjectId("");
    setReportType("");
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      resetForm();
      generateMutation.reset();
    }
    onOpenChange(value);
  }

  function handleGenerate() {
    if (!projectId || !reportType) return;

    generateMutation.mutate(
      { projectId, reportType },
      {
        onSuccess: (report) => {
          handleOpenChange(false);
          onGenerated?.(report);
        },
      },
    );
  }

  const canGenerate = projectId && reportType;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-teal-600" />
            {t("dialog.title")}
          </DialogTitle>
          <DialogDescription>{t("dialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-project">{t("dialog.project")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="report-project" className="w-full">
                <SelectValue placeholder={t("dialog.selectProject")} />
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
            <Label htmlFor="report-type">{t("dialog.reportType")}</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger id="report-type" className="w-full">
                <SelectValue placeholder={t("dialog.selectType")} />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(`types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {generateMutation.error && (
          <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {generateMutation.error instanceof ApiError
              ? generateMutation.error.message
              : tCommon("errors.unknown")}
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || generateMutation.isPending}
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileBarChart className="h-4 w-4" />
            )}
            {generateMutation.isPending
              ? t("dialog.generating")
              : t("dialog.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
