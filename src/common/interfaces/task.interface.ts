export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  status: 'pending' | 'in_progress' | 'blocked' | 'testing' | 'completed';
  type: 'frontend' | 'backend' | 'fullstack' | 'other';
  source: 'internal' | 'linear' | 'asana' | 'jira';
  externalId?: string;
  assignedAgent?: 'dev' | 'qa' | 'pm';
  deadline?: Date;
  createdAt: Date;
}
