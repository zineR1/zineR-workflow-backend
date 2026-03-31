import { Step } from './step.interface';

export interface Execution {
  id: string;
  taskId: string;
  agentType: 'dev' | 'qa' | 'pm';
  status: 'running' | 'blocked' | 'cancelled' | 'completed';
  steps: Step[];
  createdAt: Date;
}
