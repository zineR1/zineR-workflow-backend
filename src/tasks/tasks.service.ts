import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '../common/interfaces/task.interface';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class TasksService {
  private tasks: Task[] = [];

  constructor(private readonly projectsService: ProjectsService) {}

  create(taskData: {
    title: string;
    description: string;
    projectId: string;
    type: Task['type'];
    deadline?: Date;
  }): Task {
    const project = this.projectsService.findById(taskData.projectId);
    if (!project) {
      throw new NotFoundException(`Project with id "${taskData.projectId}" not found`);
    }

    const task: Task = {
      id: uuidv4(),
      title: taskData.title,
      description: taskData.description,
      projectId: taskData.projectId,
      status: 'pending',
      type: taskData.type,
      source: 'internal',
      deadline: taskData.deadline,
      createdAt: new Date(),
    };

    this.tasks.push(task);
    return task;
  }

  findAll(): Task[] {
    return this.tasks;
  }

  findById(id: string): Task | null {
    return this.tasks.find((t) => t.id === id) ?? null;
  }

  findByProjectId(projectId: string): Task[] {
    return this.tasks.filter((t) => t.projectId === projectId);
  }

  updateTask(id: string, updates: Partial<Pick<Task, 'status' | 'assignedAgent'>>): Task | null {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return null;
    Object.assign(task, updates);
    return task;
  }
}
