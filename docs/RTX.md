# Handyvideo auf dem RTX-PC verarbeiten

Die Rekonstruktion läuft auf dem separaten NVIDIA-PC, die Website auch auf dem Laptop.
Der vorbereitete Weg nutzt **Nerfstudio 1.1.5 / Splatfacto** im offiziellen Linux-Docker-Image.
FFmpeg und COLMAP sind enthalten. Kein Nerfstudio-Fork und keine eigene Trainingsimplementierung sind nötig.
Eine GPU-Installation kann erst auf deinem RTX-PC geprüft werden.

## Einmalig unter Windows

1. Aktuellen NVIDIA-Windows-Treiber installieren.
2. In PowerShell `wsl --install -d Ubuntu-24.04` ausführen, falls WSL2 fehlt. Windows kann Administratorrechte/Neustart verlangen. Alternativ `scripts/setup-windows.ps1` starten.
3. [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) installieren/starten. Linux-Container, WSL2-Backend und Integration für Ubuntu aktivieren. Die persönliche Nutzung fällt unter die kostenlose Docker-Desktop-Lizenz; andere Organisationen müssen die Docker-Lizenzbedingungen prüfen.
4. In Ubuntu im Linux-Home arbeiten, nicht im langsamen `/mnt/c`-Projektverzeichnis:

```bash
git clone https://github.com/Mjakinin/room-memories.git
cd room-memories
bash scripts/setup-rtx.sh
```

Der Setup-Befehl lädt mehrere GB, prüft CUDA und hält den konkreten Image-Digest lokal fest.
Keinen Linux-NVIDIA-Anzeigetreiber in WSL installieren: die GPU wird durch den Windows-Treiber bereitgestellt.
Das Setup startet noch keine Rekonstruktion.

## Aufnehmen und rechnen

Langsam durch den Raum gehen, mehrere Blickrichtungen und Höhen aufnehmen. Seitliche Bewegung hilft der Tiefenrekonstruktion. Nur auf der Stelle drehen reicht häufig nicht.
Licht möglichst konstant halten, Personen/Tiere vermeiden, digitale Zoomwechsel vermeiden. Spiegel und gleichförmige Wände bleiben schwierig. Aufnahmeflächen müssen im Video sichtbar sein; verdeckte Rückseiten werden nicht zuverlässig rekonstruiert.

```bash
python3 scripts/process-video.py \
  --video /mnt/c/Users/DEIN_NAME/Videos/wohnzimmer.mp4 \
  --id berlin-wohnzimmer --frames 350 --iterations 30000
```

Die Stufen sind:

1. Originalvideo kopieren und erhalten.
2. `ns-process-data video`: FFmpeg-Frames + COLMAP-Kameraposen, sequenzielles Matching.
3. `ns-train splatfacto`: Gaussian Splatting, ohne offen wartenden Trainingsviewer.
4. `ns-export gaussian-splat`: vollständige PLY-Datei exportieren.

Alles liegt unter `private/archive/captures/berlin-wohnzimmer/`: Originalvideo, Daten/Kameraposen, Training, Konfiguration, Logs, Export und `processing.json`. Nur tatsächlich ausgeführte Stufen erhalten Laufzeiten. Beim Fehler bleiben Original und Logs erhalten; erneuter Versuch bekommt eine neue ID. COLMAP kann bei ungeeigneten Videos scheitern, auch wenn CUDA funktioniert.

PLY danach in [SuperSplat](https://superspl.at/editor) öffnen, unnötige Punkte entfernen, Startkamera setzen, Vorschaubild erstellen und Viewer-Einstellungen exportieren. Private Aufnahmen möglichst in einer lokalen SuperSplat-Instanz bearbeiten; einen Export nicht auf superspl.at veröffentlichen. Anleitung im [SuperSplat-Repository](https://github.com/playcanvas/supersplat).

## Ein Raum oder ganze Wohnung?

Zuerst einen Raum testen. Eine Wohnung ist möglich, braucht aber zusammenhängende Kamerapfade mit Überlappung durch Türen und wird größer. Zimmer können in derselben Wohnungskategorie getrennt gespeichert werden; eine zusätzliche Aufnahme mit `--kind apartment` ist ebenfalls möglich. Dateien werden nicht automatisch geometrisch zu einer Wohnung zusammengefügt.

## Späterer Vergleich

[LichtFeld Studio](https://github.com/MrNeRF/LichtFeld-Studio) mit denselben Bildern/Kameraposen testen. Die Laufzeit allein ist kein Qualitätsmaß: gleiche Startansichten, Details, Löcher, Artefakte und Web-Dateigröße vergleichen. Keine Änderungen am Quellcode nötig.

Ein optionaler [Brush](https://github.com/ArthurBrussee/brush)-Test bleibt für den Vulkan-Laptop vorgesehen. Das Laptop-Training ist kein Bestandteil des verifizierten RTX-Setups.

Quellen: [Nerfstudio-Installation](https://docs.nerf.studio/quickstart/installation.html), [Splatfacto](https://docs.nerf.studio/nerfology/methods/splat.html), [offizielles Dockerfile](https://github.com/nerfstudio-project/nerfstudio/blob/v1.1.5/Dockerfile), [NVIDIA CUDA in WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html).
