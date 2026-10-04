#!/usr/bin/env bash
set -euo pipefail
# Official Nerfstudio 1.1.5 Linux/amd64 image, verified from GHCR.
room_image='ghcr.io/nerfstudio-project/nerfstudio@sha256:b59b8e1012d7a43679d3234b3de9c8416a4b8435fcbf21b9d8c4494b8563f19e'
if ! command -v docker >/dev/null; then
  echo 'Docker fehlt. Docker Desktop installieren/starten und WSL-Integration aktivieren (docs/RTX.md).'
  exit 1
fi
docker info >/dev/null
docker pull "$room_image"
docker run --rm --gpus all "$room_image" python -c 'import torch; assert torch.cuda.is_available(), "CUDA fehlt. NVIDIA-Windows-Treiber und Docker/WSL-GPU-Freigabe prüfen."; print("GPU:", torch.cuda.get_device_name(0)); print("Torch:", torch.__version__)'
docker run --rm "$room_image" bash -c 'command -v ffmpeg; command -v colmap; command -v ns-process-data; command -v ns-train; command -v ns-export'
mkdir -p .local
docker image inspect --format '{{index .RepoDigests 0}}' "$room_image" > .local/nerfstudio-image.txt
echo 'RTX-Verarbeitung vorbereitet. Der konkrete Image-Digest ist lokal festgehalten.'
echo 'Weiter: python3 scripts/process-video.py --video /pfad/raum.mp4 --id berlin-wohnzimmer'
