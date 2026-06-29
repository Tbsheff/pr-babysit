import { TaskService } from '../task.service';
import * as repo from '../task.repository';

beforeEach(() => {
  repo._resetStore();
});

const service = new TaskService();

describe('TaskService.createTask', () => {
  it('returns the new task', async () => {
    const task = await service.createTask({ title: 'Write tests' });
    expect(task.id).toBeDefined();
    expect(task.title).toBe('Write tests');
    expect(task.status).toBe('pending');
  });

  it('assigns null assigneeId by default', async () => {
    const task = await service.createTask({ title: 'No assignee' });
    expect(task.assigneeId).toBeNull();
  });

  it('stores the assignee when provided', async () => {
    const task = await service.createTask({ title: 'With assignee', assigneeId: 'user-1' });
    expect(task.assigneeId).toBe('user-1');
  });
});

describe('TaskService.completeTask', () => {
  it('marks the task done', async () => {
    const created = await service.createTask({ title: 'Finish me' });
    const completed = await service.completeTask(created.id);
    expect(completed?.status).toBe('done');
  });

  it('returns null for an unknown task', async () => {
    expect(await service.completeTask('nonexistent')).toBeNull();
  });
});

describe('TaskService.cancelTask', () => {
  it('marks the task cancelled', async () => {
    const created = await service.createTask({ title: 'Cancel me' });
    const cancelled = await service.cancelTask(created.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('returns null for an unknown task', async () => {
    expect(await service.cancelTask('nonexistent')).toBeNull();
  });
});

describe('TaskService.reassignTask', () => {
  it('updates the assignee', async () => {
    const created = await service.createTask({ title: 'Reassign me', assigneeId: 'user-1' });
    const updated = await service.reassignTask(created.id, 'user-2');
    expect(updated?.assigneeId).toBe('user-2');
  });

  it('returns null for an unknown task', async () => {
    expect(await service.reassignTask('nonexistent', 'user-1')).toBeNull();
  });
});

describe('TaskService.listTasks', () => {
  it('returns all created tasks', async () => {
    await service.createTask({ title: 'Task A' });
    await service.createTask({ title: 'Task B' });
    const tasks = await service.listTasks();
    expect(tasks).toHaveLength(2);
  });

  it('returns empty array when no tasks exist', async () => {
    const tasks = await service.listTasks();
    expect(tasks).toHaveLength(0);
  });
});
