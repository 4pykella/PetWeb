# VPN
## OpenVPN







## WireGuard

WireGuard — это современный, быстрый и легкий протокол виртуальной частной сети (VPN), который обеспечивает безопасные сетевые соединения. Он завоевал популярность благодаря простоте установки, эффективности работы и легкости настройки по сравнению с другими популярными VPN-сервисами, такими как OpenVPN и IPSec. В статье расскажем, как установить WireGuard на своем сервере.

---

## Требования к серверу

Каких-либо жестких требований к установке ПО нет. Перед тем, как начать, проверьте, что ваш сервер отвечает следующим минимальным требованиям:

1. **Операционная система:** WireGuard возможен для установки практически на любой современной ОС, в статье мы будем рассматривать установку на ОС семейства Linux, в частности Ubuntu 22.04, также подойдут любые близкие по версии Debian-based ОС (например, Ubuntu 20.04, Debian 12 и т. д.).

2. **Ресурсы сервера:** Виртуальный сервер с достаточными ресурсами для обработки VPN-трафика: 1 ядро процессора и минимум 512 МБ оперативной памяти.

3. **Доступ суперпользователя:** На вашем сервере должны быть права sudo или доступ пользователя root, чтобы выполнить необходимые шаги по установке и настройке.

4. **Требования к сети:** Убедитесь, что сервер имеет публичный IP-адрес (“белый” IP), а также есть доступ к настройке правил брандмауэра для разрешения VPN-трафика. Желательно, чтобы сетевой канал сервера был не менее 100 Мбит/сек.

---

## Установка WireGuard

### Первый способ: через Docker-контейнер

Использование Docker упрощает установку и снижает влияние на остальное ПО на сервере.

#### 1. Установка Docker

```bash
apt update
apt install docker.io -y
apt install docker-compose -y
````

#### 2. Создание и запуск контейнера

Создаем директорию для конфигурационных файлов:

```bash
mkdir -p /etc/wireguard/config
```

Запускаем контейнер:

```bash
docker run -d \
  --name=wireguard \
  --cap-add=NET_ADMIN \
  --cap-add=SYS_MODULE \
  -e PUID=1000 \
  -e PGID=1000 \
  -e TZ=Europe/Moscow \
  -e SERVERURL=62.109.21.223 \
  -e SERVERPORT=51820 \
  -e PEERS=3 \
  -e PEERDNS=auto \
  -e INTERNAL_SUBNET=10.13.13.0 \
  -p 51820:51820/udp \
  -v /etc/wireguard:/config \
  -v /lib/modules:/lib/modules \
  --sysctl='net.ipv4.conf.all.src_valid_mark=1' \
  --sysctl='net.ipv4.ip_forward=1' \
  --restart unless-stopped \
  linuxserver/wireguard
```

> Замените `62.109.21.223` на IP вашего сервера. Настройте параметры `TZ` и `PEERS` по необходимости.

#### 3. Проверка контейнера

```bash
docker ps
```

Если контейнер запущен, вы увидите его в списке.

Конфигурационные файлы будут доступны в папке `/etc/wireguard/config`.

---

### Второй способ: С помощью скрипта

#### 1. Запуск скрипта

```bash
wget https://git.io/wireguard -O wireguard-install.sh && bash wireguard-install.sh
```

#### 2. Пункты установки

Скрипт запросит IP сервера, порт VPN (по умолчанию 51820) и количество клиентов. После завершения работы скрипта будут созданы конфигурационные файлы.

#### 3. Завершение установки

Файлы конфигурации хранятся обычно в `/etc/wireguard/`.

---

### Третий способ: Ручная установка (на примере Ubuntu)

#### 1. Обновление пакетов

```bash
apt update
```

#### 2. Установка WireGuard

```bash
apt install wireguard -y
```

#### 3. Генерация ключей сервера

```bash
wg genkey | tee /etc/wireguard/privatekey | wg pubkey | tee /etc/wireguard/publickey
```

#### 4. Генерация ключей клиентов

Для каждого клиента (например, для 3 устройств):

```bash
wg genkey | tee /etc/wireguard/peer_1_privatekey | wg pubkey | tee /etc/wireguard/peer_1_publickey
wg genkey | tee /etc/wireguard/peer_2_privatekey | wg pubkey | tee /etc/wireguard/peer_2_publickey
wg genkey | tee /etc/wireguard/peer_3_privatekey | wg pubkey | tee /etc/wireguard/peer_3_publickey
```

#### 5. Создание конфигурации сервера `/etc/wireguard/wg0.conf`

```ini
[Interface]
PrivateKey = <server_private_key>
Address = 10.13.13.1/24
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
ListenPort = 51820

[Peer]
# peer_1
PublicKey = <client_public_key(peer_1_publickey)>
AllowedIPs = 10.13.13.2/32

[Peer]
# peer_2
PublicKey = <client_public_key(peer_2_publickey)>
AllowedIPs = 10.13.13.3/32

[Peer]
# peer_3
PublicKey = <client_public_key(peer_3_publickey)>
AllowedIPs = 10.13.13.4/32
```

> Замените `<server_private_key>` и `<client_public_key>` на реальные значения.

#### 6. Создание конфигурационных файлов клиентов

Пример для первого клиента `/etc/wireguard/peer_1.conf`:

```ini
[Interface]
Address = 10.13.13.2/32
PrivateKey = <client1_private_key>
DNS = 1.1.1.1

[Peer]
PublicKey = <server_public_key>
Endpoint = <server-ip>:51820
AllowedIPs = 0.0.0.0/0, ::/0
```

> Замените `<client1_private_key>`, `<server_public_key>`, `<server-ip>` на реальные значения.

Аналогично создайте `peer_2.conf` и `peer_3.conf` с соответствующими ключами и IP-адресами.

#### 7. Включение IP-форвардинга

Выполните временно:

```bash
sysctl -w net.ipv4.ip_forward=1
```

Для постоянного включения добавьте в `/etc/sysctl.conf` строку:

```ini
net.ipv4.ip_forward = 1
```

#### 8. Запуск WireGuard

```bash
wg-quick up wg0
systemctl enable wg-quick@wg0
```

#### 9. Настройка фаервола

Убедитесь, что порт WireGuard (51820 UDP или другой) открыт.

---

## Настройка клиента WireGuard

### 1. Установка клиента

На Linux (Debian-based):

```bash
sudo apt install wireguard
```

Для Windows, macOS, iOS и Android скачайте официальное приложение с сайта WireGuard.

### 2. Получение клиентских конфигурационных файлов

* При установке через Docker или скрипт файлы генерируются автоматически в указанной директории (например, `/etc/wireguard/config/peer1/peer1.conf`).
* При ручной установке файлы лежат в `/etc/wireguard/peer_<i>.conf`.

Скопируйте нужный файл на устройство клиента.

### 3. Подключение к VPN

На Linux:

```bash
sudo wg-quick up peer_1.conf
```

Для десктопных и мобильных приложений импортируйте конфигурацию через GUI.


