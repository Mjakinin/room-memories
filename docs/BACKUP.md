# Backup and restoration

The **original archive** is stored locally in `private/archive/`, or in the directory specified by `ROOM_ARCHIVE`. Keep the video, full PLY, SOG, starting view and metadata together. Netlify and GitHub do not replace this archive.

## External drive

Connect the drive and create a destination directory. In WSL, a Windows drive might be available under `/mnt/e`; **check your own drive path**.

```bash
mkdir -p /mnt/e/RoomMemories
npm run backup -- --disk /mnt/e/RoomMemories
```

This creates dated snapshots, writes SHA-256 checksums and verifies the copy. It does not delete older backups or overwrite existing snapshots. The additional local snapshot in `.local/backups` is a copy on the same computer, not an independent backup. Large videos and training checkpoints can require substantial storage. Remove old snapshots manually after reviewing them.

## Encrypted Google Drive backup

Install `rclone` ([official instructions](https://rclone.org/install/)); on Ubuntu, `sudo apt install rclone` is an option. Then run:

```bash
rclone config
```

1. Create a **drive** remote named `rooms-drive` and complete Google authorization yourself. Use a dedicated Drive directory.
2. Create a **crypt** remote named `rooms-crypt`, pointing to `rooms-drive:RoomMemoriesEncrypted`.
3. Select `standard` filename encryption and enable directory-name encryption. Set a long encryption password and a salt.
4. Store the rclone configuration and encryption password separately from the computer in your password manager. Without the key, the Drive backup cannot be restored. Never commit the configuration to this repository.

```bash
npm run backup -- --disk /mnt/e/RoomMemories --remote rooms-crypt:backups
```

The command accepts only a `crypt` remote for cloud backups. After uploading, it downloads the decrypted copy into a temporary directory and verifies every SHA-256 checksum. This can take time and requires temporary disk space. Drive uses your existing storage allowance; the command does not purchase storage.

An external or cloud copy is not reported as completed until its destination is configured and the copy has been verified.

## Restore

Always restore into a **new** destination rather than overwriting the existing archive:

```bash
npm run restore -- --snapshot /mnt/e/RoomMemories/SNAPSHOT_ID --to private/restored-archive
# Or restore from the encrypted Drive copy:
npm run restore -- --snapshot rooms-crypt:backups/SNAPSHOT_ID --to private/restored-archive
```

The command verifies the file list and checksums before and after copying. Existing destinations, symlinks and damaged files are rejected. Test the restored archive:

```bash
ROOM_ARCHIVE="$PWD/private/restored-archive" npm run build
```

If everything is correct, use the same `ROOM_ARCHIVE` when deploying. Back up the website password separately or generate new credentials; credentials are deliberately excluded from the room archive.

Automated tests cover local backup/restoration and rejection of damaged backups. Test the cloud and actual external drive after configuring them.
