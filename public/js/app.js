const root = document.documentElement;
const saved = localStorage.getItem('theme') || 'light';
root.dataset.theme = saved;

function syncThemeImages() {
  document.querySelectorAll('[data-theme-image], [data-theme-product-image]').forEach(image => {
    const nextSrc = root.dataset.theme === 'dark' ? image.dataset.darkSrc : image.dataset.lightSrc;
    if (nextSrc && image.getAttribute('src') !== nextSrc) image.setAttribute('src', nextSrc);
  });
}

document.querySelectorAll('[data-theme-toggle]').forEach(btn => btn.addEventListener('click', () => {
  root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', root.dataset.theme);
  syncThemeImages();
}));
syncThemeImages();

document.querySelectorAll('[data-split-title]').forEach(title => {
  const words = title.textContent.trim().split(/\s+/);
  title.innerHTML = words.map((word, index) => `<span style="--w:${index}">${word}</span>`).join(' ');
});

function animateCount(el) {
  if (el.dataset.done) return;
  el.dataset.done = 'true';
  const target = Number(el.dataset.count || 0);
  const duration = 1100;
  const start = performance.now();
  const tick = now => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(target * eased);
    if (progress < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const observer = new IntersectionObserver((entries) => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  entry.target.classList.add('show');
  entry.target.querySelectorAll('[data-count]').forEach(animateCount);
}), { threshold: .12 });

document.querySelectorAll('.reveal, .counter-band').forEach(el => observer.observe(el));

document.querySelectorAll('[data-parallax-stage]').forEach(stage => {
  const movable = stage.querySelectorAll('.float-card, .float-badge, .app-phone, .quote-card, .ai-floating-card, .stack-chip');
  stage.addEventListener('pointermove', event => {
    const rect = stage.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - .5) * 18;
    const y = ((event.clientY - rect.top) / rect.height - .5) * 18;
    movable.forEach((el, index) => {
      const depth = (index + 1) * .35;
      el.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
    });
  });
  stage.addEventListener('pointerleave', () => {
    movable.forEach(el => { el.style.transform = ''; });
  });
});

const contactExamples = {
  'Consultoría IA': 'Ej: Queremos evaluar cómo usar IA para consultar documentos internos, automatizar reportes o reducir tareas manuales repetitivas.',
  'ERP / Gestión operacional': 'Ej: Necesitamos ordenar producción, stock, usuarios, estados y reportes en una plataforma centralizada.',
  'Reportes y Power BI': 'Ej: Queremos conectar datos de planillas o sistemas internos para tener tableros confiables y actualizados.',
  'Integración de sistemas': 'Ej: Necesitamos conectar nuestras plataformas para evitar doble digitación y mejorar la trazabilidad.',
  'Software a medida': 'Ej: Tenemos un proceso propio que hoy vive en planillas y queremos convertirlo en una aplicación web.',
  'Formularios y flujos': 'Ej: Queremos digitalizar formularios, aprobaciones, adjuntos y seguimiento de estados.'
};

function contactExampleFor(interest) {
  return contactExamples[interest] || `Ej: Me interesa conversar sobre ${interest}. Queremos revisar alcance, implementación y una posible demo.`;
}

function applyContactInterest() {
  const params = new URLSearchParams(window.location.search);
  const interest = params.get('interest');
  if (!interest) return;

  document.querySelectorAll('form[action="/leads"]').forEach(form => {
    const select = form.querySelector('select[name="interest"]');
    const message = form.querySelector('textarea[name="message"]');

    if (select) {
      const option = Array.from(select.options).find(item => item.value === interest || item.textContent.trim() === interest);
      if (option) select.value = option.value;
    }

    if (message && !message.value.trim()) {
      message.placeholder = contactExampleFor(interest);
    }
  });
}

applyContactInterest();
