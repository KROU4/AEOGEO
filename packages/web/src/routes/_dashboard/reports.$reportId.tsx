import { useState } from "react";
import { Link, createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Share2, Trash2 } from "lucide-react";
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
import { useReport, useDeleteReport } from "@/hooks/use-reports";
import { ReportDetailView } from "@/components/reports/report-detail";
import { ReportShareDialog } from "@/components/reports/report-share-dialog";

export const Route = createFileRoute("/_dashboard/reports/$reportId")({
  component: ReportDetailPage,
});

function ReportDetailPage() {
  const { reportId } = useParams({ from: "/_dashboard/reports/$reportId" });
  const { t } = useTranslation("reports");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const { data: report, isLoading, error } = useReport(reportId);
  const deleteReport = useDeleteReport();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Button variant="ghost" asChild>
          <Link to="/reports">
            <ArrowLeft className="h-4 w-4" />
            {tc("actions.back")}
          </Link>
        </Button>
        {report ? (
          <div className="flex items-center gap-2">
            <Button onClick={() => setShareDialogOpen(true)}>
              <Share2 className="h-4 w-4" />
              {tc("actions.share")}
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              {t("deleteReport")}
            </Button>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error || !report ? (
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
          {t("detail.loadError")}
        </div>
      ) : (
        <>
          <ReportDetailView report={report} />
          <ReportShareDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            reportId={report.id}
            reportTitle={report.title}
          />

          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("deleteConfirmTitle", { name: report.title })}
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
                    deleteReport.mutate(reportId, {
                      onSuccess: () => navigate({ to: "/reports" }),
                    });
                  }}
                >
                  {t("deleteConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
