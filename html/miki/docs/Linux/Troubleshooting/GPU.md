
### 1. Установка nvtop для мониторинга 
```bash
sudo apt install nvtop
```
#### Older

- AMD and Intel Dependencies
  ```bash
  sudo apt install libdrm-dev libsystemd-dev
  # Ubuntu 18.04
  sudo apt install libudev-dev
  ```

- NVIDIA Dependency
  - NVIDIA drivers (see [Ubuntu Wiki](https://help.ubuntu.com/community/BinaryDriverHowto/Nvidia) or [Ubuntu PPA](https://launchpad.net/~graphics-drivers/+archive/ubuntu/ppa) or [Debian Wiki](https://wiki.debian.org/NvidiaGraphicsDrivers#NVIDIA_Proprietary_Driver))

- NVTOP Dependencies
  - CMake, ncurses and Git
  ```bash
  sudo apt install cmake libncurses5-dev libncursesw5-dev git
  ```

- NVTOP
  - Follow the [NVTOP Build](#nvtop-build)

### 2. Установка glmark2 (не тестировал)
```bash
sudo apt install glmark2
```


