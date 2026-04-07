import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogDescription,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  Plus,
  Layers,
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Trash2,
  Loader2,
  FolderOpen,
} from "lucide-react";
import {
  useQuerySets,
  useCreateQuerySet,
  useQueries,
  useCreateQuery,
  useUpdateQuery,
  useDeleteQuery,
  useGenerateQueries,
  useClusterQueries,
  useBatchUpdateQueries,
} from "@/hooks/use-queries";
import type { QuerySet } from "@/types/query";

export const Route = createFileRoute(
  "/_dashboard/projects/$projectId/queries"
)({
  component: QueriesPage,
});

// -- Status Badge --

function QueryStatusBadge({ status }: { status: string }) {
  const { t } = useTranslation("queries");

  switch (status) {
    case "approved":
      return (
        <Badge
          variant="outline"
          className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
        >
          {t("status.approved")}
        </Badge>
      );
    case "rejected":
      return (
        <Badge
          variant="outline"
          className="bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
        >
          {t("status.rejected")}
        </Badge>
      );
    case "pending":
    default:
      return (
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
        >
          {t("status.pending")}
        </Badge>
      );
  }
}

// -- Category Badge --

function categoryTranslationKey(category: string): string {
  switch (category) {
    case "competitive":
      return "comparison";
    case "informational":
      return "general";
    default:
      return category;
  }
}

function CategoryBadge({ category }: { category: string }) {
  const { t } = useTranslation("queries");

  const colors: Record<string, string> = {
    brand:
      "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
    product:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    competitive:
      "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
    informational:
      "bg-stone-50 text-stone-700 border-stone-200 dark:bg-stone-950 dark:text-stone-300 dark:border-stone-800",
  };

  return (
    <Badge
      variant="outline"
      className={colors[category] ?? "bg-muted text-muted-foreground"}
    >
      {t(`category.${categoryTranslationKey(category)}`, category)}
    </Badge>
  );
}

// -- Priority Badge --

function getPriorityLevel(priority: number): "high" | "medium" | "low" {
  if (priority >= 4) return "high";
  if (priority >= 2) return "medium";
  return "low";
}

function PriorityBadge({ priority }: { priority: number }) {
  const { t } = useTranslation("queries");
  const level = getPriorityLevel(priority);

  const colors: Record<"high" | "medium" | "low", string> = {
    high: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
    medium:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
    low: "bg-stone-50 text-stone-600 border-stone-200 dark:bg-stone-950 dark:text-stone-400 dark:border-stone-800",
  };

  return (
    <Badge variant="outline" className={colors[level]}>
      {t(`priority.${level}`)}
    </Badge>
  );
}

// -- Query Set Card --

function QuerySetCard({
  querySet,
  projectId,
  isExpanded,
  onToggle,
}: {
  querySet: QuerySet;
  projectId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("queries");
  const generateQueries = useGenerateQueries(projectId, querySet.id);
  const clusterQueries = useClusterQueries(projectId, querySet.id);
  const [showAddDialog, setShowAddDialog] = useState(false);

  return (
    <div>
      <Card className={isExpanded ? "rounded-b-none border-b-0" : ""}>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <button
              onClick={onToggle}
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {querySet.name}
                  </h3>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {t("queryCount", { count: querySet.query_count })}
                  </span>
                </div>
                {querySet.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {querySet.description}
                  </p>
                )}
              </div>
            </button>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateQueries.mutate({ count: 10 })}
                disabled={generateQueries.isPending}
              >
                {generateQueries.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {generateQueries.isPending
                  ? t("generating")
                  : t("actions.generate")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => clusterQueries.mutate()}
                disabled={clusterQueries.isPending}
              >
                {clusterQueries.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Layers className="w-3.5 h-3.5" />
                )}
                {clusterQueries.isPending
                  ? t("clustering")
                  : t("actions.cluster")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-3.5 h-3.5" />
                {t("actions.addQuery")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isExpanded && (
        <QueryTable projectId={projectId} querySetId={querySet.id} />
      )}

      <AddQueryDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId}
        querySetId={querySet.id}
      />
    </div>
  );
}

// -- Query Table --

