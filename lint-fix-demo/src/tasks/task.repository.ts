import { Task, CreateTaskInput, UpdateTaskInput } from './task.types';

let store: Map<string, Task> = new Map();
let nextId = 1;

function generateId(): string {
  return String(nextId++);
}

export async function findById(id: string): Promise<Task | null> {
  return store.get(id) ?? null;
}

export async function findAll(): Promise<Task[]> {
  return Array.from(store.values());
}

export async function create(input: CreateTaskInput): Promise<Task> {
  const now = new Date();
  const task: Task = {
    id: generateId(),
    title: input.title,
    status: 'pending',
    assigneeId: input.assigneeId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.set(task.id, task);
  return task;
}

export async function update(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const task = store.get(id);
  if (!task) return null;
  const updated: Task = { ...task, ...input, updatedAt: new Date() };
  store.set(id, updated);
  return updated;
}

export async function remove(id: string): Promise<boolean> {
  return store.delete(id);
}

export function _resetStore(): void {
  store = new Map();
  nextId = 1;
}
