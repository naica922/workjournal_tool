"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  createTodo,
  createTodoList,
  deleteTodo,
  deleteTodoList,
  listTodoLists,
  listTodos,
  moveTodo,
  renameTodoList,
  setTodoDone,
  setTodoStatus,
  updateTodo,
} from "@/server/todos";
import { listProjects } from "@/server/projects";
import type { Project, Todo, TodoList } from "@/db/schema";
import { EditTodoDialog } from "./edit-todo-dialog";
import styles from "./todos-view.module.css";

const dateTimeFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// One draggable open task.
function TaskItem({
  todo,
  project,
  now,
  onToggle,
  onEdit,
  onDelete,
  onSetStatus,
}: {
  todo: Todo;
  project: Project | null;
  now: number;
  onToggle: (done: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetStatus: (status: "open" | "in_progress") => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: todo.id });
  const deadline = todo.deadline ? new Date(todo.deadline) : null;
  const overdue = deadline && !todo.done && deadline.getTime() < now;

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={styles.task}
    >
      {/* Drag anywhere on the body; the checkbox/buttons stop propagation. */}
      <div className={styles.taskDrag} {...attributes} {...listeners}>
        <md-checkbox
          checked={todo.done}
          aria-label={todo.done ? "Mark as not done" : "Mark as done"}
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          onInput={(e: React.FormEvent) =>
            onToggle((e.target as HTMLInputElement).checked)
          }
        />
        <div className={styles.taskBody} onClick={onEdit}>
          <p
            className={`${todo.done ? styles.taskTitleDone : styles.taskTitle} body-medium`}
          >
            {todo.title}
          </p>
          {todo.description && (
            <p className={`${styles.taskNote} body-small`}>{todo.description}</p>
          )}
          <button
            type="button"
            className={
              todo.status === "in_progress"
                ? styles.statusInProgress
                : styles.statusOpen
            }
            title="Toggle status"
            onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onSetStatus(
                todo.status === "in_progress" ? "open" : "in_progress",
              );
            }}
          >
            {todo.status === "in_progress" ? "In progress" : "To do"}
          </button>
          {(deadline || project) && (
            <p className={`${styles.taskMeta} body-small`}>
              {deadline && (
                <span className={overdue ? styles.overdue : undefined}>
                  <md-icon class={styles.metaIcon}>schedule</md-icon>
                  {dateTimeFmt.format(deadline)}
                </span>
              )}
              {project && (
                <span
                  className={styles.projectTag}
                  style={{
                    background: `color-mix(in srgb, ${project.color} 14%, white)`,
                    color: `color-mix(in srgb, ${project.color} 75%, black)`,
                  }}
                >
                  <span
                    className={styles.projectDot}
                    style={{ background: project.color }}
                  />
                  {project.name}
                </span>
              )}
            </p>
          )}
        </div>
        <md-icon-button
          type="button"
          aria-label="Delete to-do"
          onPointerDown={(e: React.PointerEvent) => e.stopPropagation()}
          onClick={onDelete}
        >
          <md-icon>delete</md-icon>
        </md-icon-button>
      </div>
    </li>
  );
}

