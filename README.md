# ProyectoManejoBuses

Aplicación web para la gestión y venta de pasajes de transporte interprovincial en Ecuador.
Proyecto del segundo parcial de Manejo y Configuración de Software (UTA – FISEI).

## Tecnologías
- Frontend: React + Vite
- Backend: Node.js + Express
- Control de versiones: Git y GitHub con GitFlow

## Estructura
```
frontend/   aplicación React
backend/    API REST con Express
```

## Flujo de trabajo (GitFlow)
- `main`: versiones entregables.
- `develop`: integración del equipo.
- `feature/<descripcion>`: una rama por tarea, siempre creada desde `develop`.
- Todo cambio entra a `develop` mediante pull request revisado por otro integrante.
- Los commits siguen Conventional Commits: `tipo(alcance): descripción`.
