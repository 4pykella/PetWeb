# SSH (Secure Shell) — Полное руководство

SSH (Secure Shell) — это сетевой протокол для безопасного удаленного управления серверами и передачи файлов. Все данные шифруются, что защищает от перехвата.

---

## Клиенты Windows

### 1. PowerShell (встроенный SSH-клиент)
В Windows 10/11 SSH уже встроен:
```powershell
# Проверить наличие
ssh -V

# Если нет — установить через "Управление дополнительными компонентами"
# или как администратор:
Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0
```
Использовать если все совсем плохо

### 2. PuTTY
Классический графический клиент:
- **Скачать**: [putty.org](https://www.putty.org/)
- **Скачать ru версия**: [putty.org.ru](https://putty.org.ru/)
- **Хранилище ключей**: PuTTY использует свой формат `.ppk`
- **Конвертация ключей**: PuTTYgen (в комплекте)

### 3. Bitvise
Более удобная версия (пользуесь ей):
- **Скачать**: [bitvise.com](https://bitvise.com/)
- Работает с обычными и .ppk ключами 
- Можно нормально созранять готовые профили подключения

### 4. Git Bash
Вместе с Git for Windows поставляется SSH-клиент:
- Скачать: [git-scm.com](https://git-scm.com/downloads/win)
- Работает с обычными ключами (не .ppk)

---

## Подключение Linux

### Базовое подключение
```bash
# Стандартное подключение (порт 22)
ssh user@192.168.1.100

# С явным указанием порта
ssh -p 2222 user@server.com

# Подключение с конкретным ключом
ssh -i ~/.ssh/my_private_key user@host
```

### Настройка файла конфигурации (~/.ssh/config)
```ssh-config
# Упрощаем подключения
Host myserver
    HostName 192.168.1.100
    User admin
    Port 2222
    IdentityFile ~/.ssh/server_key

# Для GitHub
Host github.com
    User git
    IdentityFile ~/.ssh/github_ed25519

# Подключение через прыжковый хост (Jump Host)
Host internal-server
    HostName 10.0.0.5
    User deployer
    ProxyJump jump-server
```

Теперь подключаемся просто:
```bash
ssh myserver
```

### Выполнение команд без интерактивной сессии
```bash
# Запустить команду и выйти
ssh user@host "ls -la /var/log"

# Скрипт на сервере
ssh user@host "bash -s" < local_script.sh

# Просмотр логов в реальном времени
ssh user@host "tail -f /var/log/nginx/access.log"
```

---

## Генерация ключей на разных платформах

### Основные типы ключей
| Тип | Длина | Рекомендация |
|-----|-------|--------------|
| **Ed25519** | 256 бит | ✅ Рекомендуется (самый безопасный и быстрый) |
| **RSA** | 4096 бит | ✅ Хорошо (совместимость со старыми системами) |
| **ECDSA** | 256/384/521 | ⚠️ Возможны проблемы с реализацией |
| **DSA** | 1024 | ❌ Устарел, не использовать |

---

### Windows

#### Способ 1: PowerShell / Командная строка (OpenSSH)
```powershell
# Генерация Ed25519 (рекомендуется)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Генерация RSA 4096
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# Указать имя файла (например, для GitHub)
ssh-keygen -t ed25519 -f "%USERPROFILE%\.ssh\github_key" -C "github@example.com"
```

#### Способ 2: PuTTYgen (графический)
1. Запустить `puttygen.exe`
2. Нажать "Generate" и двигать мышью для энтропии
3. Выбрать тип: **Ed25519** или **RSA (4096)**
4. Добавить passphrase (пароль на ключ)
5. Сохранить:
   - **Приватный ключ**: `Save private key` → файл `.ppk`
   - **Публичный ключ**: `Save public key` → файл `.txt`
   - Экспорт в OpenSSH формат: `Conversions` → `Export OpenSSH key`

#### Где лежат ключи в Windows
```
C:\Users\%USERNAME%\.ssh\
├── id_ed25519          # приватный ключ
├── id_ed25519.pub      # публичный ключ
├── authorized_keys     # чужие публичные ключи (для сервера)
├── config              # конфигурация клиента
└── known_hosts         # известные серверы
```

---

### Linux

#### Генерация ключей
```bash
# Ed25519 (рекомендуется)
ssh-keygen -t ed25519 -C "your_email@example.com"

# RSA 4096
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"

# С указанием имени файла
ssh-keygen -t ed25519 -f ~/.ssh/github_key -C "github@example.com"

# С passphrase и комментарием за один раз
ssh-keygen -t ed25519 -N "my_password" -C "server_access" -f ~/.ssh/server_key
```

#### Просмотр и управление ключами
```bash
# Посмотреть публичный ключ
cat ~/.ssh/id_ed25519.pub

# Список загруженных ключей в агент
ssh-add -l

# Добавить ключ в агент
ssh-add ~/.ssh/my_key

# Удалить все ключи из агента
ssh-add -D
```

#### Копирование публичного ключа на сервер
```bash
# Автоматически (рекомендуется)
ssh-copy-id user@server.com

# Вручную
cat ~/.ssh/id_ed25519.pub | ssh user@server.com "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"

# С указанием порта
ssh-copy-id -p 2222 user@server.com
```

---

## Передача файлов Filezilla

### Настройка Filezilla для SSH (SFTP)

Filezilla **не поддерживает SCP**, но отлично работает с **SFTP** (SSH File Transfer Protocol).

#### Шаг 1: Установка
- Скачать с [filezilla-project.org](https://filezilla-project.org/)
- Выбрать версию: **FileZilla Client** (бесплатно)

#### Шаг 2: Создание нового сайта
1. Открыть **File → Site Manager** (Ctrl+S)
2. Нажать **New Site**
3. Вкладка **General**:
   ```
   Protocol:     SFTP - SSH File Transfer Protocol
   Host:         192.168.1.100 (или domain.com)
   Port:         22 (стандартный, или ваш)
   Logon Type:   Key file
   User:         username
   Key file:     Выбрать ваш ПРИВАТНЫЙ ключ
   ```

#### Шаг 3: Конвертация ключей для Filezilla
**Проблема**: Filezilla не понимает ключи PuTTY (`.ppk`) и требует OpenSSH формат.

**Решение A** (у вас уже есть ключ OpenSSH):
```bash
# Ключи из Linux/WSL/Git Bash работают сразу
# Просто укажите путь к приватному ключу (без расширения .pub)
```

**Решение B** (конвертация .ppk → OpenSSH в PuTTYgen):
1. Открыть PuTTYgen
2. **File → Load private key** (загрузить .ppk)
3. **Conversions → Export OpenSSH key** (сохранить без расширения)
4. Использовать этот ключ в Filezilla

**Решение C** (конвертация командной строкой):
```bash
# puttygen в Linux/WSL
puttygen mykey.ppk -O private-openssh -o mykey_openssh

# или через ssh-keygen
ssh-keygen -p -f mykey.ppk  # не работает напрямую
```

#### Шаг 4: Подключение
1. Нажать **Connect**
2. При первом подключении подтвердить ключ хоста
3. Готово — можно перетаскивать файлы

### Альтернативы Filezilla для SSH

| Программа | Платформа | Особенности |
|-----------|-----------|-------------|
| **WinSCP** | Windows | Олдскул |
| **Cyberduck** | Win/Mac | Добавил на случай Mac |
| **rsync** | Linux/WSL | Хардкор |


---

## Типичные проблемы и решения

| Проблема | Решение |
|----------|---------|
| `Permission denied (publickey)` | Ключ не добавлен в `authorized_keys` на сервере |
| Filezilla: `Authentication failed` | Неправильный формат ключа (нужен OpenSSH) |
| Windows: `ssh не найден` | Добавить OpenSSH через компоненты Windows |
| `WARNING: UNPROTECTED PRIVATE KEY FILE` | Исправить права: `chmod 600 ~/.ssh/id_*` |
| `Host key verification failed` | Удалить старый ключ: `ssh-keygen -R hostname` |

---
