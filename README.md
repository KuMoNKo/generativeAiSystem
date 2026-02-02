# Generative AI Platform (ROCm Optimized)

Plataforma de IA generativa optimizada para GPUs AMD (probado en RX 6750 XT) utilizando Docker y ROCm 6.2.

## **Estructura de Directorios**

```text
.
├── docker-compose.yml       # Orquestación de contenedores
├── .env                     # Variables de entorno y configuración de GPU
├── services/                # Dockerfiles y lógica de servicios
│   ├── ollama/              # API de gestión para Ollama
│   ├── musicgen/            # [SKIPPED] Generación de Audio
│   └── imagegen/            # Generación y edición de Imágenes/Video (ComfyUI)
├── api-gateway/             # API Gateway Express.js (Punto de entrada único)
├── storage/                 # Volúmenes persistentes
│   ├── gateway/output/      # Resultados finales (JSON, Imágenes, Video)
│   ├── imagegen/            # Modelos y entradas de ComfyUI
│   └── ollama/              # Modelos de LLM
└── tests/                   # Suite de pruebas automatizadas
```

## **Requisitos Previos**

1.  **Drivers ROCm en el Host:** Instalados y funcionales (`rocm-smi` debe mostrar la GPU).
2.  **Permisos:** El usuario debe pertenecer a los grupos `video` y `render`.
    ```bash
    sudo usermod -aG video,render $USER
    ```
3.  **Docker & Compose:** Docker Engine v24+ y Docker Compose V2.

## **Instalación y Despliegue**

1.  **Configurar variables:**
    Edita el archivo `.env` para ajustar la `API_KEY` y los límites de VRAM si es necesario.

2.  **Construir e iniciar:**
    ```bash
    docker compose build
    docker compose up -d
    ```

3.  **Descargar modelos iniciales:**
    ```bash
    # Ollama
    docker exec -it ollama ollama run llama3.2
    ```

## **Servicios Incluidos**
- **API Gateway (Puerto 8080):** Punto de entrada único con autenticación (`x-api-key`). 
    - Orquestación de personajes (`/agent/character`).
    - Generación individual de texto, imagen y video.
    - Persistencia automática de resultados en `storage/gateway/output/`.
- **Ollama (Puerto 11000):** Motor de LLM optimizado para ROCm (Llama 3.2).
- **ImageGen & VideoGen (Puerto 11002):** Generación y edición de imágenes (SD 1.5) y video (AnimateDiff) mediante ComfyUI.
- **API Gateway (Puerto 8080):** Punto de entrada único para aplicaciones Frontend.

## **Servicios Eliminados/Omitidos**
- **MusicGen / ACE-Step:** Eliminados para optimizar el almacenamiento y priorizar la generación de imagen/video en GPUs con 12GB VRAM.

## **Ejecución de Tests**
Para verificar la integridad de la plataforma:
```bash
python3 tests/test_gateway.py
```

## **Solución de Problemas**
- **VRAM Insuficiente (12GB):** El sistema está configurado con `--lowvram` y usa SD 1.5 para maximizar la estabilidad. Evita ejecutar múltiples modelos pesados simultáneamente.
- **Error HIP:** Revisa el archivo `GEMINI.md` (Sección 10) para detalles sobre la configuración de memoria optimizada.