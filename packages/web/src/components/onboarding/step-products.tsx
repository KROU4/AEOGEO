import { useState, type KeyboardEvent } from "react";
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
import { Loader2, Package, Plus, Sparkles, Trash2, X } from "lucide-react";
import type { ProductCreate, ProductSuggestion } from "@/types/brand";

interface StepProductsProps {
  products: ProductCreate[];
  onChange: (products: ProductCreate[]) => void;
  suggestions: ProductSuggestion[];
  isSuggesting: boolean;
  suggestionError: string | null;
  canSuggest: boolean;
  suggestPrerequisiteMessage: string | null;
  onSuggest: () => void;
  onAcceptSuggestion: (suggestion: ProductSuggestion) => void;
  onAcceptAllSuggestions: () => void;
  onDismissSuggestion: (suggestion: ProductSuggestion) => void;
}

function emptyProduct(): ProductCreate {
  return {
    name: "",
    description: "",
    category: "",
    pricing: "",
    features: [],
  };
}

function ProductForm({
  product,
  index,
  onChange,
  onRemove,
}: {
  product: ProductCreate;
  index: number;
  onChange: (p: ProductCreate) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation("onboarding");
  const [featureInput, setFeatureInput] = useState("");

  function update(field: keyof ProductCreate, value: string | string[]) {
    onChange({ ...product, [field]: value });
  }

  function handleFeatureKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && featureInput.trim()) {
      e.preventDefault();
      const features = product.features ?? [];
      if (!features.includes(featureInput.trim())) {
        update("features", [...features, featureInput.trim()]);
      }
      setFeatureInput("");
    }
  }

  function removeFeature(fi: number) {
    const features = product.features ?? [];
    update(
      "features",
      features.filter((_, i) => i !== fi)
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Package className="h-4 w-4 text-teal-600" />
          {product.name || `${t("products.nameLabel")} ${index + 1}`}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
          {t("products.removeProduct")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("products.nameLabel")}</Label>
          <Input
            value={product.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder={t("products.namePlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("products.categoryLabel")}</Label>
          <Input
            value={product.category ?? ""}
            onChange={(e) => update("category", e.target.value)}
            placeholder={t("products.categoryPlaceholder")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("products.descriptionLabel")}</Label>
        <Textarea
          value={product.description ?? ""}
          onChange={(e) => update("description", e.target.value)}
          placeholder={t("products.descriptionPlaceholder")}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("products.priceRangeLabel")}</Label>
        <Input
          value={product.pricing ?? ""}
          onChange={(e) => update("pricing", e.target.value)}
          placeholder={t("products.priceRangePlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("products.featuresLabel")}</Label>
        <Input
          value={featureInput}
          onChange={(e) => setFeatureInput(e.target.value)}
          onKeyDown={handleFeatureKeyDown}
          placeholder={t("products.featuresPlaceholder")}
        />
        {(product.features?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {product.features!.map((feature, fi) => (
              <Badge key={fi} variant="secondary" className="gap-1 pr-1">
                {feature}
                <button
                  type="button"
                  onClick={() => removeFeature(fi)}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StepProducts({
  products,
  onChange,
  suggestions,
  isSuggesting,
  suggestionError,
  canSuggest,
  suggestPrerequisiteMessage,
  onSuggest,
  onAcceptSuggestion,
  onAcceptAllSuggestions,
  onDismissSuggestion,
}: StepProductsProps) {
  const { t } = useTranslation("onboarding");

  function addProduct() {
    onChange([...products, emptyProduct()]);
  }

  function updateProduct(index: number, product: ProductCreate) {
    const next = [...products];
    next[index] = product;
    onChange(next);
  }

  function removeProduct(index: number) {
    onChange(products.filter((_, i) => i !== index));
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{t("products.title")}</CardTitle>
            <CardDescription>{t("products.description")}</CardDescription>
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
                  {t("products.suggesting")}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  {t("products.suggestButton")}
                </>
              )}
            </Button>
            <Button type="button" onClick={addProduct} size="sm">
              <Plus className="h-4 w-4" />
              {t("products.addProduct")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <p className="text-sm font-medium text-foreground">
            {t("products.suggestHint")}
          </p>
          {suggestPrerequisiteMessage && (
            <p className="mt-1 text-sm text-muted-foreground">
              {suggestPrerequisiteMessage}
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
                  {t("products.suggestionsTitle")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("products.suggestionsDescription")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onAcceptAllSuggestions}
              >
                {t("products.addAllSuggestions")}
              </Button>
            </div>

            <div className="space-y-3">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.name}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {suggestion.name}
                        </span>
                        {suggestion.category && (
                          <Badge variant="secondary">{suggestion.category}</Badge>
                        )}
                      </div>
                      {suggestion.description && (
                        <p className="text-sm text-muted-foreground">
                          {suggestion.description}
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
                        {t("products.addSuggestion")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDismissSuggestion(suggestion)}
                      >
                        {t("products.dismissSuggestion")}
                      </Button>
                    </div>
                  </div>

                  {suggestion.pricing && (
                    <p className="mt-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t("products.priceRangeLabel")}:
                      </span>{" "}
                      {suggestion.pricing}
                    </p>
                  )}

                  {(suggestion.features?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(suggestion.features ?? []).map((feature) => (
                        <Badge key={feature} variant="outline">
                          {feature}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {(suggestion.evidence?.length ?? 0) > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {t("products.evidenceLabel")}
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

        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {t("products.emptyState")}
            </p>
          </div>
        ) : (
          products.map((product, index) => (
            <div key={index}>
              {index > 0 && <Separator className="mb-4" />}
              <ProductForm
                product={product}
                index={index}
                onChange={(p) => updateProduct(index, p)}
                onRemove={() => removeProduct(index)}
              />
            </div>
          ))
        )}

        <p className="text-sm text-muted-foreground pt-2">
          {t("products.skipHint")}
        </p>
      </CardContent>
    </Card>
  );
}
