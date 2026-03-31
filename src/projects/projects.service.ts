import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../common/interfaces/project.interface';

@Injectable()
export class ProjectsService {
  private projects: Project[] = [];

  create(projectData: { name: string; context: string; projectImageUrl: string }): Project {
    const project: Project = {
      id: uuidv4(),
      name: projectData.name,
      context: projectData.context,
      projectImageUrl: projectData.projectImageUrl,
      createdAt: new Date(),
    };

    this.projects.push(project);
    return project;
  }

  findAll(): Project[] {
    return this.projects;
  }

  findById(id: string): Project | null {
    return this.projects.find((p) => p.id === id) ?? null;
  }
}
