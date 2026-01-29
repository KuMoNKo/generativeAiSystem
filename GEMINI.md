# Registro de Intervención - Generative AI Platform

Este documento resume las acciones realizadas por el agente Gemini para sanear y reconstruir la plataforma.

## **Estado de la Intervención (25 de enero de 2026)**

### **1. Saneamiento del Entorno (Fase 1)**
- **GPU AMD:** Verificada y funcional (RX 6750 XT - Navi 22).
- **ROCm:** Instalado stack v6.2.4 oficial de AMD.
- **Limpieza Docker:**
    - Purga total de contenedores, imágenes y volúmenes antiguos.
    - Espacio recuperado: **323 GB**.
- **Permisos:** Se han asignado los grupos `video` y `render` al usuario (pendiente reinicio para activar).

### **2. Nueva Arquitectura (Fase 2)**
- **User-Agnostic:** Se han eliminado todas las rutas `/home/kumonko/...` harcoded. Ahora el sistema utiliza rutas relativas y variables de entorno.
- **Estructura Organizada:**
    - `services/`: Contenedores con Dockerfiles personalizados para Ollama Manager y MusicGen.
    - `api-gateway/`: Puente Express.js con seguridad (API_KEY).
    - `storage/`: Almacenamiento persistente local.
- **Docker Compose:** Configurado con red interna (`ai-network`) y comunicación por nombres de servicio.

### **3. API Gateway (Fase 3)**
- **Express Server:** Implementado con proxy para servicios de texto, imagen, audio y video.
- **Configuración:** Centralizada en `api-gateway/config/services.js`.
- **Dependencias:** Instaladas (`express`, `axios`, `cors`, etc.).

## **Tareas Pendientes (Tras Reinicio)**
1. **Verificar Grupos:** Ejecutar `groups` para confirmar `video` y `render`.
2. **Construir Imágenes:** 
   ```bash
   docker compose build
   ```
3. **Lanzar Servicios:**
   ```bash
   docker compose up -d
   ```
4. **Prueba de Conexión:**
   ```bash
   curl -H "x-api-key: local_dev_key_change_me" http://localhost:3000/health
   ```

---
*Fin del registro. El sistema está listo para el despliegue tras el reinicio de sesión.*
