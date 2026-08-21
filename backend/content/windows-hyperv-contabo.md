# Windows Hyper-V und virtuelle Maschinen auf Contabo einrichten

Hyper-V ist Microsofts Typ-1-Hypervisor für Windows und Windows Server. Damit lassen sich auf einem Windows-Host isolierte virtuelle Maschinen mit Windows- oder Linux-Gastsystemen betreiben. Diese Anleitung beschreibt eine praxistaugliche Hyper-V-Umgebung auf Contabo und berücksichtigt dabei die bestehende TechWissen-/Dokploy-Infrastruktur.

Der wichtigste Punkt vorab: **Hyper-V wird nicht in einem Docker-Container und nicht über Dokploy installiert.** Hyper-V ist eine Host-Rolle des Windows-Betriebssystems und benötigt direkten Zugriff auf Hardware-Virtualisierungsfunktionen. Ein normaler Contabo VPS eignet sich dafür nicht. Contabo erlaubt Nested Virtualization nur auf Dedicated Servern und VDS; gleichzeitig weist Contabo ausdrücklich darauf hin, dass Hyper-V auf einem VDS mit Windows Server nicht funktioniert. Für einen Windows-Hyper-V-Host ist daher ein **separater Contabo Dedicated Server mit Windows Server** die empfohlene Architektur.

Der vorhandene Ubuntu-VPS mit Docker, Dokploy und TechWissen bleibt davon getrennt und kann weiterhin für Container, Reverse Proxy und Web-Anwendungen verwendet werden.

## Zielarchitektur

Die empfohlene Architektur trennt Container-Hosting und klassische Virtualisierung:

```text
Internet
   │
   ├─────────────────────────────────────┐
   │                                     │
   ▼                                     ▼
Contabo Ubuntu VPS                 Contabo Dedicated Server
Docker + Dokploy                   Windows Server 2025
Traefik                            Hyper-V
   │                                     │
   │                                     ▼
   │                              VM-NAT 192.168.100.0/24
   │                                     │
   │                         ┌───────────┼───────────┐
   │                         │           │           │
   │                         ▼           ▼           ▼
   │                       VM01        VM02        VM03
   │                      Windows      Linux      Testsystem
   │
   └── TechWissen und andere Docker-Anwendungen
```

Die Kernregeln sind:

- Der bestehende Ubuntu-/Dokploy-VPS bleibt unverändert.
- Hyper-V läuft auf einem separaten Windows-Server.
- Für einen Windows-Hyper-V-Host wird bei Contabo ein Dedicated Server empfohlen.
- Virtuelle Maschinen erhalten zunächst private IP-Adressen in einem Hyper-V-NAT-Netz.
- Die Management-Schnittstelle des Windows-Hosts wird nicht unnötig öffentlich gemacht.
- RDP wird nach Möglichkeit nur über VPN oder eine auf die eigene Quell-IP begrenzte Firewall-Regel genutzt.
- Öffentliche VM-Dienste werden gezielt freigegeben, nicht die gesamte VM.
- Hyper-V-VMs und Docker-Container bleiben logisch getrennte Plattformen.

## Warum ein normaler Contabo VPS nicht geeignet ist

Hyper-V benötigt Hardware-Virtualisierungsfunktionen wie Intel VT-x oder AMD-V, VM-Monitor-Mode-Erweiterungen und Second-Level Address Translation (SLAT).

Microsoft nennt für Hyper-V unter anderem:

- 64-Bit-Prozessor,
- SLAT,
- VM-Monitor-Mode-Erweiterungen,
- aktivierte Hardware-Virtualisierung,
- Data Execution Prevention,
- ausreichend RAM für Host und Gäste.

Auf einem virtuellen Server müssen diese Funktionen zusätzlich an die virtuelle Maschine weitergereicht werden. Das wird als **Nested Virtualization** bezeichnet.

Contabo dokumentiert aktuell:

