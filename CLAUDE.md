# CLAUDE.md

Este archivo define cómo debe trabajar Claude Code dentro de este backend.

# Descripción del Proyecto

Este es un backend en NestJS para un sistema de orquestación de agentes de IA.

El sistema permite:

* Gestionar tareas
* Asignar agentes (Dev, QA, PM)
* Ejecutar tareas con LLMs
* Controlar la ejecución (ejecutar, cancelar, ajustar, continuar)

Este backend es el núcleo del sistema.

---

# Principios de Arquitectura

## 1. Arquitectura Modular (OBLIGATORIO)

Seguir estrictamente la estructura de NestJS:

* Cada dominio debe ser un módulo
* Controllers → manejo de requests HTTP
* Services → lógica de negocio
* No poner lógica en controllers

---

## 2. Módulos principales

El sistema debe organizarse en:

* agents → define roles y prompts de agentes
* executions → ejecución y ciclo de vida de agentes (CORE)
* tasks → gestión de tareas
* projects → contexto del proyecto
* (futuro) integrations → integraciones externas (Linear, etc)

---

## 3. Responsabilidad Única

* Controllers → solo request/response
* Services → lógica
* Agents → definición de comportamiento (sin lógica HTTP)

---

## 4. Flujo de ejecución (CRÍTICO)

Toda ejecución debe seguir:

1. Recibir request
2. Construir prompt:

   * system prompt del agente
   * contexto del proyecto
   * contexto de la tarea
   * input del usuario (opcional)
3. Llamar al modelo
4. Devolver respuesta estructurada

---

## 5. Respuesta estructurada (OBLIGATORIO)

Todas las respuestas deben tener formato consistente:

* status: running | blocked | completed | failed
* blockType: opcional
* message
* requiredInputs
* options

Nunca devolver solo texto plano.

---

## 6. Sin lógica de frontend

Este backend NO debe:

* manejar UI
* tener lógica de presentación

---

## 7. Manejo de estado

El estado de ejecución debe ser explícito:

* running
* blocked
* cancelled
* completed

Evitar estados implícitos.

---

## 8. Simplicidad primero

* Evitar sobreingeniería
* No usar microservicios
* No abstraer sin necesidad

---

# Guías de Código

* Usar TypeScript estrictamente
* Nombres claros
* Funciones simples
* Evitar lógica compleja innecesaria

---

# Consideraciones futuras (NO implementar ahora)

* Base de datos
* Integración con Linear
* Autenticación
* Multiusuario

---

Enfocarse únicamente en el sistema de ejecución de agentes.
