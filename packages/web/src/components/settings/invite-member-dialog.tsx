import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects } from "@/hooks/use-projects";
import { useInviteMember, useTenantRoles } from "@/hooks/use-team";
import { ApiError } from "@/lib/api-client";

interface InviteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteMemberDialog({
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  const { data: roles = [], isLoading: rolesLoading } = useTenantRoles();
  const { data: projectsData, isLoading: projectsLoading } = useProjects();
  const inviteMemberMutation = useInviteMember();

  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [projectId, setProjectId] = useState("__none__");
  const [error, setError] = useState<string | null>(null);

  const projects = projectsData?.items ?? [];

  useEffect(() => {
    if (!open) {
      setEmail("");
      setRoleId("");
      setProjectId("__none__");
      setError(null);
      return;
    }

    if (roles.length > 0 && !roleId) {
      const defaultRole =
        roles.find((candidate) => candidate.name === "Editor") ?? roles[0];
      if (defaultRole) {
        setRoleId(defaultRole.id);
      }
    }
  }, [open, roleId, roles]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError(t("team.invite.errors.emailRequired"));
      return;
    }

    if (!roleId) {
      setError(t("team.invite.errors.roleRequired"));
      return;
    }

    inviteMemberMutation.mutate(
      {
        email: email.trim(),
        role_id: roleId,
        project_id: projectId === "__none__" ? undefined : projectId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
        onError: (err) => {
          if (err instanceof ApiError) {
            setError(
              tc(`errors.${err.code}`, {
                defaultValue: tc("errors.unknown"),
              }),
            );
            return;
          }

          setError(t("team.invite.errors.failed"));
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("team.invite.title")}</DialogTitle>
          <DialogDescription>{t("team.invite.subtitle")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("team.invite.emailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("team.invite.emailPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">{t("team.invite.roleLabel")}</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="invite-role" className="w-full">
                <SelectValue placeholder={t("team.invite.rolePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {rolesLoading && (
                  <SelectItem value="__loading_roles__" disabled>
                    {t("team.invite.loadingRoles")}
                  </SelectItem>
                )}
                {!rolesLoading &&
                  roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-project">{t("team.invite.projectLabel")}</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="invite-project" className="w-full">
                <SelectValue placeholder={t("team.invite.projectPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">
                  {t("team.invite.noProject")}
                </SelectItem>
                {projectsLoading && (
                  <SelectItem value="__loading_projects__" disabled>
                    {t("team.invite.loadingProjects")}
                  </SelectItem>
                )}
                {!projectsLoading &&
                  projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tc("actions.cancel")}
            </Button>
            <Button type="submit" disabled={inviteMemberMutation.isPending}>
              {inviteMemberMutation.isPending
                ? t("team.invite.submitting")
                : t("team.invite.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
