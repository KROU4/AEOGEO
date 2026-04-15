import { useEffect } from "react";
import {
  Navigate,
  createFileRoute,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useAuth } from "@clerk/react";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useProject } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api-client";
import {
  parseDashboardSearch,
  persistProjectAliasFromSearch,
} from "@/lib/dashboard-search";

export const Route = createFileRoute("/_dashboard")({
  validateSearch: (search: Record<string, unknown>) =>
    parseDashboardSearch(search),
  component: DashboardLayout,
});

const segmentToNavKey: Record<string, string> = {
  overview: "nav.overview",
  visibility: "nav.visibility",
  reports: "nav.reports",
  content: "nav.content",
  widgets: "nav.widgets",
  projects: "nav.projects",
  settings: "nav.settings",
  citations: "nav.citations",
  competitors: "nav.competitors",
  platforms: "nav.platforms",
  assistant: "nav.assistant",
  "ai-keys": "nav.adminKeys",
  "ai-usage": "nav.adminUsage",
};

const UUID_SEGMENT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toTitle(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ");
}

function getProjectIdFromMatches(
  matches: ReturnType<typeof useMatches>
): string {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const value = matches[index]?.params.projectId;
    if (typeof value === "string") {
      return value;
    }
  }
  return "";
}

/** `?p=<uuid>` matches plan contract; we persist and remove it so path-based project id stays canonical. */
function ProjectAliasSync() {
  const search = useSearch({ strict: false }) as {
    period?: string;
    p?: string;
  };
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!search.p) return;
    persistProjectAliasFromSearch(search.p);
    void navigate({
      to: location.pathname,
      search: (prev) => ({
        ...prev,
        p: undefined,
      }),
      replace: true,
    });
  }, [search.p, location.pathname, navigate]);

  return null;
}

function DashboardLayout() {
  const { isLoaded, isSignedIn } = useAuth();
  const currentUserQuery = useCurrentUser();
  const { t } = useTranslation("common");
  const location = useLocation();
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  const projectId = getProjectIdFromMatches(matches);
  const { data: project } = useProject(projectId);

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1] || "overview";
  const previousSegment = pathSegments[pathSegments.length - 2] || "overview";

  let title: string;
  if (projectId && (lastSegment === projectId || UUID_SEGMENT_RE.test(lastSegment))) {
    title = project?.name || t("nav.projects");
  } else if (segmentToNavKey[lastSegment]) {
    title = t(segmentToNavKey[lastSegment]);
  } else if (UUID_SEGMENT_RE.test(lastSegment) && segmentToNavKey[previousSegment]) {
    title = t(segmentToNavKey[previousSegment]);
  } else {
    const fallbackSegment = lastMatch?.pathname.split("/").filter(Boolean).pop() || lastSegment;
    title = toTitle(fallbackSegment);
  }

  if (!isLoaded) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading...</div>;
  }

  if (!isSignedIn) {
    return <Navigate to="/login" search={{ redirect_url: location.pathname }} />;
  }

  if (
    currentUserQuery.error instanceof ApiError &&
    currentUserQuery.error.code === "auth.bootstrap_required"
  ) {
    return <Navigate to="/complete-signup" />;
  }

  return (
    <SidebarProvider>
      <ProjectAliasSync />
      <AppSidebar />
      <SidebarInset>
        <Topbar title={title} />
        <main className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