```text
VPS
→ keine Nested Virtualization

VDS
→ Nested Virtualization grundsätzlich möglich
→ aber Hyper-V mit Windows Server laut Contabo nicht funktionsfähig

Dedicated Server
→ Nested Virtualization / Hyper-V geeignet
```

Für diese Anleitung wird deshalb von einem **Contabo Dedicated Server mit Windows Server** ausgegangen.

## Verhältnis zu ContaboVpsDokploy

Die vorhandene TechWissen-Infrastruktur basiert auf:

```text
Ubuntu VPS
Docker
Dokploy
Traefik
```

Hyper-V gehört nicht in diesen Stack.

Nicht versuchen:

```text
Ubuntu VPS
└── Docker
    └── Windows Hyper-V
```

und auch nicht:

```text
Dokploy
└── Hyper-V Container
```

Beides entspricht nicht dem Hyper-V-Betriebsmodell.

Stattdessen:

```text
Server A
Ubuntu + Dokploy

Server B
Windows Server + Hyper-V
```

Diese Trennung ist auch betrieblich sinnvoll: Ein Fehler oder Neustart des Hyper-V-Hosts beeinflusst die Dokploy-Plattform nicht und umgekehrt.

## Voraussetzungen

Für die Anleitung werden benötigt:

- Contabo Dedicated Server,
- Windows Server 2025 oder eine andere unterstützte Windows-Server-Version,
- Administratorzugriff auf Windows,
- genügend CPU-Kerne,
- genügend RAM für Host und alle gleichzeitig laufenden VMs,
- genügend NVMe-/SSD-Speicher,
- ISO-Datei des gewünschten Gastbetriebssystems,
- eine Backup-Strategie außerhalb des Hyper-V-Hosts.

Für Windows-Lizenzen gilt zusätzlich: Contabo erlaubt eigene Windows-Lizenzen auf Dedicated Servern. Auf VPS und VDS müssen dagegen die von Contabo bereitgestellten Windows-Server-Lizenzen verwendet werden.

Für Windows-Gast-VMs müssen die jeweiligen Microsoft-Lizenzrechte separat geprüft werden.

## Ressourcen planen

Eine VM benötigt mindestens:

```text
vCPU
RAM
virtuelle Festplatte
Netzwerk
```

Beispiel für einen kleineren Testhost:

```text
Windows Host             4–8 GB RAM Reserve
VM01 Windows Server      4 GB RAM
VM02 Ubuntu Server       2–4 GB RAM
VM03 Testsystem          4 GB RAM
```

Bei 16 GB physischem RAM wäre diese Konfiguration bereits knapp.

Für ernsthafte Hyper-V-Nutzung sind 32 GB RAM oder mehr wesentlich angenehmer.

Wichtig: Der Host benötigt immer eigene Ressourcen. Weise nicht den gesamten physischen RAM den virtuellen Maschinen zu.

## Hyper-V-Anforderungen prüfen

PowerShell oder Eingabeaufforderung als Administrator öffnen:

```powershell
systeminfo.exe
```

Am Ende der Ausgabe befindet sich der Abschnitt:

```text
Hyper-V Requirements
```

Auf einem geeigneten Host müssen die Hardwareanforderungen erfüllt sein.

Alternativ können die mitgelieferten Prüfscripte verwendet werden:

```powershell
.\scripts\01-check-hyperv-requirements.ps1
```

Wenn bereits ein Hypervisor aktiv ist, zeigt `systeminfo` statt der einzelnen Anforderungen an, dass ein Hypervisor erkannt wurde.

## Hyper-V installieren

PowerShell als Administrator starten:

```powershell
Install-WindowsFeature `
  -Name Hyper-V `
  -IncludeManagementTools `
  -Restart
