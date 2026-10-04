"""Run the existing Nerfstudio video -> COLMAP -> Splatfacto -> Gaussian PLY pipeline."""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time

PROJECT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--video', type=Path, required=True)
    parser.add_argument('--id', required=True)
    parser.add_argument('--frames', type=int, default=350)
    parser.add_argument('--iterations', type=int, default=30000)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', args.id):
        parser.error('ID: Kleinbuchstaben, Ziffern und Bindestriche verwenden.')
    if not args.video.is_file() or args.frames < 50 or args.iterations < 100:
        parser.error('Video fehlt oder Frames/Iterationen sind zu klein.')
    if not shutil.which('docker'):
        parser.error('Zuerst bash scripts/setup-rtx.sh ausführen.')
    digest_file = PROJECT / '.local' / 'nerfstudio-image.txt'
    if not digest_file.exists():
        parser.error('Zuerst bash scripts/setup-rtx.sh ausführen.')
    image = digest_file.read_text().strip()
    root = Path(os.environ.get('ROOM_ARCHIVE', PROJECT / 'private' / 'archive')).resolve() / 'captures' / args.id
    root.mkdir(parents=True, exist_ok=False)
    (root / 'input').mkdir()
    source = root / 'input' / ('video' + args.video.suffix.lower())
    shutil.copy2(args.video, source)
    metrics = {'version': 1, 'startedAt': datetime.now(timezone.utc).isoformat(), 'image': image, 'framesRequested': args.frames, 'iterations': args.iterations, 'stages': [], 'status': 'running'}
    def save():
        (root / 'processing.json').write_text(json.dumps(metrics, indent=2) + '\n')
    def run(name, command):
        started = time.monotonic()
        base = ['docker', 'run', '--rm', '--gpus', 'all', '--shm-size', '8g', '--user', f'{os.getuid()}:{os.getgid()}', '-e', 'HOME=/tmp', '-e', 'QT_QPA_PLATFORM=offscreen', '-e', 'MPLCONFIGDIR=/tmp/matplotlib', '-v', f'{root}:/workspace', '-w', '/workspace', image]
        with open(root / f'{name}.log', 'w') as log:
            process = subprocess.Popen(base + command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            for line in process.stdout:
                print(line, end='', flush=True); log.write(line)
            result = process.wait()
        metrics['stages'].append({'name': name, 'seconds': round(time.monotonic() - started, 2), 'exitCode': result})
        save()
        if result:
            raise RuntimeError(f'{name} fehlgeschlagen. Details: {root / (name + ".log")}')
    save()
    try:
        run('versions', ['python', '-c', 'import importlib.metadata as m,torch; print("nerfstudio",m.version("nerfstudio")); print("gsplat",m.version("gsplat")); print("torch",torch.__version__); print("GPU",torch.cuda.get_device_name(0))'])
        run('prepare', ['ns-process-data', 'video', '--data', '/workspace/input/' + source.name, '--output-dir', '/workspace/data', '--num-frames', str(args.frames), '--matching-method', 'sequential'])
        run('train', ['ns-train', 'splatfacto', '--data', '/workspace/data', '--output-dir', '/workspace/outputs', '--max-num-iterations', str(args.iterations), '--vis', 'tensorboard'])
        configs = list((root / 'outputs').rglob('config.yml'))
        if len(configs) != 1:
            raise RuntimeError('Training-Konfiguration konnte nicht eindeutig bestimmt werden.')
        config = '/workspace/' + configs[0].relative_to(root).as_posix()
        run('export', ['ns-export', 'gaussian-splat', '--load-config', config, '--output-dir', '/workspace/export'])
        metrics['status'] = 'complete'
        metrics['files'] = [{'name': str(p.relative_to(root)), 'bytes': p.stat().st_size} for p in (root / 'export').glob('*.ply')]
        save()
        print(f'Fertig. Originalvideo, Training, PLY und echte Messwerte liegen in {root}')
        print('PLY in SuperSplat öffnen, Startansicht/Vorschaubild wählen, danach npm run rooms -- import … (README).')
    except (Exception, KeyboardInterrupt):
        metrics['status'] = 'failed'; save(); raise

if __name__ == '__main__':
    main()
