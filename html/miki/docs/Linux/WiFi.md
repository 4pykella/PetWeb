## 1. Проверка доступных Wi-Fi адаптеров

```bash
    lshw -C network
```

## 2. Установка необходимых пакетов

```bash
    sudo apt update
    sudo apt install wpasupplicant
```


## 3. Поиск доступных Wi-Fi сетей
```bash
    sudo iwlist "свой адаптер" scan | grep ESSID
```

## 4. Подключение
### 4.1 Подключение через netplan

Зайти в файл
```bash
    sudo nano /etc/netplan/01-wifi-config.yaml
```

Заполняем yaml
```yaml
    network:
    version: 2
    renderer: networkd
    wifis:
        wlp36s0:
            dhcp4: true
            dhcp6: true
            access-points:
                "ESSID":
                    password: "пароль_от_сети"
```

Применяем 
```bash
    sudo netplan generate
    sudo netplan apply
```
### 4.2 Быстрый способ через nmcli (если установлен)

```bash
    sudo nmcli dev wifi connect "ESSID" password "пароль_от_сети"
```
