(() => {
  const section = document.getElementById('methodology');
  if (!section) return;
  const slides = [...section.querySelectorAll('.method-slide')];
  const dots = [...section.querySelectorAll('.method-dot')];
  function select(index) {
    slides.forEach((slide, i) => { slide.hidden = i !== index; });
    dots.forEach((dot, i) => dot.setAttribute('aria-pressed', String(i === index)));
  }
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => select(index));
    dot.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % dots.length;
      else if (event.key === 'ArrowLeft') next = (index + dots.length - 1) % dots.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = dots.length - 1;
      else return;
      event.preventDefault();
      select(next);
      dots[next].focus();
    });
  });
})();
