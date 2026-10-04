# Backup und Wiederherstellung

Das **Originalarchiv** liegt lokal in `private/archive/`, alternativ im mit `ROOM_ARCHIVE` gesetzten Verzeichnis. Video, vollständige PLY-Datei, SOG, Startkamera und Metadaten gehören zusammen. Netlify und GitHub ersetzen dieses Archiv nicht.

## Externe Platte

Platte verbinden und ein Zielverzeichnis anlegen. In WSL ist eine Windows-Platte z.B. unter `/mnt/e` erreichbar; **Pfad selbst prüfen**.

```bash
mkdir -p /mnt/e/RoomMemories
npm run backup -- --disk /mnt/e/RoomMemories
```

Das erstellt datierte Snapshots, schreibt SHA-256-Prüfsummen und prüft die Kopie. Es löscht keine ältere Sicherung und überschreibt keine existierende Sicherung. Der zusätzliche lokale Snapshot unter `.local/backups` ist nur eine Kopie auf demselben Computer. Der Platzbedarf kann bei großen Originalvideos/Trainingsständen erheblich sein. Alte Snapshots nach eigener Prüfung manuell entfernen.

## Google Drive verschlüsselt

`rclone` installieren ([offizielle Anleitung](https://rclone.org/install/)); unter Ubuntu ist `sudo apt install rclone` möglich. Danach:

```bash
rclone config
```

1. Remote `rooms-drive` vom Typ **drive** anlegen, Google-Anmeldung selbst bestätigen. Eigenes Drive-Verzeichnis verwenden.
2. Remote `rooms-crypt` vom Typ **crypt** anlegen, Ziel `rooms-drive:RoomMemoriesEncrypted`.
3. Dateinamenverschlüsselung `standard`, Verzeichnisnamenverschlüsselung aktivieren; eigenes langes Verschlüsselungspasswort und Salt setzen.
4. rclone-Konfiguration und Verschlüsselungspasswort getrennt vom PC in deinem Passwortmanager sichern. Ohne diesen Schlüssel ist die Drive-Kopie nicht wiederherstellbar. Konfiguration niemals in dieses Repo legen.

```bash
npm run backup -- --disk /mnt/e/RoomMemories --remote rooms-crypt:backups
```

Der Befehl akzeptiert für die Cloud nur einen `crypt`-Remote. Nach dem Upload lädt er die entschlüsselte Kopie in ein temporäres Verzeichnis und verifiziert alle SHA-256-Prüfsummen. Der gesamte Übertragungsweg kann lange dauern und braucht temporären Platz. Drive verwendet dein vorhandenes Kontingent; es wird kein kostenpflichtiger Speicher gebucht.

Ohne OAuth-Anmeldung und Wahl der Platte werden diese beiden Ziele nicht als gesichert gemeldet.

## Wiederherstellen

Immer in ein **neues** Ziel, niemals ungeprüft über das bestehende Archiv:

```bash
npm run restore -- --snapshot /mnt/e/RoomMemories/SNAPSHOT_ID --to private/restored-archive
# Oder aus der verschlüsselten Drive-Kopie:
npm run restore -- --snapshot rooms-crypt:backups/SNAPSHOT_ID --to private/restored-archive
```

Das prüft Dateiliste/Prüfsummen vor und nach dem Kopieren. Vorhandene Ziele, Symlinks und beschädigte Dateien werden abgewiesen. Wiederhergestelltes Archiv testen:

```bash
ROOM_ARCHIVE="$PWD/private/restored-archive" npm run build
```

Ist alles korrekt, dasselbe `ROOM_ARCHIVE` beim Veröffentlichen verwenden. Das Zugangspasswort der Website separat sichern oder neu erzeugen; es ist absichtlich kein Bestandteil des Raumarchivs.

Automatisch geprüft: lokale Sicherung/Wiederherstellung und Ablehnung beschädigter Backups. Cloud und echte externe Platte müssen nach deiner Einrichtung einmal durchlaufen.
