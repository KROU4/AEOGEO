import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import type { Widget, WidgetCreate, WidgetUpdate } from "@/types/widget";
import type { Project } from "@/types/project";

const FONT_OPTIONS = [
  { value: "system", label: "System Default" },
  { value: "Inter", label: "Inter" },
  { value: "Roboto", label: "Roboto" },
  { value: "Open Sans", label: "Open Sans" },
  { value: "Lato", label: "Lato" },
  { value: "Poppins", label: "Poppins" },
  { value: "Nunito", label: "Nunito" },
  { value: "Source Sans 3", label: "Source Sans 3" },
];

interface WidgetConfiguratorProps {
  widget?: Widget;
  projects: Project[];
  onSave: (data: WidgetCreate | WidgetUpdate) => void;
  isSaving?: boolean;
}

export function WidgetConfigurator({
  widget,
  projects,
  onSave,
  isSaving,
}: WidgetConfiguratorProps) {
  const { t } = useTranslation("widgets");
  const { t: tc } = useTranslation("common");

  const [name, setName] = useState(widget?.name ?? "");
  const [projectId, setProjectId] = useState(widget?.project_id ?? "");
  const [mode, setMode] = useState(widget?.mode ?? "faq");
  const [theme, setTheme] = useState(widget?.theme ?? "light");
  const [maxItems, setMaxItems] = useState(widget?.max_items ?? 5);
  const [borderRadius, setBorderRadius] = useState(widget?.border_radius ?? 8);
  const [fontFamily, setFontFamily] = useState(widget?.font_family ?? "system");

  // Reset form when widget prop changes (e.g. switching between widgets)
  useEffect(() => {
    if (widget) {
      setName(widget.name);
      setProjectId(widget.project_id);
      setMode(widget.mode);
      setTheme(widget.theme);
      setMaxItems(widget.max_items);
      setBorderRadius(widget.border_radius);
      setFontFamily(widget.font_family || "system");
    }
  }, [widget]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (widget) {
      // Update existing
      const update: WidgetUpdate = {
        name,
        mode,
        theme,
        max_items: maxItems,
        border_radius: borderRadius,
        font_family: fontFamily === "system" ? null : fontFamily,
      };
      onSave(update);
    } else {
      // Create new
      const create: WidgetCreate = {
        name,
        project_id: projectId,
        mode,
        theme,
        position: "bottom-right",
        max_items: maxItems,
        border_radius: borderRadius,
        font_family: fontFamily === "system" ? "system" : fontFamily,
        json_ld_enabled: false,
      };
      onSave(create);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="widget-name">{t("config.widgetName")}</Label>
        <Input
          id="widget-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("config.widgetNamePlaceholder")}
          required
        />
      </div>

      {/* Project selector -- only for creation */}
      {!widget && (
        <div className="space-y-2">
          <Label>{t("config.project")}</Label>
          <Select value={projectId} onValueChange={setProjectId} required>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={t("config.projectPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Mode */}
      <div className="space-y-3">
        <Label>{t("config.mode")}</Label>
        <RadioGroup
          value={mode}
          onValueChange={setMode}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="faq" id="mode-faq" />
            <Label htmlFor="mode-faq" className="font-normal cursor-pointer">
              {t("config.modeFaq")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="blog_feed" id="mode-blog" />
            <Label htmlFor="mode-blog" className="font-normal cursor-pointer">
              {t("config.modeBlogFeed")}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Theme */}
      <div className="space-y-3">
        <Label>{t("config.theme")}</Label>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="flex gap-4"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="light" id="theme-light" />
            <Label htmlFor="theme-light" className="font-normal cursor-pointer">
              {t("config.themeLight")}
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="dark" id="theme-dark" />
            <Label htmlFor="theme-dark" className="font-normal cursor-pointer">
              {t("config.themeDark")}
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Max Items */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("config.maxItems")}</Label>
          <span className="text-sm tabular-nums text-muted-foreground">
            {maxItems}
          </span>
        </div>
        <Slider
          value={[maxItems]}
          onValueChange={(v) => setMaxItems(v[0] ?? 5)}
          min={1}
          max={20}
          step={1}
        />
      </div>

      {/* Border Radius */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t("config.borderRadius")}</Label>
          <span className="text-sm tabular-nums text-muted-foreground">
            {borderRadius}px
          </span>
        </div>
        <Slider
          value={[borderRadius]}
          onValueChange={(v) => setBorderRadius(v[0] ?? 8)}
          min={0}
          max={24}
          step={1}
        />
      </div>

      {/* Font Family */}
      <div className="space-y-2">
        <Label>{t("config.fontFamily")}</Label>
        <Select value={fontFamily} onValueChange={setFontFamily}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FONT_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Save */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSaving || !name || (!widget && !projectId)}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        {widget ? tc("actions.save") : tc("actions.create")}
      </Button>
    </form>
  );
}
