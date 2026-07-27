"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createProject,
  deleteProject,
  projectOverview,
} from "@/server/projects";
import { BLOCK_COLORS, DEFAULT_BLOCK_COLOR, PROJECT_ICONS } from "@/lib/blocks";
import { formatMinutes, type ProjectOverview } from "@/lib/project-stats";
import styles from "./projects-view.module.css";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function ProjectCard({
  overview,
  readOnly,
  onDelete,
}: {
  overview: ProjectOverview;
  readOnly: boolean;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { project, totalMinutes, events, blockerEntries, links } = overview;

  return (
    <section className={styles.card}>
      <button
        type="button"
        className={styles.projectHeader}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {project.icon ? (
          <md-icon
            className={styles.projectIcon}
            style={{ color: project.color }}
          >
            {project.icon}
          </md-icon>
        ) : (
          <span
            className={styles.projectDot}
            style={{ background: project.color }}
          />
        )}
        <span className={`${styles.projectName} title-medium`}>
          {project.name}
        </span>
        <span className={`${styles.projectHours} body-medium`}>
          {formatMinutes(totalMinutes)}
        </span>
        <md-icon>{open ? "expand_less" : "expand_more"}</md-icon>
      </button>

      {open && (
        <div>
          <h3 className={`${styles.sectionTitle} body-small`}>
            Events ({events.length})
          </h3>
          <ul className={styles.list}>
            {events.map((event) => (
              <li key={event.id} className={styles.listItem}>
                <span className={`${styles.listItemText} body-medium`}>
                  {event.title}
                </span>
                <span className={`${styles.listItemMeta} body-small`}>
                  {dateFormat.format(event.start)}
                  {event.recurrence !== "none" &&
                    ` · ${event.occurrences}× ${event.recurrence}`}
                  {" · "}
                  {event.occurrences === 0
                    ? "planned"
                    : formatMinutes(event.minutes)}
                </span>
              </li>
            ))}
            {events.length === 0 && (
              <li className={`${styles.empty} body-medium`}>No events yet.</li>
            )}
          </ul>

          {blockerEntries.length > 0 && (
            <>
              <h3 className={`${styles.sectionTitle} body-small`}>
                Blockers & solutions
              </h3>
              {blockerEntries.map((entry, index) => (
                <div key={index} className={styles.pair}>
                  <p className={`${styles.pairLabel} body-small`}>
                    {entry.eventTitle}
                  </p>
                  {entry.blocker && (
                    <p className="body-medium">Blocker: {entry.blocker}</p>
                  )}
                  {entry.solutionSteps && (
                    <p className="body-medium">
                      Solution: {entry.solutionSteps}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}

          {links.length > 0 && (
            <>
              <h3 className={`${styles.sectionTitle} body-small`}>Links</h3>
              <ul className={styles.list}>
                {links.map((link, index) => (
                  <li key={index} className={styles.listItem}>
                    <span className={`${styles.listItemText} body-medium`}>
                      {link.label}: {link.url}
                    </span>
                    <span className={`${styles.listItemMeta} body-small`}>
                      {link.eventTitle}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!readOnly && (
            <md-text-button
              type="button"
              onClick={() => onDelete(project.id)}
              style={{ marginTop: "0.75rem" }}
            >
              Delete project
            </md-text-button>
          )}
        </div>
      )}
    </section>
  );
}

export function ProjectsView({
  ownerId,
  readOnly = false,
}: {
  // Project owner; undefined shows the signed-in user's own projects.
  ownerId?: string;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const ownerKey = ownerId ?? "me";
  const [color, setColor] = useState<string>(DEFAULT_BLOCK_COLOR);
  const [icon, setIcon] = useState<string>(PROJECT_ICONS[0]);
  const [error, setError] = useState<string | null>(null);

  const { data: overviews } = useQuery({
    queryKey: ["project-overview", ownerKey],
    queryFn: () => projectOverview(ownerId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project-overview", ownerKey] });
    queryClient.invalidateQueries({ queryKey: ["projects", ownerKey] });
  };

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      invalidate();
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: invalidate,
    onError: (e: Error) => setError(e.message),
  });

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    createMutation.mutate({
      name: String(data.get("name") ?? ""),
      color,
      icon,
    });
    form.reset();
  }

  return (
    <div className={styles.page}>
      <h1 className={`${styles.heading} headline-small`}>Projects</h1>

      {!readOnly && (
        <section className={styles.card}>
          <h2 className="title-medium" style={{ margin: 0 }}>
            New project
          </h2>
          <form className={styles.createForm} onSubmit={handleCreate}>
            <div className={styles.createRow}>
              <md-outlined-text-field label="Name" name="name" required />
              <div
                className={styles.swatchRow}
                role="radiogroup"
                aria-label="Project color"
              >
                {BLOCK_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={color === c.value}
                    aria-label={`Project color ${c.name}`}
                    className={
                      color === c.value ? styles.swatchSelected : styles.swatch
                    }
                    style={{ background: c.value }}
                    onClick={() => setColor(c.value)}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className={`${styles.fieldLabel} body-small`}>Icon</p>
              <div
                className={styles.iconGrid}
                role="radiogroup"
                aria-label="Project icon"
              >
                {PROJECT_ICONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={icon === name}
                    aria-label={name}
                    className={
                      icon === name ? styles.iconButtonSelected : styles.iconButton
                    }
                    style={icon === name ? { color } : undefined}
                    onClick={() => setIcon(name)}
                  >
                    <md-icon>{name}</md-icon>
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.createActions}>
              <md-filled-tonal-button
                type="submit"
                disabled={createMutation.isPending}
              >
                Create
              </md-filled-tonal-button>
            </div>
          </form>
          {error && <p className={`${styles.error} body-medium`}>{error}</p>}
        </section>
      )}

      {(overviews ?? []).map((overview) => (
        <ProjectCard
          key={overview.project.id}
          overview={overview}
          readOnly={readOnly}
          onDelete={(id) => deleteMutation.mutate(id)}
        />
      ))}
      {overviews?.length === 0 && (
        <p className={`${styles.empty} body-medium`}>
          {readOnly
            ? "No projects yet."
            : "No projects yet. Create one and assign it to your calendar entries."}
        </p>
      )}
    </div>
  );
}
