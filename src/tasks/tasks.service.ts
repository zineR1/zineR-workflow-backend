import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Task } from '../common/interfaces/task.interface';
import { ProjectsService } from '../projects/projects.service';
import { ExecutionsService } from '../executions/executions.service';

@Injectable()
export class TasksService {
  private tasks: Task[] = [];

  constructor(
    private readonly projectsService: ProjectsService,
    @Inject(forwardRef(() => ExecutionsService))
    private readonly executionsService: ExecutionsService,
  ) {}

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

  moveTask(
    taskId: string,
    targetStatus: Task['status'],
    agentType?: 'dev' | 'qa' | 'pm',
  ): Task {
    const task = this.findById(taskId);
    if (!task) {
      throw new NotFoundException(`Task with id "${taskId}" not found`);
    }

    this.validateTransition(task.status, targetStatus);

    if (targetStatus === 'in_progress' && !agentType) {
      throw new BadRequestException('agentType is required when moving to in_progress');
    }

    const activeExecution = this.executionsService.getActiveExecution(taskId);

    if (targetStatus === 'in_progress') {
      // Global rule: cancel running before moving, but leave blocked — createExecution will resume it
      if (activeExecution?.status === 'running') {
        this.executionsService.cancelExecution(activeExecution.id);
      }
      // createExecution handles: blocked → resume, none → create new
      this.executionsService.createExecution(taskId, agentType!);
      return this.findById(taskId)!;
    }

    // Moving away from in_progress: cancel any active execution (running or blocked) for consistency
    if (activeExecution) {
      this.executionsService.cancelExecution(activeExecution.id);
    }

    return this.updateTask(taskId, { status: targetStatus })!;
  }

  private validateTransition(from: Task['status'], to: Task['status']): void {
    const allowed: Record<Task['status'], Task['status'][]> = {
      pending: ['in_progress', 'testing', 'completed'],
      in_progress: ['pending', 'testing', 'completed', 'in_progress'],
      testing: ['completed', 'in_progress', 'pending'],
      completed: ['pending', 'in_progress', 'testing'],
      blocked: ['pending', 'in_progress', 'testing', 'completed'],
    };

    if (!allowed[from]?.includes(to)) {
      throw new BadRequestException(`Cannot transition task from "${from}" to "${to}"`);
    }
  }
}
