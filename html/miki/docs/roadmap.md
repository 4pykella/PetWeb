# Roadmap: Kubernetes в HomeLab на Proxmox

> Путь от «что такое под» до HA-кластера из нескольких нод в Proxmox с GitOps, мониторингом и бэкапами.
> Каждый шаг: **теория → ссылки → практика (задания) → критерий «готово»**. Не переходи дальше, пока не выполнил задания шага.
> В конце — [общий список материалов](#общий-список-материалов) по Linux, сетям, Docker, CI/CD и облакам.

---

## Схема лаборатории

```
                    ┌──────────────── Proxmox VE ────────────────┐
  LAN 192.168.1.0/24│                                             │
  ──────────────────┤  k8s-cp-1   192.168.1.101  2 vCPU / 4 GB    │  control plane
                    │  k8s-cp-2   192.168.1.102  2 vCPU / 4 GB    │  (шаг 13, HA)
                    │  k8s-cp-3   192.168.1.103  2 vCPU / 4 GB    │  (шаг 13, HA)
                    │  k8s-w-1    192.168.1.111  2 vCPU / 4 GB    │  worker
                    │  k8s-w-2    192.168.1.112  2 vCPU / 4 GB    │  worker
                    │  k8s-w-3    192.168.1.113  2 vCPU / 4 GB    │  worker (опц.)
                    │                                             │
                    │  VIP API     192.168.1.100  (kube-vip)      │
                    │  MetalLB     192.168.1.200-192.168.1.220    │
                    └──────────────────────────────────────────────┘
                     TrueNAS (NFS) — постоянные тома
```

**Минимум для старта:** 1 control plane + 2 worker = 6 vCPU, 12 ГБ RAM, ~100 ГБ диска.
**Для HA (шаг 13):** +2 control plane.

| # | Шаг | Время |
|---|-----|-------|
| 0 | [Фундамент: Linux, сети, контейнеры](#шаг-0-фундамент) | 1–2 нед |
| 1 | [Теория Kubernetes](#шаг-1-теория-kubernetes) | 3–5 дней |
| 2 | [Песочница: kind / killercoda](#шаг-2-песочница) | 2–3 дня |
| 3 | [Подготовка VM в Proxmox (cloud-init шаблон)](#шаг-3-vm-в-proxmox) | 2–3 дня |
| 4 | [Кластер kubeadm на нескольких нодах](#шаг-4-кластер-kubeadm) | 3–5 дней |
| 5 | [kubectl и базовые объекты](#шаг-5-kubectl-и-базовые-объекты) | 1 нед |
| 6 | [Конфигурация, пробы, ресурсы](#шаг-6-конфигурация-и-ресурсы) | 4–5 дней |
| 7 | [Сеть: Service, MetalLB, Ingress/Gateway, TLS](#шаг-7-сеть) | 1 нед |
| 8 | [Хранилище: PV/PVC, NFS с TrueNAS, Longhorn](#шаг-8-хранилище) | 1 нед |
| 9 | [Планирование и типы нагрузок](#шаг-9-планирование-и-нагрузки) | 4–5 дней |
| 10 | [Helm и перенос PetWeb в кластер](#шаг-10-helm-и-petweb) | 1 нед |
| 11 | [Мониторинг и логи](#шаг-11-мониторинг-и-логи) | 4–5 дней |
| 12 | [CI/CD + GitOps (GitLab CI + Argo CD)](#шаг-12-gitops) | 1 нед |
| 13 | [Безопасность: RBAC, PSA, секреты](#шаг-13-безопасность) | 1 нед |
| 14 | [HA control plane, обновления, бэкапы etcd/Velero](#шаг-14-эксплуатация-и-ha) | 1–2 нед |
| 15 | [IaC: Terraform + Ansible для всего кластера](#шаг-15-iac) | 1–2 нед |
| 16 | [Подготовка к CKA](#шаг-16-cka) | 3–4 нед |

---

## Шаг 0. Фундамент

Без этого Kubernetes превращается в набор магических заклинаний.

**Что знать:** процессы и systemd, файловые права, `ip`/`ss`/`dig`/`curl`, iptables/nftables на уровне «что такое NAT», cgroups и namespaces, Dockerfile, сети Docker, docker compose.

📚 Материалы:
- Kubernetes требует понимать контейнеры: [Docker](#docs/Linux/Docker.md) из этой Miki
- Различия Docker / containerd / CRI-O / runc — https://habr.com/ru/companies/domclick/articles/566224/
- Сети для самых маленьких — https://linkmeup.gitbook.io/sdsm
- Linux namespaces и cgroups (Red Hat) — https://www.redhat.com/en/blog/7-linux-namespaces
- Модель OSI: [Модель_OSI](#docs/Network/Модель_OSI.md)

🛠 Задания:
1. Запусти контейнер `nginx` и найди его процесс на хосте (`ps`, `lsns`), посмотри его cgroup в `/sys/fs/cgroup`.
2. Создай две сети Docker и объясни, почему контейнеры из разных сетей не видят друг друга.
3. Собери multi-stage образ бота из `bot/` и уменьши его размер.

✅ Готово, когда: можешь объяснить, чем контейнер отличается от VM, и что такое CRI.

---

## Шаг 1. Теория Kubernetes

**Ключевые понятия:** control plane (kube-apiserver, etcd, scheduler, controller-manager), нода (kubelet, kube-proxy, container runtime), декларативность и reconciliation loop, объекты и `spec`/`status`, labels/selectors, namespaces, CNI/CSI/CRI.

📚 Материалы:
- Компоненты кластера — https://kubernetes.io/docs/concepts/overview/components/
- Объекты Kubernetes — https://kubernetes.io/docs/concepts/overview/working-with-objects/
- Slurm: Kubernetes для разработчиков (видео) — https://www.youtube.com/watch?v=Mw_rEH2pElw&list=PL8D2P0ruohOBSA_CDqJLflJ8FLJNe26K-
- Артур Крюков (плейлисты) — https://www.youtube.com/@OldPythonKAA/playlists
- Комикс от Google «Smooth sailing with Kubernetes» — https://cloud.google.com/kubernetes-engine/kubernetes-comic

🛠 Задания:
1. Нарисуй схему: что происходит от `kubectl apply -f deployment.yaml` до запущенного контейнера (apiserver → etcd → controller → scheduler → kubelet → containerd).
2. Запиши в Miki конспект `Linux/Kubernetes/Архитектура.md`.

✅ Готово, когда: можешь объяснить, зачем нужен etcd и что будет, если упадёт scheduler.

---

## Шаг 2. Песочница

Перед тем как строить кластер на Proxmox — пощупай Kubernetes там, где его не жалко ломать.

📚 Материалы:
- kind (Kubernetes in Docker) — https://kind.sigs.k8s.io/docs/user/quick-start/
- Бесплатные интерактивные лабы — https://killercoda.com/playgrounds
- Шпаргалка kubectl — https://kubernetes.io/docs/reference/kubectl/quick-reference/

```bash
# кластер из 1 control plane + 2 worker в Docker
cat > kind.yaml <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
EOF
kind create cluster --name lab --config kind.yaml
kubectl get nodes -o wide
```

🛠 Задания:
1. Подними kind-кластер из 3 нод, задеплой `nginx`, сделай `kubectl port-forward` и открой в браузере.
2. Удали pod руками и посмотри, как Deployment создаёт новый.

✅ Готово, когда: уверенно используешь `get`, `describe`, `logs`, `exec`, `apply`, `delete`.

---

## Шаг 3. VM в Proxmox

Делаем cloud-init шаблон один раз и клонируем из него все ноды.

📚 Материалы:
- Proxmox Cloud-Init Support — https://pve.proxmox.com/wiki/Cloud-Init_Support
- Ubuntu cloud images — https://cloud-images.ubuntu.com/noble/current/
- `qm` manual — https://pve.proxmox.com/pve-docs/qm.1.html

На хосте Proxmox:

```bash
# 1. шаблон Ubuntu 24.04
wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
qm create 9000 --name ubuntu-2404-tpl --memory 2048 --cores 2 \
  --net0 virtio,bridge=vmbr0 --scsihw virtio-scsi-single --agent enabled=1
qm importdisk 9000 noble-server-cloudimg-amd64.img local-lvm
qm set 9000 --scsi0 local-lvm:vm-9000-disk-0,discard=on,ssd=1
qm set 9000 --ide2 local-lvm:cloudinit --boot order=scsi0 --serial0 socket --vga serial0
qm set 9000 --ciuser ubuntu --sshkeys ~/.ssh/id_ed25519.pub
qm resize 9000 scsi0 32G
qm template 9000

# 2. ноды кластера
for spec in "101 k8s-cp-1" "111 k8s-w-1" "112 k8s-w-2"; do
  set -- $spec
  qm clone 9000 $1 --name $2 --full
  qm set $1 --cores 2 --memory 4096 --ipconfig0 ip=192.168.1.$1/24,gw=192.168.1.1 \
    --nameserver 192.168.1.1
  qm start $1
done
```

> ⚠️ CPU type для VM — `host` (`qm set <id> --cpu host`), иначе некоторые CNI (Cilium) и образы с x86-64-v2 работают медленно или не стартуют.
> Включи QEMU Guest Agent в VM: `sudo apt install -y qemu-guest-agent`.

🛠 Задания:
1. Создай шаблон и 3 VM, проверь SSH на все ноды по ключу.
2. Пропиши все ноды в `/etc/hosts` (или в DNS на OpenWRT): `k8s-cp-1`, `k8s-w-1`, `k8s-w-2`.
3. Сделай снапшот всех VM «clean» — к нему удобно откатываться при экспериментах.

✅ Готово, когда: `ssh ubuntu@k8s-w-2` работает без пароля, у каждой ноды уникальные hostname, MAC и `/etc/machine-id`.

---

## Шаг 4. Кластер kubeadm

📚 Материалы:
- Установка kubeadm — https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/install-kubeadm/
- Container runtimes (containerd, cgroup driver) — https://kubernetes.io/docs/setup/production-environment/container-runtimes/
- Создание кластера — https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/
- Calico on-prem — https://docs.tigera.io/calico/latest/getting-started/kubernetes/self-managed-onprem/onpremises
- Актуальные версии — https://kubernetes.io/releases/
- Хардкорная альтернатива для понимания: Kubernetes The Hard Way — https://github.com/kelseyhightower/kubernetes-the-hard-way

### 4.1 На ВСЕХ нодах

```bash
# swap off
sudo swapoff -a && sudo sed -i '/ swap / s/^/#/' /etc/fstab

# модули и sysctl
cat <<EOF | sudo tee /etc/modules-load.d/k8s.conf
overlay
br_netfilter
EOF
sudo modprobe overlay && sudo modprobe br_netfilter
cat <<EOF | sudo tee /etc/sysctl.d/k8s.conf
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sudo sysctl --system

# containerd с systemd cgroup driver
sudo apt update && sudo apt install -y containerd
sudo mkdir -p /etc/containerd
containerd config default | sudo tee /etc/containerd/config.toml >/dev/null
sudo sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
sudo systemctl restart containerd

# kubeadm / kubelet / kubectl (подставь актуальную минорную версию)
K8S=v1.34
sudo apt install -y apt-transport-https ca-certificates curl gpg
curl -fsSL https://pkgs.k8s.io/core:/stable:/$K8S/deb/Release.key \
  | sudo gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/$K8S/deb/ /" \
  | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt update && sudo apt install -y kubelet kubeadm kubectl
sudo apt-mark hold kubelet kubeadm kubectl
```

### 4.2 На control plane

```bash
sudo kubeadm init \
  --control-plane-endpoint=192.168.1.101 \
  --pod-network-cidr=10.244.0.0/16
mkdir -p ~/.kube && sudo cp /etc/kubernetes/admin.conf ~/.kube/config && sudo chown $(id -u):$(id -g) ~/.kube/config
```

CNI (Calico через оператор; версию возьми из документации Calico):

```bash
kubectl create -f https://raw.githubusercontent.com/projectcalico/calico/v3.30.0/manifests/tigera-operator.yaml
curl -O https://raw.githubusercontent.com/projectcalico/calico/v3.30.0/manifests/custom-resources.yaml
sed -i 's#192.168.0.0/16#10.244.0.0/16#' custom-resources.yaml   # pod CIDR не должен пересекаться с LAN!
kubectl create -f custom-resources.yaml
```

### 4.3 На воркерах

```bash
# команду печатает kubeadm init; если потерял:
kubeadm token create --print-join-command
sudo kubeadm join 192.168.1.101:6443 --token ... --discovery-token-ca-cert-hash sha256:...
```

> ⚠️ Pod CIDR по умолчанию у Calico `192.168.0.0/16` пересекается с домашней сетью `192.168.1.0/24` — именно поэтому выше используем `10.244.0.0/16`.

🛠 Задания:
1. Собери кластер 1 cp + 2 worker, скопируй `~/.kube/config` к себе на ПК.
2. Запусти `kubectl run test --image=busybox -it --rm -- nslookup kubernetes.default` — проверка DNS внутри кластера.
3. Сломай и почини: останови `kubelet` на воркере, посмотри статус ноды, верни.
4. Сделай снапшот VM «kubeadm-ready».

✅ Готово, когда: `kubectl get nodes` — все `Ready`, поды `calico-*` и `coredns-*` `Running`, поды на разных нодах пингуют друг друга.

---

## Шаг 5. kubectl и базовые объекты

**Объекты:** Pod, ReplicaSet, Deployment, Service (ClusterIP), Namespace, labels/selectors/annotations.

📚 Материалы:
- Pods — https://kubernetes.io/docs/concepts/workloads/pods/
- Deployments — https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
- Service — https://kubernetes.io/docs/concepts/services-networking/service/
- Интерактивный туториал — https://kubernetes.io/docs/tutorials/kubernetes-basics/

```bash
kubectl create namespace lab
kubectl -n lab create deployment web --image=nginx:1.27 --replicas=3
kubectl -n lab expose deployment web --port=80
kubectl -n lab get pods -o wide            # поды разъехались по нодам?
kubectl -n lab set image deployment/web nginx=nginx:1.28
kubectl -n lab rollout status deployment/web
kubectl -n lab rollout undo deployment/web
```

🛠 Задания:
1. Перепиши всё выше в YAML-манифесты (используй `--dry-run=client -o yaml`), храни их в git.
2. Сделай Deployment с образом, которого не существует, разбери `ImagePullBackOff` через `describe`.
3. Сделай под, который падает (`command: ["sh","-c","exit 1"]`), разбери `CrashLoopBackOff` через `logs --previous`.
4. Поставь `k9s` и `kubectx/kubens` — https://k9scli.io/

✅ Готово, когда: пишешь Deployment + Service из головы и делаешь rolling update/rollback.

---

## Шаг 6. Конфигурация и ресурсы

**Темы:** ConfigMap, Secret, env/volume-монтирование, liveness/readiness/startup probes, requests/limits, QoS-классы, LimitRange, ResourceQuota.

📚 Материалы:
- ConfigMaps — https://kubernetes.io/docs/concepts/configuration/configmap/
- Secrets — https://kubernetes.io/docs/concepts/configuration/secret/
- Probes — https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
- Ресурсы — https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/

🛠 Задания:
1. Задеплой Telegram-бота из `bot/`: токен — в Secret, `SCHEDULE_START`/`SCHEDULE_PATTERN` — в ConfigMap.
2. Добавь nginx readiness-пробу на `/` и посмотри, как Service убирает неготовый под из Endpoints.
3. Поставь контейнеру `limits.memory: 32Mi` и заставь его упасть в `OOMKilled`.
4. Создай ResourceQuota на namespace `lab` и попробуй её превысить.

✅ Готово, когда: понимаешь разницу между requests и limits и что такое `Guaranteed`/`Burstable`/`BestEffort`.

---

## Шаг 7. Сеть

**Темы:** типы Service (ClusterIP, NodePort, LoadBalancer, Headless), CoreDNS, kube-proxy (iptables/ipvs), MetalLB для bare-metal, Ingress и Gateway API, cert-manager, NetworkPolicy.

> ℹ️ Проект **ingress-nginx** объявлен устаревшим и снят с поддержки — для новых кластеров используй **Gateway API** (Traefik, Envoy Gateway, Cilium) или Traefik как Ingress-контроллер.

📚 Материалы:
- MetalLB — https://metallb.io/installation/ и https://metallb.io/configuration/
- Gateway API — https://gateway-api.sigs.k8s.io/
- Traefik на Kubernetes — https://doc.traefik.io/traefik/getting-started/install-traefik/
- cert-manager — https://cert-manager.io/docs/installation/helm/
- cert-manager DNS-01 — https://cert-manager.io/docs/configuration/acme/dns01/
- NetworkPolicy — https://kubernetes.io/docs/concepts/services-networking/network-policies/
- Редактор NetworkPolicy — https://editor.networkpolicy.io/

MetalLB L2 для домашней сети:

```yaml
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata: { name: lan, namespace: metallb-system }
spec:
  addresses: ["192.168.1.200-192.168.1.220"]   # исключи этот диапазон из DHCP роутера!
---
apiVersion: metallb.io/v1beta2
kind: L2Advertisement
metadata: { name: lan, namespace: metallb-system }
```

🛠 Задания:
1. Установи MetalLB, получи `EXTERNAL-IP` у Service типа LoadBalancer, открой его с ПК.
2. Установи Traefik (Helm) с включённым Gateway API, опубликуй `web` по имени `lab.chepykella.ru` через `HTTPRoute`.
3. Установи cert-manager, выпусти wildcard-сертификат через DNS-01 (тот же DNS-провайдер, что в `cert.sh`).
4. Напиши NetworkPolicy «default deny» для `lab` и разреши трафик только от Traefik к `web`.

✅ Готово, когда: сервис из кластера открывается по HTTPS с валидным сертификатом, а лишний трафик режется политиками.

---

## Шаг 8. Хранилище

**Темы:** Volume, PersistentVolume, PersistentVolumeClaim, StorageClass, динамическое выделение, access modes (RWO/RWX), StatefulSet + volumeClaimTemplates.

📚 Материалы:
- Persistent Volumes — https://kubernetes.io/docs/concepts/storage/persistent-volumes/
- csi-driver-nfs — https://github.com/kubernetes-csi/csi-driver-nfs
- Longhorn — https://longhorn.io/docs/latest/deploy/install/
- StatefulSet — https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/

Вариант для HomeLab: NFS-шара на **TrueNAS** + `csi-driver-nfs`:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: truenas-nfs
  annotations: { storageclass.kubernetes.io/is-default-class: "true" }
provisioner: nfs.csi.k8s.io
parameters:
  server: 192.168.1.20        # IP TrueNAS
  share: /mnt/pool/k8s
reclaimPolicy: Retain
mountOptions: ["nfsvers=4.1"]
```

🛠 Задания:
1. Создай датасет и NFS-шару на TrueNAS (см. [TrueNAS](#docs/HomeLab/TrueNAS/Пользователи.md)), на всех нодах `apt install nfs-common`.
2. Поставь csi-driver-nfs, создай PVC, смонтируй в под, запиши файл, удали под — файл остался.
3. Задеплой PostgreSQL как StatefulSet с `volumeClaimTemplates`.
4. (опц.) Добавь каждой worker-VM второй диск и поставь Longhorn — сравни с NFS.

✅ Готово, когда: данные переживают пересоздание подов и переезд на другую ноду.

---

## Шаг 9. Планирование и нагрузки

**Темы:** DaemonSet, Job, CronJob, nodeSelector, node/pod affinity и anti-affinity, taints/tolerations, topologySpreadConstraints, PodDisruptionBudget, `cordon`/`drain`, HPA + metrics-server.

📚 Материалы:
- Назначение подов на ноды — https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
- Taints и tolerations — https://kubernetes.io/docs/concepts/scheduling-eviction/taint-and-toleration/
- PDB — https://kubernetes.io/docs/tasks/run-application/configure-pdb/
- HPA — https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/
- metrics-server — https://github.com/kubernetes-sigs/metrics-server

🛠 Задания:
1. Разнеси 3 реплики `web` строго по разным нодам (podAntiAffinity).
2. Поставь PDB `minAvailable: 2` и сделай `kubectl drain k8s-w-1` — сервис не должен моргнуть.
3. Выключи VM `k8s-w-2` в Proxmox и засеки, через сколько поды переедут. Найди, какой параметр за это отвечает.
4. Сделай CronJob, который раз в сутки бэкапит БД из шага 8 в NFS.
5. Поставь metrics-server и HPA на `web`, нагрузи через `hey`/`ab`.

✅ Готово, когда: можешь обслуживать ноду (drain → обновление → uncordon) без простоя.

---

## Шаг 10. Helm и PetWeb

**Темы:** чарты, values, шаблоны, зависимости, `helm upgrade --install`, `helm rollback`; Kustomize как альтернатива.

📚 Материалы:
- Helm quickstart — https://helm.sh/docs/intro/quickstart/
- Шаблоны чартов — https://helm.sh/docs/chart_template_guide/
- Статья про Helm (Habr) — https://habr.com/ru/articles/769046/
- Kustomize — https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/

🛠 Задания (переносим этот проект в кластер):
1. `helm create petweb` — чарт с Deployment сайта (nginx + статика из образа), Service, HTTPRoute.
2. Добавь в чарт бота (`workdays-bot`) с Secret и PVC для `vacations.json`.
3. Homepage: включи интеграцию с Kubernetes (`HomeLab/HomePage/kubernetes.yaml`) и ServiceAccount с правами на чтение.
4. Заведи `values-prod.yaml`, установи `helm upgrade --install petweb ./petweb -f values-prod.yaml`.

✅ Готово, когда: весь PetWeb (кроме мониторинга) разворачивается одной командой Helm.

---

## Шаг 11. Мониторинг и логи

📚 Материалы:
- kube-prometheus-stack — https://github.com/prometheus-community/helm-charts/tree/main/charts/kube-prometheus-stack
- Цикл статей про метрики — https://habr.com/ru/companies/tochka/articles/683608/
- Prometheus и Grafana — https://habr.com/ru/articles/709204/
- Loki — https://grafana.com/docs/loki/latest/setup/install/helm/
- Grafana Alloy (сбор логов) — https://grafana.com/docs/alloy/latest/

🛠 Задания:
1. Установи kube-prometheus-stack, открой готовые дашборды по нодам и подам.
2. Добавь `ServiceMonitor` для nginx-exporter сайта.
3. Поставь Loki + Alloy, найди в Grafana логи бота.
4. Настрой алерт `KubePodCrashLooping` в Telegram (Alertmanager → telegram_configs).

✅ Готово, когда: падение пода приходит алертом в Telegram, а причину видно в логах в Grafana.

---

## Шаг 12. GitOps

**Схема:** `git push` → GitLab CI собирает образ → пушит в registry → обновляет тег в репозитории манифестов → Argo CD синхронизирует кластер.

📚 Материалы:
- Argo CD getting started — https://argo-cd.readthedocs.io/en/stable/getting_started/
- Argo CD (Habr, KTS) — https://habr.com/ru/companies/kts/articles/723760/
- App of Apps — https://argo-cd.readthedocs.io/en/stable/operator-manual/cluster-bootstrapping/
- GitLab CI: [Гайд по GitLab](#docs/GitLab/Гайд.md)

🛠 Задания:
1. Установи Argo CD, опубликуй UI через Gateway.
2. Создай репозиторий `homelab-gitops` с чартом PetWeb и `Application` на него.
3. В GitLab CI собирай образ бота с тегом `$CI_COMMIT_SHORT_SHA` и коммить новый тег в `values-prod.yaml`.
4. Перейди на паттерн App of Apps: MetalLB, Traefik, cert-manager, мониторинг — тоже через Argo CD.

✅ Готово, когда: изменения в кластер попадают только через git, а `kubectl edit` откатывается Argo CD.

---

## Шаг 13. Безопасность

📚 Материалы:
- RBAC — https://kubernetes.io/docs/reference/access-authn-authz/rbac/
- Pod Security Admission — https://kubernetes.io/docs/concepts/security/pod-security-admission/
- Sealed Secrets — https://github.com/bitnami-labs/sealed-secrets
- Vault: база — https://habr.com/ru/companies/jetinfosystems/articles/762194/
- Vault + Kubernetes — https://habr.com/ru/companies/ru_mts/articles/880594/
- External Secrets Operator — https://external-secrets.io/latest/
- Trivy Operator — https://aquasecurity.github.io/trivy-operator/latest/

🛠 Задания:
1. Создай пользователя `dev` (сертификат через CSR API) с правами только на namespace `lab`.
2. Включи PSA `restricted` на namespace приложений и исправь манифесты (`runAsNonRoot`, `readOnlyRootFilesystem`, `drop: [ALL]`).
3. Перенеси секреты бота в Sealed Secrets (их можно хранить в git) или Vault + ESO.
4. Поставь Trivy Operator и закрой критичные уязвимости образов.

✅ Готово, когда: в git нет ни одного секрета в открытом виде, а под не может запуститься от root.

---

## Шаг 14. Эксплуатация и HA

**Темы:** HA control plane (3 ноды + VIP), бэкап и восстановление etcd, обновление кластера kubeadm, ротация сертификатов, Velero.

📚 Материалы:
- HA-топология kubeadm — https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/
- kube-vip (static pod) — https://kube-vip.io/docs/installation/static/
- Бэкап etcd — https://kubernetes.io/docs/tasks/administer-cluster/configure-upgrade-etcd/
- Обновление kubeadm — https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/
- Сертификаты kubeadm — https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-certs/
- Velero — https://velero.io/docs/

🛠 Задания:
1. Пересобери кластер в HA: `k8s-cp-1..3`, kube-vip с VIP `192.168.1.100`, `kubeadm init --control-plane-endpoint=192.168.1.100:6443 --upload-certs`.
2. Выключи в Proxmox любую cp-ноду — `kubectl` продолжает работать.
3. Сделай `etcdctl snapshot save`, удали namespace `lab`, восстанови etcd из снапшота.
4. Обнови кластер на следующую минорную версию по официальной инструкции (сначала cp, потом воркеры через drain).
5. Поставь Velero с бэкапом в MinIO на TrueNAS, восстанови namespace на «чистый» кластер.

✅ Готово, когда: переживаешь потерю любой одной ноды и умеешь восстановиться из бэкапа.

---

## Шаг 15. IaC

Всё, что сделано руками в шагах 3–4, — в код.

📚 Материалы:
- Terraform provider bpg/proxmox — https://registry.terraform.io/providers/bpg/proxmox/latest/docs
- ADV-IT Terraform — https://www.youtube.com/watch?v=R0CaxXhrfFE&list=PLg5SS_4L6LYujWDTYb-Zbofdl44Jxb2l8
- ADV-IT Ansible — https://www.youtube.com/watch?v=Ck1SGolr6GI&list=PLg5SS_4L6LYufspdPupdynbMQTBnZd31N
- Kubespray — https://github.com/kubernetes-sigs/kubespray
- (альтернатива) Talos Linux на Proxmox — https://www.talos.dev/latest/talos-guides/install/virtualized-platforms/proxmox/

🛠 Задания:
1. Terraform: VM `k8s-*` создаются из шаблона 9000 по списку в `variables.tf`.
2. Ansible: роль `k8s-prereqs` (swap, модули, sysctl, containerd, kubeadm) — шаг 4.1 одной командой.
3. Разверни кластер через Kubespray на тех же VM и сравни с ручным kubeadm.
4. Полный цикл `terraform destroy && terraform apply && ansible-playbook ... && argocd sync` — кластер с приложениями с нуля меньше чем за 30 минут.

✅ Готово, когда: кластер можно уничтожить и воссоздать без ручных действий.

---

## Шаг 16. CKA

📚 Материалы:
- Программа экзамена CKA — https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/
- Curriculum — https://github.com/cncf/curriculum
- Симулятор killer.sh (идёт с ваучером экзамена) — https://killer.sh/
- Бесплатные сценарии — https://killercoda.com/killer-shell-cka

🛠 Задания:
1. Пройди все сценарии killercoda CKA.
2. Решай задачи только через `kubectl` + документацию kubernetes.io (на экзамене больше ничего нет).
3. Настрой алиасы: `alias k=kubectl`, `export do="--dry-run=client -o yaml"`.

✅ Готово, когда: проходишь killer.sh на 80%+ за отведённое время.

---

## Финальный проект

> **PetWeb в Kubernetes:** HA-кластер из 6 нод в Proxmox, созданный Terraform + Ansible; сайт, Miki, бот и Homepage деплоятся GitLab CI → registry → Argo CD; HTTPS по wildcard-сертификату cert-manager (DNS-01); данные на TrueNAS NFS; мониторинг kube-prometheus-stack + Loki с алертами в Telegram; бэкапы etcd и Velero.

Чек-лист:
- [ ] Кластер HA (3 cp + 3 worker), VIP через kube-vip
- [ ] MetalLB + Gateway API + cert-manager
- [ ] StorageClass на TrueNAS NFS
- [ ] Helm-чарт PetWeb, App of Apps в Argo CD
- [ ] Мониторинг и алерты в Telegram
- [ ] RBAC, PSA restricted, секреты не в git
- [ ] Бэкапы etcd/Velero проверены восстановлением
- [ ] Всё описано в Miki

---

## Общий список материалов

**Linux**
- Семаев LPIC-1 — https://www.youtube.com/watch?v=rKCu-tfL730&list=PLmxB7JSpraiep6kr802UDqiAIU-76nGfc
- Основы GNU/Linux и подготовка к RHCSA — https://www.youtube.com/watch?v=acqAnwP_WZU&list=PLisqB92_b4TlQH3jVGf6lrFMVqalCTjAQ
- Кетов «Как работает Linux» — https://www.youtube.com/watch?v=V3gI8-8k8Q4&list=PLHHm04DXWzeKZycf_ZuBgxWdVBnrjE_mj

**Git**
- https://www.atlassian.com/ru/git/tutorials/what-is-git
- https://learngitbranching.js.org/

**Net/Sec**
- Сети для самых маленьких — https://linkmeup.gitbook.io/sdsm
- TLS — https://habr.com/ru/articles/332294/
- Что такое CVE — https://habr.com/ru/companies/pvs-studio/articles/678410/

**Docker**
- Docker основы — https://habr.com/ru/companies/ruvds/articles/438796/
- Различия между Docker, containerd, CRI-O и runc — https://habr.com/ru/companies/domclick/articles/566224/

**Monitoring**
- Цикл статей про метрики — https://habr.com/ru/companies/tochka/articles/683608/
- OpenSearch — https://habr.com/ru/articles/662527/
- Prometheus и Grafana — https://habr.com/ru/articles/709204/

**CI/CD**
- GitLab CI — https://habr.com/ru/articles/498436/
- [Гайд по GitLab](#docs/GitLab/Гайд.md)

**IaC**
- ADV-IT Ansible — https://www.youtube.com/watch?v=Ck1SGolr6GI&list=PLg5SS_4L6LYufspdPupdynbMQTBnZd31N

**k8s**
- Slurm Kubernetes для разработчиков — https://www.youtube.com/watch?v=Mw_rEH2pElw&list=PL8D2P0ruohOBSA_CDqJLflJ8FLJNe26K-
- Артур Крюков — https://www.youtube.com/@OldPythonKAA/playlists
- Helm — https://habr.com/ru/articles/769046/
- Vault база — https://habr.com/ru/companies/jetinfosystems/articles/762194/
- Vault с k8s — https://habr.com/ru/companies/ru_mts/articles/880594/
- Argo CD — https://habr.com/ru/companies/kts/articles/723760/

**Clouds**
- ADV-IT Terraform — https://www.youtube.com/watch?v=R0CaxXhrfFE&list=PLg5SS_4L6LYujWDTYb-Zbofdl44Jxb2l8
- Terraform Yandex Cloud — https://www.youtube.com/watch?v=y1eqR0xL1ZI
