import { createFileRoute } from "@tanstack/react-router";
import { ProjectorView } from "../components/slides/projector-view";

export const Route = createFileRoute("/projector")({
  component: ProjectorPage,
});

function ProjectorPage() {
  return <ProjectorView />;
}
