import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { useReportShareLink, useShareReport } from "@/hooks/use-reports";
import { buildAbsoluteShareUrl } from "@/lib/report";
import { formatDate } from "@/lib/format";
import { useLocale } from "@/hooks/use-locale";
import { Copy, ExternalLink, Loader2, Share2 } from "lucide-react";

interface ReportShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string;
  reportTitle: string;
}

export function ReportShareDialog({
  open,
  onOpenChange,
  reportId,
  reportTitle,
}: ReportShareDialogProps) {
  const { t } = useTranslation("reports");
  const { t: tc } = useTranslation("common");
  const { locale } = useLocale();
  const shareLinkQuery = useReportShareLink(reportId, open);
  const shareMutation = useShareReport(reportId);

  const shareLink = shareMutation.data ?? shareLinkQuery.data;
  const absoluteUrl = shareLink?.url
    ? buildAbsoluteShareUrl(shareLink.url)
    : null;

  async function handleCopy() {
    if (!absoluteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success(tc("actions.copied"));
    } catch {
      toast.error(t("share.copyError"));
    }
  }

  function handleGenerate() {
    shareMutation.mutate();
  }

  const isLoading = shareLinkQuery.isLoading || shareMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-teal-600" />
            {t("share.title")}
          </DialogTitle>
          <DialogDescription>
            {t("share.description", { title: reportTitle })}
          </DialogDescription>
        </DialogHeader>

        {absoluteUrl ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {t("share.linkReady")}
              </p>
              <div className="flex gap-2">
                <Input value={absoluteUrl} readOnly />
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                  {tc("actions.copy")}
                </Button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t("share.expiresAt", {
                date: formatDate(shareLink!.expires_at, locale, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }),
              })}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {t("share.empty")}
          </div>
        )}

        <DialogFooter className="gap-2">
          {absoluteUrl ? (
            <Button variant="outline" asChild>
              <a href={absoluteUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                {t("share.openLink")}
              </a>
            </Button>
          ) : null}
          <Button onClick={handleGenerate} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {shareLink ? t("share.regenerate") : t("share.generate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
