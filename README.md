# La Penúltima Lounge — POS multisede

## Cómo levantar el proyecto
1. Abrir Docker Desktop.
2. Copiar `.env.example` a `.env`.
3. Ejecutar: `docker compose up --build`
4. Probar: http://localhost:3000/health

## Flujo de trabajo
- Nadie trabaja directo en `main`.
- Cada historia va en su rama: `feature/hu-XX-nombre`.
- Se integra con Pull Request revisado por el otro.