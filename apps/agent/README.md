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
```

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `PORT` | Порт HTTP сервера | `8080` |
| `AGENT_TOKEN` | Токен авторизации (получить при создании сервера в панели) | — |
| `HY2_CONFIG_PATH` | Путь к конфигу Hysteria2 | `/etc/hysteria/config.yaml` |

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

Файл конфига перезаписывается; при отсутствии секции `auth` или `auth.userpass` она создаётся.

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
