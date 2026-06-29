import * as repo from './task.repository';
import { Task, CreateTaskInput } from './task.types';

export class TaskService {
  async createTask(input: CreateTaskInput): Promise<Task> {
    const task = await repo.create(input);
    await this.auditLog(`created task ${task.id}`);
    return task;
  }

  async completeTask(id: string): Promise<Task | null> {
    const task = await repo.update(id, { status: 'done' });
    if (!task) return null;
    await this.sendNotification(task.assigneeId, `Task "${task.title}" is complete`);
    return task;
  }

  async cancelTask(id: string): Promise<Task | null> {
    const task = await repo.update(id, { status: 'cancelled' });
    if (!task) return null;
    await repo.remove(id);
    await this.auditLog(`purged cancelled task ${id}`);
    return task;
  }

  async reassignTask(id: string, assigneeId: string): Promise<Task | null> {
    const task = await repo.findById(id);
    if (!task) return null;
    const updated = await repo.update(id, { assigneeId });
    if (!updated) return null;
    await this.auditLog(`reassigned task ${id} to ${assigneeId}`);
    return updated;
  }

  async listTasks(): Promise<Task[]> {
    return repo.findAll();
  }

  private async auditLog(message: string): Promise<void> {
    await Promise.resolve();
    process.stdout.write(`[AUDIT] ${message}\n`);
  }

  private async sendNotification(assigneeId: string | null, message: string): Promise<void> {
    if (!assigneeId) return;
    await Promise.resolve();
    process.stdout.write(`[NOTIFY] ${assigneeId}: ${message}\n`);
  }
}