```

Der Server startet dabei neu.

Nach dem Neustart prüfen:

```powershell
Get-WindowsFeature Hyper-V
```

Erwartet wird:

```text
Installed
```

Hyper-V Manager öffnen:

```text
virtmgmt.msc
```

oder über:

```text
Server Manager
→ Tools
→ Hyper-V Manager
```

## Hyper-V-Verzeichnisse festlegen

VM-Dateien sollten nicht ungeordnet unter dem Systemlaufwerk liegen.

Beispiel:

```text
D:\Hyper-V\
├── Virtual Machines\
├── Virtual Hard Disks\
├── ISO\
└── Exports\
```

Standardpfade können gesetzt werden:

```powershell
Set-VMHost `
  -VirtualMachinePath "D:\Hyper-V\Virtual Machines" `
  -VirtualHardDiskPath "D:\Hyper-V\Virtual Hard Disks"
```

Prüfen:

```powershell
Get-VMHost |
  Select-Object VirtualMachinePath, VirtualHardDiskPath
```

## Netzwerkstrategie

Hyper-V unterstützt unter anderem:

```text
External Switch
Internal Switch
Private Switch
```

### External Switch

Eine VM hängt unmittelbar an einem physischen Netzwerkadapter des Hosts.

Das ist auf einem Remote-Server riskant, weil eine fehlerhafte Switch-Konfiguration die Management-Verbindung des Hosts unterbrechen kann. Zusätzlich können Hosting-Provider Einschränkungen bezüglich zusätzlicher MAC-Adressen oder IP-Adressen haben.

### Internal Switch mit NAT

Für einen Contabo-Server ist ein internes NAT-Netz ein guter Ausgangspunkt:

```text
Internet
   │
   ▼
Windows Host
öffentliche IP
   │
   │ NAT
   ▼
192.168.100.0/24
   │
   ├── VM01 192.168.100.10
   ├── VM02 192.168.100.11
   └── VM03 192.168.100.12
```

Die VMs verwenden die öffentliche IP des Hosts für ausgehenden Datenverkehr. Eingehende Verbindungen werden nur bei Bedarf gezielt weitergeleitet.

## Internes NAT-Netz erstellen

PowerShell als Administrator:

```powershell
New-VMSwitch `
  -Name "VM-NAT" `
  -SwitchType Internal
```

Interface ermitteln:

```powershell
Get-NetAdapter
```

Der Adapter heißt normalerweise:

```text
vEthernet (VM-NAT)
```

Gateway-IP setzen:

```powershell
New-NetIPAddress `
  -IPAddress 192.168.100.1 `
  -PrefixLength 24 `
  -InterfaceAlias "vEthernet (VM-NAT)"
```

NAT konfigurieren:

```powershell
New-NetNat `
  -Name "VM-NAT" `
  -InternalIPInterfaceAddressPrefix "192.168.100.0/24"
```

Prüfen:

```powershell
Get-VMSwitch
Get-NetNat
Get-NetIPAddress `
  -InterfaceAlias "vEthernet (VM-NAT)"
```

Microsoft weist darauf hin, dass WinNAT derzeit nur ein NAT-Netz pro Host unterstützt. Plane das Subnetz daher ausreichend groß.

## Erste virtuelle Maschine erstellen

Beispiel:

```text
Name:       VM-WIN01
Generation: 2
RAM:        4 GB
CPU:        2
Disk:       80 GB
Switch:     VM-NAT
```

PowerShell:

```powershell
$vmName = "VM-WIN01"
$vmPath = "D:\Hyper-V\Virtual Machines\$vmName"
$vhdPath = "D:\Hyper-V\Virtual Hard Disks\$vmName.vhdx"

New-VM `
  -Name $vmName `
  -Generation 2 `
  -MemoryStartupBytes 4GB `
  -NewVHDPath $vhdPath `
  -NewVHDSizeBytes 80GB `
  -SwitchName "VM-NAT" `
  -Path $vmPath

Set-VMProcessor `
  -VMName $vmName `
  -Count 2
```

