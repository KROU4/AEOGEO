import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X } from "lucide-react";
import type { BrandProfileDraft } from "@/types/brand";

interface StepBrandBasicsProps {
  data: BrandProfileDraft;
  onChange: (data: BrandProfileDraft) => void;
  errors?: Record<string, string>;
  onAutofill?: (domain: string) => Promise<Partial<BrandProfileDraft>>;
}

export function StepBrandBasics({ data, onChange, errors, onAutofill }: StepBrandBasicsProps) {
  const { t } = useTranslation("onboarding");
  const [uspInput, setUspInput] = useState("");
  const [isAutofilling, setIsAutofilling] = useState(false);

  function update(field: keyof BrandProfileDraft, value: string | string[]) {
    onChange({ ...data, [field]: value });
  }

  function handleUspKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && uspInput.trim()) {
      e.preventDefault();
      const current = data.unique_selling_points ?? [];
      if (!current.includes(uspInput.trim())) {
        update("unique_selling_points", [...current, uspInput.trim()]);
      }
      setUspInput("");
    }
  }

  async function handleAutofill() {
    if (!data.domain.trim() || !onAutofill) return;
    setIsAutofilling(true);
    try {
      const result = await onAutofill(data.domain.trim());
      onChange({
        ...data,
        name: data.name.trim() ? data.name : result.name || data.name || "",
        description: result.description || data.description || "",
        industry: result.industry || data.industry || "",
        tone_of_voice: result.tone_of_voice || data.tone_of_voice || "",
        target_audience: result.target_audience || data.target_audience || "",
        unique_selling_points: result.unique_selling_points?.length
          ? result.unique_selling_points
          : data.unique_selling_points ?? [],
      });
    } catch {
      // silently fail, user can fill manually
    } finally {
      setIsAutofilling(false);
    }
  }

  function removeUsp(index: number) {
    const current = data.unique_selling_points ?? [];
    update(
      "unique_selling_points",
      current.filter((_, i) => i !== index)
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brandBasics.title")}</CardTitle>
        <CardDescription>{t("brandBasics.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Brand Name + Domain — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-name">{t("brandBasics.nameLabel")}</Label>
            <Input
              id="brand-name"
              value={data.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder={t("brandBasics.namePlaceholder")}
              className={errors?.name ? "border-destructive" : ""}
            />
            {errors?.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-domain">{t("brandBasics.domainLabel")}</Label>
            <Input
              id="brand-domain"
              value={data.domain}
              onChange={(e) => update("domain", e.target.value)}
              placeholder={t("brandBasics.domainPlaceholder")}
              className={errors?.domain ? "border-destructive" : ""}
            />
            {errors?.domain && (
              <p className="text-sm text-destructive">{errors.domain}</p>
            )}
          </div>
        </div>

        {/* Auto-fill button */}
        {onAutofill && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAutofill}
              disabled={!data.domain.trim() || isAutofilling}
            >
              {isAutofilling ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("brandBasics.autofilling")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("brandBasics.autofillButton")}
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground">{t("brandBasics.autofillHint")}</p>
          </div>
        )}

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="brand-industry">{t("brandBasics.industryLabel")}</Label>
          <Input
            id="brand-industry"
            value={data.industry ?? ""}
            onChange={(e) => update("industry", e.target.value)}
            placeholder={t("brandBasics.industryPlaceholder")}
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="brand-description">{t("brandBasics.descriptionLabel")}</Label>
          <Textarea
            id="brand-description"
            value={data.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder={t("brandBasics.descriptionPlaceholder")}
            rows={4}
          />
        </div>

        {/* Tone + Audience — side by side on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="brand-tone">{t("brandBasics.toneLabel")}</Label>
            <Input
              id="brand-tone"
              value={data.tone_of_voice ?? ""}
              onChange={(e) => update("tone_of_voice", e.target.value)}
              placeholder={t("brandBasics.tonePlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="brand-audience">{t("brandBasics.audienceLabel")}</Label>
            <Input
              id="brand-audience"
              value={data.target_audience ?? ""}
              onChange={(e) => update("target_audience", e.target.value)}
              placeholder={t("brandBasics.audiencePlaceholder")}
            />
          </div>
        </div>

        {/* Unique Selling Points */}
        <div className="space-y-2">
          <Label htmlFor="brand-usp">{t("brandBasics.uspLabel")}</Label>
          <Input
            id="brand-usp"
            value={uspInput}
            onChange={(e) => setUspInput(e.target.value)}
            onKeyDown={handleUspKeyDown}
            placeholder={t("brandBasics.uspPlaceholder")}
          />
          <p className="text-xs text-muted-foreground">{t("brandBasics.uspHint")}</p>

          {(data.unique_selling_points?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {data.unique_selling_points!.map((usp, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="gap-1 pr-1"
                >
                  {usp}
                  <button
                    type="button"
                    onClick={() => removeUsp(index)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
