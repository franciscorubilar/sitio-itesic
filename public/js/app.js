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
  return contactExamples[interest] || `Ej: Me interesa conversar sobre ${interest}. Queremos revisar alcance, implementación y una posible propuesta.`;
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

function initSiteChatbot() {
  const shell = document.querySelector('[data-chatbot]');
  const configEl = document.getElementById('chatbot-config');
  if (!shell || !configEl) return;

  let config = {};
  try { config = JSON.parse(configEl.textContent || '{}'); } catch (_) { config = {}; }

  const panel = shell.querySelector('[data-chatbot-panel]');
  const toggle = shell.querySelector('[data-chatbot-toggle]');
  const close = shell.querySelector('[data-chatbot-close]');
  const messages = shell.querySelector('[data-chatbot-messages]');
  const quick = shell.querySelector('[data-chatbot-quick]');
  const form = shell.querySelector('[data-chatbot-form]');
  const leadForm = shell.querySelector('[data-chatbot-lead-form]');
  const status = shell.querySelector('[data-chatbot-status]');
  const actions = shell.querySelector('[data-chatbot-actions]');
  const leadCancel = shell.querySelector('[data-chatbot-lead-cancel]');
  const nudge = shell.querySelector('[data-chatbot-nudge]');
  const composerInput = shell.querySelector('[data-chatbot-input]');
  const composerSend = shell.querySelector('[data-chatbot-send]');
  const state = { intent: '', leadHint: '', history: [], qualified: false };
  const storageKey = 'itesicws_chatbot_conversation_v1';
  let conversationMessages = [];
  let restoringConversation = false;
  let pingPlayed = false;
  let nudgeShown = false;

  const serviceOptions = [
    { icon: '🤖', label: 'Consultoría IA', desc: 'Te ayudo a pensar IA útil, con procesos, documentos y asistentes que realmente funcionen.', prompt: 'Quiero consultoría IA para mi empresa' },
    { icon: '🧩', label: 'Software a medida', desc: 'Diseño soluciones claras para ordenar procesos, usuarios y estados sin complejidad innecesaria.', prompt: 'Necesito software a medida para un proceso interno' },
    { icon: '📊', label: 'Power BI / Datos', desc: 'Te acompaño a transformar datos en dashboards y decisiones claras.', prompt: 'Necesito ayuda con Power BI y reportes' },
    { icon: '⚙️', label: 'Automatización', desc: 'Reducimos tareas repetidas y aceleramos tus flujos con menos errores.', prompt: 'Quiero automatizar un proceso de mi empresa' },
    { icon: '💬', label: 'Chatbot inteligente', desc: 'Construimos un asistente útil que responde y deriva cuando conviene.', prompt: 'Quiero un chatbot inteligente para mi sitio web' },
    { icon: '👤', label: 'Hablar con humano', desc: 'Te conecto rápido con el equipo si quieres hablar con alguien real.', prompt: 'Quiero hablar con una persona del equipo' }
  ];

  const defaultSuggestions = config.quickReplies && config.quickReplies.length
    ? config.quickReplies
    : ['Consultoría IA', 'Software a medida', 'Power BI / Datos', 'Automatización', 'Chatbot inteligente'];

  function normalize(value) {
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function setStatus(text) {
    if (status) status.textContent = text || 'En línea';
  }

  function playPing() {
    if (pingPlayed) return;
    pingPlayed = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.close?.();
        return;
      }
      const now = ctx.currentTime;
      const gain = ctx.createGain();
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(740, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      setTimeout(() => ctx.close?.(), 260);
    } catch (_) {}
  }

  function saveConversation() {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        state,
        messages: conversationMessages.slice(-40),
        started: !!messages.dataset.started,
        savedAt: new Date().toISOString()
      }));
    } catch (_) {}
  }

  function restoreConversation() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '{}');
      if (!saved || !Array.isArray(saved.messages) || !saved.messages.length) return;
      restoringConversation = true;
      Object.assign(state, saved.state || {});
      conversationMessages = saved.messages.slice(-40);
      conversationMessages.forEach(item => addMessage(item.text, item.from, { skipPersist: true }));
      messages.dataset.started = 'true';
      setStatus(state.intent === 'lead' ? 'Listo para derivar' : 'En línea');
      restoringConversation = false;
    } catch (_) {
      restoringConversation = false;
    }
  }

  function addMessage(text, from = 'bot', options = {}) {
    const bubble = document.createElement('div');
    bubble.className = `chatbot-bubble ${from}`;
    String(text || '').split('\n').filter(Boolean).forEach((line, index) => {
      if (index) bubble.appendChild(document.createElement('br'));
      bubble.appendChild(document.createTextNode(line));
    });
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    if (!options.skipPersist && !restoringConversation) {
      conversationMessages.push({ text: String(text || ''), from, at: new Date().toISOString() });
      saveConversation();
    }
    return bubble;
  }

  function addOptionChips(items = serviceOptions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'chatbot-option-chips';
    items.slice(0, 6).forEach(item => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chatbot-option-chip';
      chip.innerHTML = `<span></span><b></b>`;
      chip.querySelector('span').textContent = item.icon || '•';
      chip.querySelector('b').textContent = item.label;
      chip.title = item.desc || item.label;
      chip.addEventListener('click', () => sendUserMessage(item.prompt || item.label));
      wrapper.appendChild(chip);
    });
    messages.appendChild(wrapper);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const bubble = document.createElement('div');
    bubble.className = 'chatbot-bubble bot typing';
    bubble.innerHTML = '<span></span><span></span><span></span>';
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
    setStatus('Escribiendo...');
    return bubble;
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function makeButton(label, onClick, className = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }

  function renderSuggestions(items = defaultSuggestions) {
    clearNode(quick);
    const visible = items.slice(0, 6);
    quick.hidden = !visible.length;
    visible.forEach(label => {
      quick.appendChild(makeButton(label, () => sendUserMessage(label)));
    });
  }

  function resizeComposer() {
    if (!composerInput) return;
    composerInput.style.height = 'auto';
    composerInput.style.height = `${Math.min(composerInput.scrollHeight, 92)}px`;
  }

  function showLeadForm(prefill = '') {
    if (leadForm) {
      leadForm.hidden = false;
      const messageInput = leadForm.querySelector('[name="message"]');
      if (messageInput) {
        messageInput.value = prefill || state.leadHint || '';
      }
    }
    shell.classList.add('lead-open');
    addMessage('Perfecto, con esto puedo entregar tu mensaje al equipo y avanzar rápido. Por favor, ingresa tus datos en el formulario.', 'bot note');
  }

  function hideLeadForm() {
    shell.classList.remove('lead-open');
    if (leadForm) {
      leadForm.hidden = true;
    }
  }

  function renderActions(items = []) {
    clearNode(actions);
    const filtered = items.slice(0, 4);
    actions.hidden = !filtered.length;
    filtered.forEach(action => {
      if (action.type === 'link' && action.url) {
        const link = document.createElement('a');
        link.href = action.url;
        link.textContent = action.label || 'Abrir';
        link.className = 'chatbot-action';
        if (action.url.startsWith('http')) {
          link.target = '_blank';
          link.rel = 'noopener';
        }
        actions.appendChild(link);
        return;
      }
      if (action.type === 'lead') {
        actions.appendChild(makeButton(action.label || 'Dejar mis datos', () => showLeadForm(state.leadHint || state.history.map(item => item.text).join('\n')), 'chatbot-action'));
      }
    });
  }

  async function askBot(value) {
    const typing = showTyping();
    if (composerSend) composerSend.disabled = true;
    try {
      const response = await fetch('/api/chatbot/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, state })
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.error || 'No pude responder ahora.');
      typing.remove();
      setStatus(data.intent === 'lead' ? 'Listo para derivar' : 'En línea');
      state.intent = data.state?.intent || data.intent || state.intent;
      state.leadHint = data.state?.leadHint || state.leadHint || value;
      if (data.state?.lastProductSlug) state.lastProductSlug = data.state.lastProductSlug;
      addMessage(data.answer || 'Te puedo orientar con gusto.');
      if (data.cards) addOptionChips(serviceOptions.filter(item => data.cards.includes(item.label)));
      renderSuggestions(data.suggestions || defaultSuggestions);
      renderActions(data.actions || []);
      if (data.lead) {
        addMessage('Cuando quieras, puedo pedirte los datos mínimos para que te contacte el equipo. Mientras tanto seguimos conversando.', 'bot note');
      }
      saveConversation();
    } catch (error) {
      typing.remove();
      setStatus('Derivación disponible');
      addMessage(error.message || 'Vaya, se me cortó la respuesta. Intentemos de nuevo o te paso directo al equipo si prefieres.');
      renderActions(config.whatsapp ? [{ type: 'link', label: 'WhatsApp', url: config.whatsapp }, { type: 'lead', label: 'Dejar mis datos' }] : [{ type: 'lead', label: 'Dejar mis datos' }]);
    } finally {
      if (composerSend) composerSend.disabled = false;
    }
  }

  function sendUserMessage(value) {
    const clean = String(value || '').trim();
    if (!clean) return;
    openPanel({ source: 'user' });
    state.history.push({ from: 'user', text: clean, at: new Date().toISOString() });
    addMessage(clean, 'user');
    saveConversation();
    const normalized = normalize(clean);
    if ((normalized === 'dejar mis datos' || normalized === 'dar mis datos' || normalized === 'dejar datos')) {
      addMessage('Claro. Te pido solo lo necesario para que el equipo pueda responderte bien.');
      showLeadForm(state.leadHint || state.history.map(item => item.text).join('\n'));
      return;
    }
    if (normalized === 'whatsapp' && config.whatsapp) {
      window.open(config.whatsapp, '_blank', 'noopener');
      addMessage('Genial, abrí WhatsApp para que puedas hablar con el equipo en vivo. Si quieres, sigo aquí para ayudarte a preparar la consulta.');
      return;
    }
    askBot(clean);
  }

  function openPanel(options = {}) {
    panel.hidden = false;
    panel.style.display = '';
    shell.classList.add('open');
    shell.classList.remove('has-nudge');
    if (nudge) nudge.hidden = true;
    if (!messages.dataset.started) {
      messages.dataset.started = 'true';
      setStatus('En línea');
      addMessage('¡Hola 👋 Soy tu asistente amigo de ITESICWS. Estoy para ayudarte con tu consulta, paso a paso y sin tecnicismos. Cuéntame qué necesitas y vamos directo al punto.');
      addOptionChips();
      renderSuggestions(defaultSuggestions);
      renderActions(config.whatsapp ? [{ type: 'link', label: 'WhatsApp', url: config.whatsapp }, { type: 'lead', label: 'Dejar mis datos' }] : [{ type: 'lead', label: 'Dejar mis datos' }]);
    }
  }

  function closePanel() {
    panel.hidden = true;
    panel.style.display = 'none';
    shell.classList.remove('open');
    hideLeadForm();
  }

  function showNudge() {
    if (nudgeShown || !panel.hidden || document.visibilityState !== 'visible') return;
    nudgeShown = true;
    shell.classList.add('has-nudge');
    if (nudge) nudge.hidden = false;
    playPing();
  }

  restoreConversation();
  renderSuggestions(defaultSuggestions);
  toggle.addEventListener('click', () => panel.hidden ? openPanel({ source: 'toggle' }) : closePanel());
  nudge?.addEventListener('click', () => openPanel({ source: 'nudge' }));
  nudge?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPanel({ source: 'nudge' });
    }
  });
  close?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('[data-chatbot-close]')) return;
    event.preventDefault();
    event.stopPropagation();
    closePanel();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) closePanel();
  });
  leadCancel?.addEventListener('click', hideLeadForm);

  form?.addEventListener('submit', event => {
    event.preventDefault();
    const input = form.elements.message;
    const value = input.value.trim();
    if (!value) return;
    input.value = '';
    sendUserMessage(value);
  });

  function submitComposer() {
    const value = composerInput?.value.trim();
    if (!value) return;
    composerInput.value = '';
    resizeComposer();
    sendUserMessage(value);
  }

  composerSend?.addEventListener('click', submitComposer);
  composerInput?.addEventListener('input', resizeComposer);
  composerInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitComposer();
    }
  });

  leadForm?.addEventListener('submit', event => {
    event.preventDefault();
    const button = leadForm.querySelector('button[type="submit"]');
    const original = button.textContent;
    button.disabled = true;
    button.textContent = 'Enviando...';
    const payload = Object.fromEntries(new FormData(leadForm).entries());
    payload.interest = state.intent ? `Chatbot - ${state.intent}` : 'Chatbot del sitio';
    payload.message = `${payload.message || ''}\n\nContexto conversacional:\n${state.history.map(item => `- ${item.text}`).join('\n')}`.trim();
    fetch('/api/chatbot/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(response => response.json().then(data => ({ ok: response.ok, data })))
      .then(({ ok, data }) => {
        if (!ok || !data.ok) throw new Error(data.error || 'Error');
        addMessage(data.message || 'Solicitud recibida. Te contactaremos pronto.');
        if (data.whatsapp) renderActions([{ type: 'link', label: 'Continuar por WhatsApp', url: data.whatsapp }]);
        leadForm.reset();
        hideLeadForm();
      })
      .catch(error => addMessage(error.message || 'No se pudo enviar. Intenta por WhatsApp o correo.'))
      .finally(() => {
        button.disabled = false;
        button.textContent = original;
      });
  });

  window.addEventListener('load', () => setTimeout(showNudge, 3000 + Math.random() * 2000), { once: true });
}

