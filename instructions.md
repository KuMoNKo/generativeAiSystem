## Instrucciones para crear la plataforma con vibe coding

### Requisitos previos
- [ ] 1. Comprueba que tienes instalado Docker y Docker Compose.
- [ ] 2. Comprueba que tienes instalado ROCm.
- [ ] 3. Comprueba que el usuario pertenece a los grupos video y render.

### Instalación
- [ ] 4. Revisar el fichero .env y ajustar los valores según sea necesario.
- [ ] 5. Generar el fichero docker-compose.yml
    - [ ] 5.1 Definir la red de docker
    - [ ] 5.2 Definir el servicio de ollama
        - [ ] 5.2.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT), ademas de llama3.2
        - [ ] 5.2.2 Construir el fichero docker-compose.yml (docker compose build)
        - [ ] 5.2.3 Ejecutar docker compose up -d
        - [ ] 5.2.4 Descargar el modelo de llama3.2 y aquél que se decida
        - [ ] 5.2.5 Probar que funciona
        - [ ] 5.2.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.2.2
    - [ ] 5.3 Definir el servicio de musicgen
        - [ ] 5.3.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT)
        - [ ] 5.3.2 Construir el fichero docker-compose.yml (docker compose build)
        - [ ] 5.3.3 Ejecutar docker compose up -d
        - [ ] 5.3.4 Descargar el modelo decidido
        - [ ] 5.3.5 Probar que funciona 
        - [ ] 5.3.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.3.2
    - [ ] 5.4 Definir el servicio de imagegen
        - [ ] 5.4.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT)
        - [ ] 5.4.2 Construir el fichero docker-compose.yml (docker compose build)
        - [ ] 5.4.3 Ejecutar docker compose up -d
        - [ ] 5.4.4 Descargar el modelo decidido
        - [ ] 5.4.5 Probar que funciona 
        - [ ] 5.4.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.4.2
    - [ ] 5.5 Definir el servicio de videogen
        - [ ] 5.5.1 Definir el servicio - Pensar el modelo que debe usarse para la GPU (RX 6750 XT)
        - [ ] 5.5.2 Construir el fichero docker-compose.yml (docker compose build)
        - [ ] 5.5.3 Ejecutar docker compose up -d
        - [ ] 5.5.4 Descargar el modelo decidido
        - [ ] 5.5.5 Probar que funciona 
        - [ ] 5.5.6 En caso de error en cualquier punto, solucionar el error y volver al paso 2.5.2
    - [ ] 5.6 Definir el servicio de api-gateway
        - [ ] 5.6.1 Definir el servicio - Definir la arquitectura del API Gateway
        - [ ] 5.6.2 Construir el fichero docker-compose.yml (docker compose build)
        - [ ] 5.6.3 Ejecutar docker compose up -d
        - [ ] 5.6.4 Probar que funciona 
        - [ ] 5.6.5 En caso de error en cualquier punto, solucionar el error y volver al paso 2.6.2

#### Conexiones

---------------------------------------------------------------------------------------------------------------------------------------------------------------------
|endpoint   |method     |model      |destination                        |description                            |                                                     |
|-----------|-----------|-----------|-----------------------------------|---------------------------------------|-----------------------------------------------------|
|/text/gen  |POST       |llama3.2   |ollama:11000/api/generate          |Genera texto a partir de un prompt     |                                                     |
|/text/eval |POST       |llama3.2   |ollama:11000/api/evaluate          |Evalúa el texto generado               |                                                     |
|/text/edit |POST       |llama3.2   |ollama:11000/api/generate          |Edita el texto generado                |                                                     |
|/image/gen |POST       |**ND**     |**ND**                             |Genera imágenes a partir de un prompt  |                                                     |
|/image/edit|POST       |**ND**     |**ND**                             |Edita las imágenes generadas           |                                                     |
|/image/edit|POST       |**ND**     |**ND**                             |Edita las imágenes generadas           |                                                     |
|/music/gen |POST       |**ND**     |**ND**                             |Genera música a partir de un prompt    |                                                     |
|/video/gen |POST       |**ND**     |**ND**                             |Genera video a partir de un prompt     |                                                     |
---------------------------------------------------------------------------------------------------------------------------------------------------------------------

#### Restricciones
1. Tras definir y probar un servicio, no se debe modificar al crear los siguientes.
2. El gateway debe ser el único punto de entrada para las aplicaciones Frontend.
3. El gateway debe tener endpoints disponibles por http y cli
4. El gateway (y los servicios) deben permitir descargar modelos a petición (y selección del modelo en todos los endpoints, dejando uno por defecto)