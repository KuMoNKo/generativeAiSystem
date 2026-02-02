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
    - `services/`: Contenedores con Dockerfiles personalizados para Ollama Manager y MusicGen [SKIPPED].
    - `imagegen/`: Implementado con ComfyUI sobre ROCm (PyTorch latest/Ubuntu 24.04).
    - `api-gateway/`: Puente Express.js (REVERTIDO/Pendiente).
    - `storage/`: Almacenamiento persistente local.
- **Docker Compose:** Configurado con red interna (`ai-network`) y comunicación por nombres de servicio.

### **3. Pruebas de Imagen (31 de enero de 2026)**
- **Modelo:** Juggernaut XL v9 (SDXL).
- **txt2img:** Generación exitosa de retrato realista de Elfa de la Noche.
- **img2img:** Transformación exitosa de `genericElf.png` (captura WoW) a versión realista.
- **Ubicación:** Resultados guardados en `storage/imagegen/output/`.

### **4. API Gateway (Fase 3) - REVERTIDO**
- *El servicio de API Gateway ha sido eliminado y su arquitectura está pendiente de re-definición (punto 5.6.1).*

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

## **Estado de la Intervención (1 de febrero de 2026)**

### **5. Saneamiento y Optimización de Almacenamiento**
- **Eliminación de Servicios Obsoletos:**
    - `acestep`: Eliminado por completo (liberados ~8 GB de storage y ~80 GB de caché/imágenes Docker).
    - `musicgen`: Eliminado por completo para liberar recursos.
- **Espacio Recuperado:** Aproximadamente **88.5 GB** adicionales tras la purga de contenedores y volúmenes de estos servicios.

### **6. Evolución de ImageGen a VideoGen (AnimateDiff)**
- **Consolidación:** Se ha decidido no crear un contenedor separado para video para optimizar la VRAM (12GB). `imagegen` ahora gestiona tanto imagen como video.
- **Implementación:**
    - Instalación de nodos `ComfyUI-AnimateDiff-Evolved` y `ComfyUI-VideoHelperSuite`.
    - Dependencias añadidas: `ffmpeg`, `opencv-python`, `imageio-ffmpeg`.
- **Modelos Instalados:**
    - Checkpoint SD 1.5: `v1-5-pruned-emaonly.safetensors` (necesario para AnimateDiff).
    - Motion Module: `mm_sd_v15_v2.ckpt` (AnimateDiff v2).
- **Pruebas de Video:** Generación exitosa de animación de 8 frames (`test_animatediff`).

### **7. Actualización de Ollama**
- **Modelo:** Se ha validado el uso de `llama3.2:latest` (3.2B) como modelo base por su eficiencia en 12GB de VRAM.

### 8. Verificación de Integridad
- **Suite de Tests:** Actualizada en `tests/test_behavior.py` y `tests/test_gateway.py` cubriendo:
    - Ollama (Tags y Generación con llama3.2).
    - Imagen (SDXL txt2img e img2img).
    - Video (AnimateDiff).
    - API Gateway (Proxy, Individual y Orchestrated endpoints).
- **Resultado:** Todos los tests funcionales (10/10 en el Gateway).

### 9. API Gateway (Fase 3) - COMPLETADO
- **Tecnología:** Node.js Express.
- **Funcionalidad:**
    - Proxy autenticado a Ollama y ComfyUI.
    - Endpoints simplificados (`/text/gen`, `/image/gen`, etc.).
    - Orquestación avanzada (`/agent/character`).
    - Soporte global para parámetros `seed` y `steps`.
- **Persistencia de Activos:**
    - Los outputs (JSON de texto, imágenes y videos) se guardan automáticamente en `storage/gateway/output/YYYYMMDD_HHmm/`.
    - Implementado sistema de sondeo (polling) para descargar activos desde ComfyUI al Gateway tras finalizar la generación.
- **Seguridad:** Validación obligatoria de `x-api-key`.

### 10. Optimizaciones de Estabilidad (VRAM 12GB)
- **Modelo Base:** Cambio de SDXL a SD 1.5 (`v1-5-pruned-emaonly.safetensors`) para generación individual y orquestada, evitando errores HIP por falta de memoria.
- **Configuración Docker:**
    - Activado modo `--lowvram` en ComfyUI.
    - Ajustado `PYTORCH_HIP_ALLOC_CONF` para fragmentación optimizada en ROCm.
    - Implementado `entrypoint` y `command` limpios en `docker-compose.yml`.
