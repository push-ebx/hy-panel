# Hy2 Panel API

Backend API для управления Hysteria2 серверами.

## Запуск

```bash
# Из корня монорепо
pnpm dev:api

# Или напрямую
cd apps/api
pnpm dev
```

## Переменные окружения

```env
DATABASE_URL=mysql://root:password@localhost:3306/hy2_panel
JWT_SECRET=your-secret-key
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

## API Endpoints

### Авторизация

#### POST /api/auth/login
Авторизация пользователя.

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'
```

Ответ:
```json
{
  "success": true,
  "data": { "token": "eyJ..." }
}
```

### Серверы

Все эндпоинты требуют заголовок `Authorization: Bearer TOKEN`.

#### GET /api/servers
Список всех серверов.

#### GET /api/servers/:id
Получить сервер по ID.

#### POST /api/servers
Создать сервер.

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Germany 1",
    "host": "de1.example.com",
    "agentUrl": "http://123.45.67.89:8080"
  }'
```

Ответ:
```json
{
  "success": true,
  "data": { "id": "uuid", "agentToken": "uuid" },
  "message": "Server created"
}
```

#### PATCH /api/servers/:id
Обновить сервер.

#### DELETE /api/servers/:id
Удалить сервер.

#### POST /api/servers/sync
Синхронизировать всех клиентов со всех серверов. Читает конфиги Hysteria2 через агентов и обновляет БД.

```bash
curl -X POST http://localhost:4000/api/servers/sync \
  -H "Authorization: Bearer TOKEN"
```

Ответ:
```json
{
  "success": true,
  "data": { "servers": 2, "clients": 15 },
  "message": "Synced 2/2 servers, imported 15 clients"
}
```

### Клиенты

#### GET /api/clients
Список всех клиентов.

#### POST /api/clients
Создать клиента.

```bash
curl -X POST http://localhost:4000/api/clients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "serverId": "server-uuid",
    "name": "User 1",
    "password": "optional-password"
  }'
```

#### PATCH /api/clients/:id
Обновить клиента.

```bash
curl -X PATCH http://localhost:4000/api/clients/CLIENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "New Name", "enabled": false}'
```

#### DELETE /api/clients/:id
Удалить клиента.

### Пользователи

#### GET /api/users
Список всех пользователей (только для админов).

#### POST /api/users
Создать пользователя.

#### PATCH /api/users/:id
Обновить пользователя.

#### DELETE /api/users/:id
Удалить пользователя.

## Архитектура

```
Hysteria2 YAML config
        ↓
    Go Agent (:8080)
        ↓ GET /export
    Panel API (:4000)
        ↓
      MySQL DB
        ↓
    Web Frontend
```

Панель читает конфигурацию клиентов из агентов при вызове `/api/servers/sync`. Агент предоставляет endpoint `/export`, который возвращает список пользователей из YAML конфига Hysteria2.

## База данных

```bash
# Генерация миграций
pnpm db:generate

# Применение миграций
pnpm db:push

# Создание админа
pnpm seed
```
