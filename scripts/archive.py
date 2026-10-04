"""Versioned archive snapshots; verified restores. No destructive synchronization."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from uuid import uuid4

PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_ARCHIVE = Path(os.environ.get('ROOM_ARCHIVE', PROJECT / 'private' / 'archive')).resolve()

def digest(file):
    result = hashlib.sha256()
    with open(file, 'rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()

def files_in(root):
    result = []
    for file in sorted(root.rglob('*')):
        if file.is_symlink():
            raise ValueError(f'Symlinks im Archiv sind nicht erlaubt: {file.name}')
        if file.is_file():
            result.append(file)
    return result

def verify(snapshot):
    snapshot = Path(snapshot).resolve()
    manifest_file = snapshot / 'manifest.json'
    if manifest_file.is_symlink():
        raise ValueError('Ungültiges Manifest.')
    manifest = json.loads(manifest_file.read_text())
    if manifest.get('version') != 1 or not isinstance(manifest.get('files'), dict) or not manifest['files']:
        raise ValueError('Ungültiges oder leeres Backup-Manifest.')
    archive = snapshot / 'archive'
    if archive.is_symlink() or not archive.is_dir():
        raise ValueError('Ungültiges Archivverzeichnis im Backup.')
    expected = manifest['files']
    actual = {str(p.relative_to(archive).as_posix()) for p in files_in(archive)}
    if actual != set(expected):
        raise ValueError('Backup-Dateien stimmen nicht mit dem Manifest überein.')
    for name, checksum in expected.items():
        target = archive / name
        if Path(name).is_absolute() or '..' in Path(name).parts or not target.resolve().is_relative_to(archive.resolve()):
            raise ValueError('Unsicherer Pfad im Backup.')
        if digest(target) != checksum:
            raise ValueError(f'Prüfsumme stimmt nicht: {name}')
    return manifest

def snapshot_archive(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination.is_relative_to(source) or source.is_relative_to(destination):
        raise ValueError('Backup-Ziel und Archiv müssen getrennte Verzeichnisse sein.')
    if not source.is_dir() or not files_in(source):
        raise ValueError('Das Archiv ist leer oder fehlt. Zuerst eine Aufnahme importieren.')
    destination.mkdir(parents=True, exist_ok=True)
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid4().hex[:8]
    temporary = destination / ('.' + name + '.partial')
    final = destination / name
    try:
        shutil.copytree(source, temporary / 'archive')
        manifest = {'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(), 'files': {str(p.relative_to(temporary / 'archive').as_posix()): digest(p) for p in files_in(temporary / 'archive')}}
        (temporary / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        verify(temporary)
        temporary.rename(final)
    except Exception:
        shutil.rmtree(temporary, ignore_errors=True)
        raise
    return final

def require_crypt(remote):
    if ':' not in remote or not shutil.which('rclone'):
        raise ValueError('rclone installieren und einen crypt-Remote einrichten (docs/BACKUP.md).')
    name = remote.split(':', 1)[0]
    result = subprocess.run(['rclone', 'config', 'dump'], capture_output=True, text=True, check=True)
    # Configuration may contain secrets: never print stdout or the parsed configuration.
    config = json.loads(result.stdout)
    if config.get(name, {}).get('type') != 'crypt':
        raise ValueError('Cloud-Backups sind nur über einen rclone crypt-Remote erlaubt.')

def restore_snapshot(snapshot, destination):
    snapshot, destination = Path(snapshot).resolve(), Path(destination).resolve()
    verify(snapshot)
    if destination.is_relative_to(snapshot):
        raise ValueError('Wiederherstellung muss außerhalb des Backup-Snapshots erfolgen.')
    if destination.exists():
        raise ValueError('Wiederherstellungsziel existiert bereits. Ein neues, leeres Ziel wählen.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    stage = destination.parent / ('.restore-' + uuid4().hex)
    try:
        shutil.copytree(snapshot / 'archive', stage)
        for name, checksum in verify(snapshot)['files'].items():
            if digest(stage / name) != checksum:
                raise ValueError('Kopieren fehlgeschlagen.')
        stage.rename(destination)
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise
    return destination

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    backup = commands.add_parser('backup')
    backup.add_argument('--archive', type=Path, default=DEFAULT_ARCHIVE)
    backup.add_argument('--disk', type=Path)
    backup.add_argument('--remote', help='rclone crypt remote, e.g. rooms-crypt:backups')
    restore = commands.add_parser('restore')
    restore.add_argument('--snapshot', required=True, help='Local snapshot directory or encrypted remote:path')
    restore.add_argument('--to', type=Path, required=True)
    args = parser.parse_args()
    if args.command == 'backup':
        if not args.disk and not args.remote:
            parser.error('Mindestens --disk oder --remote angeben. Es wird kein Backup-Ziel geraten.')
        local = snapshot_archive(args.archive, PROJECT / '.local' / 'backups')
        print(f'Lokaler Snapshot geprüft: {local}')
        if args.disk:
            destination = args.disk.resolve()
            if not destination.is_dir():
                raise ValueError('Externe Platte/Ziel fehlt. Vorher verbinden und Zielverzeichnis anlegen.')
            final = destination / local.name
            if final.exists():
                raise ValueError('Snapshot-Ziel existiert bereits.')
            shutil.copytree(local, final)
            verify(final)
            print(f'Externe Kopie geprüft: {final}')
        if args.remote:
            require_crypt(args.remote)
            remote_path = args.remote.rstrip('/') + '/' + local.name
            subprocess.run(['rclone', 'copy', str(local), remote_path], check=True)
            # Check decrypted downloaded bytes, not merely provider-side ciphertext metadata.
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(['rclone', 'copy', remote_path, tmp], check=True)
                verify(Path(tmp))
            print('Verschlüsselte Cloud-Kopie durch Download und SHA-256 geprüft.')
    else:
        if ':' in args.snapshot and not Path(args.snapshot).exists():
            require_crypt(args.snapshot)
            with tempfile.TemporaryDirectory() as tmp:
                subprocess.run(['rclone', 'copy', args.snapshot, tmp], check=True)
                restore_snapshot(Path(tmp), args.to)
        else:
            restore_snapshot(Path(args.snapshot), args.to)
        print(f'Wiederhergestellt und geprüft: {args.to}')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        print(f'Backup/Wiederherstellung fehlgeschlagen: {error}')
        raise SystemExit(1)
