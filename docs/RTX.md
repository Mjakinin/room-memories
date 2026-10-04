# Process a phone video on an RTX computer

Reconstruction runs on the separate NVIDIA computer; the website can also run on the laptop.
The prepared workflow uses **Nerfstudio 1.1.5 / Splatfacto** in the official Linux Docker image.
FFmpeg and COLMAP are included. No Nerfstudio fork or custom training implementation is required.
GPU installation must be validated on the RTX computer itself.

## One-time Windows setup

1. Install an up-to-date NVIDIA Windows driver.
2. Run `wsl --install -d Ubuntu-24.04` in PowerShell if WSL2 is missing. Windows may require administrator privileges or a restart. Alternatively, run `scripts/setup-windows.ps1`.
3. Install and start [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/). Enable Linux containers, the WSL2 backend and Ubuntu integration. Personal use is covered by Docker Desktop's free license; organizations should check Docker's license terms.
4. Work inside your Ubuntu home directory, rather than keeping the project under the slower `/mnt/c` filesystem:

```bash
git clone https://github.com/Mjakinin/room-memories.git
cd room-memories
bash scripts/setup-rtx.sh
```

Setup downloads several GB, checks CUDA and records the exact image digest locally.
Do not install a Linux NVIDIA display driver inside WSL: GPU access is provided by the Windows driver.
Setup does not start a reconstruction.

## Record and process

Walk slowly through the room and capture multiple viewing directions and heights. Sideways movement helps depth reconstruction; simply rotating in place is often insufficient.
Keep lighting steady, avoid moving people or pets and avoid digital zoom changes. Mirrors and featureless walls remain challenging. Surfaces must be visible in the video; hidden backsides cannot be reconstructed reliably.

```bash
python3 scripts/process-video.py \
  --video /mnt/c/Users/YOUR_NAME/Videos/living-room.mp4 \
  --id berlin-living-room --frames 350 --iterations 30000
```

The pipeline stages are:

1. Copy and preserve the original video.
2. `ns-process-data video`: extract FFmpeg frames and estimate COLMAP camera poses with sequential matching.
3. `ns-train splatfacto`: train Gaussian splats without leaving an interactive training viewer waiting.
4. `ns-export gaussian-splat`: export the full PLY file.

Everything is stored in `private/archive/captures/berlin-living-room/`: original video, images/camera poses, training data, configuration, logs, exported model and `processing.json`. Timings are recorded only for stages that actually run. On failure, the original video and logs remain available; use a new ID for another attempt. COLMAP can fail on unsuitable footage even when CUDA works.

Open the PLY in [SuperSplat](https://superspl.at/editor), remove unwanted splats, choose a starting camera, create a thumbnail and export viewer settings. For private captures, prefer a local SuperSplat instance and do not publish the export on superspl.at. See the [SuperSplat repository](https://github.com/playcanvas/supersplat) for setup instructions.

## Individual room or whole apartment?

Start with one room. A whole apartment is possible but needs continuous camera paths with overlap through doorways and produces larger files. Individual rooms can share an apartment category; an additional capture with `--kind apartment` is also supported. Separate model files are not automatically merged into one apartment reconstruction.

## Planned comparisons

Test [LichtFeld Studio](https://github.com/MrNeRF/LichtFeld-Studio) with the same images and camera poses. Runtime alone is not a quality measure: compare the same starting views, detail, holes, artifacts and web file size. No source-code changes are required.

An optional [Brush](https://github.com/ArthurBrussee/brush) experiment is planned for the Vulkan laptop. Laptop training is separate from the RTX setup and has not been validated.

Sources: [Nerfstudio installation](https://docs.nerf.studio/quickstart/installation.html), [Splatfacto](https://docs.nerf.studio/nerfology/methods/splat.html), [official Dockerfile](https://github.com/nerfstudio-project/nerfstudio/blob/v1.1.5/Dockerfile), [NVIDIA CUDA on WSL](https://docs.nvidia.com/cuda/wsl-user-guide/index.html).
