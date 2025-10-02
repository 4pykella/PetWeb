# Мониторинг температуры и частот процессора в Linux

Набор инструментов и скриптов для мониторинга температуры и рабочих частот процессора в системах Linux.

## Установка необходимых пакетов

### 1. Установка lm-sensors для мониторинга температуры
```bash
sudo apt install lm-sensors
```

После установки выполните настройку:
```bash
sudo sensors-detect
```
Отвечайте "yes" на все вопросы для автоматического обнаружения датчиков.

### 2. Установка cpufrequtils для мониторинга частот
```bash
sudo apt install cpufrequtils
```

## Команды для мониторинга

### Мониторинг температуры
```bash
# Все показания датчиков
sensors

# Только температуры ядер
sensors | grep Core

# Все температурные показания
sensors | grep -i temp
```

### Мониторинг частот процессора
```bash
# Подробная информация о частотах
cpufreq-info

# Текущие частоты
cpufreq-info | grep "current CPU frequency"

# Альтернативные способы
cat /proc/cpuinfo | grep "MHz"
lscpu | grep "MHz"
```

## Скрипт для автоматического мониторинга

Создайте файл `monitoring_script.sh`:

```bash
#!/bin/bash
# monitoring_script.sh

echo "Запуск мониторинга температуры и частот..."

while true; do
    clear
    echo "=== $(date) ==="
    echo "Температура:"
    sensors | grep -E "(Core|Package)"
    echo ""
    echo "Частоты:"
    cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_cur_freq | \
    awk '{printf "CPU%d: %.2f GHz\n", NR-1, $1/1000000}'
    sleep 2
done
```

Сделайте скрипт исполняемым и запустите:
```bash
chmod +x monitoring_script.sh
./monitoring_script.sh
```