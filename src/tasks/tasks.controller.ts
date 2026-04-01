import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { Task } from '../common/interfaces/task.interface';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  create(
    @Body()
    body: {
      title: string;
      description: string;
      projectId: string;
      type: Task['type'];
      deadline?: Date;
    },
  ) {
    return this.tasksService.create(body);
  }

  @Get()
  findAll() {
    return this.tasksService.findAll();
  }

  @Get('project/:projectId')
  findByProjectId(@Param('projectId') projectId: string) {
    return this.tasksService.findByProjectId(projectId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tasksService.findById(id);
  }

  @Patch(':id/move')
  move(
    @Param('id') id: string,
    @Body() body: { targetStatus: Task['status']; agentType?: 'dev' | 'qa' | 'pm' },
  ) {
    return this.tasksService.moveTask(id, body.targetStatus, body.agentType);
  }
}