initSiteChatbot();

// Mejoras UX globales: menú móvil, progreso de lectura, tabla de contenidos y copiado de enlaces.
document.querySelectorAll('[data-mobile-nav]').forEach(button => {
  const nav = document.querySelector('.site-header nav');
  if (!nav) return;
  button.addEventListener('click', () => {
    nav.classList.toggle('open');
    button.setAttribute('aria-expanded', nav.classList.contains('open') ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => nav.classList.remove('open')));
});

const readingProgress = document.querySelector('[data-reading-progress]');
if (readingProgress) {
  const updateProgress = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    readingProgress.style.transform = `scaleX(${Math.min(1, window.scrollY / max)})`;
  };
  updateProgress();
  window.addEventListener('scroll', updateProgress, { passive: true });
}

const articleBody = document.querySelector('[data-article-body]');
const articleToc = document.querySelector('[data-article-toc]');
if (articleBody && articleToc) {
  const headings = Array.from(articleBody.querySelectorAll('h2, h3')).slice(0, 8);
  if (headings.length) {
    headings.forEach((heading, index) => {
      heading.id = heading.id || `seccion-${index + 1}`;
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent;
      link.className = heading.tagName.toLowerCase();
      articleToc.appendChild(link);
    });
  } else {
    articleToc.innerHTML = '<span>Lectura rápida y sin secciones extensas.</span>';
  }
}

