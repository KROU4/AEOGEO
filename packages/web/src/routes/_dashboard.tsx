import { useEffect, type CSSProperties } from "react";
import {
  Navigate,
  createFileRoute,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AlertCircle } from "lucide-react";
import { PlaceholderCard } from "@/components/layout/placeholder-card";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useCurrentUser } from "@/hooks/use-auth";
import { useProject, useProjects } from "@/hooks/use-projects";
import { ApiError } from "@/lib/api-client";
import {
  parseDashboardSearch,
  persistProjectAliasFromSearch,
} from "@/lib/dashboard-search";
import { isDemoMode } from "@/lib/demo-mode";
import { useSessionAuth } from "@/lib/session-auth";

export const Route = createFileRoute("/_dashboard")({
  validateSearch: (search: Record<string, unknown>) =>
    parseDashboardSearch(search),
  component: DashboardLayout,
  errorComponent: DashboardErrorBoundary,
});

const segmentToNavKey: Record<string, string> = {
  overview: "nav.projects",
  visibility: "nav.visibility",
  competitors: "nav.competitors",
  citations: "nav.citations",
  assistant: "nav.assistant",
  platforms: "nav.platforms",
  reports: "nav.reports",
  projects: "nav.projects",
  settings: "nav.settings",
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
  const { isLoaded, isSignedIn } = useSessionAuth();
  const currentUserQuery = useCurrentUser();
  const { t } = useTranslation("common");
  const location = useLocation();
  const matches = useMatches();
  const lastMatch = matches[matches.length - 1];
  const projectId = getProjectIdFromMatches(matches);
  const { data: project } = useProject(projectId);
  const projectsQuery = useProjects();

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

  const demo = isDemoMode();

  if (!isSignedIn) {
    return <Navigate to="/login" search={{ redirect_url: location.pathname }} />;
  }

  if (
    !demo &&
    currentUserQuery.error instanceof ApiError &&
    currentUserQuery.error.code === "auth.bootstrap_required"
  ) {
    return <Navigate to="/complete-signup" replace />;
  }

  /** Empty workspace: force first project creation, but allow Reports, Settings, and Analytics stubs so nav is usable. */
  const allowedPathWhenNoProjects =
    location.pathname === "/projects/new" ||
    location.pathname.startsWith("/reports") ||
    location.pathname.startsWith("/settings") ||
    location.pathname.startsWith("/visibility") ||
    location.pathname.startsWith("/competitors") ||
    location.pathname.startsWith("/citations") ||
    location.pathname.startsWith("/assistant") ||
    location.pathname.startsWith("/platforms");

  if (
    !demo &&
    currentUserQuery.data &&
    projectsQuery.data &&
    projectsQuery.data.items.length === 0 &&
    !allowedPathWhenNoProjects
  ) {
    return <Navigate to="/projects/new" replace />;
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "220px",
        } as CSSProperties
      }
    >
      <ProjectAliasSync />
      <AppSidebar />
      <SidebarInset className="min-h-svh">
        <Topbar title={title} />
        <main className="avop-dashboard-canvas flex-1 p-8 pb-24 w-full min-h-0">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function DashboardErrorBoundary() {
  return (
    <div className="p-8">
      <PlaceholderCard
        icon={AlertCircle}
        title="Something went wrong"
        description="Reload the page and try again."
      />
    </div>
  );
}
