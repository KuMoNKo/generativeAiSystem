# Generative AI Platform (ROCm Optimized)

Plataforma de IA generativa optimizada para GPUs AMD (probado en RX 6750 XT) utilizando Docker y ROCm 6.2.

## **Estructura de Directorios**

```text
.
├── docker-compose.yml       # Orquestación de contenedores
├── .env                     # Variables de entorno y configuración de GPU
├── services/                # Dockerfiles y lógica de servicios
│   ├── ollama/              # API de gestión para Ollama
│   ├── musicgen/            # Generación de Audio
│   ├── imagegen/            # Generación y edición de Imágenes
│   └── videogen/            # Generación de Video
├── api-gateway/             # API Gateway Express.js (Bridge para React)
├── storage/                 # Volúmenes persistentes (Modelos y Salidas)
└── scripts/                 # Utilidades de mantenimiento
```

## **Requisitos Previos**

1.  **Drivers ROCm en el Host:** Instalados y funcionales (`rocm-smi` debe mostrar la GPU).
2.  **Permisos:** El usuario debe pertenecer a los grupos `video` y `render`.
    ```bash
    sudo usermod -aG video,render $USER
    # Reiniciar sesión después de ejecutar
    ```
3.  **Docker & Compose:** Docker Engine v24+ y Docker Compose V2.

## **Instalación y Despliegue**

1.  **Configurar variables:**
    Edita el archivo `.env` para ajustar la API_KEY y los límites de VRAM si es necesario.

2.  **Construir e iniciar:**
    ```bash
    docker compose build
    docker compose up -d
    ```

3.  **Descargar modelos iniciales (Ollama):**
    ```bash
    curl http://localhost:11434/api/pull -d '{"name": "phi3:mini"}'
    ```

## **Servicios Incluidos**
- **Ollama (Puerto 11000):** Motor de LLM.
- **MusicGen (Puerto 11001):** Generación de audio mediante AudioCraft.
- **ImageGen (Puerto 11002):** Generación y edición de imágenes.
- **VideoGen (Puerto 11003):** Generación de video.
- **API Gateway (Puerto 8080):** Punto de entrada único para aplicaciones Frontend.

## **Solución de Problemas**
- **Error de permisos GPU:** Verifica que los dispositivos `/dev/kfd` y `/dev/dri` tengan permisos de lectura/escritura y que el usuario esté en los grupos correctos.
- **VRAM Insuficiente:** Ajusta `PYTORCH_HIP_ALLOC_CONF` en el `.env` para fragmentar la memoria de forma más agresiva.
- **Incompatibilidad de arquitectura:** La variable `HSA_OVERRIDE_GFX_VERSION=10.3.0` es necesaria para que las GPUs Navi 22 (como la 6750 XT) sean compatibles con librerías compiladas para Navi 21.