document.querySelectorAll('[data-copy-link]').forEach(button => {
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      const original = button.textContent;
      button.textContent = 'Enlace copiado';
      setTimeout(() => { button.textContent = original; }, 1800);
    } catch (_) {
      alert('No se pudo copiar automáticamente. Copia la URL desde el navegador.');
    }
  });
});

function initProductUsecases() {
  const usecaseLayout = document.querySelector('.usecase-layout');
  if (!usecaseLayout) return;

  const conceptFlow = usecaseLayout.querySelector('.concept-flow');
  if (!conceptFlow) return;
  const conceptSteps = Array.from(conceptFlow.querySelectorAll('ol li'));
  const cards = usecaseLayout.querySelectorAll('.usecase-card');

  // Normalize string for fuzzy matching
  function cleanStr(str) {
    return str.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9ñ]/g, '');
  }

  // Find if two texts share any matching keyword of length >= 4
  function isMatch(textA, textB) {
    const cleanA = cleanStr(textA);
    const cleanB = cleanStr(textB);
    
    // Exact or contains match
    if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    
    // Word list match (if at least one word of length >= 4 matches)
    const wordsA = textA.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => w.length >= 4);
    const wordsB = textB.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(w => w.length >= 4);
    
    return wordsA.some(wa => wordsB.some(wb => wa.includes(wb) || wb.includes(wa)));
  }

  function highlightSteps(targetSteps = []) {
    if (targetSteps.length === 0) {
      conceptFlow.classList.remove('has-active');
      conceptSteps.forEach(li => {
        li.classList.remove('highlighted', 'dimmed');
      });
      return;
    }

    conceptFlow.classList.add('has-active');
    conceptSteps.forEach(li => {
      const liText = li.textContent.trim();
      const match = targetSteps.some(stepText => isMatch(liText, stepText));
      if (match) {
        li.classList.add('highlighted');
        li.classList.remove('dimmed');
      } else {
        li.classList.add('dimmed');
        li.classList.remove('highlighted');
      }
    });
  }

  cards.forEach(card => {
    const cardSteps = Array.from(card.querySelectorAll('.usecase-mini-flow b')).map(b => b.textContent.trim());

    // When hovering a usecase card, highlight all its steps
    card.addEventListener('mouseenter', () => {
      highlightSteps(cardSteps);
    });

    card.addEventListener('mouseleave', () => {
      highlightSteps([]);
    });

    // Also support hover over individual steps in the mini flow to focus on that step only
    card.querySelectorAll('.usecase-mini-flow b').forEach(b => {
      const stepText = b.textContent.trim();
      
      b.addEventListener('mouseenter', (e) => {
        e.stopPropagation(); // prevent card level hover
        highlightSteps([stepText]);
      });
      
      b.addEventListener('mouseleave', (e) => {
        e.stopPropagation();
        highlightSteps(cardSteps); // return to card level highlight
      });
    });
  });

  // Bidirectional interaction: hover over concept flow step highlights cards
  conceptSteps.forEach(li => {
    const liText = li.textContent.trim();

    li.addEventListener('mouseenter', () => {
      // Dim other concept flow steps
      conceptFlow.classList.add('has-active');
      conceptSteps.forEach(item => {
        if (item === li) {
          item.classList.add('highlighted');
          item.classList.remove('dimmed');
        } else {
          item.classList.add('dimmed');
          item.classList.remove('highlighted');
        }
      });

      // Highlight matching steps inside usecase cards
      cards.forEach(card => {
        const flowBubbles = Array.from(card.querySelectorAll('.usecase-mini-flow b'));
        const hasMatch = flowBubbles.some(b => isMatch(liText, b.textContent.trim()));
        if (hasMatch) {
          card.style.transform = 'translateY(-4px)';
          card.style.borderColor = 'var(--primary)';
          card.style.boxShadow = 'var(--heavy)';
          
          flowBubbles.forEach(b => {
            if (isMatch(liText, b.textContent.trim())) {
              b.style.background = 'var(--primary)';
              b.style.color = 'white';
              b.style.transform = 'scale(1.08)';
            }
          });
        } else {
          card.style.opacity = '0.4';
          card.style.transform = 'scale(0.98)';
        }
      });
    });

    li.addEventListener('mouseleave', () => {
      // Reset concept flow steps
      conceptFlow.classList.remove('has-active');
      conceptSteps.forEach(item => {
        item.classList.remove('highlighted', 'dimmed');
      });

      // Reset cards
      cards.forEach(card => {
        card.style.transform = '';
        card.style.borderColor = '';
        card.style.boxShadow = '';
        card.style.opacity = '';
        
        card.querySelectorAll('.usecase-mini-flow b').forEach(b => {
          b.style.background = '';
          b.style.color = '';
          b.style.transform = '';
        });
      });
    });
  });
}

// Initialize usecase diagrams interaction
initProductUsecases();
