export interface Step {
  id: string;
  title: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  message?: string;
  createdAt: Date;
}
