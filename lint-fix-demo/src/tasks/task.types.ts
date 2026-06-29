export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskInput {
  title: string;
  assigneeId?: string;
}

export interface UpdateTaskInput {
  title?: string;
  status?: TaskStatus;
  assigneeId?: string | null;
}
