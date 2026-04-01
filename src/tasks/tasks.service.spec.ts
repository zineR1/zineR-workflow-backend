import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { ExecutionsService } from '../executions/executions.service';
import { ProjectsService } from '../projects/projects.service';

/**
 * Tests de integración entre TasksService y ExecutionsService.
 * Se mockea únicamente ProjectsService para aislar la capa de datos del proyecto.
 * Ambos servicios (Tasks y Executions) son instancias reales para validar la interacción completa.
 */
describe('TasksService', () => {
  let tasksService: TasksService;
  let executionsService: ExecutionsService;

  const mockProjectsService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    mockProjectsService.findById.mockReturnValue({
      id: 'project-1',
      name: 'Proyecto de prueba',
      context: 'Contexto de prueba',
      projectImageUrl: '',
      createdAt: new Date(),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        ExecutionsService,
        { provide: ProjectsService, useValue: mockProjectsService },
      ],
    }).compile();

    tasksService = module.get<TasksService>(TasksService);
    executionsService = module.get<ExecutionsService>(ExecutionsService);
  });

  // ---------------------------------------------------------------------------
  // Helpers locales
  // ---------------------------------------------------------------------------

  function crearTask() {
    return tasksService.create({
      title: 'Tarea de prueba',
      description: 'Descripción de la tarea',
      projectId: 'project-1',
      type: 'backend',
    });
  }

  function moverAInProgress(taskId: string, agentType: 'dev' | 'qa' | 'pm' = 'dev') {
    return tasksService.moveTask(taskId, 'in_progress', agentType);
  }

  function getExecActiva(taskId: string) {
    return executionsService.getActiveExecution(taskId);
  }

  function getHistorialExecuciones(taskId: string) {
    return executionsService.getExecutionsByTaskId(taskId);
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('Debería crear una task en estado pending con los datos correctos', () => {
      const task = crearTask();

      expect(task.status).toBe('pending'); // Una task nueva siempre empieza en pending
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Tarea de prueba');
    });

    it('Cuando el proyecto no existe, debería lanzar NotFoundException', () => {
      mockProjectsService.findById.mockReturnValue(null);

      expect(() =>
        tasksService.create({
          title: 'Task',
          description: 'Desc',
          projectId: 'proyecto-inexistente',
          type: 'backend',
        }),
      ).toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — validaciones generales
  // ---------------------------------------------------------------------------

  describe('moveTask - validaciones', () => {
    it('Cuando la task no existe, debería lanzar NotFoundException', () => {
      expect(() => tasksService.moveTask('id-inexistente', 'testing')).toThrow(NotFoundException);
    });

    it('Cuando targetStatus es in_progress y no se envía agentType, debería lanzar BadRequestException', () => {
      const task = crearTask();

      expect(() => tasksService.moveTask(task.id, 'in_progress')).toThrow(BadRequestException);
    });

    it('Cuando la transición no está permitida, debería lanzar BadRequestException con mensaje descriptivo', () => {
      const task = crearTask(); // Estado: pending
      tasksService.moveTask(task.id, 'testing'); // Estado: testing

      // testing → pending es válido, pero testing → in_progress requiere agentType
      expect(() => tasksService.moveTask(task.id, 'in_progress')).toThrow(BadRequestException);
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — desde PENDING
  // ---------------------------------------------------------------------------

  describe('moveTask - Desde PENDING', () => {
    it('Cuando una task en pending se mueve a in_progress, debería crear una nueva execution y cambiar el estado de la task a in_progress', () => {
      const task = crearTask();

      tasksService.moveTask(task.id, 'in_progress', 'dev');

      const taskActualizada = tasksService.findById(task.id)!;
      const execuciones = getHistorialExecuciones(task.id);

      expect(taskActualizada.status).toBe('in_progress'); // La task debe estar en in_progress
      expect(execuciones).toHaveLength(1); // Debe crearse exactamente una execution
      expect(execuciones[0].status).toBe('running'); // La nueva execution debe estar en running
      expect(execuciones[0].agentType).toBe('dev'); // El agente debe ser el indicado
    });

    it('Cuando una task en pending se mueve a testing, debería solo cambiar el estado sin crear executions', () => {
      const task = crearTask();

      tasksService.moveTask(task.id, 'testing');

      expect(tasksService.findById(task.id)!.status).toBe('testing'); // La task debe estar en testing
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No debe crearse ninguna execution
    });

    it('Cuando una task en pending se mueve a completed, debería solo cambiar el estado sin crear executions', () => {
      const task = crearTask();

      tasksService.moveTask(task.id, 'completed');

      expect(tasksService.findById(task.id)!.status).toBe('completed'); // La task debe estar en completed
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No debe crearse ninguna execution
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — desde IN_PROGRESS con execution RUNNING
  // ---------------------------------------------------------------------------

  describe('moveTask - Desde IN_PROGRESS con execution running', () => {
    it('Cuando una task en progreso con execution running se mueve a pending, debería cancelar la execution y cambiar el estado de la task a pending', () => {
      const task = crearTask();
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;

      tasksService.moveTask(task.id, 'pending');

      expect(tasksService.findById(task.id)!.status).toBe('pending'); // La task debe estar en pending
      expect(exec.status).toBe('cancelled'); // La execution running debe cancelarse
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Cuando una task en progreso con execution running se mueve a testing, debería cancelar la execution y cambiar el estado de la task a testing', () => {
      const task = crearTask();
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;

      tasksService.moveTask(task.id, 'testing');

      expect(tasksService.findById(task.id)!.status).toBe('testing'); // La task debe estar en testing
      expect(exec.status).toBe('cancelled'); // La execution running debe cancelarse
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Cuando una task en progreso con execution running se mueve a completed, debería cancelar la execution y cambiar el estado de la task a completed', () => {
      const task = crearTask();
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;

      tasksService.moveTask(task.id, 'completed');

      expect(tasksService.findById(task.id)!.status).toBe('completed'); // La task debe estar en completed
      expect(exec.status).toBe('cancelled'); // La execution running debe cancelarse
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Al cancelar la execution por un movimiento, el historial de executions debe conservarse', () => {
      const task = crearTask();
      moverAInProgress(task.id);

      tasksService.moveTask(task.id, 'pending');

      expect(getHistorialExecuciones(task.id)).toHaveLength(1); // La execution cancelada debe seguir en el historial
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — desde IN_PROGRESS con execution BLOCKED
  // ---------------------------------------------------------------------------

  describe('moveTask - Desde IN_PROGRESS con execution blocked', () => {
    function prepararTaskBloqueada() {
      const task = crearTask();
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;
      executionsService.blockExecution(exec.id); // Bloquear la execution
      return { task, exec };
    }

    it('Cuando una task en progreso con execution blocked se mueve a pending, debería cancelar la execution bloqueada y cambiar el estado a pending', () => {
      const { task, exec } = prepararTaskBloqueada();

      tasksService.moveTask(task.id, 'pending');

      expect(tasksService.findById(task.id)!.status).toBe('pending'); // La task debe estar en pending
      expect(exec.status).toBe('cancelled'); // La execution bloqueada debe cancelarse al abandonar
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Cuando una task en progreso con execution blocked se mueve a testing, debería cancelar la execution bloqueada y cambiar el estado a testing', () => {
      const { task, exec } = prepararTaskBloqueada();

      tasksService.moveTask(task.id, 'testing');

      expect(tasksService.findById(task.id)!.status).toBe('testing'); // La task debe estar en testing
      expect(exec.status).toBe('cancelled'); // La execution bloqueada debe cancelarse
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Cuando una task en progreso con execution blocked se mueve a completed, debería cancelar la execution bloqueada y cambiar el estado a completed', () => {
      const { task, exec } = prepararTaskBloqueada();

      tasksService.moveTask(task.id, 'completed');

      expect(tasksService.findById(task.id)!.status).toBe('completed'); // La task debe estar en completed
      expect(exec.status).toBe('cancelled'); // La execution bloqueada debe cancelarse
      expect(getExecActiva(task.id)).toBeNull(); // No debe quedar ninguna execution activa
    });

    it('Cuando una task en progreso con execution blocked se vuelve a mover a in_progress, debería continuar la misma execution (no crear una nueva)', () => {
      const { task, exec } = prepararTaskBloqueada();
      const idExecOriginal = exec.id;

      tasksService.moveTask(task.id, 'in_progress', 'dev');

      const execActiva = getExecActiva(task.id)!;
      const historial = getHistorialExecuciones(task.id);

      expect(execActiva.id).toBe(idExecOriginal); // Se debe reutilizar la misma execution bloqueada, no crear una nueva
      expect(execActiva.status).toBe('running'); // La execution bloqueada debe pasar a running
      expect(historial).toHaveLength(1); // El historial no debe crecer al reanudar una execution existente
    });

    it('Cuando se reanuda una execution bloqueada, los steps anteriores deben conservarse', () => {
      const task = crearTask();
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;
      executionsService.addStep(exec.id, 'Paso 1 completado');
      executionsService.addStep(exec.id, 'Paso 2 en progreso');
      executionsService.blockExecution(exec.id);

      tasksService.moveTask(task.id, 'in_progress', 'dev');

      const execReanudada = getExecActiva(task.id)!;
      expect(execReanudada.steps).toHaveLength(2); // Los steps existentes deben conservarse al reanudar — no se pierde contexto
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — desde TESTING
  // ---------------------------------------------------------------------------

  describe('moveTask - Desde TESTING', () => {
    function prepararTaskEnTesting() {
      const task = crearTask();
      tasksService.moveTask(task.id, 'testing');
      return task;
    }

    it('Cuando una task en testing se mueve a pending, debería solo cambiar el estado', () => {
      const task = prepararTaskEnTesting();

      tasksService.moveTask(task.id, 'pending');

      expect(tasksService.findById(task.id)!.status).toBe('pending'); // La task debe estar en pending
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No deben crearse executions
    });

    it('Cuando una task en testing se mueve a in_progress, debería crear una nueva execution', () => {
      const task = prepararTaskEnTesting();

      tasksService.moveTask(task.id, 'in_progress', 'qa');

      const taskActualizada = tasksService.findById(task.id)!;
      const execuciones = getHistorialExecuciones(task.id);

      expect(taskActualizada.status).toBe('in_progress'); // La task debe estar en in_progress
      expect(execuciones).toHaveLength(1); // Debe crearse exactamente una execution nueva
      expect(execuciones[0].status).toBe('running'); // La execution debe estar en running
      expect(execuciones[0].agentType).toBe('qa'); // El agente debe ser el indicado
    });

    it('Cuando una task en testing se mueve a completed, debería solo cambiar el estado', () => {
      const task = prepararTaskEnTesting();

      tasksService.moveTask(task.id, 'completed');

      expect(tasksService.findById(task.id)!.status).toBe('completed'); // La task debe estar en completed
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No deben crearse executions
    });
  });

  // ---------------------------------------------------------------------------
  // moveTask — desde COMPLETED
  // ---------------------------------------------------------------------------

  describe('moveTask - Desde COMPLETED', () => {
    function prepararTaskCompletada() {
      const task = crearTask();
      tasksService.moveTask(task.id, 'completed');
      return task;
    }

    it('Cuando una task completada se mueve a pending, debería solo cambiar el estado', () => {
      const task = prepararTaskCompletada();

      tasksService.moveTask(task.id, 'pending');

      expect(tasksService.findById(task.id)!.status).toBe('pending'); // La task debe estar en pending
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No deben crearse executions
    });

    it('Cuando una task completada se mueve a in_progress, debería crear una nueva execution', () => {
      const task = prepararTaskCompletada();

      tasksService.moveTask(task.id, 'in_progress', 'pm');

      const taskActualizada = tasksService.findById(task.id)!;
      const execuciones = getHistorialExecuciones(task.id);

      expect(taskActualizada.status).toBe('in_progress'); // La task debe estar en in_progress
      expect(execuciones).toHaveLength(1); // Debe crearse exactamente una execution nueva
      expect(execuciones[0].agentType).toBe('pm'); // El agente debe ser el indicado
    });

    it('Cuando una task completada se mueve a testing, debería solo cambiar el estado', () => {
      const task = prepararTaskCompletada();

      tasksService.moveTask(task.id, 'testing');

      expect(tasksService.findById(task.id)!.status).toBe('testing'); // La task debe estar en testing
      expect(getHistorialExecuciones(task.id)).toHaveLength(0); // No deben crearse executions
    });
  });

  // ---------------------------------------------------------------------------
  // Historial de executions — garantías de integridad
  // ---------------------------------------------------------------------------

  describe('Integridad del historial de executions', () => {
    it('Después de múltiples movimientos, todas las executions del historial deben conservarse', () => {
      const task = crearTask();

      // Ciclo 1: pending → in_progress → testing
      moverAInProgress(task.id);
      tasksService.moveTask(task.id, 'testing'); // Cancela la execution running

      // Ciclo 2: testing → in_progress → completed
      tasksService.moveTask(task.id, 'in_progress', 'qa');
      tasksService.moveTask(task.id, 'completed'); // Cancela la execution running

      const historial = getHistorialExecuciones(task.id);

      expect(historial).toHaveLength(2); // Las dos executions deben estar en el historial
      expect(historial[0].agentType).toBe('dev'); // Primera execution con agente dev
      expect(historial[1].agentType).toBe('qa'); // Segunda execution con agente qa
      expect(historial.every((e) => e.status === 'cancelled')).toBe(true); // Ambas executions deben estar canceladas
    });

    it('El flujo completo running → blocked → running → completed debe completarse con una sola execution', () => {
      const task = crearTask();

      // Arrancar
      moverAInProgress(task.id);
      const exec = getExecActiva(task.id)!;

      // Bloquear
      executionsService.blockExecution(exec.id);
      expect(exec.status).toBe('blocked'); // La execution debe estar bloqueada

      // Reanudar (reutiliza la misma execution)
      tasksService.moveTask(task.id, 'in_progress', 'dev');
      expect(getExecActiva(task.id)!.id).toBe(exec.id); // Se debe reutilizar la misma execution
      expect(getExecActiva(task.id)!.status).toBe('running'); // La execution debe volver a running

      // Completar
      executionsService.completeExecution(exec.id);

      const historial = getHistorialExecuciones(task.id);
      expect(historial).toHaveLength(1); // Todo el ciclo debe haber ocurrido en una sola execution
      expect(historial[0].status).toBe('completed'); // La única execution debe estar completada
      expect(tasksService.findById(task.id)!.status).toBe('testing'); // La task debe pasar a testing al completar
    });

    it('Al mover in_progress → in_progress con execution running, debe cancelar la actual y crear una nueva (nunca dos activas simultáneas)', () => {
      const task = crearTask();
      moverAInProgress(task.id);
      const execOriginal = getExecActiva(task.id)!;

      // Volver a mover a in_progress cancela la running y crea una nueva
      moverAInProgress(task.id);

      const historial = getHistorialExecuciones(task.id);
      const activas = historial.filter((e) => e.status === 'running' || e.status === 'blocked');

      expect(execOriginal.status).toBe('cancelled'); // La execution running original debe cancelarse
      expect(historial).toHaveLength(2); // Debe haber dos executions en el historial
      expect(activas).toHaveLength(1); // Solo una execution puede estar activa en cualquier momento
      expect(activas[0].status).toBe('running'); // La execution activa debe estar en running
    });
  });
});
