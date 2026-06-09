#!/usr/bin/env python3
import json
import os
import sys
import hashlib
import subprocess
from pathlib import Path

VIDEO_EXTS = {'.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi'}
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.avif'}

def safe_rel(root: Path, path: Path) -> str:
    return str(path.relative_to(root)).replace('\\', '/')

def item_id(rel_path: str) -> str:
    return hashlib.sha1(rel_path.encode('utf-8')).hexdigest()[:16]

def run_ffprobe(ffprobe_path: str, path: str) -> dict:
    if not ffprobe_path or not os.path.isfile(ffprobe_path):
        return {}
    cmd = [
        ffprobe_path,
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        path
    ]
    try:
        cp = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if cp.returncode != 0:
            return {}
        return json.loads(cp.stdout or '{}')
    except Exception:
        return {}

def build_video_meta(ffprobe_data: dict) -> dict:
    result = {
        'duration': 0.0,
        'width': 0,
        'height': 0,
        'codec': '',
    }
    try:
        fmt = ffprobe_data.get('format', {}) or {}
        result['duration'] = float(fmt.get('duration') or 0.0)
    except Exception:
        result['duration'] = 0.0
    for stream in ffprobe_data.get('streams', []) or []:
        if stream.get('codec_type') == 'video':
            result['width'] = int(stream.get('width') or 0)
            result['height'] = int(stream.get('height') or 0)
            result['codec'] = str(stream.get('codec_name') or '')
            break
    return result

def thumbnail_for_video(ffmpeg_path: str, source_path: str, thumb_path: str) -> bool:
    if not ffmpeg_path or not os.path.isfile(ffmpeg_path):
        return False
    thumb = Path(thumb_path)
    thumb.parent.mkdir(parents=True, exist_ok=True)
    if thumb.is_file():
        return True
    cmd = [
        ffmpeg_path,
        '-y',
        '-ss', '00:00:02',
        '-i', source_path,
        '-frames:v', '1',
        '-vf', 'scale=640:-1',
        thumb_path
    ]
    try:
        cp = subprocess.run(cmd, capture_output=True, text=True, check=False)
        return cp.returncode == 0 and thumb.is_file()
    except Exception:
        return False

def find_folder_image(path: Path):
    for name in ('folder.jpg', 'folder.jpeg', 'poster.jpg', 'cover.jpg', 'cover.jpeg', 'thumb.jpg'):
        candidate = path.parent / name
        if candidate.is_file():
            return candidate
    return None

def scan(cfg: dict) -> tuple[dict, dict]:
    root = Path(cfg['library_root']).resolve()
    thumb_dir = Path(cfg['thumb_dir']).resolve()
    ffmpeg_path = cfg.get('ffmpeg_path', '')
    ffprobe_path = cfg.get('ffprobe_path', '')

    public_items = []
    track_index = {}
    thumb_index = {}
    folder_index = {}

    for file_path in sorted(root.rglob('*')):
        if not file_path.is_file():
            continue
        ext = file_path.suffix.lower()
        if ext not in VIDEO_EXTS and ext not in IMAGE_EXTS:
            continue

        rel_path = safe_rel(root, file_path)
        rel_folder = rel_path.rsplit('/', 1)[0] if '/' in rel_path else ''
        id_ = item_id(rel_path)
        title = file_path.stem

        item = {
            'id': id_,
            'title': title,
            'type': 'video' if ext in VIDEO_EXTS else 'image',
            'relativePath': rel_path,
            'folderPath': rel_folder,
            'extension': ext[1:],
            'size': file_path.stat().st_size,
            'modifiedAt': int(file_path.stat().st_mtime),
            'duration': 0,
            'width': 0,
            'height': 0,
            'codec': '',
            'thumb': True,
        }

        if item['type'] == 'video':
            probe = run_ffprobe(ffprobe_path, str(file_path))
            meta = build_video_meta(probe)
            item.update(meta)
            thumb_path = thumb_dir / f'{id_}.jpg'
            if thumbnail_for_video(ffmpeg_path, str(file_path), str(thumb_path)):
                thumb_index[id_] = {'path': str(thumb_path), 'type': 'image'}
        else:
            thumb_index[id_] = {'path': str(file_path), 'type': 'image'}

        folder_cover = find_folder_image(file_path)
        if folder_cover and item['type'] == 'video':
            thumb_index[id_] = {'path': str(folder_cover), 'type': 'image'}

        public_items.append(item)
        track_index[id_] = {'path': str(file_path), 'type': item['type']}

        bucket = folder_index.setdefault(rel_folder, {'path': rel_folder, 'name': rel_folder.split('/')[-1] if rel_folder else 'Root', 'count': 0})
        bucket['count'] += 1

    public_cache = {
        'name': 'MediaWall',
        'mode': 'fixed',
        'label': cfg.get('library_label', 'Library'),
        'items': public_items,
        'folders': sorted(folder_index.values(), key=lambda x: x['path']),
        'stats': {
            'videos': len([i for i in public_items if i['type'] == 'video']),
            'pictures': len([i for i in public_items if i['type'] == 'image']),
            'total': len(public_items),
        },
        'updatedAt': int(__import__('time').time()),
    }
    private_cache = {
        'trackIndex': track_index,
        'thumbIndex': thumb_index,
    }
    return public_cache, private_cache

def main():
    if len(sys.argv) < 2:
        print('Missing config file', file=sys.stderr)
        return 1
    config_path = Path(sys.argv[1]).resolve()
    cfg = json.loads(config_path.read_text(encoding='utf-8'))
    public_cache, private_cache = scan(cfg)
    Path(cfg['public_cache']).write_text(json.dumps(public_cache, indent=2, ensure_ascii=False), encoding='utf-8')
    Path(cfg['private_cache']).write_text(json.dumps(private_cache, indent=2, ensure_ascii=False), encoding='utf-8')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
