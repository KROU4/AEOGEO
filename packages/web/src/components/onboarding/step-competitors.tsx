import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Sparkles, Swords, Trash2 } from "lucide-react";
import type {
  CompetitorCreate,
  CompetitorSuggestion,
} from "@/types/brand";

interface StepCompetitorsProps {
  competitors: CompetitorCreate[];
  onChange: (competitors: CompetitorCreate[]) => void;
  suggestions: CompetitorSuggestion[];
  isSuggesting: boolean;
  suggestionError: string | null;
  canSuggest: boolean;
  onSuggest: () => void;
  onAcceptSuggestion: (suggestion: CompetitorSuggestion) => void;
  onAcceptAllSuggestions: () => void;
  onDismissSuggestion: (suggestion: CompetitorSuggestion) => void;
}

function emptyCompetitor(): CompetitorCreate {
  return { name: "", website: "", notes: "" };
}

function CompetitorForm({
  competitor,
  index,
  onChange,
  onRemove,
}: {
  competitor: CompetitorCreate;
  index: number;
  onChange: (c: CompetitorCreate) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("onboarding");

  function update(field: keyof CompetitorCreate, value: string) {
    onChange({ ...competitor, [field]: value });
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Swords className="h-4 w-4 text-teal-600" />
          {competitor.name || `${t("competitors.nameLabel")} ${index + 1}`}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {t("competitors.removeCompetitor")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("competitors.nameLabel")}</Label>
          <Input
            value={competitor.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder={t("competitors.namePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("competitors.domainLabel")}</Label>
          <Input
            value={competitor.website ?? ""}
            onChange={(e) => update("website", e.target.value)}
            placeholder={t("competitors.domainPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("competitors.notesLabel")}</Label>
        <Textarea
          value={competitor.notes ?? ""}
          onChange={(e) => update("notes", e.target.value)}
          placeholder={t("competitors.notesPlaceholder")}
          rows={2}
        />
      </div>
    </div>
  );
}

export function StepCompetitors({
  competitors,
  onChange,
  suggestions,
  isSuggesting,
  suggestionError,
  canSuggest,
  onSuggest,
  onAcceptSuggestion,
  onAcceptAllSuggestions,
  onDismissSuggestion,
}: StepCompetitorsProps) {
  const { t } = useTranslation("onboarding");

  function addCompetitor() {
    onChange([...competitors, emptyCompetitor()]);
  }

  function updateCompetitor(index: number, competitor: CompetitorCreate) {
    const next = [...competitors];
    next[index] = competitor;
    onChange(next);
  }

  function removeCompetitor(index: number) {
    onChange(competitors.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("competitors.title")}</CardTitle>
            <CardDescription>{t("competitors.description")}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSuggest}
              disabled={!canSuggest || isSuggesting}
            >
              {isSuggesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("competitors.suggesting")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("competitors.suggestButton")}
                </>
              )}
            </Button>
            <Button type="button" onClick={addCompetitor} size="sm">
              <Plus className="h-4 w-4" />
              {t("competitors.addCompetitor")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            {t("competitors.suggestHint")}
          </p>
          {!canSuggest && (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("competitors.suggestPrerequisite")}
            </p>
          )}
          {suggestionError && (
            <p className="mt-2 text-sm text-destructive">{suggestionError}</p>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-3 rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("competitors.suggestionsTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("competitors.suggestionsDescription")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onAcceptAllSuggestions}
              >
                {t("competitors.addAllSuggestions")}
              </Button>
            </div>

            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={`${suggestion.name}:${suggestion.website ?? ""}`}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {suggestion.name}
                        </span>
                        {suggestion.website && (
                          <Badge variant="secondary">{suggestion.website}</Badge>
                        )}
                      </div>
                      {suggestion.positioning && (
                        <p className="text-sm text-muted-foreground">
                          {suggestion.positioning}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onAcceptSuggestion(suggestion)}
                      >
                        <Plus className="h-4 w-4" />
                        {t("competitors.addSuggestion")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismissSuggestion(suggestion)}
                      >
                        {t("competitors.dismissSuggestion")}
                      </Button>
                    </div>
                  </div>

                  {suggestion.notes && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      {suggestion.notes}
                    </p>
                  )}

                  {(suggestion.evidence?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("competitors.evidenceLabel")}
                      </p>
                      {(suggestion.evidence ?? []).map((evidence) => (
                        <p key={evidence} className="text-sm text-muted-foreground">
                          {evidence}
                        </p>
                      ))}
                    </div>
                  )}

                  {(suggestion.source_urls?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(suggestion.source_urls ?? []).map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-teal-700 underline underline-offset-4"
                        >
                          {url}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {competitors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Swords className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("competitors.emptyState")}
            </p>
          </div>
        ) : (
          competitors.map((competitor, index) => (
            <div key={index}>
              {index > 0 && <Separator className="mb-4" />}
              <CompetitorForm
                competitor={competitor}
                index={index}
                onChange={(c) => updateCompetitor(index, c)}
                onRemove={() => removeCompetitor(index)}
              />
            </div>
          ))
        )}

        <p className="text-sm text-muted-foreground pt-2">
          {t("competitors.skipHint")}
        </p>
      </CardContent>
    </Card>
  );
}
