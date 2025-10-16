# Troubleshooting оперативной памяти в Linux

##  Проверка использования памяти

### Базовая информация о памяти
```bash
# Просмотр общей информации о памяти
free -h

# Детальная информация о памяти
cat /proc/meminfo

# Мониторинг в реальном времени
htop
# или
top
```

### Анализ процессов
```bash
# Сортировка процессов по использованию памяти
ps aux --sort=-%mem | head -10

# Просмотр распределения памяти
cat /proc/meminfo | grep -i commit
```

## Проверка на наличие утечек памяти

```bash
# Мониторинг изменений в использовании памяти
watch -n 1 'free -h'

# Поиск процессов с растущим использованием памяти
cat /proc/meminfo | grep -i slab
```

## Тестирование оперативной памяти

### Установка memtester
```bash
# Для Debian/Ubuntu
sudo apt install memtester

# Для CentOS/RHEL/Fedora
sudo yum install memtester
# или
sudo dnf install memtester
```

### Базовое тестирование
```bash
# Тестирование памяти (занимает указанный объем)
sudo memtester 1G 1  # тестировать 1GB, 1 раз

# Множественные проходы тестирования
sudo memtester 2G 3  # тестировать 2GB, 3 раза
```

## Безопасный скрипт для тестирования памяти

### Скрипт safe_memtest.sh
```bash
#!/bin/bash
# safe_memtest.sh - Безопасное тестирование оперативной памяти

# Получаем доступную память в KB
AVAILABLE_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')

# Конвертируем в GB
AVAILABLE_GB=$((AVAILABLE_KB / 1024 / 1024))
TOTAL_GB=$((TOTAL_KB / 1024 / 1024))

# Рассчитываем безопасный объем (75% от доступной)
SAFE_TEST_GB=$((AVAILABLE_GB * 75 / 100))

# Минимальный запас для системы
MIN_RESERVE=2

if [ $SAFE_TEST_GB -lt $MIN_RESERVE ]; then
    echo "Недостаточно свободной памяти для теста"
    echo "Доступно: ${AVAILABLE_GB}GB, нужно минимум: ${MIN_RESERVE}GB"
    exit 1
fi

# Ограничиваем максимальный тест 90% от общей памяти
MAX_TEST_GB=$((TOTAL_GB * 90 / 100))
if [ $SAFE_TEST_GB -gt $MAX_TEST_GB ]; then
    SAFE_TEST_GB=$MAX_TEST_GB
fi

echo "Общая память: ${TOTAL_GB}GB"
echo "Доступно: ${AVAILABLE_GB}GB"
echo "Будет протестировано: ${SAFE_TEST_GB}GB"

# Запускаем тест
sudo memtester ${SAFE_TEST_GB}G 1
```

### Использование скрипта
```bash
# Сделать скрипт исполняемым
chmod +x safe_memtest.sh

# Запуск скрипта
./safe_memtest.sh
```

## Дополнительные инструменты мониторинга

### Проверка использования swap
```bash
# Информация о swap
swapon --show
free -h | grep -i swap

# Мониторинг в реальном времени
vmstat 1
```

### Анализ через системные логи
```bash
# Поиск ошибок памяти в логах
dmesg | grep -i memory
dmesg | grep -i "out of memory"

# Проверка OOM-killer
journalctl | grep -i "killed process"
```

## Важные предупреждения

1. **Всегда оставляйте запас памяти** для работы системы
2. **Мониторьте использование swap** во время тестирования
3. **Прервите тест (Ctrl+C)** если система начинает сильно тормозить
4. **Не запускайте интенсивные тесты** на production-системах в рабочее время

## Рекомендации по использованию

- Для начального тестирования используйте небольшие объемы (1-2GB)
- Постепенно увеличивайте объем тестируемой памяти
- Используйте скрипт `safe_memtest.sh` для автоматического расчета безопасного объема
- Проводите тестирование в периоды низкой нагрузки на систему