function AddTaskField({ onAdd }: { onAdd: (title: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const t = value.trim();
    if (!t) return;
    onAdd(t);
    setValue("");
  };
  return (
    <div className={styles.addTask}>
      <md-icon class={styles.addTaskIcon}>add</md-icon>
      <input
        className={styles.addTaskInput}
        placeholder="Add a task"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        onBlur={submit}
      />
    </div>
  );
}

function ListColumn({
  list,
  openTodos,
  doneTodos,
  projectFor,
  now,
  onRename,
  onDeleteList,
  onAddTask,
  onToggle,
  onEditTask,
  onDeleteTask,
  onSetStatus,
}: {
  list: TodoList;
  openTodos: Todo[];
  doneTodos: Todo[];
  projectFor: (id: string | null) => Project | null;
  now: number;
  onRename: (title: string) => void;
  onDeleteList: () => void;
  onAddTask: (title: string) => void;
  onToggle: (todo: Todo, done: boolean) => void;
  onEditTask: (todo: Todo) => void;
  onDeleteTask: (id: string) => void;
  onSetStatus: (todo: Todo, status: "open" | "in_progress") => void;
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [showDone, setShowDone] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <section className={styles.column} aria-label={list.title}>
      <header className={styles.columnHead}>
        {editingTitle ? (
          <input
            className={styles.titleInput}
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditingTitle(false);
              if (title.trim() && title.trim() !== list.title)
                onRename(title.trim());
              else setTitle(list.title);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") {
                setTitle(list.title);
                setEditingTitle(false);
              }
            }}
          />
        ) : (
          <h2
            className={`${styles.columnTitle} title-medium`}
            onClick={() => {
              // Start editing from the current title (no sync effect needed).
              setTitle(list.title);
              setEditingTitle(true);
            }}
            title="Rename list"
          >
            {list.title}
          </h2>
        )}
        {confirmingDelete ? (
          <span className={styles.confirmDelete}>
            <span className="body-small">Delete list?</span>
            <md-icon-button
              type="button"
              aria-label="Confirm delete list"
              onClick={() => {
                setConfirmingDelete(false);
                onDeleteList();
              }}
            >
              <md-icon class={styles.confirmYes}>check</md-icon>
            </md-icon-button>
            <md-icon-button
              type="button"
              aria-label="Cancel delete list"
              onClick={() => setConfirmingDelete(false)}
            >
              <md-icon>close</md-icon>
            </md-icon-button>
          </span>
        ) : (
          <md-icon-button
            type="button"
            aria-label="Delete list"
            onClick={() => setConfirmingDelete(true)}
          >
            <md-icon>delete</md-icon>
          </md-icon-button>
        )}
      </header>

      <AddTaskField onAdd={onAddTask} />

      <SortableContext
        items={openTodos.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={styles.taskList} data-list={list.id}>
          {openTodos.map((t) => (
            <TaskItem
              key={t.id}
              todo={t}
              project={projectFor(t.projectId)}
              now={now}
              onToggle={(done) => onToggle(t, done)}
              onEdit={() => onEditTask(t)}
              onDelete={() => onDeleteTask(t.id)}
              onSetStatus={(status) => onSetStatus(t, status)}
            />
          ))}
          {openTodos.length === 0 && (
            <li className={`${styles.emptyHint} body-small`}>No tasks yet.</li>
          )}
        </ul>
      </SortableContext>

      {doneTodos.length > 0 && (
        <div className={styles.doneSection}>
          <button
            type="button"
            className={styles.doneToggle}
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            <md-icon>{showDone ? "expand_more" : "chevron_right"}</md-icon>
            Completed ({doneTodos.length})
          </button>
          {showDone && (
            <ul className={styles.taskList}>
              {doneTodos.map((t) => (
                <li key={t.id} className={styles.doneTask}>
                  <md-checkbox
                    checked
                    aria-label="Mark as not done"
                    onInput={() => onToggle(t, false)}
                  />
                  <span
                    className={`${styles.taskTitleDone} body-medium`}
                    onClick={() => onEditTask(t)}
                  >
                    {t.title}
                  </span>
                  <md-icon-button
                    type="button"
                    aria-label="Delete to-do"
                    onClick={() => onDeleteTask(t.id)}
                  >
                    <md-icon>delete</md-icon>
                  </md-icon-button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

export function TodosView() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Todo | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  // A single "now" for overdue checks, kept out of child render (pure).
  const [now] = useState(() => Date.now());
  // Local ordering mirror while dragging so moves feel instant.
  const [orderByList, setOrderByList] = useState<Record<string, string[]>>({});
  const [newListOpen, setNewListOpen] = useState(false);
  const dragging = useRef(false);

  const { data: lists } = useQuery({
    queryKey: ["todo-lists"],
    queryFn: () => listTodoLists(),
  });
  const { data: todos } = useQuery({
    queryKey: ["todos"],
    queryFn: () => listTodos(),
  });
  const { data: projects } = useQuery({
    queryKey: ["projects", "me"],
    queryFn: () => listProjects(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["todos"] });
    queryClient.invalidateQueries({ queryKey: ["todo-lists"] });
  };

  const todoMap = useMemo(
    () => new Map((todos ?? []).map((t) => [t.id, t])),
    [todos],
  );
  const projectFor = (id: string | null) =>
    id ? (projects?.find((p) => p.id === id) ?? null) : null;

  // Rebuild the open-task ordering from server data when not mid-drag.
  useEffect(() => {
    if (dragging.current) return;
    const next: Record<string, string[]> = {};
    for (const l of lists ?? []) next[l.id] = [];
    for (const t of todos ?? []) {
      if (t.done || !t.listId) continue;
      (next[t.listId] ??= []).push(t.id);
    }
    setOrderByList(next);
  }, [lists, todos]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const listForItem = (id: string): string | null => {
    if (orderByList[id]) return id; // dropped on an (empty) column
    for (const [listId, ids] of Object.entries(orderByList)) {
      if (ids.includes(id)) return listId;
    }
    return null;
  };

  const createListMut = useMutation({
    mutationFn: (title: string) => createTodoList(title),
    onSuccess: invalidate,
  });
  const renameListMut = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameTodoList(id, title),
    onSuccess: invalidate,
  });
  const deleteListMut = useMutation({
    mutationFn: (id: string) => deleteTodoList(id),
    onSuccess: invalidate,
  });
  const createTodoMut = useMutation({
    mutationFn: (input: { listId: string; title: string }) => createTodo(input),
    onSuccess: invalidate,
  });
  const doneMut = useMutation({
    mutationFn: ({ id, done }: { id: string; done: boolean }) =>
      setTodoDone(id, done),
    onSuccess: invalidate,
  });
  const statusMut = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: "open" | "in_progress";
    }) => setTodoStatus(id, status),
    onSuccess: invalidate,
  });
  const deleteTodoMut = useMutation({
    mutationFn: (id: string) => deleteTodo(id),
    onSuccess: invalidate,
  });
  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      updateTodo(id, input),
    onSuccess: () => {
      invalidate();
      setEditing(null);
    },
  });
  const moveMut = useMutation({
    mutationFn: (input: { id: string; listId: string; index: number }) =>
      moveTodo(input),
    onSuccess: invalidate,
  });

  function handleDragStart(event: DragStartEvent) {
    dragging.current = true;
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    if (!overId) return;
    const from = listForItem(activeId);
    const to = listForItem(overId);
    if (!from || !to || from === to) return;

    setOrderByList((prev) => {
      const fromIds = prev[from].filter((id) => id !== activeId);
      const toIds = [...prev[to]];
      const overIndex = toIds.indexOf(overId);
      const insertAt = overIndex >= 0 ? overIndex : toIds.length;
      toIds.splice(insertAt, 0, activeId);
      return { ...prev, [from]: fromIds, [to]: toIds };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : null;
    dragging.current = false;
    setActiveId(null);
    if (!overId) return;

    const listId = listForItem(activeId);
    if (!listId) return;

    let ids = orderByList[listId];
    const overIndex = ids.indexOf(overId);
    const activeIndex = ids.indexOf(activeId);
    if (overIndex >= 0 && activeIndex >= 0 && overIndex !== activeIndex) {
      ids = arrayMove(ids, activeIndex, overIndex);
      setOrderByList((prev) => ({ ...prev, [listId]: ids }));
    }
    const finalIndex = ids.indexOf(activeId);
    moveMut.mutate({ id: activeId, listId, index: Math.max(0, finalIndex) });
  }

  const activeTodo = activeId ? (todoMap.get(activeId) ?? null) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={`${styles.heading} headline-small`}>To-dos</h1>
          <p className={`${styles.subnote} body-small`}>
            To-dos are just for you — they don&apos;t count toward your
            performance reviews.
          </p>
        </div>
        {newListOpen ? (
          <input
            className={styles.newListInput}
            placeholder="New list name"
            autoFocus
            onKeyDown={(e) => {
              const value = (e.target as HTMLInputElement).value.trim();
              if (e.key === "Enter" && value) {
                createListMut.mutate(value);
                setNewListOpen(false);
              }
              if (e.key === "Escape") setNewListOpen(false);
            }}
            onBlur={(e) => {
              const value = e.target.value.trim();
              if (value) createListMut.mutate(value);
              setNewListOpen(false);
            }}
          />
        ) : (
          <md-outlined-button
            type="button"
            onClick={() => setNewListOpen(true)}
          >
            <md-icon slot="icon">add</md-icon>
            New list
          </md-outlined-button>
        )}
      </div>

      {(lists ?? []).length === 0 ? (
        <p className={`${styles.emptyBoard} body-medium`}>
          You have no lists yet. Create your first list to start adding tasks.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className={styles.board}>
            {(lists ?? []).map((list) => {
              const orderedIds = orderByList[list.id] ?? [];
              const openTodos = orderedIds
                .map((id) => todoMap.get(id))
                .filter((t): t is Todo => !!t);
              const doneTodos = (todos ?? []).filter(
                (t) => t.listId === list.id && t.done,
              );
              return (
                <ListColumn
                  key={list.id}
                  list={list}
                  openTodos={openTodos}
                  doneTodos={doneTodos}
                  projectFor={projectFor}
                  now={now}
                  onRename={(title) =>
                    renameListMut.mutate({ id: list.id, title })
                  }
                  onDeleteList={() => deleteListMut.mutate(list.id)}
                  onAddTask={(title) =>
                    createTodoMut.mutate({ listId: list.id, title })
                  }
                  onToggle={(t, done) => doneMut.mutate({ id: t.id, done })}
                  onEditTask={(t) => setEditing(t)}
                  onDeleteTask={(id) => deleteTodoMut.mutate(id)}
                  onSetStatus={(t, status) =>
                    statusMut.mutate({ id: t.id, status })
                  }
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeTodo && (
              <div className={`${styles.task} ${styles.taskOverlay}`}>
                <div className={styles.taskDrag}>
                  <md-checkbox checked={activeTodo.done} />
                  <div className={styles.taskBody}>
                    <p className={`${styles.taskTitle} body-medium`}>
                      {activeTodo.title}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {editing && (
        <EditTodoDialog
          key={editing.id}
          todo={editing}
          projects={projects ?? []}
          pending={updateMut.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => updateMut.mutate({ id: editing.id, input })}
        />
      )}
    </div>
  );
}
