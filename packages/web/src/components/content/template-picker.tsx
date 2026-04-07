import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  HelpCircle,
  FileText,
  GitCompareArrows,
  ShoppingCart,
  DollarSign,
  BookOpen,
} from "lucide-react";
import type { ContentTemplate, ContentType } from "@/types/content";

const iconByContentType: Record<ContentType, React.ElementType> = {
  faq: HelpCircle,
  blog: FileText,
  comparison: GitCompareArrows,
  buyer_guide: ShoppingCart,
  pricing_clarifier: DollarSign,
  glossary: BookOpen,
};

interface TemplatePickerProps {
  templates: ContentTemplate[];
  value: string | null;
  onChange: (templateId: string) => void;
}

export function TemplatePicker({
  templates,
  value,
  onChange,
}: TemplatePickerProps) {
  const { t } = useTranslation("content");

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {templates.map((template) => {
        const Icon =
          iconByContentType[template.content_type as ContentType] ?? FileText;
        const isSelected = value === template.id;

        return (
          <Card
            key={template.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={0}
            onClick={() => onChange(template.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onChange(template.id);
              }
            }}
            className={cn(
              "cursor-pointer transition-all hover:border-teal-300 hover:shadow-md",
              isSelected &&
                "border-teal-500 bg-teal-50/50 shadow-md ring-1 ring-teal-500/20 dark:bg-teal-950/20 dark:border-teal-400"
            )}
          >
            <CardContent className="p-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isSelected
                      ? "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium leading-tight",
                      isSelected && "text-teal-700 dark:text-teal-300"
                    )}
                  >
                    {template.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-snug">
                    {t(
                      `generate.templates.${template.content_type}.description`,
                      { defaultValue: template.content_type }
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
