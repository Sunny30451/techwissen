# Universelle Docker-Entwicklungsumgebung auf Contabo mit Dokploy

Eine gute Entwicklungsumgebung auf einem VPS sollte **projektneutral, reproduzierbar und sicher erweiterbar** sein. Statt einen einzigen riesigen Container mit Desktop, Android Studio, Java, Node.js und allen denkbaren Tools zu bauen, verwenden wir ein kleines Basis-Image und leiten daraus projektspezifische Images ab.

> **Zielbild:** VS Code läuft lokal auf deinem Rechner. Über **Remote SSH** verbindest du dich durch den Contabo-VPS mit dem Entwicklungscontainer. Quellcode und Benutzerverzeichnis liegen auf persistenten Docker-Volumes. Java, Android SDK oder ein kompletter RDP-Desktop werden nur bei Bedarf ergänzt.

## Architektur

```text
Contabo VPS
│
├── Ubuntu 24.04
├── Docker
├── Dokploy
│
├── dev-project-a
│   ├── Ubuntu 24.04
│   ├── Git + GitHub CLI
│   ├── Node.js 24 LTS
│   ├── OpenSSH Server
│   ├── Build Tools
│   ├── /home/dev       -> persistentes Volume
│   └── /workspace      -> persistentes Volume
│
├── dev-project-b
│   └── FROM dev-base
│       + Java
│
└── dev-android
    └── FROM dev-base
        + Java
        + Android SDK
        + optional XFCE/XRDP
        + optional Android Studio
```

### Was gehört ins Basis-Image?

| Bestandteil | Basis-Image |
| --- | --- |
| Ubuntu 24.04 | Ja |
| SSH Server | Ja |
| Git | Ja |
| GitHub CLI | Ja |
| Node.js 24 LTS | Ja |
| npm | Ja |
| Compiler/Build Tools | Ja |
| curl, wget, jq, zip | Ja |
| VS Code Server | Automatisch über Remote SSH |
| Java | Optionaler Layer |
| Android SDK | Optionaler Layer |
| Android Studio | Optionaler GUI-Layer |
| RDP/XFCE | Optionaler GUI-Layer |

## Repository-Struktur

Lege für das Basis-Image beispielsweise dieses Repository an:

```text
dev-base/
├── Dockerfile
├── docker-compose.yml
└── docker/
    ├── entrypoint.sh
    └── 99-devcontainer.conf
```

## Basis-Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM ubuntu:24.04

ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_VERSION=24.18.1
ARG DEV_UID=10001
ARG DEV_GID=10001

ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8
ENV TZ=Europe/Berlin

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        bash \
        bash-completion \
        build-essential \
        ca-certificates \
        curl \
        git \
        gnupg \
        jq \
        less \
        openssh-server \
        procps \
        rsync \
        sudo \
        unzip \
        vim \
        wget \
        xz-utils \
        zip \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p -m 755 /etc/apt/keyrings && \
    curl -fsSL \
        https://cli.github.com/packages/githubcli-archive-keyring.gpg \
        -o /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
        > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
        amd64) NODE_ARCH="x64" ;; \
        arm64) NODE_ARCH="arm64" ;; \
        *) echo "Unsupported architecture"; exit 1 ;; \
    esac; \
    cd /tmp; \
    curl -fsSLO \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"; \
    curl -fsSLO \
        "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt"; \
    grep " node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz$" \
        SHASUMS256.txt | sha256sum -c -; \
    tar -xJf \
        "node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
        -C /usr/local \
        --strip-components=1 \
        --no-same-owner; \
    rm -f \
        "node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz" \
        SHASUMS256.txt; \
    node --version; \
    npm --version

RUN groupadd --gid ${DEV_GID} dev && \
    useradd \
        --uid ${DEV_UID} \
        --gid ${DEV_GID} \
        --create-home \
        --shell /bin/bash \
        dev && \
    usermod -aG sudo dev && \
    echo "dev ALL=(ALL) NOPASSWD:ALL" \
        > /etc/sudoers.d/dev && \
    chmod 0440 /etc/sudoers.d/dev

RUN mkdir -p \
        /run/sshd \
        /run/config \
        /var/lib/devcontainer/ssh \
        /workspace && \
    chown dev:dev /workspace && \
    rm -f /etc/ssh/ssh_host_*

COPY docker/99-devcontainer.conf \
     /etc/ssh/sshd_config.d/99-devcontainer.conf

COPY docker/entrypoint.sh \
     /usr/local/bin/dev-entrypoint

