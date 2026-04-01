import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExecutionsService } from './executions.service';
import { TasksService } from '../tasks/tasks.service';

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let tasksService: { findById: jest.Mock; updateTask: jest.Mock };

  const TASK_ID = 'task-abc-123';

  const mockTask = {
    id: TASK_ID,
    title: 'Tarea de prueba',
    description: 'Descripción',
    projectId: 'project-1',
    status: 'pending' as const,
    type: 'backend' as const,
    source: 'internal' as const,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    tasksService = {
      findById: jest.fn().mockReturnValue(mockTask),
      updateTask: jest.fn().mockReturnValue(mockTask),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionsService,
        { provide: TasksService, useValue: tasksService },
      ],
    }).compile();

    service = module.get<ExecutionsService>(ExecutionsService);
  });

  // ---------------------------------------------------------------------------
  // createExecution
  // ---------------------------------------------------------------------------

  describe('createExecution', () => {
    it('Cuando no existe ninguna execution activa, debería crear una nueva execution en estado running', () => {
      const resultado = service.createExecution(TASK_ID, 'dev');

      expect(resultado.taskId).toBe(TASK_ID); // La execution debe pertenecer a la task correcta
      expect(resultado.agentType).toBe('dev'); // El agente asignado debe ser dev
      expect(resultado.status).toBe('running'); // La nueva execution debe arrancar en estado running
      expect(resultado.steps).toEqual([]); // Una nueva execution comienza sin steps
      expect(resultado.id).toBeDefined(); // La execution debe tener un ID generado
    });

    it('Cuando ya existe una execution en estado running, debería lanzar error e impedir crear una segunda ejecución simultánea', () => {
      service.createExecution(TASK_ID, 'dev'); // Primera execution, queda en running

      expect(() => service.createExecution(TASK_ID, 'qa')).toThrow(
        'Task already has a running execution', // No se permite más de una execution running por task
      );
    });

    it('Cuando ya existe una execution en estado running, la cantidad de executions no debe aumentar', () => {
      service.createExecution(TASK_ID, 'dev');

      try {
        service.createExecution(TASK_ID, 'qa');
      } catch {}

      expect(service.getExecutionsByTaskId(TASK_ID)).toHaveLength(1); // El historial no debe crecer con un intento fallido
    });

    it('Cuando existe una execution en estado blocked, debería reanudar la misma execution sin crear una nueva', () => {
      const execOriginal = service.createExecution(TASK_ID, 'dev');
      service.blockExecution(execOriginal.id);

      const resultado = service.createExecution(TASK_ID, 'dev');

      expect(resultado.id).toBe(execOriginal.id); // Se debe reutilizar la misma execution bloqueada, no crear una nueva
    });

    it('Cuando existe una execution en estado blocked, al reanudarla debería cambiar su estado a running', () => {
      const execOriginal = service.createExecution(TASK_ID, 'dev');
      service.blockExecution(execOriginal.id);

      const resultado = service.createExecution(TASK_ID, 'dev');

      expect(resultado.status).toBe('running'); // La execution bloqueada debe pasar a estado running al ser reanudada
    });

    it('Cuando existe una execution en estado blocked, al reanudarla los steps existentes deben conservarse', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.addStep(exec.id, 'Paso inicial');
      service.blockExecution(exec.id);

      const resultado = service.createExecution(TASK_ID, 'dev');

      expect(resultado.steps).toHaveLength(1); // Los steps deben conservarse al reanudar — no se pierde contexto
      expect(resultado.steps[0].title).toBe('Paso inicial');
    });

    it('Cuando existe una execution en estado blocked, al reanudarla la cantidad total de executions no debe aumentar', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.blockExecution(exec.id);

      service.createExecution(TASK_ID, 'dev');

      expect(service.getExecutionsByTaskId(TASK_ID)).toHaveLength(1); // Al reanudar no se crea una nueva execution en el historial
    });

    it('Al reanudar una execution bloqueada, debería actualizar la task a in_progress con el agente asignado', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      tasksService.updateTask.mockClear();
      service.blockExecution(exec.id);

      service.createExecution(TASK_ID, 'qa');

      expect(tasksService.updateTask).toHaveBeenCalledWith(TASK_ID, {
        status: 'in_progress',
        assignedAgent: 'qa',
      }); // Se debe actualizar la task a in_progress al reanudar la execution
    });

    it('Al crear una nueva execution, debería actualizar la task a in_progress con el agente asignado', () => {
      service.createExecution(TASK_ID, 'pm');

      expect(tasksService.updateTask).toHaveBeenCalledWith(TASK_ID, {
        status: 'in_progress',
        assignedAgent: 'pm',
      }); // La task debe actualizarse a in_progress al arrancar una nueva execution
    });

    it('Cuando la task no existe, debería lanzar NotFoundException', () => {
      tasksService.findById.mockReturnValue(null);

      expect(() => service.createExecution('task-inexistente', 'dev')).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // blockExecution
  // ---------------------------------------------------------------------------

  describe('blockExecution', () => {
    it('Cuando se bloquea una execution en estado running, debería cambiar su estado a blocked', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      const resultado = service.blockExecution(exec.id);

      expect(resultado.status).toBe('blocked'); // La execution debe pasar a estado blocked
    });

    it('Cuando se intenta bloquear una execution ya completada, debería lanzar error', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.completeExecution(exec.id);

      expect(() => service.blockExecution(exec.id)).toThrow(
        'Cannot modify a completed or cancelled execution', // No se puede modificar una execution finalizada
      );
    });

    it('Cuando se intenta bloquear una execution ya cancelada, debería lanzar error', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.cancelExecution(exec.id);

      expect(() => service.blockExecution(exec.id)).toThrow(
        'Cannot modify a completed or cancelled execution',
      );
    });

    it('Cuando la execution no existe, debería lanzar NotFoundException', () => {
      expect(() => service.blockExecution('id-inexistente')).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // cancelExecution
  // ---------------------------------------------------------------------------

  describe('cancelExecution', () => {
    it('Cuando se cancela una execution en estado running, debería cambiar su estado a cancelled', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      const resultado = service.cancelExecution(exec.id);

      expect(resultado.status).toBe('cancelled'); // La execution debe pasar a estado cancelled
    });

    it('Cuando se cancela una execution en estado blocked, debería cambiar su estado a cancelled', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.blockExecution(exec.id);

      const resultado = service.cancelExecution(exec.id);

      expect(resultado.status).toBe('cancelled'); // Una execution bloqueada también puede ser cancelada
    });

    it('Después de cancelar, la execution ya no debe considerarse activa', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.cancelExecution(exec.id);

      const activa = service.getActiveExecution(TASK_ID);

      expect(activa).toBeNull(); // Una execution cancelada no debe aparecer como activa
    });

    it('Cuando la execution no existe, debería lanzar NotFoundException', () => {
      expect(() => service.cancelExecution('id-inexistente')).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // completeExecution
  // ---------------------------------------------------------------------------

  describe('completeExecution', () => {
    it('Cuando se completa una execution en estado running, debería cambiar su estado a completed', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      const resultado = service.completeExecution(exec.id);

      expect(resultado.status).toBe('completed'); // La execution debe pasar a estado completed
    });

    it('Al completar una execution, debería actualizar el estado de la task a testing', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      tasksService.updateTask.mockClear();

      service.completeExecution(exec.id);

      expect(tasksService.updateTask).toHaveBeenCalledWith(TASK_ID, { status: 'testing' }); // La task debe pasar a testing al completar la execution
    });

    it('Después de completar, la execution ya no debe considerarse activa', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.completeExecution(exec.id);

      const activa = service.getActiveExecution(TASK_ID);

      expect(activa).toBeNull(); // Una execution completada no debe aparecer como activa
    });

    it('Cuando se intenta completar una execution ya cancelada, debería lanzar error', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.cancelExecution(exec.id);

      expect(() => service.completeExecution(exec.id)).toThrow(
        'Cannot modify a completed or cancelled execution',
      );
    });

    it('Cuando la execution no existe, debería lanzar NotFoundException', () => {
      expect(() => service.completeExecution('id-inexistente')).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // getActiveExecution
  // ---------------------------------------------------------------------------

  describe('getActiveExecution', () => {
    it('Cuando existe una execution en estado running, debería retornarla como execution activa', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      const activa = service.getActiveExecution(TASK_ID);

      expect(activa?.id).toBe(exec.id); // La execution running debe retornarse como activa
      expect(activa?.status).toBe('running');
    });

    it('Cuando existe una execution en estado blocked, debería retornarla como execution activa', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.blockExecution(exec.id);

      const activa = service.getActiveExecution(TASK_ID);

      expect(activa?.id).toBe(exec.id); // Una execution bloqueada también debe considerarse activa
      expect(activa?.status).toBe('blocked');
    });

    it('Cuando la execution está cancelada, debería retornar null', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.cancelExecution(exec.id);

      expect(service.getActiveExecution(TASK_ID)).toBeNull(); // Una execution cancelada no es activa
    });

    it('Cuando la execution está completada, debería retornar null', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.completeExecution(exec.id);

      expect(service.getActiveExecution(TASK_ID)).toBeNull(); // Una execution completada no es activa
    });

    it('Cuando no existe ninguna execution para la task, debería retornar null', () => {
      expect(service.getActiveExecution('task-sin-executions')).toBeNull(); // Sin executions no hay ninguna activa
    });
  });

  // ---------------------------------------------------------------------------
  // addStep / updateStepStatus
  // ---------------------------------------------------------------------------

  describe('addStep', () => {
    it('Debería agregar un step a la execution en estado running', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      const step = service.addStep(exec.id, 'Analizando código');

      expect(step.title).toBe('Analizando código');
      expect(step.status).toBe('running'); // Un nuevo step comienza en estado running
      expect(exec.steps).toHaveLength(1); // El step debe agregarse a la execution
    });

    it('Cuando se intenta agregar un step a una execution completada, debería lanzar error', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      service.completeExecution(exec.id);

      expect(() => service.addStep(exec.id, 'Nuevo paso')).toThrow(
        'Cannot modify a completed or cancelled execution',
      );
    });
  });

  describe('updateStepStatus', () => {
    it('Debería actualizar el estado de un step existente', () => {
      const exec = service.createExecution(TASK_ID, 'dev');
      const step = service.addStep(exec.id, 'Compilando');

      const resultado = service.updateStepStatus(exec.id, step.id, 'completed', 'Compilación exitosa');

      expect(resultado.status).toBe('completed'); // El step debe actualizarse a completed
      expect(resultado.message).toBe('Compilación exitosa'); // El mensaje debe guardarse en el step
    });

    it('Cuando el step no existe, debería lanzar NotFoundException', () => {
      const exec = service.createExecution(TASK_ID, 'dev');

      expect(() => service.updateStepStatus(exec.id, 'step-inexistente', 'completed')).toThrow(
        NotFoundException,
      );
    });
  });
});