Für moderne Betriebssysteme sollte grundsätzlich **Generation 2** verwendet werden, sofern das Gastbetriebssystem sie unterstützt.

## Dynamischen Arbeitsspeicher konfigurieren

Beispiel:

```powershell
Set-VMMemory `
  -VMName "VM-WIN01" `
  -DynamicMemoryEnabled $true `
  -MinimumBytes 2GB `
  -StartupBytes 4GB `
  -MaximumBytes 8GB
```

Das erlaubt Hyper-V, den Speicherbedarf dynamisch anzupassen.

Für Anwendungen mit sehr vorhersehbarem Speicherbedarf kann statischer RAM geeigneter sein.

## ISO einbinden

ISO-Datei beispielsweise nach:

```text
D:\Hyper-V\ISO\WindowsServer.iso
```

kopieren.

DVD-Laufwerk hinzufügen:

```powershell
Add-VMDvdDrive `
  -VMName "VM-WIN01" `
  -Path "D:\Hyper-V\ISO\WindowsServer.iso"
```

DVD als erstes Bootgerät festlegen:

```powershell
$dvd = Get-VMDvdDrive -VMName "VM-WIN01"

Set-VMFirmware `
  -VMName "VM-WIN01" `
  -FirstBootDevice $dvd
```

VM starten:

```powershell
Start-VM "VM-WIN01"
```

Konsole öffnen:

```powershell
vmconnect.exe localhost VM-WIN01
```

## Netzwerk im Gast konfigurieren

Ein internes Hyper-V-NAT-Netz stellt nicht automatisch einen DHCP-Server bereit.

Beispiel für die erste VM:

```text
IP:       192.168.100.10
Maske:    255.255.255.0
Gateway:  192.168.100.1
DNS:      1.1.1.1
           9.9.9.9
```

Zweite VM:

```text
192.168.100.11
```

Dritte VM:

```text
192.168.100.12
```

Alle VMs verwenden:

```text
Gateway 192.168.100.1
```

Danach aus der VM testen:

```powershell
Test-NetConnection 1.1.1.1 -Port 443
```

und:

```powershell
Resolve-DnsName microsoft.com
```

## Öffentlichen Dienst einer VM bereitstellen

Angenommen VM01 betreibt HTTPS:

```text
VM-IP:       192.168.100.10
VM-Port:     443
Host-Port:   8443
```

Portweiterleitung:

```powershell
Add-NetNatStaticMapping `
  -NatName "VM-NAT" `
  -Protocol TCP `
  -ExternalIPAddress "0.0.0.0/0" `
  -ExternalPort 8443 `
  -InternalIPAddress "192.168.100.10" `
  -InternalPort 443
```

Prüfen:

```powershell
Get-NetNatStaticMapping
```

Zusätzlich muss die Windows Firewall des Hosts diesen Port erlauben:

```powershell
New-NetFirewallRule `
  -DisplayName "Hyper-V VM01 HTTPS 8443" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 8443 `
  -Action Allow
```

Für produktive Dienste sollte zusätzlich geprüft werden, ob der Dienst direkt über eine eigene IP, einen Reverse Proxy oder ein VPN bereitgestellt werden soll.

## RDP nicht ungeschützt veröffentlichen

Nicht empfohlen:

```text
Internet
→ Host:3389
→ VM:3389
```

Besser:

```text
VPN
→ Windows Host
→ VM
```

oder die Windows-Firewall auf die eigene öffentliche Quell-IP beschränken.

Beispiel für eine begrenzte Host-Regel:

```powershell
New-NetFirewallRule `
  -DisplayName "RDP from admin IP" `
  -Direction Inbound `
  -Protocol TCP `
  -LocalPort 3389 `
  -RemoteAddress "DEINE_OEFFENTLICHE_IP/32" `
  -Action Allow