RUN chmod +x /usr/local/bin/dev-entrypoint

WORKDIR /workspace
EXPOSE 22
ENTRYPOINT ["/usr/local/bin/dev-entrypoint"]
CMD ["/usr/sbin/sshd", "-D", "-e"]
```

## SSH-Konfiguration

Datei `docker/99-devcontainer.conf`:

```text
Port 22
HostKey /var/lib/devcontainer/ssh/ssh_host_ed25519_key
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
AllowUsers dev
AllowTcpForwarding yes
GatewayPorts no
X11Forwarding no
PermitTunnel no
UseDNS no
```

Damit sind Root-Login und Passwort-Anmeldung abgeschaltet. Zugriff erfolgt ausschließlich über SSH-Schlüssel. Portforwarding bleibt erlaubt, damit lokale Entwicklungsports sicher getunnelt werden können.

## Entrypoint

Datei `docker/entrypoint.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

DEV_USER="dev"
DEV_HOME="/home/dev"
AUTHORIZED_KEYS_SOURCE="/run/config/authorized_keys"
SSH_HOSTKEY_DIR="/var/lib/devcontainer/ssh"

if [[ ! -s "${AUTHORIZED_KEYS_SOURCE}" ]]; then
    echo "ERROR: ${AUTHORIZED_KEYS_SOURCE} fehlt oder ist leer."
    exit 1
fi

install -d -m 700 -o "${DEV_USER}" -g "${DEV_USER}" "${DEV_HOME}/.ssh"
install -m 600 -o "${DEV_USER}" -g "${DEV_USER}" \
    "${AUTHORIZED_KEYS_SOURCE}" \
    "${DEV_HOME}/.ssh/authorized_keys"

mkdir -p "${SSH_HOSTKEY_DIR}"

if [[ ! -f "${SSH_HOSTKEY_DIR}/ssh_host_ed25519_key" ]]; then
    ssh-keygen -q -t ed25519 -N "" \
        -f "${SSH_HOSTKEY_DIR}/ssh_host_ed25519_key"
fi

mkdir -p /workspace
chown "${DEV_USER}:${DEV_USER}" /workspace "${DEV_HOME}"
exec "$@"
```

Der SSH-Host-Key liegt auf einem persistenten Volume. Dadurch ändert sich die Host-Identität nicht bei jedem Redeploy.

## Docker Compose für Dokploy

```yaml
services:
  dev:
    build:
      context: .
      dockerfile: Dockerfile

    restart: unless-stopped

    ports:
      - "127.0.0.1:${DEV_SSH_PORT:-2222}:22"

    volumes:
      - dev-home:/home/dev
      - workspace:/workspace
      - ssh-hostkeys:/var/lib/devcontainer/ssh

    environment:
      TZ: Europe/Berlin

    working_dir: /workspace

volumes:
  dev-home:
  workspace:
  ssh-hostkeys:
```

Der entscheidende Punkt ist die Bind-Adresse:

```yaml
ports:
  - "127.0.0.1:2222:22"
```

Der SSH-Port des Containers ist damit **nur auf dem VPS selbst** erreichbar und nicht direkt aus dem Internet.

## SSH-Key erzeugen

Auf deinem lokalen Rechner:

```bash
ssh-keygen \
    -t ed25519 \
    -a 100 \
    -f ~/.ssh/contabo-dev \
    -C "contabo-dev"
```

Public Key anzeigen:

```bash
cat ~/.ssh/contabo-dev.pub
```

Nur den Public Key in Dokploy hinterlegen. Der private Schlüssel bleibt ausschließlich auf deinem Client.

## Deployment in Dokploy

1. Projekt erstellen.
2. Compose Service anlegen.
3. GitHub-Repository auswählen.
4. `./docker-compose.yml` als Compose-Datei verwenden.
5. `DEV_SSH_PORT=2222` als Environment Variable setzen.
6. Den Public Key als File Mount nach `/run/config/authorized_keys` mounten.
7. Deploy ausführen.

Für dieses Setup eignet sich Docker Compose besser als ein Stack, weil das Image direkt aus einem Dockerfile gebaut wird.

## SSH über ProxyJump

Beispiel für `~/.ssh/config` auf deinem PC:

```sshconfig
Host contabo
    HostName 123.123.123.123
    User sunny
    Port 22
    IdentityFile ~/.ssh/contabo-vps
    ServerAliveInterval 60

Host dev-base
    HostName 127.0.0.1
    User dev
    Port 2222
    IdentityFile ~/.ssh/contabo-dev
    ProxyJump contabo
    ServerAliveInterval 60
