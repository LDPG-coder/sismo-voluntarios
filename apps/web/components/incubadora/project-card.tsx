"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ProjectStatusBadge } from "@/components/incubadora/status-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ProjectSummary = {
  id: string;
  title: string;
  category: string;
  status: string;
  is_anonymous: boolean;
  creator: { id: string | null; name: string; photo_url: string | null; is_anonymous: boolean };
  evaluation_percentage: number;
  evaluation_count: number;
  created_at: string | null;
  cover_image: { id: string; data: string } | null;
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  const authorName = project.is_anonymous ? "Anónimo" : project.creator?.name || "Desconocido";
  return (
    <Link href={`/incubadora/${project.id}`} className="block">
      <Card className="overflow-hidden transition-shadow hover:shadow-md">
        {project.cover_image?.data ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image.data}
            alt={project.title}
            className="h-40 w-full object-cover"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-[#f4f5f7] dark:from-emerald-950/30 dark:to-zinc-900">
            <span className="text-3xl">🌱</span>
          </div>
        )}
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline">{project.category}</Badge>
            <ProjectStatusBadge status={project.status} />
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{project.title}</h3>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="truncate">{authorName}</span>
            {project.created_at && (
              <>
                <span>·</span>
                <span>{new Date(project.created_at).toLocaleDateString("es")}</span>
              </>
            )}
          </div>
          {project.status === "evaluating" && (
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Evaluación</span>
                <span className="font-medium">{project.evaluation_percentage}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-400"
                  style={{ width: `${project.evaluation_percentage}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                {project.evaluation_count} evaluación(es)
              </p>
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
