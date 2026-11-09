// Starfield and scroll reveal, shared by the keepsake and the daily reading.
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Starfield
  var sky = document.getElementById('stars');
  var count = window.innerWidth < 680 ? 70 : 140;
  for (var i = 0; i < count; i++) {
    var s = document.createElement('span');
    var size = Math.random() < 0.85 ? 1 + Math.random() * 1.2 : 2 + Math.random() * 1.5;
    s.className = 'star';
    s.style.width = s.style.height = size + 'px';
    s.style.left = (Math.random() * 100) + '%';
    s.style.top = (Math.random() * 100) + '%';
    s.style.setProperty('--d', (3 + Math.random() * 5).toFixed(1) + 's');
    s.style.setProperty('--delay', (-Math.random() * 6).toFixed(1) + 's');
    sky.appendChild(s);
  }

  // Reveal sections as they scroll in
  var items = document.querySelectorAll('.reveal');
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('shown'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('shown'); io.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
