(function () {
  'use strict';

  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('scrolled', window.scrollY > 40); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  var sections = document.querySelectorAll('section[id]');
  var anchorLinks = document.querySelectorAll('.nav-links a[href^="#"]');
  if (sections.length && anchorLinks.length) {
    var activate = function () {
      var line = window.scrollY + window.innerHeight / 2;
      var current = '';
      sections.forEach(function (s) {
        if (line >= s.offsetTop) current = s.id;
      });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1].id;
      }
      anchorLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current);
      });
    };
    window.addEventListener('scroll', activate, { passive: true });
    activate();
  }

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  var arrow = document.querySelector('.hero-scroll');
  if (arrow) {
    var hide = function () { arrow.classList.toggle('hidden', window.scrollY > 30); };
    window.addEventListener('scroll', hide, { passive: true });
    hide();
  }

  document.querySelectorAll('.project-card .card-trace path').forEach(function (path) {
    var card = path.closest('.project-card');
    var size = function () {
      var w = card.clientWidth, h = card.clientHeight, i = 0;
      path.setAttribute('d',
        'M' + i + ',' + i + ' L' + i + ',' + (h - i) +
        ' L' + (w - i) + ',' + (h - i) +
        ' L' + (w - i) + ',' + i + ' Z');
      var len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
    };
    window.addEventListener('load', function () {
      requestAnimationFrame(function () { size(); });
    }, { once: true });
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t); t = setTimeout(size, 150);
    }, { passive: true });
  });

  var resumeDialog = document.getElementById('resume-dialog');
  var resumeLink = document.querySelector('[data-resume]');
  if (resumeDialog && resumeLink && typeof resumeDialog.showModal === 'function') {
    var closeResume = function () {
      if (!resumeDialog.open || resumeDialog.classList.contains('closing')) return;
      resumeDialog.classList.add('closing');
      var done = function () {
        resumeDialog.classList.remove('closing');
        resumeDialog.close();
      };
      resumeDialog.addEventListener('animationend', done, { once: true });
      setTimeout(function () { if (resumeDialog.open) done(); }, 400);
    };
    resumeLink.addEventListener('click', function (e) {
      e.preventDefault();
      resumeDialog.showModal();
    });
    resumeDialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeResume();
    });
    resumeDialog.addEventListener('click', function (e) {
      if (e.target === resumeDialog || e.target.closest('.resume-close') || e.target.closest('.resume-option')) {
        closeResume();
      }
    });
  }

  console.log('%cHey! Nice to meet you!!', 'color:#e03050;font:700 16px monospace;');
  console.log('%cs@seamusf.com', 'color:#9a9a9a;font:12px monospace;');
})();