```

Danach genügt:

```bash
ssh dev-base
```

Der Verbindungsweg sieht so aus:

```text
PC
 │
 │ SSH :22
 ▼
Contabo VPS
 │
 │ localhost:2222
 ▼
Docker Container
 │
 └── SSH :22
```

Port `2222` muss dafür nicht in der externen Firewall geöffnet werden.

## VS Code Remote SSH

Auf deinem Rechner installierst du Visual Studio Code und die Erweiterung **Remote - SSH**. Anschließend:

1. `F1` drücken.
2. `Remote-SSH: Connect to Host...` auswählen.
3. `dev-base` auswählen.
4. VS Code verbindet sich über den VPS mit dem Container.
5. Beim ersten Zugriff wird der VS Code Server im Container eingerichtet.

Da `/home/dev` persistent ist, bleiben Remote-Erweiterungen, Shell-Konfiguration und viele Benutzereinstellungen erhalten.

## GitHub CLI einrichten

Im Container:

```bash
gh auth login
gh auth status
gh auth setup-git
```

Danach kannst du ein Repository direkt in den Workspace klonen:

```bash
cd /workspace
gh repo clone USER/projekt1
```

## Entwicklungsports sicher tunneln

Läuft deine Anwendung im Container beispielsweise auf Port `3000`, brauchst du dafür keinen öffentlichen Docker-Port:

```bash
ssh -L 3000:127.0.0.1:3000 dev-base
```

Danach erreichst du die Anwendung lokal über:

```text
http://localhost:3000
```

Dasselbe Prinzip funktioniert für Vite, Angular, APIs oder andere Dienste:

```bash
ssh -L 5173:127.0.0.1:5173 dev-base
ssh -L 8080:127.0.0.1:8080 dev-base
```

## Datenbanken tunneln

Ein Projekt kann neben dem Entwicklungscontainer weitere Dienste enthalten:

```yaml
services:
  dev:
    # ...

  postgres:
    image: postgres:18
    environment:
      POSTGRES_PASSWORD: example
    volumes:
      - postgres-data:/var/lib/postgresql/data

volumes:
  postgres-data:
```

Vom Dev-Container erreichst du die Datenbank unter `postgres:5432`. Für einen lokalen Datenbank-Client kannst du den Port durch SSH tunneln:

```bash
ssh -L 5432:postgres:5432 dev-base
```

Anschließend verbindet sich DBeaver oder pgAdmin lokal mit `localhost:5432`.

## Mehrere Entwicklungscontainer

Mehrere Projekte bekommen unterschiedliche localhost-Ports auf dem VPS:

```text
Projekt A -> 127.0.0.1:2222 -> Container :22
Projekt B -> 127.0.0.1:2223 -> Container :22
Projekt C -> 127.0.0.1:2224 -> Container :22
```

Deine SSH-Konfiguration kann entsprechend mehrere Hosts enthalten:

```sshconfig
Host projekt-a
    HostName 127.0.0.1
    Port 2222
    User dev
    ProxyJump contabo
    IdentityFile ~/.ssh/contabo-dev

Host projekt-b
    HostName 127.0.0.1
    Port 2223
    User dev
    ProxyJump contabo
    IdentityFile ~/.ssh/contabo-dev
```

## Basis-Image veröffentlichen und wiederverwenden

Statt den Basis-Dockerfile in jedes Projekt zu kopieren, veröffentlichst du das Image beispielsweise über GitHub Container Registry:

```text
ghcr.io/DEIN-USER/dev-base:1
ghcr.io/DEIN-USER/dev-base:1.1
ghcr.io/DEIN-USER/dev-base:ubuntu24-node24
```

Neue Images leiten sich davon ab:

```dockerfile
FROM ghcr.io/DEIN-USER/dev-base:ubuntu24-node24
```

Eine sinnvolle Hierarchie:

```text
dev-base
├── dev-node
├── dev-java
├── dev-python
└── dev-android
    └── dev-android-desktop
```

## Java ergänzen

```dockerfile
FROM ghcr.io/DEIN-USER/dev-base:ubuntu24-node24

USER root

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        openjdk-21-jdk \
        maven \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