function QueryTable({
  projectId,
  querySetId,
}: {
  projectId: string;
  querySetId: string;
}) {
  const { t } = useTranslation("queries");
  const { data, isLoading } = useQueries(projectId, querySetId);
  const updateQuery = useUpdateQuery(projectId, querySetId);
  const deleteQuery = useDeleteQuery(projectId, querySetId);
  const batchUpdate = useBatchUpdateQueries(projectId, querySetId);
  const queries = data?.items ?? [];

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = queries.length > 0 && selected.size === queries.length;
  const someSelected = selected.size > 0 && selected.size < queries.length;

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(queries.map((q) => q.id)));
    }
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function handleBulkApprove() {
    const ids = Array.from(selected);
    batchUpdate.mutate(
      { query_ids: ids, status: "approved" },
      { onSuccess: clearSelection }
    );
  }

  function handleBulkReject() {
    const ids = Array.from(selected);
    batchUpdate.mutate(
      { query_ids: ids, status: "rejected" },
      { onSuccess: clearSelection }
    );
  }

  function handleBulkDelete() {
    const ids = Array.from(selected);
    Promise.all(ids.map((id) => deleteQuery.mutateAsync(id))).then(
      clearSelection
    );
  }

  const isBusy = batchUpdate.isPending || deleteQuery.isPending;

  return (
    <Card className="rounded-t-none border-t-0">
      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 bg-muted/50 border-b">
          <span className="text-sm text-muted-foreground">
            {t("bulk.selected", { count: selected.size })}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              disabled={isBusy}
            >
              <Check className="w-3.5 h-3.5 text-green-600" />
              {t("actions.approve")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkReject}
              disabled={isBusy}
            >
              <X className="w-3.5 h-3.5 text-red-600" />
              {t("actions.reject")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBusy}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t("actions.delete")}
            </Button>
          </div>
        </div>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[40%]">{t("table.text")}</TableHead>
              <TableHead>{t("table.category")}</TableHead>
              <TableHead>{t("table.priority")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right pr-4">
                {t("table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              queries.map((query) => (
                <TableRow
                  key={query.id}
                  data-state={selected.has(query.id) ? "selected" : undefined}
                >
                  <TableCell className="pl-4">
                    <Checkbox
                      checked={selected.has(query.id)}
                      onCheckedChange={() => toggleOne(query.id)}
                      aria-label={`Select "${query.text}"`}
                    />
                  </TableCell>
                  <TableCell>
                    <span className="text-foreground text-sm">
                      {query.text}
                    </span>
                  </TableCell>
                  <TableCell>
                    <CategoryBadge category={query.category} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={query.priority} />
                  </TableCell>
                  <TableCell>
                    <QueryStatusBadge status={query.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex items-center justify-end gap-1">
                      {query.status === "pending" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              updateQuery.mutate({
                                queryId: query.id,
                                data: { status: "approved" },
                              })
                            }
                            disabled={updateQuery.isPending}
                            title={t("actions.approve")}
                          >
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              updateQuery.mutate({
                                queryId: query.id,
                                data: { status: "rejected" },
                              })
                            }
                            disabled={updateQuery.isPending}
                            title={t("actions.reject")}
                          >
                            <X className="w-3.5 h-3.5 text-red-600" />
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => deleteQuery.mutate(query.id)}
                        disabled={deleteQuery.isPending}
                        title={t("actions.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && queries.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  {t("emptyQueries")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FlowStepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-background/70 p-4 text-left">
      <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold text-foreground">
        {number}
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

// -- Add Query Dialog --

function AddQueryDialog({
  open,
  onOpenChange,
  projectId,
  querySetId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  querySetId: string;
}) {
  const { t } = useTranslation("queries");
  const [text, setText] = useState("");
  const createQuery = useCreateQuery(projectId, querySetId);

  function handleSubmit() {
    if (!text.trim()) return;
    createQuery.mutate(
      { text: text.trim(), category: "informational", priority: 3 },
      {
        onSuccess: () => {
          setText("");
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addQueryTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("table.text")}</Label>
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("addQueryPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || createQuery.isPending}
          >
            {createQuery.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {t("actions.addQuery")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Create Query Set Dialog --

function CreateQuerySetDialog({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}) {
  const { t } = useTranslation("queries");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const createQuerySet = useCreateQuerySet(projectId);

  function handleSubmit() {
    if (!name.trim()) return;
    createQuerySet.mutate(
      { name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          onOpenChange(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createQuerySet")}</DialogTitle>
          <DialogDescription>{t("createQuerySetHelp")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t("querySetName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("querySetNamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("querySetDescription")}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("querySetDescriptionPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || createQuerySet.isPending}
          >
            {createQuerySet.isPending && (
              <Loader2 className="w-4 h-4 animate-spin" />
            )}
            {t("createQuerySet")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -- Loading Skeleton --

function QuerySetsSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// -- Main Page --

function QueriesPage() {
  const { projectId } = useParams({
    from: "/_dashboard/projects/$projectId/queries",
  });
  const { t } = useTranslation("queries");
  const { data, isLoading } = useQuerySets(projectId);
  const querySets = data?.items ?? [];

  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  function toggleExpand(setId: string) {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t("querySets")}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4" />
          {t("newQuerySet")}
        </Button>
      </div>

      {isLoading && <QuerySetsSkeleton />}

      {!isLoading && querySets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-10">
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <FolderOpen className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-lg font-semibold text-foreground">
                    {t("emptyStateTitle")}
                  </h4>
                  <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
                    {t("emptyStateDescription")}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <FlowStepCard
                  number={1}
                  title={t("flow.createSetTitle")}
                  description={t("flow.createSetDescription")}
                />
                <FlowStepCard
                  number={2}
                  title={t("flow.addQueriesTitle")}
                  description={t("flow.addQueriesDescription")}
                />
                <FlowStepCard
                  number={3}
                  title={t("flow.runTitle")}
                  description={t("flow.runDescription")}
                />
              </div>

              <div className="flex justify-center">
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="w-4 h-4" />
                  {t("newQuerySet")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {querySets.length > 0 && (
        <div className="space-y-4">
          {querySets.map((querySet) => (
            <QuerySetCard
              key={querySet.id}
              querySet={querySet}
              projectId={projectId}
              isExpanded={expandedSets.has(querySet.id)}
              onToggle={() => toggleExpand(querySet.id)}
            />
          ))}
        </div>
      )}

      <CreateQuerySetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        projectId={projectId}
      />
    </div>
  );
}
