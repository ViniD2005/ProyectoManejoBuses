## GC-n — Título del cambio

**Jira:** GC-n  
**Tipo de cambio (ITIL):** Normal / Estándar / Emergencia · **Riesgo:** Bajo / Medio / Alto

### Por qué
<!-- Corrección del docente, incidente o mejora del equipo -->

### Qué cambia
-

### Cómo probar
1.

### Base de datos
<!-- Script nuevo de backend/database (por ejemplo 016_...sql) o «Sin cambios en la base» -->

### Checklist
- [ ] La rama sale de `develop`, lleva la clave `GC-n` y el PR apunta a `develop`
- [ ] Los commits siguen Conventional Commits con la clave (`feat(GC-n): ...`)
- [ ] `npm run lint` y `npm run build` del frontend sin errores
- [ ] Probado con Docker (`docker compose restart backend`)
- [ ] Si hay script SQL, se puede ejecutar varias veces sin error
- [ ] No subí `.env`, contraseñas ni archivos de `uploads/`