```

Vor Änderungen an Remote-Firewall oder Netzwerk immer eine funktionierende Contabo-Konsole/Rescue-Möglichkeit bereithalten.

## VM-Verwaltung per PowerShell

Alle VMs anzeigen:

```powershell
Get-VM
```

Starten:

```powershell
Start-VM VM-WIN01
```

Sauber herunterfahren:

```powershell
Stop-VM VM-WIN01
```

Erzwungen ausschalten:

```powershell
Stop-VM VM-WIN01 -TurnOff
```

Das entspricht einem harten Ausschalten und sollte nur verwendet werden, wenn ein reguläres Herunterfahren nicht möglich ist.

VM neu starten:

```powershell
Restart-VM VM-WIN01
```

Status:

```powershell
Get-VM VM-WIN01 |
  Select-Object Name, State, CPUUsage, MemoryAssigned, Uptime
```

## Checkpoints

Checkpoint erstellen:

```powershell
Checkpoint-VM `
  -Name "VM-WIN01" `
  -SnapshotName "vor-update"
```

Anzeigen:

```powershell
Get-VMSnapshot VM-WIN01
```

Checkpoint löschen:

```powershell
Remove-VMSnapshot `
  -VMName "VM-WIN01" `
  -Name "vor-update"
```

Checkpoints sind **kein Backup**. Sie befinden sich auf demselben Storage und dienen vor allem kurzfristigen Rollback-Szenarien.

## VM exportieren

Für eine portable Kopie:

```powershell
Export-VM `
  -Name "VM-WIN01" `
  -Path "E:\Hyper-V-Backups"
```

Ein vollständiges Backupkonzept sollte zusätzlich externe oder räumlich getrennte Speicherung verwenden.

## Deployment in Dokploy

Hyper-V selbst wird nicht über Dokploy deployt.

Die Rollen bleiben getrennt:

```text
Dokploy
→ Docker-/Compose-Anwendungen auf Ubuntu

Hyper-V
→ virtuelle Maschinen auf Windows Server
```

Das ist eine bewusste Ausnahme von den üblichen TechWissen-Dokploy-Anleitungen.

Wenn eine Hyper-V-VM später einen Webdienst bereitstellt, gibt es drei typische Varianten:

### Variante 1: direkt über den Hyper-V-Host

```text
Internet
→ Windows Host Port
→ NAT
→ VM
```

Einfach, aber jeder Dienst benötigt eine eigene Firewall-/NAT-Regel.

### Variante 2: eigene öffentliche IP für die VM

Wenn Contabo für den konkreten Server zusätzliche IP-/Netzwerkoptionen bereitstellt und das Netzwerkmodell dies erlaubt, kann eine VM direkt routbar gemacht werden.

Diese Konfiguration muss mit der konkreten Contabo-Netzwerkkonfiguration abgestimmt werden.

### Variante 3: Reverse Proxy über den bestehenden Dokploy-VPS

Fortgeschritten:

```text
Internet
   │
   ▼
Dokploy / Traefik
   │
   │ privates VPN / Routing
   ▼