```

Prüfen:

```bash
java --version
mvn --version
```

Für Gradle sollte möglichst der **Gradle Wrapper des Projekts** verwendet werden:

```bash
./gradlew build
```

So bestimmt das Projekt selbst die benötigte Gradle-Version.

## Python ergänzen

```dockerfile
FROM ghcr.io/DEIN-USER/dev-base:ubuntu24-node24

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        python3 \
        python3-pip \
        python3-venv \
    && rm -rf /var/lib/apt/lists/*
```

## Android SDK ergänzen

Für normale Server-Builds brauchst du nicht zwingend Android Studio. Häufig genügt das Android SDK mit den Command Line Tools.

```dockerfile
FROM ghcr.io/DEIN-USER/dev-java:latest

ARG ANDROID_CLI_VERSION=15859902
ENV ANDROID_SDK_ROOT=/opt/android-sdk
ENV PATH="${PATH}:${ANDROID_SDK_ROOT}/cmdline-tools/latest/bin:${ANDROID_SDK_ROOT}/platform-tools"

RUN curl -fsSL \
    "https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CLI_VERSION}_latest.zip" \
    -o /tmp/android-tools.zip && \
    mkdir -p ${ANDROID_SDK_ROOT}/cmdline-tools && \
    unzip -q /tmp/android-tools.zip -d /tmp/android-cli && \
    mv /tmp/android-cli/cmdline-tools \
       ${ANDROID_SDK_ROOT}/cmdline-tools/latest && \
    rm -rf /tmp/android-tools.zip /tmp/android-cli
```

Benötigte Plattform und Build Tools werden anschließend projektspezifisch installiert:

```dockerfile
RUN yes | sdkmanager --licenses && \
    sdkmanager \
        "platform-tools" \
        "platforms;android-36" \
        "build-tools;36.0.0"
```

## Android Emulator auf einem VPS

Der Android Emulator benötigt Hardware-Virtualisierung für brauchbare Performance. Auf virtuellen Servern ist dafür **Nested Virtualization** nötig. Wenn der gewählte VPS-Tarif diese Funktion nicht bereitstellt, solltest du Android-Builds auf dem Server durchführen und den Emulator lokal ausführen.

Geeignete Aufgaben auf dem Server:

- Java/Kotlin kompilieren
- Gradle Builds
- Android SDK
- Linting
- Unit Tests ohne Emulator
- APK/AAB-Erstellung

Für Emulatoren ist ein VDS oder Dedicated Server mit verfügbarer Virtualisierung häufig die bessere Wahl.

## RDP-Desktop als separater Layer

Android Studio oder andere GUI-Anwendungen sollten nicht das Basis-Image aufblähen. Dafür baust du einen eigenen Desktop-Layer:

```text
dev-base
   ↓
dev-java
   ↓
dev-android
   ↓
dev-android-desktop
       ├── XFCE
       ├── XRDP
       └── Android Studio
```

Beispiel:

```dockerfile
FROM ghcr.io/DEIN-USER/dev-base:ubuntu24-node24

USER root

RUN apt-get update && \
    apt-get install -y \
        dbus-x11 \
        supervisor \
        xfce4 \
        xfce4-terminal \
        xorgxrdp \
        xrdp \
    && rm -rf /var/lib/apt/lists/*

RUN echo "xfce4-session" > /home/dev/.xsession && \
    chown dev:dev /home/dev/.xsession && \
    adduser xrdp ssl-cert

EXPOSE 3389
```

Auch RDP sollte ausschließlich an localhost des VPS gebunden werden:

```yaml
ports:
  - "127.0.0.1:2224:22"
  - "127.0.0.1:13389:3389"
```

## RDP über SSH tunneln

Auf deinem PC:

```bash
ssh -N -L 13389:127.0.0.1:13389 contabo
```

Danach verbindest du deinen RDP-Client mit:

```text
127.0.0.1:13389
```

Port `3389` muss nicht öffentlich freigegeben werden.

## Browserbasierte Alternative mit code-server

Eine weitere Option ist eine browserbasierte VS-Code-Umgebung. `code-server` kann als eigener optionaler Layer installiert werden:

```dockerfile
RUN curl -fsSL https://code-server.dev/install.sh | sh
```

Start im Container:

```bash
code-server --bind-addr 127.0.0.1:8080 /workspace
```

Zugriff über SSH-Tunnel:

```bash
ssh -L 8080:127.0.0.1:8080 dev-base
```

Danach lokal `http://localhost:8080` aufrufen.

## Öffentliche Preview-URLs über Dokploy

Für eine rein persönliche Entwicklungsumgebung ist SSH-Portforwarding die sicherste und einfachste Methode. Wenn andere Personen eine Preview testen sollen, kann die Anwendung dagegen über Dokploy und Traefik unter einer Domain veröffentlicht werden:

```text
projekt-a-dev.example.com
```

Dafür sollte HTTPS aktiviert und bei nicht öffentlichen Projekten eine zusätzliche Authentifizierung vorgeschaltet werden.

## Docker im Entwicklungscontainer

Früher oder später willst du eventuell im Dev-Container selbst `docker build` oder `docker compose` verwenden. Das Mounten von `/var/run/docker.sock` ist technisch einfach, verleiht dem Container aber sehr weitreichenden Zugriff auf den Docker-Host.

Deshalb empfiehlt sich zunächst:

```text
GitHub
   ↓
Dokploy
   ↓
Docker Host
```

Der Entwicklungscontainer muss nicht automatisch Zugriff auf den Docker-Daemon des VPS besitzen.

## Persistente Daten

Drei Bereiche sollten persistent bleiben:

```yaml
volumes:
  dev-home:
  workspace:
  ssh-hostkeys:
```

### `/workspace`

Enthält Git-Repositories, Quellcode und Projektdateien.

### `/home/dev`

Enthält Benutzerkonfiguration, GitHub-CLI-Login, VS-Code-Server, Remote-Erweiterungen, Shell-History und Caches.

### `/var/lib/devcontainer/ssh`

Enthält den SSH-Host-Key des Containers.

Systempakete sollten dagegen **nicht manuell im laufenden Container gepflegt** werden. Dauerhafte Software gehört in den Dockerfile und wird durch einen Image-Rebuild reproduzierbar installiert.

## Beispiel eines echten Fullstack-Projekts

Angenommen ein Projekt benötigt Node.js, Java, Maven, PostgreSQL und Redis:

```dockerfile
FROM ghcr.io/DEIN-USER/dev-base:ubuntu24-node24

RUN apt-get update && \
    apt-get install -y \
        openjdk-21-jdk \
        maven \
    && rm -rf /var/lib/apt/lists/*
```

Compose:

```yaml
services:
  dev:
    build:
      context: .
      dockerfile: Dockerfile.dev
    restart: unless-stopped
    ports:
      - "127.0.0.1:2223:22"
    volumes:
      - dev-home:/home/dev
      - workspace:/workspace
      - ssh-hostkeys:/var/lib/devcontainer/ssh
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:18
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: development
      POSTGRES_DB: inventory
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    image: redis:8

volumes:
  dev-home:
  workspace:
  ssh-hostkeys:
  postgres-data:
```

Innerhalb des Dev-Containers sind die Dienste über ihre Compose-Namen erreichbar:

```text
PostgreSQL: postgres:5432
Redis:      redis:6379
```

## Empfohlene Regeln

1. **VS Code lokal + Remote SSH** als Standard verwenden.
2. **SSH und RDP niemals direkt öffentlich exponieren**; stattdessen localhost-Bindings plus SSH-Tunnel beziehungsweise ProxyJump verwenden.
3. **Basis-Image klein halten** und Java, Android sowie Desktop-Komponenten als abgeleitete Images bauen.
4. **Sourcecode und Home-Verzeichnis auf Named Volumes persistieren**.
5. **Development- und Production-Images strikt trennen**.
6. Änderungen an vorinstallierter Software immer im Dockerfile versionieren und das Image neu bauen.

Mit dieser Struktur erhältst du eine wiederverwendbare Entwicklungsplattform, die sich von einem kleinen Node.js-Projekt bis zu Java- oder Android-Build-Umgebungen schrittweise erweitern lässt.

## Weiterführende offizielle Dokumentation

- [Dokploy – Docker Compose](https://docs.dokploy.com/docs/core/docker-compose)
- [Dokploy – Domains für Docker Compose](https://docs.dokploy.com/docs/core/docker-compose/domains)
- [Visual Studio Code – Remote SSH](https://code.visualstudio.com/docs/remote/ssh)
- [Node.js – Releaseübersicht](https://nodejs.org/en/about/previous-releases)
- [GitHub CLI – Linux Installation](https://github.com/cli/cli/blob/trunk/docs/install_linux.md)
- [PostgreSQL – Versioning Policy](https://www.postgresql.org/support/versioning/)
- [PostgreSQL Docker Official Image](https://hub.docker.com/_/postgres)
- [Android Studio – Installation und Systemanforderungen](https://developer.android.com/studio/install)
- [Contabo – Nested Virtualization](https://help.contabo.com/en/support/solutions/articles/103000271595-can-i-setup-nested-virtualization-on-my-server-)

*Stand der in diesem Artikel verwendeten Versionsbeispiele: 7. August 2026.*
