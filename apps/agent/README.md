# Hy2 Panel Agent

Go-агент для чтения конфигурации Hysteria2. Устанавливается на каждый VPN сервер.

## Сборка

```bash
cd apps/agent
go mod tidy
go build -o agent .
```

## Переменные окружения

```env
PORT=8080
AGENT_TOKEN=токен-из-панели
HY2_CONFIG_PATH=/etc/hysteria/config.yaml
HY2_SERVICE_NAME=hysteria-server
HY2_API_URL=http://127.0.0.1:9999
HY2_API_SECRET=your-traffic-stats-secret
```

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт HTTP сервера | `8080` |
| `AGENT_TOKEN` | Токен авторизации (получить при создании сервера в панели) | — |
| `HY2_CONFIG_PATH` | Путь к конфигу Hysteria2 | `/etc/hysteria/config.yaml` |
| `HY2_SERVICE_NAME` | Имя systemd-сервиса для перезапуска после изменения конфига (`systemctl restart …`). Пусто — перезапуск не выполняется | `hysteria-server` |
| `HY2_API_URL` | Базовый URL Hysteria2 Traffic Stats API (например `http://127.0.0.1:9999`). Нужен для отображения онлайна клиентов в панели | — |
| `HY2_API_SECRET` | Секрет из секции `trafficStats.secret` конфига Hysteria2; передаётся в заголовке `Authorization` при запросе к API | — |

## Запуск

```bash
# Напрямую
./agent

# Или с .env файлом
echo "AGENT_TOKEN=your-token" > .env
./agent
```

## API Endpoints

### GET /export
Возвращает список клиентов из конфига Hysteria2.

Требует заголовок: `Authorization: Bearer AGENT_TOKEN`

```bash
curl http://localhost:8080/export \
  -H "Authorization: Bearer your-token"
```

Ответ:
```json
{
  "clients": [
    { "id": "user1", "password": "pass1", "enabled": true },
    { "id": "user2", "password": "pass2", "enabled": true }
  ]
}
```

### POST /clients
Добавляет клиента в конфиг Hysteria2 (auth.userpass). Тело запроса — JSON.

Требует заголовки: `Authorization: Bearer AGENT_TOKEN`, `Content-Type: application/json`

Тело:
```json
{ "id": "user1", "password": "secret123" }
```

```bash
curl -X POST http://localhost:8080/clients \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"id":"user1","password":"secret123"}'
```

Ответ (201):
```json
{ "id": "user1", "password": "secret123" }
```

Файл конфига перезаписывается; при отсутствии секции `auth` или `auth.userpass` она создаётся. После записи выполняется `systemctl restart HY2_SERVICE_NAME`.

### GET /traffic
Прокси к Hysteria2 Traffic Stats API: возвращает трафик по клиентам (имя → { tx, rx } в байтах). Требует `HY2_API_URL`.

### GET /online
Прокси к Hysteria2 Traffic Stats API: возвращает список онлайн-клиентов (имя → количество подключений). Для работы нужен `HY2_API_URL` в конфиге агента; в конфиге Hysteria2 должна быть включена секция `trafficStats` (listen и при необходимости secret).

Требует заголовок: `Authorization: Bearer AGENT_TOKEN`

Ответ (как у Hysteria2 GET /online):
```json
{ "user1": 2, "user2": 1 }
```

Если `HY2_API_URL` не задан, возвращается пустой объект.

### DELETE /clients/{id}
Удаляет клиента из конфига Hysteria2 (auth.userpass). `{id}` — имя пользователя (логин).

Требует заголовок: `Authorization: Bearer AGENT_TOKEN`

```bash
curl -X DELETE "http://localhost:8080/clients/user1" \
  -H "Authorization: Bearer your-token"
```

Ответ: `204 No Content`. После изменения конфига выполняется перезапуск сервиса.

### GET /health
Проверка работоспособности.

```bash
curl http://localhost:8080/health
```

Ответ:
```json
{ "status": "ok" }
```

## Формат конфига Hysteria2

Агент читает и при POST /clients дополняет секцию `auth.userpass`. Остальные поля (`listen`, `tls` и т.д.) не изменяются.

Пример конфига:

```yaml
listen: 0.0.0.0:443

tls:
  cert: /etc/hysteria/certs/fullchain.pem
  key: /etc/hysteria/certs/privkey.pem

auth:
  type: userpass
  userpass:
    Admin: b41b908e4f59bc52cece90c3615205b3
```

После вызова POST /clients с новым пользователем он будет добавлен в `auth.userpass`; структура и порядок остальных секций сохраняются.

## Systemd сервис

Создайте файл `/etc/systemd/system/hy2-agent.service`:

```ini
[Unit]
Description=Hy2 Panel Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hy2-agent
ExecStart=/opt/hy2-agent/agent
Restart=always
RestartSec=5
Environment=PORT=8080
Environment=AGENT_TOKEN=your-token-here
Environment=HY2_CONFIG_PATH=/etc/hysteria/config.yaml
Environment=HY2_SERVICE_NAME=hysteria-server
Environment=HY2_API_URL=http://127.0.0.1:9999
Environment=HY2_API_SECRET=your-traffic-stats-secret

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable hy2-agent
sudo systemctl start hy2-agent
sudo systemctl status hy2-agent
```

## Безопасность

- Агент должен быть доступен только для панели
- Используйте firewall для ограничения доступа к порту агента
- Храните `AGENT_TOKEN` в секрете

```bash
# Разрешить доступ только с IP панели
ufw allow from PANEL_IP to any port 8080
```