Hyper-V VM
```

Dafür benötigt der Ubuntu-/Dokploy-VPS eine private, abgesicherte Netzwerkverbindung zum Hyper-V-Host bzw. zur VM, beispielsweise über ein VPN.

Ein Docker-Compose-Service kann eine externe Hyper-V-VM nicht automatisch über das normale Compose-Netz `service:port` erreichen.

## Deployment prüfen

Hyper-V-Rolle:

```powershell
Get-WindowsFeature Hyper-V
```

Host:

```powershell
Get-VMHost
```

Switch:

```powershell
Get-VMSwitch
```

NAT:

```powershell
Get-NetNat
```

VMs:

```powershell
Get-VM
```

Virtuelle Festplatten:

```powershell
Get-VMHardDiskDrive -VMName VM-WIN01
```

Netzwerkadapter:

```powershell
Get-VMNetworkAdapter -VMName VM-WIN01
```

Portweiterleitungen:

```powershell
Get-NetNatStaticMapping
```

## Sicherheitskonzept

### Hyper-V-Host schlank halten

Auf dem Hyper-V-Host sollten möglichst wenige zusätzliche Anwendungen installiert werden.

Nicht gleichzeitig als allgemeiner Desktop-, Download- oder Entwicklungsserver verwenden.

### Managementzugang absichern

Bevorzugt:

```text
VPN
→ RDP / PowerShell Remoting / Hyper-V Manager
```

Wenn RDP öffentlich erreichbar sein muss:

- Quell-IP einschränken,
- Network Level Authentication verwenden,
- starke Zugangsdaten verwenden,
- Windows aktuell halten,
- keine Standard-Administratornamen verwenden,
- Loginversuche überwachen.

### VMs isolieren

Nicht jede VM benötigt einen öffentlichen Dienst.

Standard:

```text
VM
→ NAT
→ Internet outbound
```

Ingress nur gezielt freigeben.

### Keine unnötigen Portweiterleitungen

Regelmäßig prüfen:

```powershell
Get-NetNatStaticMapping
```

Nicht mehr benötigte Regeln entfernen:

```powershell
Remove-NetNatStaticMapping
```

### Windows Firewall aktiv lassen

Die Firewall nicht pauschal deaktivieren.

Stattdessen nur benötigte Ports freigeben.

## Backup-Strategie

Zu sichern sind mindestens:

```text
VM-Konfigurationen
VHDX-Dateien
Anwendungsdaten innerhalb der Gäste
wichtige Host-Konfigurationen
```

Eine VM auf derselben NVMe-Platte zu exportieren ist noch kein vollständiges Backup.

Empfehlung:

```text
Hyper-V Storage
      │
      ├── lokales Backup / Export
      │
      └── zusätzlich externes Backup
```

Für Datenbanken innerhalb einer VM sollten außerdem applikationskonsistente Datenbank-Backups erstellt werden.

## Updates

### Windows Host

Updates regelmäßig einspielen.

Vor größeren Hyper-V-/Windows-Updates:

1. Backupstatus prüfen.
2. kritische VMs sauber herunterfahren oder absichern.
3. Wartungsfenster planen.
4. Windows Update durchführen.
5. Host neu starten.
6. Hyper-V und VMs prüfen.

### Gast-VMs

Gastbetriebssysteme unabhängig vom Host aktualisieren.

Ein aktueller Hyper-V-Host ersetzt keine Updates innerhalb der VMs.

## Troubleshooting

### Hyper-V kann nicht installiert werden

Fehler beispielsweise:

```text
virtualization support is not enabled
```

Prüfen:

```powershell
systeminfo.exe
```

Auf einem normalen Contabo VPS ist das erwartbar, da keine Nested Virtualization verfügbar ist.

Auf einem Windows-VDS weist Contabo aktuell ebenfalls darauf hin, dass Hyper-V nicht funktioniert.

### VM hat kein Internet

Prüfen:

```powershell
Get-VMSwitch
Get-NetNat
Get-NetIPAddress -InterfaceAlias "vEthernet (VM-NAT)"
```

In der VM prüfen:

```text
IP:      192.168.100.x
Gateway: 192.168.100.1
DNS:     gesetzt
```

### VM ist vom Internet nicht erreichbar

Das ist im NAT-Modell zunächst absichtlich so.

Prüfen:

```powershell
Get-NetNatStaticMapping
Get-NetFirewallRule
```

### VM startet nicht

Prüfen:

```powershell
Get-VM VM-WIN01
Get-VMHardDiskDrive VM-WIN01
Get-VMNetworkAdapter VM-WIN01
```

Event Viewer:

```text
Applications and Services Logs
→ Microsoft
→ Windows
→ Hyper-V-VMMS
```

### Host verliert nach Netzwerkkonfiguration die Verbindung

Deshalb verwendet diese Anleitung standardmäßig einen **Internal Switch + NAT**.

Ein External Switch bindet sich an einen physischen Netzwerkadapter und sollte auf einem Remote-Server nur nach genauer Planung eingerichtet werden.

## PowerShell-Paket

Zu dieser Anleitung gehört ein ZIP-Paket mit wiederverwendbaren Scripts:

```text
windows-hyperv-toolkit/
├── README.md
└── scripts/
    ├── 01-check-hyperv-requirements.ps1
    ├── 02-install-hyperv.ps1
    ├── 03-create-nat-network.ps1
    ├── 04-create-vm.ps1
    ├── 05-add-port-forward.ps1
    └── 06-export-vm.ps1
