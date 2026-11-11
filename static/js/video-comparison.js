(() => {
  const container = document.getElementById('buaa-comparison');
  if (!container) return;
  const videos = [...container.querySelectorAll('video')];
  const [base, ours] = videos;
  const range = container.querySelector('input');
  let manualPause = false;
  let hovering = false;
  let touching = false;
  let failed = false;
  let starting = false;
  let rewinding = false;
  let sceneGeneration = 0;
  let playGeneration = 0;
  let autoplayBlocked = false;
  let activeScene = 'buaa-net';
  const sceneEdits = {
    'buaa-net': { suffix: '-13s', end: 13 },
    '930-0': { suffix: '-topright75' },
    '1010-2_2': { suffix: '-23s', end: 23 }
  };
  videos.forEach(video => { video.muted = true; });
  const ready = () => videos.every(v => v.readyState >= 3 && !v.seeking);
  const shouldPlay = () => !manualPause && !hovering && !touching && !failed && !document.hidden;
  const pause = () => {
    // A pause/load invalidates outstanding play promises, not user intent.
    playGeneration += 1;
    starting = false;
    videos.forEach(v => v.pause());
  };
  function align() {
    if (Number.isFinite(base.duration) && Math.abs(ours.currentTime - base.currentTime) > 0.008) {
      ours.currentTime = base.currentTime;
    }
  }
  function update() {
    if (failed) return;
    if (!shouldPlay()) {
      pause();
      align();
      return;
    }
    if (!ready() || rewinding) {
      pause();
      return;
    }
    if (starting) return;
    if (autoplayBlocked) return;
    if (videos.every(v => !v.paused)) return;
    starting = true;
    const generation = sceneGeneration;
    const attempt = ++playGeneration;
    Promise.all(videos.map(v => v.play())).then(() => {
      if (generation !== sceneGeneration || attempt !== playGeneration) return;
      starting = false;
      if (!shouldPlay()) { update(); return; }
    }).catch(error => {
      if (generation !== sceneGeneration || attempt !== playGeneration) return;
      starting = false;
      pause();
      // AbortError is normal during buffering, hovering, seeking or switching.
      // Only actual browser autoplay denial needs a user gesture.
      autoplayBlocked = error.name === 'NotAllowedError';
      if (error.name !== 'AbortError') console.warn('Comparison playback:', error);
    });
  }
  function split(value) {
    value = Math.max(0, Math.min(100, Number(value)));
    container.style.setProperty('--split', `${value}%`);
    range.value = value;
    range.setAttribute('aria-valuetext', `${Math.round(value)}% 3DGS`);
    container.querySelector('.label-ours').hidden = value > 90;
    container.querySelector('.label-baseline').hidden = value < 10;
  }
  // All scenes consistently show 3DGS on the left and Ours on the right.
  document.querySelectorAll('[data-scene]').forEach(sceneButton => {
    sceneButton.addEventListener('click', () => {
      if (sceneButton.getAttribute('aria-pressed') === 'true') return;
      sceneGeneration += 1;
      pause();
      starting = false;
      failed = false;
      autoplayBlocked = false;
      rewinding = false;
      const scene = sceneButton.dataset.scene;
      activeScene = scene;
      document.querySelectorAll('[data-scene]').forEach(item => {
        item.setAttribute('aria-pressed', String(item === sceneButton));
      });
      split(50);
      const suffix = sceneEdits[scene]?.suffix || '';
      const version = '?v=scene-edits-3';
      base.src = `./static/videos/comparisons/${scene}-baseline${suffix}.mp4${version}`;
      ours.src = `./static/videos/comparisons/${scene}-ours${suffix}.mp4${version}`;
      videos.forEach(video => video.load());
      update();
    });
  });
  base.addEventListener('loadedmetadata', () => {
    container.style.aspectRatio = `${base.videoWidth} / ${base.videoHeight}`;
  });
  container.addEventListener('pointerenter', event => {
    if (event.pointerType === 'mouse') { hovering = true; update(); }
  });
  container.addEventListener('pointerleave', event => {
    if (event.pointerType === 'mouse') { hovering = false; update(); }
  });
  container.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') {
      const rect = container.getBoundingClientRect();
      split((event.clientX - rect.left) / rect.width * 100);
    }
  });
  range.addEventListener('input', () => split(range.value));
  let touchStart = null;
  range.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse') touchStart = {x: event.clientX, y: event.clientY, paused: manualPause};
    if (event.pointerType !== 'mouse') { touching = true; update(); }
  });
  function release(event) {
    if (!touching) return;
    touching = false;
    const tap = touchStart && Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) < 8;
    manualPause = tap ? !touchStart.paused : true;
    touchStart = null;
    update();
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  range.addEventListener('keydown', event => {
    if (event.code === 'Space') {
      event.preventDefault();
      manualPause = !manualPause;
    } else {
      manualPause = true;
    }
    update();
  });
  range.addEventListener('click', event => {
    // Allow recovery from blocked autoplay without a separate Play button.
    if (event.pointerType === 'mouse' && manualPause) {
      manualPause = false;
      update();
    }
  });
  document.addEventListener('visibilitychange', update);
  function retryAfterGesture() {
    if (!autoplayBlocked) return;
    autoplayBlocked = false;
    update();
  }
  document.addEventListener('pointerdown', retryAfterGesture);
  document.addEventListener('keydown', retryAfterGesture);
  window.addEventListener('blur', () => { hovering = false; update(); });
  window.addEventListener('focus', update);
  function restartPair() {
    if (rewinding) return;
    rewinding = true;
    pause();
    videos.forEach(v => { v.currentTime = 0; });
    rewinding = false;
    update();
  }
  function enforceClipEnd() {
    const end = sceneEdits[activeScene]?.end;
    if (end && videos.some(v => v.currentTime >= end)) restartPair();
  }
  videos.forEach(video => {
    video.addEventListener('canplay', update);
    video.addEventListener('seeked', update);
    video.addEventListener('waiting', () => { pause(); align(); update(); });
    video.addEventListener('error', () => { failed = true; pause(); });
    video.addEventListener('timeupdate', enforceClipEnd);
    video.addEventListener('ended', restartPair);
  });
  // Correct drift without continuously seeking one decoder on every frame.
  setInterval(() => {
    enforceClipEnd();
    if (shouldPlay() && ready() && !base.paused && Math.abs(base.currentTime - ours.currentTime) > 0.06) {
      pause(); align(); update();
    }
    if (shouldPlay() && !starting && ready() && videos.some(v => v.paused)) update();
  }, 150);
  update();
})();
