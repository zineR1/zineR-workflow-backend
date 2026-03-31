import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Execution } from '../common/interfaces/execution.interface';
import { Step } from '../common/interfaces/step.interface';
import { TasksService } from '../tasks/tasks.service';

@Injectable()
export class ExecutionsService {
  private executions: Execution[] = [];

  constructor(private readonly tasksService: TasksService) {}

  createExecution(taskId: string, agentType: Execution['agentType']): Execution {
    const task = this.tasksService.findById(taskId);
    if (!task) {
      throw new NotFoundException(`Task with id "${taskId}" not found`);
    }

    const activeExecution = this.executions.find(
      (e) => e.taskId === taskId && (e.status === 'running' || e.status === 'blocked'),
    );
    if (activeExecution) {
      throw new Error('Task already has an active execution');
    }

    const execution: Execution = {
      id: uuidv4(),
      taskId,
      agentType,
      status: 'running',
      steps: [],
      createdAt: new Date(),
    };

    this.executions.push(execution);
    this.tasksService.updateTask(taskId, { status: 'in_progress', assignedAgent: agentType });

    return execution;
  }

  getExecutionById(id: string): Execution | null {
    return this.executions.find((e) => e.id === id) ?? null;
  }

  getExecutionsByTaskId(taskId: string): Execution[] {
    return this.executions.filter((e) => e.taskId === taskId);
  }

  private assertModifiable(execution: Execution): void {
    if (execution.status === 'completed' || execution.status === 'cancelled') {
      throw new Error('Cannot modify a completed or cancelled execution');
    }
  }

  addStep(executionId: string, stepTitle: string): Step {
    const execution = this.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new NotFoundException(`Execution with id "${executionId}" not found`);
    }
    this.assertModifiable(execution);

    const step: Step = {
      id: uuidv4(),
      title: stepTitle,
      status: 'running',
      createdAt: new Date(),
    };

    execution.steps.push(step);
    return step;
  }

  updateStepStatus(
    executionId: string,
    stepId: string,
    status: Step['status'],
    message?: string,
  ): Step {
    const execution = this.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new NotFoundException(`Execution with id "${executionId}" not found`);
    }
    this.assertModifiable(execution);

    const step = execution.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new NotFoundException(`Step with id "${stepId}" not found`);
    }

    step.status = status;
    if (message !== undefined) step.message = message;

    return step;
  }

  blockExecution(executionId: string): Execution {
    const execution = this.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new NotFoundException(`Execution with id "${executionId}" not found`);
    }
    this.assertModifiable(execution);

    execution.status = 'blocked';
    return execution;
  }

  completeExecution(executionId: string): Execution {
    const execution = this.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new NotFoundException(`Execution with id "${executionId}" not found`);
    }
    this.assertModifiable(execution);

    execution.status = 'completed';
    this.tasksService.updateTask(execution.taskId, { status: 'testing' });

    return execution;
  }

  cancelExecution(executionId: string): Execution {
    const execution = this.executions.find((e) => e.id === executionId);
    if (!execution) {
      throw new NotFoundException(`Execution with id "${executionId}" not found`);
    }

    execution.status = 'cancelled';
    return execution;
  }
}
