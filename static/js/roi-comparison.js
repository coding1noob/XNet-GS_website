document.querySelectorAll('.roi-group').forEach(group => {
  const view = group.querySelector('.roi-view');
  const handles = [...view.querySelectorAll('.roi-handle')];
  let values = [100 / 3, 200 / 3];
  function update() {
    view.style.setProperty('--first', `${values[0]}%`);
    view.style.setProperty('--second', `${values[1]}%`);
    handles.forEach((handle, i) => {
      handle.setAttribute('aria-valuenow', values[i].toFixed(1));
      handle.setAttribute('aria-valuemin', i ? values[0].toFixed(1) : '0');
      handle.setAttribute('aria-valuemax', i ? '100' : values[1].toFixed(1));
    });
    ['.roi-label-gt', '.roi-label-base', '.roi-label-ours'].forEach((selector, i) => {
      const widths = [values[0], values[1] - values[0], 100 - values[1]];
      view.querySelector(selector).hidden = widths[i] < 12;
    });
  }
  function set(i, value) {
    values[i] = Math.max(i ? values[0] : 0, Math.min(i ? 100 : values[1], value));
    update();
  }
  handles.forEach((handle, i) => {
    let pointer = null;
    const move = event => {
      const rect = view.getBoundingClientRect();
      set(i, (event.clientX - rect.left) / rect.width * 100);
    };
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      pointer = event.pointerId;
      handle.setPointerCapture(pointer);
      handle.focus();
      move(event);
      event.preventDefault();
    });
    handle.addEventListener('pointermove', event => { if (pointer === event.pointerId) move(event); });
    handle.addEventListener('pointerup', () => { pointer = null; });
    handle.addEventListener('pointercancel', () => { pointer = null; });
    handle.addEventListener('lostpointercapture', () => { pointer = null; });
    handle.addEventListener('keydown', event => {
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') set(i, values[i] - step);
      else if (event.key === 'ArrowRight') set(i, values[i] + step);
      else if (event.key === 'Home') set(i, 0);
      else if (event.key === 'End') set(i, 100);
      else return;
      event.preventDefault();
    });
  });
  let generation = 0;
  group.querySelectorAll('[data-roi]').forEach(button => {
    button.addEventListener('click', async () => {
      const entry = JSON.parse(button.dataset.roi);
      const current = ++generation;
      const files = ['gt_roi.png', 'left_render_roi.png', 'right_render_roi.png'];
      const paths = files.map(file => `${entry.path}/${file}`);
      try {
        // Switch all three images together, avoiding comparisons across scenes.
        await Promise.all(paths.map(src => {
          const image = new Image(); image.src = src; return image.decode();
        }));
      } catch (error) { console.error('Could not load ROI comparison', error); return; }
      if (current !== generation) return;
      view.style.aspectRatio = view.dataset.cropAspect || `${entry.width} / ${entry.height}`;
      view.querySelectorAll('img').forEach((image, i) => {
        image.src = paths[i]; image.alt = `${entry.label} ${['GT', '3DGS', 'Ours'][i]}`;
      });
      group.querySelectorAll('[data-roi]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      values = [100 / 3, 200 / 3]; update();
    });
  });
  update();
});
