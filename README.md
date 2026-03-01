# Hy2 Panel

Веб-панель для управления Hysteria2 VPN серверами.

## Стек

- **Frontend**: Next.js, shadcn/ui, TypeScript
- **Backend**: Hono, Node.js, TypeScript
- **Database**: MySQL, Drizzle ORM
- **Agent**: Go

## Структура проекта

```
hy2-panel/
├── apps/
│   ├── api/          # Backend API (Hono)
│   ├── web/          # Frontend (Next.js)
│   └── agent/        # Go агент для серверов
├── packages/
│   ├── db/           # Drizzle ORM схемы
│   └── shared/       # Общие типы и утилиты
└── package.json
```

## Быстрый старт

### 1. Установка зависимостей

```bash
pnpm install
```

### 2. Настройка окружения

```bash
cp .env.example .env
```

Отредактируйте `.env`:
```env
DATABASE_URL=mysql://root:password@localhost:3306/hy2_panel
JWT_SECRET=your-secret-key
PORT=4000
CORS_ORIGIN=http://localhost:3000
```

### 3. База данных

```bash
# Создать таблицы
pnpm db:push

# Создать админа (admin@example.com / admin123)
pnpm seed
```

### 4. Запуск

```bash
# Все сервисы
pnpm dev

# Только API
pnpm dev:api

# Только frontend
pnpm dev:web
```

## Архитектура

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│    MySQL    │
│  (Next.js)  │     │   (Hono)    │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          │ GET /export
                          ▼
              ┌───────────────────────┐
              │      Go Agents        │
              │  (на каждом сервере)  │
              └───────────────────────┘
                          │
                          │ читает
                          ▼
              ┌───────────────────────┐
              │   Hysteria2 Config    │
              │      (YAML)           │
              └───────────────────────┘
```

## Установка агента на сервер

### 1. Сборка

```bash
cd apps/agent
go build -o agent .
```

### 2. Загрузка на сервер

```bash
scp agent user@server:/opt/hy2-agent/
```

### 3. Настройка

На сервере создайте `/opt/hy2-agent/.env`:
```env
PORT=8080
AGENT_TOKEN=токен-из-панели
HY2_CONFIG_PATH=/etc/hysteria/config.yaml
```

### 4. Запуск

```bash
cd /opt/hy2-agent
./agent
```

Подробнее: [apps/agent/README.md](apps/agent/README.md)

## API

### Добавление сервера

```bash
curl -X POST http://localhost:4000/api/servers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{
    "name": "Germany 1",
    "host": "de1.example.com",
    "agentUrl": "http://SERVER_IP:8080"
  }'
```

Сохраните `agentToken` из ответа — он нужен для настройки агента.

### Синхронизация

```bash
curl -X POST http://localhost:4000/api/servers/sync \
  -H "Authorization: Bearer TOKEN"
```

Подробнее: [apps/api/README.md](apps/api/README.md)

## Скрипты

| Команда | Описание |
|---------|----------|
| `pnpm dev` | Запуск всех сервисов |
| `pnpm dev:api` | Запуск только API |
| `pnpm dev:web` | Запуск только frontend |
| `pnpm build` | Сборка всех пакетов |
| `pnpm db:generate` | Генерация миграций |
| `pnpm db:push` | Применение схемы к БД |
| `pnpm seed` | Создание админа |

## Лицензия

MIT
