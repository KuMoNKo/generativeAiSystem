# Instrucciones Detalladas para la Plataforma Generativa

Este documento proporciona detalles técnicos, comandos y configuraciones específicas para complementar la hoja de ruta en `instructions.md`.

## 1. Requisitos Previos

### 1.1 Comprobar Docker y Docker Compose
Ejecuta los siguientes comandos para verificar las versiones instaladas:
```bash
docker --version
docker compose version
```
Asegúrate de que el demonio de Docker esté corriendo: `systemctl status docker`.

### 1.2 Comprobar ROCm
Para verificar que el stack de ROCm está correctamente instalado y reconoce la GPU (Navi 22):
```bash
rocminfo
# O también
/opt/rocm/bin/rocm-smi
```
Deberías ver listada la RX 6750 XT.

### 1.3 Comprobar Grupos de Usuario
El usuario debe tener acceso directo al hardware para que ROCm funcione dentro de los contenedores:
```bash
groups $USER | grep -E 'video|render'
```
Si no aparecen, añádelos y reinicia la sesión: `sudo usermod -aG video,render $USER`.

---

## 2. Instalación y Configuración

### 2.1 Configuración del Entorno (.env)
Crea el archivo `.env` basándote en `.env.dist`. Asegúrate de definir:
- `OLLAMA_PORT=11434`
- `GATEWAY_PORT=3000`
- `API_KEY=tu_clave_secreta`
- `ROCM_VERSION=6.2.4`

### 2.2 Servicio de Ollama (Texto)
- **Imagen:** Utilizar `ollama/ollama:rocm`.
- **Modelo:** Llama 3.2 (ligero y eficiente para 12GB VRAM).
- **GPU RX 6750 XT:** Configurar el dispositivo `/dev/kfd` y `/dev/dri` en el docker-compose.
- **Comando de descarga:** `docker exec -it ollama ollama run llama3.2`

### 2.3 [DELETED] Servicio de ACE-Step (Audio)
- **Estado:** Eliminado el 1 de febrero de 2026 para liberar espacio y optimizar recursos (8.5 GB recuperados).
- **Histórico:** Anteriormente implementado con `ACE-Step/ACE-Step-v1-3.5B`.

### 2.4 Servicio de ImageGen (Imagen)
- **Tecnología:** Stable Diffusion (SDXL y SD 1.5).
- **Implementación:** ComfyUI sobre ROCm.
- **Modelos Principales:** `juggernautXL_v9.safetensors`.
- **Ruta de modelos:** `/app/models` mapeado a `${STORAGE_PATH}/imagegen/models`.

### 2.5 Servicio de VideoGen (Video)
- **Tecnología:** AnimateDiff.
- **Implementación:** Integrado directamente en el servicio `imagegen` para ahorrar VRAM.
- **Nodos:** `ComfyUI-AnimateDiff-Evolved`, `ComfyUI-VideoHelperSuite`.
- **Modelos:** `v1-5-pruned-emaonly.safetensors` y `mm_sd_v15_v2.ckpt`.

### 2.6 API Gateway
- **Base:** Node.js con Express.
- **Funcionalidad:** 
    - Validación de `x-api-key`.
    - Enrutamiento dinámico a los servicios internos (`http://ollama:11000`, `http://imagegen:8188`).
    - Registro de logs de peticiones.

---

## 3. Guía de Conexiones y API

El Gateway centraliza todas las llamadas. Los endpoints deben aceptar un parámetro `model` opcional para permitir flexibilidad.

- **Generación de Texto:**
  `POST /text/gen` -> Body: `{ "prompt": "...", "model": "llama3.2" }`

- **Gestión de Modelos:**
  Implementar un endpoint `POST /models/download` para que el gateway pueda instruir a los servicios la descarga de nuevos modelos mediante sus respectivas APIs internas.
