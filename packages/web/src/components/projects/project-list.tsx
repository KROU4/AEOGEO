import { ProjectCard } from "./project-card";

const projects = [
  {
    name: "Acme Corp Website",
    clientName: "Acme Corp",
    domain: "acme.com",
    memberCount: 5,
    visibilityScore: 7.2,
  },
  {
    name: "TechFlow Platform",
    clientName: "TechFlow",
    domain: "techflow.io",
    memberCount: 3,
    visibilityScore: 5.8,
  },
  {
    name: "GreenLeaf Store",
    clientName: "GreenLeaf",
    domain: "greenleaf.shop",
    memberCount: 2,
    visibilityScore: 8.5,
  },
];

export function ProjectList() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.map((project, i) => (
        <ProjectCard key={i} {...project} />
      ))}
    </div>
  );
}
