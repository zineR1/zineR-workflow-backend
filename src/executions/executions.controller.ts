import { Controller, Get, Post, Patch, Param, Body } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { Execution } from '../common/interfaces/execution.interface';
import { Step } from '../common/interfaces/step.interface';

@Controller('executions')
export class ExecutionsController {
  constructor(private readonly executionsService: ExecutionsService) {}

  @Post('run')
  createExecution(@Body() body: { taskId: string; agentType: Execution['agentType'] }) {
    return this.executionsService.createExecution(body.taskId, body.agentType);
  }

  @Get('task/:taskId')
  getExecutionsByTaskId(@Param('taskId') taskId: string) {
    return this.executionsService.getExecutionsByTaskId(taskId);
  }

  @Get(':id')
  getExecutionById(@Param('id') id: string) {
    return this.executionsService.getExecutionById(id);
  }

  @Post(':id/step')
  addStep(@Param('id') id: string, @Body() body: { title: string }) {
    return this.executionsService.addStep(id, body.title);
  }

  @Patch(':id/step/:stepId')
  updateStepStatus(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Body() body: { status: Step['status']; message?: string },
  ) {
    return this.executionsService.updateStepStatus(id, stepId, body.status, body.message);
  }

  @Post(':id/block')
  blockExecution(@Param('id') id: string) {
    return this.executionsService.blockExecution(id);
  }

  @Post(':id/complete')
  completeExecution(@Param('id') id: string) {
    return this.executionsService.completeExecution(id);
  }

  @Post(':id/cancel')
  cancelExecution(@Param('id') id: string) {
    return this.executionsService.cancelExecution(id);
  }
}
