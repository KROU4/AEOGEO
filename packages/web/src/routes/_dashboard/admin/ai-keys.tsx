import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  MoreHorizontal,
  RotateCw,
  Trash2,
  Zap,
  KeyRound,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  useAdminKeys,
  useCreateAdminKey,
  useRevokeAdminKey,
  useRotateAdminKey,
  useTestAdminKey,
} from "@/hooks/use-admin-keys";

export const Route = createFileRoute("/_dashboard/admin/ai-keys")({
  component: AIKeysPage,
});

const PROVIDERS = ["openai", "anthropic", "google", "openrouter"] as const;

function AIKeysPage() {
  const { t } = useTranslation("admin");
  const { data: keys, isLoading } = useAdminKeys();
  const [addOpen, setAddOpen] = useState(false);
  const [rotateKeyId, setRotateKeyId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t("aiKeys.title")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t("aiKeys.subtitle")}
          </p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t("aiKeys.addKey")}
            </Button>
          </DialogTrigger>
          <AddKeyDialog onClose={() => setAddOpen(false)} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : keys && keys.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("aiKeys.provider")}</TableHead>
                  <TableHead>{t("aiKeys.label")}</TableHead>
                  <TableHead>{t("aiKeys.keyHint")}</TableHead>
                  <TableHead>{t("aiKeys.scope")}</TableHead>
                  <TableHead>{t("aiKeys.status")}</TableHead>
                  <TableHead>{t("aiKeys.lastUsed")}</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <KeyRow
                    key={key.id}
                    keyData={key}
                    onRotate={() => setRotateKeyId(key.id)}
                  />
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <KeyRound className="w-10 h-10 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">{t("aiKeys.noKeys")}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("aiKeys.noKeysHint")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {rotateKeyId && (
        <RotateKeyDialog
          keyId={rotateKeyId}
          onClose={() => setRotateKeyId(null)}
        />
      )}
    </div>
  );
}

function KeyRow({
  keyData,
  onRotate,
}: {
  keyData: NonNullable<ReturnType<typeof useAdminKeys>["data"]>[number];
  onRotate: () => void;
}) {
  const { t } = useTranslation("admin");
  const revokeMutation = useRevokeAdminKey();
  const testMutation = useTestAdminKey();

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return t("aiKeys.never");
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <TableRow>
      <TableCell className="font-medium">
        {t(`aiKeys.providers.${keyData.provider}`)}
      </TableCell>
      <TableCell>{keyData.label}</TableCell>
      <TableCell className="font-mono text-sm text-muted-foreground">
        {keyData.key_hint}
      </TableCell>
      <TableCell>
        <Badge variant={keyData.tenant_id ? "secondary" : "outline"}>
          {keyData.tenant_id
            ? t("aiKeys.tenantScoped", { name: keyData.tenant_name })
            : t("aiKeys.global")}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={keyData.is_active ? "default" : "destructive"}>
          {keyData.is_active ? t("aiKeys.active") : t("aiKeys.revoked")}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(keyData.last_used_at)}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() => testMutation.mutate(keyData.id)}
            >
              {testMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : testMutation.data?.success ? (
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
              ) : testMutation.data?.success === false ? (
                <XCircle className="w-4 h-4 mr-2 text-red-600" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              {t("aiKeys.test")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onRotate}>
              <RotateCw className="w-4 h-4 mr-2" />
              {t("aiKeys.rotate")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => {
                if (window.confirm(t("aiKeys.confirmRevoke"))) {
                  revokeMutation.mutate(keyData.id);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {t("aiKeys.revoke")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function AddKeyDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("admin");
  const createMutation = useCreateAdminKey();
  const [provider, setProvider] = useState("");
  const [label, setLabel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [scope, setScope] = useState("global");

  const handleSubmit = () => {
    createMutation.mutate(
      {
        provider,
        api_key: apiKey,
        label,
        tenant_id: scope === "global" ? null : undefined,
      },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("aiKeys.form.title")}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label>{t("aiKeys.form.providerLabel")}</Label>
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger>
              <SelectValue placeholder={t("aiKeys.form.providerPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {t(`aiKeys.providers.${p}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("aiKeys.form.labelLabel")}</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("aiKeys.form.labelPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("aiKeys.form.apiKeyLabel")}</Label>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={t("aiKeys.form.apiKeyPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("aiKeys.form.scopeLabel")}</Label>
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">
                {t("aiKeys.form.scopeGlobal")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={!provider || !label || !apiKey || createMutation.isPending}
        >
          {createMutation.isPending && (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          )}
          {t("aiKeys.form.submit")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function RotateKeyDialog({
  keyId,
  onClose,
}: {
  keyId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation("admin");
  const rotateMutation = useRotateAdminKey();
  const [newKey, setNewKey] = useState("");

  const handleSubmit = () => {
    rotateMutation.mutate(
      { keyId, newApiKey: newKey },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("aiKeys.form.editTitle")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t("aiKeys.form.apiKeyLabel")}</Label>
            <Input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={t("aiKeys.form.apiKeyPlaceholder")}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!newKey || rotateMutation.isPending}
          >
            {rotateMutation.isPending && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {t("aiKeys.form.rotateSubmit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
