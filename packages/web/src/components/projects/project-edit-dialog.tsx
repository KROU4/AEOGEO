import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProject } from "@/hooks/use-projects";
import type { Project } from "@/types/project";

interface ProjectEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
}

interface ProjectFormState {
  name: string;
  client_name: string;
  domain: string;
  description: string;
}

function emptyForm(): ProjectFormState {
  return {
    name: "",
    client_name: "",
    domain: "",
    description: "",
  };
}

export function ProjectEditDialog({
  open,
  onOpenChange,
  project,
}: ProjectEditDialogProps) {
  const { t } = useTranslation("projects");
  const updateProject = useUpdateProject(project?.id ?? "");
  const [form, setForm] = useState<ProjectFormState>(emptyForm);

  useEffect(() => {
    if (!open || !project) {
      setForm(emptyForm());
      return;
    }

    setForm({
      name: project.name,
      client_name: project.client_name,
      domain: project.domain ?? "",
      description: project.description ?? "",
    });
  }, [open, project]);

  async function handleSubmit() {
    if (!project || !form.name.trim() || !form.client_name.trim()) {
      return;
    }

    try {
      await updateProject.mutateAsync({
        name: form.name.trim(),
        client_name: form.client_name.trim(),
        domain: form.domain.trim() || null,
        description: form.description.trim(),
      });
      toast.success(t("projectEditor.saveSuccess"));
      onOpenChange(false);
    } catch {
      toast.error(t("projectEditor.saveError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("projectEditor.title")}</DialogTitle>
          <DialogDescription>
            {t("projectEditor.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">{t("projectEditor.fields.name")}</Label>
            <Input
              id="project-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder={t("projectEditor.placeholders.name")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-client">{t("projectEditor.fields.clientName")}</Label>
            <Input
              id="project-client"
              value={form.client_name}
              onChange={(event) =>
                setForm((current) => ({ ...current, client_name: event.target.value }))
              }
              placeholder={t("projectEditor.placeholders.clientName")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-domain">{t("projectEditor.fields.domain")}</Label>
            <Input
              id="project-domain"
              value={form.domain}
              onChange={(event) =>
                setForm((current) => ({ ...current, domain: event.target.value }))
              }
              placeholder={t("projectEditor.placeholders.domain")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-description">{t("projectEditor.fields.description")}</Label>
            <Textarea
              id="project-description"
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder={t("projectEditor.placeholders.description")}
              className="min-h-28"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("deleteCancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              updateProject.isPending ||
              !form.name.trim() ||
              !form.client_name.trim()
            }
          >
            {updateProject.isPending
              ? t("projectEditor.saving")
              : t("projectEditor.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
