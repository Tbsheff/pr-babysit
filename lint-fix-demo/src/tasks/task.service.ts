import * as repo from './task.repository';
import { Task, CreateTaskInput, UpdateTaskInput } from './task.types';

export class TaskService {
  async createTask(input: CreateTaskInput): Promise<Task> {
    const task = await repo.create(input);
    // BUG: floating promise — result of auditLog is not awaited
    this.auditLog(`created task ${task.id}`);
    return task;
  }

  async completeTask(id: string): Promise<Task | null> {
    const task = await repo.update(id, { status: 'done' });
    if (!task) return null;
    // BUG: floating promise — notification is fired and forgotten
    this.sendNotification(task.assigneeId, `Task "${task.title}" is complete`);
    return task;
  }

  async cancelTask(id: string): Promise<Task | null> {
    const task = await repo.update(id, { status: 'cancelled' });
    if (!task) return null;
    // BUG: floating promise inside an expression statement
    repo.remove(id).then(() => {
      this.auditLog(`purged cancelled task ${id}`);
    });
    return task;
  }

  async reassignTask(id: string, assigneeId: string): Promise<Task | null> {
    const task = await repo.findById(id);
    if (!task) return null;
    const updated = await repo.update(id, { assigneeId });
    if (!updated) return null;
    // BUG: floating promise — sync-looking call but returns a promise
    this.auditLog(`reassigned task ${id} to ${assigneeId}`);
    return updated;
  }

  async listTasks(): Promise<Task[]> {
    return repo.findAll();
  }

  private async auditLog(message: string): Promise<void> {
    // Simulates async audit write (e.g., to a remote log store)
    await Promise.resolve();
    process.stdout.write(`[AUDIT] ${message}\n`);
  }

  private async sendNotification(assigneeId: string | null, message: string): Promise<void> {
    if (!assigneeId) return;
    await Promise.resolve();
    process.stdout.write(`[NOTIFY] ${assigneeId}: ${message}\n`);
  }
}
