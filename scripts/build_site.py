"""Build a Pages artifact containing only resources used by the public page."""
from html.parser import HTMLParser
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / '_site'

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.files = {'index.html'}
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        for key in ('src', 'href'):
            url = attrs.get(key, '')
            if url.startswith(('./static/', 'static/')):
                self.files.add(url.split('?')[0].removeprefix('./'))
        if 'data-roi' in attrs:
            entry = json.loads(attrs['data-roi'])
            for name in ('gt_roi.png', 'left_render_roi.png', 'right_render_roi.png'):
                self.files.add(entry['path'] + '/' + name)
        if 'data-scene' in attrs:
            scene = attrs['data-scene']
            suffix = {'buaa-net': '-13s', '930-0': '-topright75', '1010-2_2': '-23s'}.get(scene, '')
            for method in ('baseline', 'ours'):
                self.files.add(f'static/videos/comparisons/{scene}-{method}{suffix}.mp4')

assets = Assets()
assets.feed((ROOT / 'index.html').read_text())
for name in assets.files:
    if not (ROOT / name).is_file():
        raise FileNotFoundError(name)
if DEST.exists():
    shutil.rmtree(DEST)
for name in sorted(assets.files):
    target = DEST / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / name, target)
(DEST / '.nojekyll').touch()
print(f'Built {len(assets.files)} files, {sum((ROOT / name).stat().st_size for name in assets.files) / 1024**2:.1f} MiB')
