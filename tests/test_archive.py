import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('archive', Path(__file__).resolve().parents[1] / 'scripts' / 'archive.py')
archive = importlib.util.module_from_spec(spec)
spec.loader.exec_module(archive)

class ArchiveTest(unittest.TestCase):
    def test_roundtrip_and_corruption(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); source = root / 'private'; source.mkdir()
            (source / 'video.mp4').write_bytes(b'original video fixture')
            (source / 'scene.ply').write_bytes(b'original model fixture')
            snapshot = archive.snapshot_archive(source, root / 'backups')
            restored = archive.restore_snapshot(snapshot, root / 'restored')
            self.assertEqual((restored / 'scene.ply').read_bytes(), (source / 'scene.ply').read_bytes())
            with self.assertRaises(ValueError):
                archive.restore_snapshot(snapshot, restored)
            (snapshot / 'archive' / 'video.mp4').write_bytes(b'corrupted')
            with self.assertRaises(ValueError):
                archive.restore_snapshot(snapshot, root / 'bad')

    def test_backup_rejects_nested_target_and_symlinks(self):
        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / 'source'; source.mkdir(); (source / 'file').write_text('test')
            with self.assertRaises(ValueError):
                archive.snapshot_archive(source, source / 'backups')
            (source / 'linked').symlink_to(source / 'file')
            with self.assertRaises(ValueError):
                archive.snapshot_archive(source, Path(tmp) / 'backup')

if __name__ == '__main__':
    unittest.main()
