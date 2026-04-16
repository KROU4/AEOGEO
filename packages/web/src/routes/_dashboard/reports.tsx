import { useState } from "react";
import { Link, Outlet, createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardHeader,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Eye,
  Share2,
  Trash2,
  FileBarChart,
  Swords,
  TrendingUp,
  Loader2,
  Download,
} from "lucide-react";
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
import { AvopPageHeader } from "@/components/avop";
import { useReports, useDeleteReport, useDownloadReportPdf } from "@/hooks/use-reports";
import { GenerateReportDialog } from "@/components/reports/generate-report-dialog";
import { ReportShareDialog } from "@/components/reports/report-share-dialog";
import { PlaceholderCard } from "@/components/layout/placeholder-card";
import type { ReportSummary } from "@/types/report";
import { useLocale } from "@/hooks/use-locale";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_dashboard/reports")({
  component: ReportsLayout,
});

function ReportsLayout() {
  const location = useLocation();
  const isReportsIndex = /^\/reports\/?$/.test(location.pathname);
  return isReportsIndex ? <ReportsPage /> : <Outlet />;
}

function getReportMeta(reportType: string, t: (key: string) => string) {
  switch (reportType) {
    case "visibility_audit":
      return {
        icon: FileBarChart,
        badgeLabel: t("types.visibility_audit"),
        badgeClassName: "bg-teal-50 text-teal-700 border-teal-200",
      };
    case "competitive_analysis":
      return {
        icon: Swords,
        badgeLabel: t("types.competitive_analysis"),
        badgeClassName: "bg-purple-50 text-purple-700 border-purple-200",
      };
    case "content_performance":
      return {
        icon: TrendingUp,
        badgeLabel: t("types.content_performance"),
        badgeClassName: "bg-green-50 text-green-700 border-green-200",
      };
    default:
      return {
        icon: FileBarChart,
        badgeLabel: reportType.replace("_", " "),
        badgeClassName: "bg-gray-50 text-gray-700 border-gray-200",
      };
  }
}

function ReportCard({ report }: { report: ReportSummary }) {
  const { t } = useTranslation("reports");
  const { t: tc } = useTranslation("common");
  const { locale } = useLocale();
  const meta = getReportMeta(report.report_type, t);
  const Icon = meta.icon;
  const deleteReport = useDeleteReport();
  const downloadPdf = useDownloadReportPdf();
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                <Icon className="w-5 h-5 text-teal-600" />
              </div>
              <Badge variant="outline" className={meta.badgeClassName}>
                {meta.badgeLabel}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {report.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-5">
            {formatDate(report.created_at, locale)}
          </p>
        </CardContent>
        <CardFooter>
          <Separator className="mb-4" />
        </CardFooter>
        <div className="flex flex-wrap items-center gap-2 px-6 pb-6 -mt-4">
          <Button variant="outline" size="sm" className="min-w-[7rem] flex-1" asChild>
            <Link
              to="/reports/$reportId"
              params={{ reportId: report.id }}
            >
              <Eye className="w-3.5 h-3.5" />
              {tc("actions.view")}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-w-[7rem] flex-1"
            disabled={downloadPdf.isPending}
            onClick={() =>
              downloadPdf.mutate({
                projectId: report.project_id,
                reportId: report.id,
              })
            }
          >
            {downloadPdf.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            {t("downloadPdf")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="w-3.5 h-3.5" />
            {tc("actions.share")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>

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
              onClick={() => deleteReport.mutate(report.id)}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ReportsPage() {
  const { data, isLoading, error } = useReports();
  const reports = data?.items ?? [];
  const { t } = useTranslation("reports");
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="space-y-8">
      <GenerateReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onGenerated={(report) =>
          navigate({
            to: "/reports/$reportId",
            params: { reportId: report.id },
          })
        }
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <AvopPageHeader
          className="min-w-0 flex-1"
          title={t("title")}
          description={t("subtitle")}
        />
        <Button className="shrink-0" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t("generateNew")}
        </Button>
      </div>

      {/* Loading / Error / Empty states */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-destructive">
          {t("errorLoad", { defaultValue: "Failed to load reports. Please try again." })}
        </div>
      )}

      {!isLoading && !error && reports.length === 0 && (
        <div className="space-y-4">
          <PlaceholderCard
            icon={FileBarChart}
            title={t("emptyTitle")}
            description={t("emptyDescription")}
          />
          <div className="flex justify-center">
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              {t("generateNew")}
            </Button>
          </div>
        </div>
      )}

      {/* Report cards */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
