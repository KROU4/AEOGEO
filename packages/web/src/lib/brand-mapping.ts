import type {
  Brand,
  BrandCreate,
  BrandProfileDraft,
  ProductCreate,
  ProductSuggestion,
  CompetitorCreate,
  CompetitorSuggestion,
  Product,
  Competitor,
} from "@/types/brand";

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function normalizeWebsite(value?: string | null): string {
  if (!value) return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

export function hasProduct(
  products: ProductCreate[],
  candidate: { name: string },
): boolean {
  const normalized = normalizeName(candidate.name);
  return products.some((product) => normalizeName(product.name) === normalized);
}

export function hasCompetitor(
  competitors: CompetitorCreate[],
  candidate: { name: string; website?: string | null },
): boolean {
  const normalizedName = normalizeName(candidate.name);
  const normalizedWebsite = normalizeWebsite(candidate.website);
  return competitors.some((competitor) => {
    if (normalizeName(competitor.name) === normalizedName) {
      return true;
    }
    return Boolean(
      normalizedWebsite &&
        normalizeWebsite(competitor.website) === normalizedWebsite,
    );
  });
}

export function toProductDraft(suggestion: ProductSuggestion): ProductCreate {
  return {
    name: suggestion.name,
    description: suggestion.description ?? "",
    category: suggestion.category ?? "",
    pricing: suggestion.pricing ?? "",
    features: suggestion.features ?? [],
  };
}

export function toCompetitorDraft(
  suggestion: CompetitorSuggestion,
): CompetitorCreate {
  return {
    name: suggestion.name,
    website: suggestion.website ?? "",
    positioning: suggestion.positioning ?? "",
    notes: suggestion.notes ?? "",
  };
}

export function toBrandPayload(draft: BrandProfileDraft): BrandCreate {
  const positioning = [
    draft.industry ? `Industry: ${draft.industry}` : null,
    draft.target_audience
      ? `Target audience: ${draft.target_audience}`
      : null,
    draft.unique_selling_points.length > 0
      ? `USPs: ${draft.unique_selling_points.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const website = draft.domain.trim();
  const normalizedWebsite =
    website && !website.startsWith("http://") && !website.startsWith("https://")
      ? `https://${website}`
      : website;

  return {
    name: draft.name,
    description: draft.description || undefined,
    positioning: positioning || undefined,
    website: normalizedWebsite || undefined,
    voice_guidelines: draft.tone_of_voice || undefined,
  };
}

export function fromBrandResponse(brand: Brand): BrandProfileDraft {
  let industry = "";
  let targetAudience = "";
  let usps: string[] = [];

  if (brand.positioning) {
    for (const line of brand.positioning.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.startsWith("Industry:")) {
        industry = trimmed.replace("Industry:", "").trim();
      } else if (trimmed.startsWith("Target audience:")) {
        targetAudience = trimmed.replace("Target audience:", "").trim();
      } else if (trimmed.startsWith("USPs:")) {
        usps = trimmed
          .replace("USPs:", "")
          .trim()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
  }

  const website = brand.website
    ? brand.website
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/\/+$/, "")
    : "";

  return {
    name: brand.name ?? "",
    domain: website,
    description: brand.description ?? "",
    industry,
    tone_of_voice: brand.voice_guidelines ?? "",
    target_audience: targetAudience,
    unique_selling_points: usps,
  };
}

export function productToCreate(product: Product): ProductCreate {
  return {
    name: product.name,
    description: product.description ?? "",
    category: product.category ?? "",
    pricing: product.pricing ?? "",
    features: product.features ?? [],
  };
}

export function competitorToCreate(competitor: Competitor): CompetitorCreate {
  return {
    name: competitor.name,
    website: competitor.website ?? "",
    positioning: competitor.positioning ?? "",
    notes: competitor.notes ?? "",
  };
}
