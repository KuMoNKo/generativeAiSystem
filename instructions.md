## Instrucciones para crear la plataforma con vibe coding

### Requisitos previos ([Ver detalles](instructions_detailed.md#1-requisitos-previos))
- [x] 1. Comprueba que tienes instalado Docker y Docker Compose.
- [x] 2. Comprueba que tienes instalado ROCm.
- [x] 3. Comprueba que el usuario pertenece a los grupos video y render.

### Instalación ([Ver detalles](instructions_detailed.md#2-instalacion-y-configuracion))
- [x] 4. Revisar el fichero .env y ajustar los valores según sea necesario.
- [x] 5. Generar el fichero docker-compose.yml
    - [x] 5.1 Definir la red de docker
    - [x] 5.2 Definir el servicio de ollama ([Detalles](instructions_detailed.md#22-servicio-de-ollama-texto))
        - [x] 5.2.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT), ademas de llama3.2
        - [x] 5.2.2 Construir el fichero docker-compose.yml (docker compose build)
        - [x] 5.2.3 Ejecutar docker compose up -d
        - [x] 5.2.4 Descargar el modelo de llama3.2 y aquél que se decida
        - [x] 5.2.5 Probar que funciona
        - [ ] 5.2.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.2.2
    - [ ] 5.3 [SKIPPED] Definir el servicio de ACE-Step (Audio)
        - [x] 5.3.1 Clonar el repositorio ACE-Step y configurar Dockerfile para ROCm
        - [x] 5.3.2 Configurar el servicio en docker-compose.yml
        - [ ] 5.3.3 [SKIPPED] Ejecutar docker compose up -d y descargar modelo ACE-Step-v1-3.5B
    - [x] 5.4 Definir el servicio de imagegen ([Detalles](instructions_detailed.md#24-servicio-de-imagegen-imagen))
        - [x] 5.4.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT)
        - [x] 5.4.2 Construir el fichero docker-compose.yml (docker compose build)
        - [x] 5.4.3 Ejecutar docker compose up -d
        - [x] 5.4.4 Descargar el modelo decidido
        - [x] 5.4.5 Probar que funciona 
        - [x] 5.4.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.4.2
    - [x] 5.5 Definir el servicio de videogen ([Detalles](instructions_detailed.md#25-servicio-de-videogen-video))
        - [x] 5.5.1 Definir el servicio - Implementado como extensión de imagegen (AnimateDiff)
        - [x] 5.5.2 Construir el fichero docker-compose.yml (docker compose build)
        - [x] 5.5.3 Ejecutar docker compose up -d
        - [x] 5.5.4 Descargar el modelo decidido (SD 1.5 + Motion Module)
        - [x] 5.5.5 Probar que funciona 
        - [x] 5.5.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.5.2
    - [x] 5.6 Definir el servicio de api-gateway ([Detalles](instructions_detailed.md#26-api-gateway))
        - [x] 5.6.1 Definir el servicio - Implementado en Node.js (Express)
        - [x] 5.6.2 Construir el fichero docker-compose.yml (docker compose build)
        - [x] 5.6.3 Ejecutar docker compose up -d
        - [x] 5.6.4 Probar que funciona 
        - [x] 5.6.5 En caso de error en cualquier punto, solucionar el error y volver al paso 2.6.2

#### Conexiones ([Ver detalles](instructions_detailed.md#3-guia-de-conexiones-y-api))

---------------------------------------------------------------------------------------------------------------------------------------------------------------------
|endpoint   |method     |model      |destination                        |description                            |                                                     |
|-----------|-----------|-----------|-----------------------------------|---------------------------------------|-----------------------------------------------------|
|/text/gen  |POST       |llama3.2   |ollama:11000/api/generate          |Genera texto a partir de un prompt     |                                                     |
|/text/eval |POST       |llama3.2   |ollama:11000/api/evaluate          |Evalúa el texto generado               |                                                     |
|/text/edit |POST       |llama3.2   |ollama:11000/api/generate          |Edita el texto generado                |                                                     |
|/image/gen |POST       |SDXL       |imagegen:11002/prompt              |Genera imágenes a partir de un prompt  |                                                     |
|/image/edit|POST       |SDXL       |imagegen:11002/prompt              |Edita las imágenes generadas           |                                                     |
|/video/gen |POST       |AnimateDiff|imagegen:11002/prompt              |Genera video a partir de un prompt     |                                                     |
|/music/gen |POST       |**ND**     |**ND**                             |[SKIPPED] Genera música                |                                                     |
---------------------------------------------------------------------------------------------------------------------------------------------------------------------

#### Restricciones
1. Tras definir y probar un servicio, no se debe modificar al crear los siguientes.
2. El gateway debe ser el único punto de entrada para las aplicaciones Frontend.
3. El gateway debe tener endpoints disponibles por http y cli
4. El gateway (y los servicios) deben permitir descargar modelos a petición (y selección del modelo en todos los endpoints, dejando uno por defecto)