import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2, XCircle, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateProject } from "@/hooks/use-projects";
import { apiPost } from "@/lib/api-client";

interface StepCreateProjectProps {
  onContinue: (projectId: string) => void;
}

interface DomainCheck {
  valid: boolean;
  domain: string | null;
  reachable: boolean;
  error: string | null;
}

function sanitizeDomainInput(raw: string): string {
  let v = raw.trim().toLowerCase();
  // Strip protocol
  v = v.replace(/^https?:\/\//, "");
  // Strip path/query/hash
  v = v.replace(/[/?#].*$/, "");
  // Strip trailing dots/slashes
  v = v.replace(/[./]+$/, "");
  return v;
}

export function StepCreateProject({ onContinue }: StepCreateProjectProps) {
  const { t } = useTranslation("funnel");
  const [name, setName] = useState("");
  const [domainRaw, setDomainRaw] = useState("");
  const [domainCheck, setDomainCheck] = useState<DomainCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const createProject = useCreateProject();

  const cleanDomain = sanitizeDomainInput(domainRaw);
  const hasDot = cleanDomain.includes(".");

  // Debounced domain reachability check
  const checkDomain = useCallback(
    async (domain: string) => {
      if (!domain || !domain.includes(".")) {
        setDomainCheck(null);
        return;
      }
      setChecking(true);
      try {
        const result = await apiPost<DomainCheck>(
          "/projects/check-domain",
          { domain },
        );
        setDomainCheck(result);
      } catch {
        setDomainCheck(null);
      } finally {
        setChecking(false);
      }
    },
    [],
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!cleanDomain || !hasDot) {
      setDomainCheck(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    debounceRef.current = setTimeout(() => {
      checkDomain(cleanDomain);
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [cleanDomain, hasDot, checkDomain]);

  const handleSubmit = async () => {
    if (!name.trim()) return;

    try {
      const project = await createProject.mutateAsync({
        name: name.trim(),
        description: "",
        client_name: "",
        domain: cleanDomain || undefined,
      });
      onContinue(project.id);
    } catch {
      toast.error("Failed to create project");
    }
  };

  // Domain status indicator
  const domainStatus = (() => {
    if (!cleanDomain || !hasDot) return null;
    if (checking) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>{t("createProject.checking")}</span>
        </div>
      );
    }
    if (!domainCheck) return null;
    if (!domainCheck.valid) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-destructive">
          <XCircle className="h-3 w-3" />
          <span>{t("createProject.invalidDomain")}</span>
        </div>
      );
    }
    if (domainCheck.reachable) {
      return (
        <div className="flex items-center gap-1.5 text-xs text-primary">
          <CheckCircle2 className="h-3 w-3" />
          <span>{domainCheck.domain}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Globe className="h-3 w-3" />
        <span>{t("createProject.unreachable")}</span>
      </div>
    );
  })();

  const canSubmit =
    name.trim().length > 0 &&
    !createProject.isPending &&
    (!cleanDomain || !hasDot || (domainCheck?.valid ?? false));

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-bold">{t("createProject.heading")}</h1>
        <p className="mt-2 text-muted-foreground">{t("createProject.description")}</p>
      </div>

      <div className="mx-auto max-w-sm space-y-4 text-left">
        <div className="space-y-2">
          <Label htmlFor="project-name">{t("createProject.nameLabel")}</Label>
          <Input
            id="project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("createProject.namePlaceholder")}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="project-url">{t("createProject.urlLabel")}</Label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
              https://
            </span>
            <Input
              id="project-url"
              value={domainRaw}
              onChange={(e) => setDomainRaw(e.target.value)}
              placeholder="example.com"
              onKeyDown={(e) => e.key === "Enter" && canSubmit && handleSubmit()}
              className="pl-[4.25rem]"
            />
          </div>
          {domainStatus}
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleSubmit}
        disabled={!canSubmit}
      >
        {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {t("createProject.submit")}
      </Button>
    </div>
  );
}