```

Die Scripts sind parametrisiert und können für weitere VMs angepasst werden.

## Produktionscheckliste

- [ ] Contabo Dedicated Server statt normalem VPS verwenden
- [ ] Windows Server als Hyper-V-Host installiert
- [ ] Hyper-V-Anforderungen mit `systeminfo` geprüft
- [ ] Hyper-V-Rolle installiert
- [ ] Host-Updates eingespielt
- [ ] VM-Storage geplant
- [ ] ausreichend Host-RAM reserviert
- [ ] internes NAT-Netz angelegt
- [ ] keine unnötigen External Switches angelegt
- [ ] VMs mit statischen privaten IPs konfiguriert
- [ ] RDP-Zugriff abgesichert
- [ ] Windows Firewall aktiv
- [ ] nur notwendige NAT-Portweiterleitungen eingerichtet
- [ ] VM-Backups außerhalb des Hosts vorhanden
- [ ] Restore getestet
- [ ] Checkpoints nicht als Backup missverstanden
- [ ] Windows-Gastlizenzen geprüft
- [ ] bestehender Ubuntu-/Dokploy-VPS bleibt getrennt

## Empfohlene endgültige Architektur

```text
Contabo Infrastruktur
│
├── Ubuntu VPS
│   ├── Docker
│   ├── Dokploy
│   ├── Traefik
│   └── TechWissen / Container-Apps
│
└── Dedicated Windows Server
    ├── Windows Server 2025
    ├── Hyper-V
    ├── VM-NAT 192.168.100.0/24
    │   ├── VM01 192.168.100.10
    │   ├── VM02 192.168.100.11
    │   └── VM03 192.168.100.12
    ├── VM Storage
    └── externe Backups
```

Diese Trennung hält Docker-Workloads und klassische virtuelle Maschinen sauber auseinander und berücksichtigt gleichzeitig die aktuellen Contabo-Einschränkungen für Nested Virtualization.

## Quellen

- Contabo: Nested Virtualization auf VPS, VDS und Dedicated Servern: https://help.contabo.com/en/support/solutions/articles/103000271595-can-i-setup-nested-virtualization-on-my-server-
- Contabo: Windows-Lizenzen auf VPS, VDS und Dedicated Servern: https://help.contabo.com/en/support/solutions/articles/103000270398-can-i-use-my-own-windows-license-on-my-contabo-server-
- Microsoft: Hyper-V System Requirements: https://learn.microsoft.com/windows-server/virtualization/hyper-v/host-hardware-requirements
- Microsoft: Hyper-V installieren: https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/install-hyper-v
- Microsoft: virtuelle Maschine erstellen: https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/create-a-virtual-machine-in-hyper-v
- Microsoft: virtuellen Switch erstellen: https://learn.microsoft.com/windows-server/virtualization/hyper-v/get-started/create-a-virtual-switch-for-hyper-v-virtual-machines
- Microsoft: NAT-Netz für Hyper-V: https://learn.microsoft.com/windows-server/virtualization/hyper-v/setup-nat-network
- Microsoft: Add-NetNatStaticMapping: https://learn.microsoft.com/powershell/module/netnat/add-netnatstaticmapping
