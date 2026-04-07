import { Outlet, createFileRoute, useLocation } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/projects/projects-page";

export const Route = createFileRoute("/_dashboard/projects")({
  component: ProjectsLayout,
});

function ProjectsLayout() {
  const location = useLocation();
  const isProjectsIndex = /^\/projects\/?$/.test(location.pathname);

  return isProjectsIndex ? <ProjectsPage /> : <Outlet />;
}
