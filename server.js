require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const slugify = require('slugify');
const OpenAI = require('openai');
const { PrismaClient, DeliveryMode } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const prisma = new PrismaClient();
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
const app = express();
const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname + '/public'));
app.use('/vendor/quill', express.static(path.join(__dirname, 'node_modules', 'quill', 'dist')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 8 }
}));

app.use(async (req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.path = req.path;
  res.locals.settings = await getSettings();
  res.locals.productTitle = productTitle;
  res.locals.productImage = productImage;
  res.locals.primaryContactEmail = primaryContactEmail;
  res.locals.whatsappUrl = whatsappUrl;
  res.locals.chatbotQuickReplies = chatbotQuickReplies;
  res.locals.formatDate = formatDate;
  res.locals.renderBlogContent = renderBlogContent;
  res.locals.statusLabel = statusLabel;
  res.locals.statusClass = statusClass;
  next();
});

async function getSettings() {
  return prisma.siteSetting.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
}

function productTitle(product) {
  const titles = {
    'perseus-erp': 'Control de producción, stock y trazabilidad industrial',
    'sistema-calibraciones': 'Gestión de calibraciones, evidencias y auditoría',
    forms: 'Formularios digitales para dejar atrás el papel',
    'portal-balances': 'Dashboards para balances e indicadores operacionales',
    bitacoras: 'Bitácoras digitales para turnos, eventos y seguimiento',
    'plataforma-zebbra': 'Monitoreo operacional y reportes SMA/DGA',
    'venta-pasajes-buses': 'Venta de pasajes, asientos y caja para buses',
    'perseus-ofa': 'Gestión de OFA, OFP y avance productivo',
    'opms-caitan': 'Nominaciones, proformas, documentos y control operativo',
    'bi-powerbi': 'Dashboards Power BI y datos listos para decidir',
    'consultoria-ia': 'IA útil para automatizar trabajo repetitivo'
  };
  return titles[product.slug] || product.summary || product.name;
}

function productImage(product, variant = '') {
  const images = {
    'perseus-erp': 'perseus-erp',
    'sistema-calibraciones': 'sistema-calibraciones',
    forms: 'forms-formularios-digitales',
    'portal-balances': 'portal-balances',
    bitacoras: 'bitacoras',
    'plataforma-zebbra': 'plataforma-zebbra',
    'venta-pasajes-buses': 'venta-pasajes-buses',
    'perseus-ofa': 'perseus-ofa-ofp',
    'opms-caitan': '/images/img-opms-caitan.svg',
    'bi-powerbi': 'bi-power-bi',
    'consultoria-ia': 'consultoria-ia'
  };
  const image = images[product.slug];
  if (!image) return product.image || '/images/img-opms-caitan.svg';
  if (image.startsWith('/images/')) return image;
  return `/images/${image}${variant ? `-${variant}` : ''}.png`;
}


function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function anyIncludes(text, terms) {
  const clean = normalizeText(text);
  const words = clean.split(' ').filter(Boolean);
  return terms.some(term => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    if (normalizedTerm.length <= 3 && !normalizedTerm.includes(' ')) {
      return words.includes(normalizedTerm);
    }
    return clean.includes(normalizedTerm);
  });
}

function compactText(value, max = 170) {
  const text = String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max).trim() + '...' : text;
}

const CHATBOT_STOPWORDS = new Set([
  'como', 'puedo', 'puede', 'resolver', 'solucionar', 'hacer', 'hace', 'para', 'por', 'con', 'sin',
  'una', 'uno', 'unos', 'unas', 'mis', 'mio', 'mia', 'empresa', 'negocio', 'necesito', 'quiero',
  'consulta', 'pregunta', 'ayuda', 'ayudar', 'sobre', 'cual', 'cuales', 'mejor', 'segun'
]);

function significantWords(value) {
  return normalizeText(value)
    .split(' ')
    .map(word => word.trim())
    .filter(word => word.length > 2 && !CHATBOT_STOPWORDS.has(word));
}

function todayInChile() {
  return new Intl.DateTimeFormat('es-CL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Santiago'
  }).format(new Date());
}

function timeInChile() {
  return new Intl.DateTimeFormat('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Santiago'
  }).format(new Date());
}

function productContextText(product, { detailed = false } = {}) {
  const modules = (product.modules || []).slice(0, detailed ? 12 : 7).join(', ');
  const benefits = (product.benefits || []).slice(0, detailed ? 7 : 4).join(', ');
  const industries = (product.industries || []).slice(0, 5).join(', ');
  const faqs = (product.faqs || []).slice(0, 2).map(faq => `\n- ${faq.question}: ${compactText(faq.answer, 150)}`).join('');
  return [
    `${product.name} (${product.category})`,
    compactText(product.description || product.summary, detailed ? 360 : 220),
    product.problem ? `Problema que resuelve: ${compactText(product.problem, detailed ? 260 : 180)}` : '',
    modules ? `Módulos principales: ${modules}.` : '',
    benefits ? `Beneficios: ${benefits}.` : '',
    industries ? `Áreas/industrias: ${industries}.` : '',
    faqs ? `Preguntas frecuentes relacionadas:${faqs}` : ''
  ].filter(Boolean).join('\n');
}

function buildChatbotWhatsApp(settings, text = '') {
  return whatsappUrl(settings.whatsappNumber, `${settings.whatsappMessage}\n\nConsulta desde chatbot: ${text || 'Quiero conversar con el equipo.'}`);
}

function chatbotKnowledgeBase(products = [], posts = []) {
  const productBlocks = products.map(product => {
    const faqs = (product.faqs || []).map(faq => `FAQ: ${faq.question} -> ${faq.answer}`).join('\n');
    return [
      `SOFTWARE: ${product.name}`,
      `Slug: ${product.slug}`,
      `Categoria: ${product.category}`,
      `Resumen: ${product.summary}`,
      `Descripcion: ${product.description}`,
      `Problema: ${product.problem}`,
      `Beneficios: ${(product.benefits || []).join('; ')}`,
      `Modulos: ${(product.modules || []).join('; ')}`,
      `Areas/industrias: ${(product.industries || []).join('; ')}`,
      faqs
    ].filter(Boolean).join('\n');
  }).join('\n\n---\n\n');

  const blogBlocks = posts.map(post => [
    `BLOG: ${post.title}`,
    `Categoria: ${post.category?.name || ''}`,
    `Resumen: ${compactText(post.excerpt || post.content, 420)}`,
    `URL: /blog/${post.slug}`
  ].join('\n')).join('\n\n---\n\n');

  return `PRODUCTOS Y SOFTWARE ITESICWS\n${productBlocks}\n\nBLOG Y CONTENIDO\n${blogBlocks}`;
}

function safeJsonFromText(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch (_) { return null; }
}

function openAiConfigured() {
  return !!openai && String(process.env.CHATBOT_AI_ENABLED || 'true').toLowerCase() !== 'false';
}

async function chatbotAnswerWithAI({ message, state, settings, products, posts }) {
  if (!openAiConfigured()) return null;

  const vectorStoreIds = String(process.env.OPENAI_VECTOR_STORE_ID || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);

  const tools = vectorStoreIds.length
    ? [{ type: 'file_search', vector_store_ids: vectorStoreIds, max_num_results: 6 }]
    : undefined;

  const previousMessages = Array.isArray(state.history)
    ? state.history.slice(-8).map(item => `${item.from || 'user'}: ${item.text}`).join('\n')
    : '';

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5-mini',
    reasoning: { effort: process.env.OPENAI_REASONING_EFFORT || 'low' },
    text: { verbosity: 'low' },
    tools,
    input: [
      {
        role: 'developer',
        content: [
          'Eres el asistente comercial y técnico de ITESICWS.',
          'Responde en español chileno, claro, útil y coherente.',
          'No vendas humo. Si el usuario pregunta algo casual, responde casual y breve.',
          'Si pregunta por una necesidad empresarial, recomienda una ruta concreta usando el contexto.',
          'Si no existe un software exacto, di que conviene software a medida y explica módulos esperables.',
          'No inventes certificaciones, normas legales ni precios.',
          'Nunca respondas solo por coincidencias de palabras; entiende el problema.',
          'Devuelve SOLO JSON válido con: answer, suggestions, actions, intent, leadHint, lastProductSlug.',
          'actions debe usar objetos {type:"link", label, url} o {type:"lead", label}.'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `Fecha actual Chile: ${todayInChile()}. Hora Chile: ${timeInChile()}.`,
          `Estado anterior: ${JSON.stringify(state || {})}`,
          previousMessages ? `Historial reciente:\n${previousMessages}` : '',
          `Contexto disponible:\n${chatbotKnowledgeBase(products, posts)}`,
          `Pregunta del usuario: ${message}`
        ].filter(Boolean).join('\n\n')
      }
    ],
    max_output_tokens: 900
  });

  const parsed = safeJsonFromText(response.output_text);
  if (!parsed || !parsed.answer) return null;

  const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : [];
  if (!actions.some(action => action.type === 'link' && /whatsapp/i.test(action.label || '')) && settings.whatsappNumber) {
    actions.push({ type: 'link', label: 'Hablar por WhatsApp', url: buildChatbotWhatsApp(settings, message) });
  }
  if (!actions.some(action => action.type === 'lead')) actions.push({ type: 'lead', label: 'Dejar mis datos' });

  return {
    ok: true,
    intent: parsed.intent || 'ai',
    lead: false,
    answer: String(parsed.answer).trim(),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : ['Ver productos', 'Hablar por WhatsApp'],
    actions,
    state: {
      intent: parsed.intent || 'ai',
      leadHint: parsed.leadHint || message,
      lastProductSlug: parsed.lastProductSlug || state.lastProductSlug
    }
  };
}

async function chatbotAnswer(message, state = {}) {
  const settings = await getSettings();
  const text = String(message || '').trim();
  const clean = normalizeText(text);
  const previousIntent = state.intent || '';
  const leadHint = state.leadHint || text;

  const products = await prisma.product.findMany({
    where: { published: true },
    include: { faqs: true },
    orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    take: 12
  });
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    include: { category: true },
    orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
    take: 6
  });

  const queryWords = significantWords(clean);
  const productMatches = products
    .map(product => {
      const haystack = normalizeText([product.name, product.slug, product.category, product.summary, product.description, product.problem, product.benefits.join(' '), product.modules.join(' '), product.industries.join(' '), product.faqs.map(faq => `${faq.question} ${faq.answer}`).join(' ')].join(' '));
      let score = queryWords.filter(word => haystack.includes(word)).length;
      if (anyIncludes(text, ['inventario', 'stock', 'bodega', 'almacen', 'existencias']) && product.slug === 'perseus-erp') score += 8;
      if (anyIncludes(text, ['pasaje', 'pasajes', 'bus', 'buses', 'asiento', 'boleto']) && product.slug === 'venta-pasajes-buses') score += 8;
      if (anyIncludes(text, ['sma', 'dga', 'zebbra', 'ambiental', 'datos faltantes']) && product.slug === 'plataforma-zebbra') score += 8;
      return { product, score };
    })
    .filter(item => item.score > 0 && (item.score > 1 || queryWords.length <= 1))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.product);

  const productExactMatches = products.filter(product => {
    const aliases = [
      product.name,
      product.slug,
      product.name.replace(/\s+/g, ''),
      product.slug.replace(/-/g, ' '),
      product.slug.split('-')[0]
    ].map(normalizeText);
    return aliases.some(alias => alias && (clean.includes(alias) || alias.includes(clean)));
  });
  const focusedProducts = (productExactMatches.length ? productExactMatches : productMatches).slice(0, 3);

  const blogMatches = posts
    .map(post => {
      const haystack = normalizeText([post.title, post.excerpt, post.category?.name, post.content].join(' '));
      const score = clean.split(' ').filter(word => word.length > 3 && haystack.includes(word)).length;
      return { post, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(item => item.post);

  const isGreeting = anyIncludes(text, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'necesito ayuda', 'ayuda']);
  const wantsHuman = anyIncludes(text, ['humano', 'ejecutivo', 'vendedor', 'contacto', 'llamar', 'telefono', 'whatsapp', 'hablar con alguien']);
  const wantsQuote = anyIncludes(text, ['cotizacion', 'cotizar', 'precio', 'valor', 'cuanto cuesta', 'presupuesto', 'demo', 'reunion', 'agendar']);
  const wantsChatbot = anyIncludes(text, ['chatbot', 'bot', 'asistente virtual', 'atencion automatica', 'whatsapp bot', 'ia conversacional']);
  const wantsAI = anyIncludes(text, ['ia', 'inteligencia artificial', 'agente', 'rag', 'documentos', 'automatizar', 'automatizacion']);
  const wantsAdminBlog = anyIncludes(text, ['blog', 'seo', 'contenido', 'articulos', 'noticias', 'admin', 'administrar']);
  const wantsBI = anyIncludes(text, ['power bi', 'dashboard', 'tablero', 'indicador', 'reporte', 'datos']);
  const wantsERP = anyIncludes(text, ['erp', 'stock', 'produccion', 'trazabilidad', 'calibracion', 'formularios', 'operacion', 'operacional']);
  const wantsInventory = anyIncludes(text, ['inventario', 'stock', 'bodega', 'bodegas', 'almacen', 'almacenes', 'existencias', 'control de materiales']);
  const wantsSoftware = anyIncludes(text, ['software a medida', 'sistema web', 'aplicacion web', 'plataforma', 'desarrollo', 'app interna']);
  const wantsAutomation = anyIncludes(text, ['automatizacion', 'automatizar', 'flujo', 'workflow', 'doble digitacion', 'excel', 'correos']);
  const wantsWebsite = anyIncludes(text, ['pagina web', 'sitio web', 'landing', 'web corporativa', 'tienda online', 'ecommerce', 'rediseño web', 'redisenar web']);
  const wantsIntegration = anyIncludes(text, ['integracion', 'integrar', 'api', 'conectar sistemas', 'base de datos', 'sql server', 'sap', 'erp existente']);
  const wantsSupport = anyIncludes(text, ['soporte', 'mantencion', 'error', 'problema', 'bug', 'no funciona', 'caido', 'lento']);
  const wantsFleetDispatch = anyIncludes(text, ['flota', 'camion', 'camiones', 'despacho', 'despachos', 'ruta', 'rutas', 'conductores', 'choferes', 'gps', 'tracking', 'seguimiento vehicular', 'materiales radioactivos', 'materiales radiactivos', 'carga peligrosa', 'mercancia peligrosa', 'sustancias peligrosas']);
  const asksCapability = anyIncludes(text, ['que haces', 'que pueden hacer', 'servicios', 'como me ayudas', 'que ofrecen', 'que venden']);
  const asksSecurity = anyIncludes(text, ['seguridad', 'permisos', 'roles', 'usuarios', 'auditoria', 'accesos']);
  const asksProductDetail = anyIncludes(text, ['modulo', 'modulos', 'area', 'areas', 'que hace', 'para que sirve', 'funcionalidad', 'funcionalidades', 'beneficio', 'beneficios', 'industria', 'industrias']);
  const asksDate = anyIncludes(text, ['que dia es', 'que fecha es', 'dia es hoy', 'fecha de hoy', 'hoy que dia']);
  const asksTime = anyIncludes(text, ['que hora es', 'hora actual', 'hora es']);
  const saysThanks = anyIncludes(text, ['gracias', 'muchas gracias', 'te pasaste', 'vale', 'ok gracias']);
  const saysConfused = anyIncludes(text, ['no entiendo', 'no entendi', 'explicame mejor', 'mas simple', 'en simple']);
  const isFrustrated = anyIncludes(text, ['malo', 'pesimo', 'inutil', 'no sirve', 'penca', 'estupido', 'ordinario', 'frustrante']);
  const asksFollowUpProduct = asksProductDetail && previousIntent === 'producto_detalle';

  const actions = [];
  if (settings.whatsappNumber) actions.push({ type: 'link', label: 'Hablar por WhatsApp', url: buildChatbotWhatsApp(settings, text) });
  actions.push({ type: 'lead', label: 'Dejar mis datos' });

  if (openAiConfigured()) {
    try {
      const aiAnswer = await chatbotAnswerWithAI({ message: text, state, settings, products, posts });
      if (aiAnswer) return aiAnswer;
    } catch (error) {
      console.error('Chatbot IA no disponible, usando reglas locales:', error.message);
    }
  }

  if (asksDate) {
    return {
      ok: true,
      intent: previousIntent || 'casual',
      lead: false,
      answer: `Hoy es ${todayInChile()}.`,
      suggestions: ['Volver a productos', 'Qué hace PERSEUS', 'Ver servicios', 'Hablar por WhatsApp'],
      actions: settings.whatsappNumber ? [{ type: 'link', label: 'Hablar por WhatsApp', url: buildChatbotWhatsApp(settings, text) }] : [],
      state: { intent: previousIntent || 'casual', leadHint }
    };
  }

  if (asksTime) {
    return {
      ok: true,
      intent: previousIntent || 'casual',
      lead: false,
      answer: `En Chile son aproximadamente las ${timeInChile()}.`,
      suggestions: ['Volver a productos', 'Qué hace Zebbra', 'Ver servicios', 'Hablar por WhatsApp'],
      actions: settings.whatsappNumber ? [{ type: 'link', label: 'Hablar por WhatsApp', url: buildChatbotWhatsApp(settings, text) }] : [],
      state: { intent: previousIntent || 'casual', leadHint }
    };
  }

  if (saysThanks) {
    return {
      ok: true,
      intent: previousIntent || 'thanks',
      lead: false,
      answer: '¡Gracias por escribir! Estoy listo para seguir ayudándote. Si quieres, puedo darte una recomendación concreta para tu caso o derivarte con el equipo.',
      suggestions: ['Qué hace PERSEUS', 'Qué hace Zebbra', 'Quiero una demo', 'Hablar por WhatsApp'],
      actions,
      state: { intent: previousIntent || 'thanks', leadHint }
    };
  }

  if (isFrustrated || saysConfused) {
    return {
      ok: true,
      intent: previousIntent || 'clarificacion',
      lead: false,
      answer: 'No te preocupes, vamos paso a paso. Cuéntame tu problema con tus propias palabras y te respondo claro: qué hace, qué módulos necesita y cuál es el siguiente paso.',
      suggestions: ['PERSEUS módulos', 'Zebbra reportes', 'Power BI datos', 'Hablar con humano'],
      actions,
      state: { intent: previousIntent || 'clarificacion', leadHint }
    };
  }

  if (wantsInventory) {
    const perseus = products.find(product => product.slug === 'perseus-erp');
    const bi = products.find(product => product.slug === 'bi-powerbi');
    const inventoryActions = [
      perseus ? { type: 'link', label: 'Ver PERSEUS ERP', url: `/productos/${perseus.slug}` } : null,
      ...actions
    ].filter(Boolean);
    return {
      ok: true,
      intent: 'inventario',
      lead: false,
      answer: [
        'Para resolver inventario en una empresa, partiría por ordenar tres cosas: entradas/salidas, stock por bodega y trazabilidad por producto o lote.',
        perseus ? `La opción más cercana es ${perseus.name}: usa módulos como ${(perseus.modules || []).filter(module => anyIncludes(module, ['stock', 'almacen', 'bodega', 'compras', 'produccion', 'ventas', 'reportes'])).slice(0, 6).join(', ') || 'Stock, Almacén y Bodegas, Compras, Producción y Reportes'}.` : '',
        'El flujo recomendado sería: registrar productos y bodegas, definir responsables, controlar movimientos, conectar compras/producción/ventas y después sacar reportes de diferencias, rotación y stock crítico.',
        bi ? 'Si ya tienes datos en planillas o sistemas separados, Power BI puede complementar con dashboards de stock, quiebres, rotación y valorización.' : ''
      ].filter(Boolean).join('\n\n'),
      suggestions: ['Módulos de inventario', 'Control por bodega', 'Reportes de stock', 'Quiero una demo'],
      actions: inventoryActions,
      state: { intent: 'inventario', leadHint: text, lastProductSlug: perseus?.slug || 'perseus-erp' }
    };
  }

  if (wantsFleetDispatch) {
    return {
      ok: true,
      intent: 'flota_despacho',
      lead: false,
      answer: [
        'Para una empresa de despacho de materiales sensibles o peligrosos, no recomendaría un chatbot ni una solución genérica. Recomendaría una plataforma operacional a medida para control de flota, trazabilidad y cumplimiento.',
        'El sistema debería cubrir: vehículos, conductores, rutas autorizadas, órdenes de despacho, estados del viaje, evidencias, incidentes, alertas, permisos, documentos del material y reportes para supervisión.',
        'Si el material es radiactivo o regulado, lo crítico es trazabilidad completa: quién despacha, qué unidad transporta, ruta, horarios, responsable, documentación, evidencias y cierre conforme.',
        'Como base técnica, se puede combinar software a medida con módulos tipo trazabilidad/operación de PERSEUS y tableros Power BI para monitorear viajes, tiempos, incidentes y cumplimiento.'
      ].join('\n\n'),
      suggestions: ['Control de flota', 'Trazabilidad de despachos', 'Alertas e incidentes', 'Quiero una demo'],
      actions: [
        { type: 'link', label: 'Ver productos', url: '/productos' },
        ...actions
      ],
      state: { intent: 'flota_despacho', leadHint: text }
    };
  }

  if (asksFollowUpProduct && state.lastProductSlug) {
    const product = products.find(item => item.slug === state.lastProductSlug);
    if (product) {
      return {
        ok: true,
        intent: 'producto_detalle',
        lead: false,
        answer: `${productContextText(product, { detailed: true })}\n\nSi quieres, también puedo separarlo por módulos críticos para partir una implementación.`,
        suggestions: ['Módulos críticos', 'Áreas que lo usan', 'Beneficios principales', 'Quiero una demo'],
        actions: [{ type: 'link', label: `Ver ${product.name}`, url: `/productos/${product.slug}` }, ...actions],
        state: { intent: 'producto_detalle', leadHint: text, lastProductSlug: product.slug }
      };
    }
  }

  if (isGreeting || clean === 'inicio' || clean === 'menu') {
    return {
      ok: true,
      intent: 'welcome',
      lead: false,
      answer: settings.chatbotWelcome || '¡Hola! Soy tu asistente digital de ITESICWS. Estoy aquí para ayudarte con software, datos, IA o para conectarte con un humano del equipo. ¿Qué te gustaría resolver hoy?',
      suggestions: ['Consultoría IA', 'Software a medida', 'Power BI / Datos', 'Automatización', 'Chatbot inteligente'],
      cards: ['Consultoría IA', 'Software a medida', 'Power BI / Datos', 'Automatización', 'Chatbot inteligente', 'Hablar con humano'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, { type: 'link', label: 'Consultoría IA', url: '/consultoria-ia' }],
      state: { intent: 'welcome', leadHint }
    };
  }

  if (focusedProducts.length && (asksProductDetail || productExactMatches.length)) {
    const detailed = focusedProducts.length === 1;
    const answer = focusedProducts.map(product => productContextText(product, { detailed })).join('\n\n');
    const suggestions = focusedProducts.length === 1
      ? ['Qué módulos tiene', 'Qué áreas lo usan', 'Beneficios principales', 'Quiero una demo']
      : focusedProducts.map(product => `Ver ${product.name}`).slice(0, 3).concat(['Quiero una demo']);
    return {
      ok: true,
      intent: 'producto_detalle',
      lead: false,
      answer: `${answer}\n\nSi me dices tu área o proceso, puedo recomendarte qué módulos aplicar primero.`,
      suggestions,
      actions: [{ type: 'link', label: `Ver ${focusedProducts[0].name}`, url: `/productos/${focusedProducts[0].slug}` }, ...actions],
      state: { intent: 'producto_detalle', leadHint: text, lastProductSlug: focusedProducts[0].slug }
    };
  }

  if (asksCapability) {
    return {
      ok: true,
      intent: 'servicios',
      lead: false,
      answer: 'Estoy listo para ayudarte con tu caso concreto. Si me cuentas tu problema en una frase, te digo qué camino conviene y cuál es el primer paso más práctico para avanzar.',
      suggestions: ['Tengo un proceso en Excel', 'Quiero IA en mi empresa', 'Necesito reportes', 'Conectar sistemas'],
      cards: ['Software a medida', 'Consultoría IA', 'Power BI / Datos', 'Automatización', 'Hablar con humano'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, ...actions],
      state: { intent: 'servicios', leadHint }
    };
  }

  if (wantsSupport) {
    return {
      ok: true,
      intent: 'soporte',
      lead: false,
      answer: 'Si necesitas soporte, dime qué sistema está afectado, qué error ves y desde cuándo ocurre. Si quieres, te ayudo a preparar el mensaje y también puedo recomendarte la vía más rápida para priorizarlo.',
      suggestions: ['Sistema caído', 'Error de usuario', 'Problema de reportes', 'Hablar por WhatsApp'],
      actions,
      state: { intent: 'soporte', leadHint: text }
    };
  }

  if (wantsHuman || wantsQuote || previousIntent === 'qualification') {
    return {
      ok: true,
      intent: 'lead',
      lead: false,
      answer: 'Perfecto, te acompaño. Cuéntame qué proceso quieres resolver, cuántas personas lo usan y si hoy lo manejan con Excel, correos u otro sistema. Así te recomiendo la mejor forma de avanzar.',
      suggestions: ['Lo usamos 8 personas', 'Hoy usamos Excel', 'Necesito integrar sistemas', 'Dejar mis datos'],
      actions,
      state: { intent: 'lead', leadHint }
    };
  }

  if (wantsSoftware) {
    return {
      ok: true,
      intent: 'software',
      lead: false,
      answer: 'Perfecto, vamos con una solución práctica. Primero entiendo tu proceso y quién lo usa, luego propongo una versión mínima que funcione rápido y que puedas escalar sin complicaciones.',
      suggestions: ['Tengo un proceso en Excel', 'Necesito usuarios y permisos', 'Quiero una demo', 'Hablar con humano'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, ...actions],
      state: { intent: 'software', leadHint: text }
    };
  }

  if (wantsWebsite) {
    return {
      ok: true,
      intent: 'web',
      lead: false,
      answer: 'Para una web efectiva no basta con que se vea bien: debe generar consultas, funcionar rápido en móvil y ser fácil de actualizar. Puedo ayudarte a definir un sitio claro y orientado a clientes, no solo a diseño.',
      suggestions: ['Web corporativa', 'Landing para leads', 'Blog administrable', 'Quiero cotizar'],
      actions: [{ type: 'link', label: 'Ver blog', url: '/blog' }, ...actions],
      state: { intent: 'web', leadHint: text }
    };
  }

  if (wantsIntegration) {
    return {
      ok: true,
      intent: 'integraciones',
      lead: false,
      answer: 'Para integrar sistemas revisamos qué plataformas deben conversar, qué datos se mueven, frecuencia, reglas de validación y trazabilidad de errores. El objetivo es dejar un flujo estable, monitoreable y sin depender de copiar datos a mano.',
      suggestions: ['Conectar APIs', 'Integrar base de datos', 'Evitar doble digitación', 'Quiero una reunión'],
      actions,
      state: { intent: 'integraciones', leadHint: text }
    };
  }

  if (wantsAutomation) {
    return {
      ok: true,
      intent: 'automatizacion',
      lead: false,
      answer: 'Para automatizar bien conviene empezar por una tarea que te quite tiempo todos los días. Dime qué parte de tu trabajo es lenta y te digo qué automatizar primero para que se note rápido.',
      suggestions: ['Automatizar Excel', 'Digitalizar aprobaciones', 'Integrar sistemas', 'Quiero cotizar'],
      actions,
      state: { intent: 'automatizacion', leadHint: text }
    };
  }

  if (wantsChatbot) {
    return {
      ok: true,
      intent: 'chatbot',
      lead: false,
      answer: 'Un chatbot casi siempre funciona mejor si se diseña como un asistente. Debe responder claro, entender lo que buscas y derivar al equipo cuando haga falta. Aquí podemos partir con el contenido del sitio y luego hacerlo más inteligente con tus datos.',
      suggestions: ['Que responda FAQs', 'Que derive a WhatsApp', 'Conectar con documentos', 'Quiero cotizar'],
      actions: [{ type: 'link', label: 'Ver consultoría IA', url: '/consultoria-ia' }, ...actions],
      state: { intent: 'chatbot', leadHint: text }
    };
  }

  if (wantsAI) {
    return {
      ok: true,
      intent: 'ia',
      lead: false,
      answer: 'Para IA prefiero hablar de un caso real y práctico. Dime qué proceso o documento quieres mejorar y te siento una ruta clara para que no quede en teoría.',
      suggestions: ['IA para documentos', 'Automatizar reportes', 'Asistente interno'],
      actions: [{ type: 'link', label: 'Ver consultoría IA', url: '/consultoria-ia' }, ...actions],
      state: { intent: 'ia', leadHint: text }
    };
  }

  if (wantsAdminBlog) {
    return {
      ok: true,
      intent: 'blog',
      lead: false,
      answer: 'El blog administrable sirve para publicar artículos, categorías, destacados, imágenes, FAQs y contenido SEO. Lo importante es que el admin permita escribir rápido, filtrar, guardar borradores, destacar publicaciones y medir qué temas generan leads.',
      suggestions: ['Cómo mejorar SEO', 'Quiero publicar artículos', 'Necesito admin más cómodo'],
      actions: [{ type: 'link', label: 'Ver blog', url: '/blog' }, { type: 'lead', label: 'Quiero mejorarlo' }],
      state: { intent: 'blog', leadHint: text }
    };
  }

  if (wantsBI) {
    return {
      ok: true,
      intent: 'bi',
      lead: false,
      answer: 'Si tienes datos, te ayudo a convertirlos en decisiones claras y no en gráficos bonitos. Cuéntame qué necesitas ver con urgencia y te sugiero el dashboard más útil para empezar.',
      suggestions: ['Dashboard ejecutivo', 'Automatizar Excel', 'Conectar bases de datos'],
      actions,
      state: { intent: 'bi', leadHint: text }
    };
  }

  if (wantsERP) {
    return {
      ok: true,
      intent: 'operacional',
      lead: false,
      answer: 'Para procesos operacionales se puede construir una plataforma con usuarios, estados, trazabilidad, evidencias, reportes y alertas. Esto aplica a producción, stock, calibraciones, bitácoras, formularios y seguimiento de tareas.',
      suggestions: ['Sistema para producción', 'Digitalizar formularios', 'Trazabilidad y reportes'],
      actions,
      state: { intent: 'operacional', leadHint: text }
    };
  }

  if (asksSecurity) {
    return {
      ok: true,
      intent: 'seguridad',
      lead: false,
      answer: 'En sistemas empresariales trabajamos con usuarios, roles, permisos por módulo, auditoría de acciones y separación de responsabilidades. Para definirlo bien hay que mapear perfiles: quién registra, quién revisa, quién aprueba y quién solo consulta reportes.',
      suggestions: ['Roles y permisos', 'Auditoría', 'Usuarios por área', 'Software a medida'],
      actions,
      state: { intent: 'seguridad', leadHint: text }
    };
  }

  if (productMatches.length) {
    const lines = productMatches.map(product => `• ${product.name}: ${compactText(product.summary || product.description, 145)} Módulos: ${(product.modules || []).slice(0, 4).join(', ')}.`).join('\n');
    return {
      ok: true,
      intent: 'producto',
      lead: false,
      answer: `Encontré soluciones relacionadas:\n${lines}\n\n¿Quieres que te recomiende cuál calza mejor según tu proceso?`,
      suggestions: ['Recomiéndame una opción', 'Quiero demo', 'Hablar con el equipo'],
      actions: [{ type: 'link', label: `Ver ${productMatches[0].name}`, url: `/productos/${productMatches[0].slug}` }, ...actions],
      state: { intent: 'producto', leadHint: text, lastProductSlug: productMatches[0].slug }
    };
  }

  if (blogMatches.length) {
    const lines = blogMatches.map(post => `• ${post.title}: ${compactText(post.excerpt || post.content, 130)}`).join('\n');
    return {
      ok: true,
      intent: 'blog_match',
      lead: false,
      answer: `Tengo contenido relacionado en el blog:\n${lines}\n\nPuedo orientarte o derivarte al equipo si quieres implementar algo parecido.`,
      suggestions: ['Quiero implementar esto', 'Ver productos', 'Hablar por WhatsApp'],
      actions: [{ type: 'link', label: 'Leer artículo', url: `/blog/${blogMatches[0].slug}` }, ...actions],
      state: { intent: 'blog_match', leadHint: text }
    };
  }

  if (isGreeting) {
    return {
      ok: true,
      intent: 'welcome',
      lead: false,
      answer: settings.chatbotWelcome || 'Hola, soy el asistente de ITESICWS. Puedo orientarte sobre software a medida, IA, Power BI, ERP, formularios digitales, blog o demos.',
      suggestions: ['Necesito software a medida', 'Quiero un chatbot IA', 'Quiero una demo', 'Ver productos'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, { type: 'link', label: 'Consultoría IA', url: '/consultoria-ia' }],
      state: { intent: 'welcome', leadHint }
    };
  }

  return {
    ok: true,
    intent: 'fallback',
    lead: false,
    answer: 'No quiero darte una respuesta genérica. Cuéntame con palabras simples qué quieres mejorar, qué te complica o qué resultado buscas, y te doy una sugerencia práctica y clara.',
    suggestions: ['Página web', 'Software a medida', 'Consultoría IA', 'Power BI / Datos', 'Conectar sistemas'],
    cards: ['Consultoría IA', 'Software a medida', 'Power BI / Datos', 'Automatización', 'Chatbot inteligente', 'Hablar con humano'],
    actions,
    state: { intent: 'fallback', leadHint: text || leadHint }
  };
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/admin/login');
  next();
}

function splitLines(value) {
  if (Array.isArray(value)) return value;
  return (value || '').split('\n').map(x => x.trim()).filter(Boolean);
}

function chatbotQuickReplies(settings) {
  return splitLines(settings.chatbotQuickReplies || '')
    .slice(0, 6);
}

function splitFaqs(value) {
  return splitLines(value)
    .map(line => {
      const [question, ...answerParts] = line.split('|');
      return { question: (question || '').trim(), answer: answerParts.join('|').trim() };
    })
    .filter(faq => faq.question && faq.answer);
}

function formatDate(date) {
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date));
}

function statusLabel(status) {
  return ({ NEW: 'Nuevo', CONTACTED: 'Contactado', IN_PROGRESS: 'En gestión', CLOSED: 'Cerrado' })[status] || status;
}

function statusClass(status) {
  return ({ NEW: 'info', CONTACTED: 'warning', IN_PROGRESS: 'success', CLOSED: 'muted' })[status] || '';
}

function csvCell(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function paragraphs(value) {
  return String(value || '').split(/\n{2,}/).map(x => x.trim()).filter(Boolean);
}

function markdownishToHtml(value) {
  return paragraphs(value).map(block => {
    if (block.startsWith('## ')) return `<h2>${escapeHtml(block.replace(/^##\s*/, ''))}</h2>`;
    if (block.startsWith('### ')) return `<h3>${escapeHtml(block.replace(/^###\s*/, ''))}</h3>`;
    const image = block.match(/^!\[(.*)\]\((.*)\)$/);
    if (image) {
      return `<figure class="blog-inline-image"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1] || 'Imagen del articulo')}">${image[1] ? `<figcaption>${escapeHtml(image[1])}</figcaption>` : ''}</figure>`;
    }
    if (block.startsWith('> ')) return `<blockquote>${escapeHtml(block.replace(/^>\s*/, ''))}</blockquote>`;
    if (block.startsWith('- ')) {
      return `<ul>${block.split('\n').filter(line => line.startsWith('- ')).map(line => `<li>${escapeHtml(line.replace(/^-\s*/, ''))}</li>`).join('')}</ul>`;
    }
    return `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

function renderBlogContent(value) {
  const content = String(value || '').trim();
  if (!content) return '';
  if (/<\/?[a-z][\s\S]*>/i.test(content)) return content;
  return markdownishToHtml(content);
}

function readMinutes(value) {
  const words = String(value || '').replace(/<[^>]*>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 190));
}

function whatsappUrl(number, text) {
  const clean = (number || '').replace(/[^0-9]/g, '');
  return clean ? `https://wa.me/${clean}?text=${encodeURIComponent(text)}` : '';
}

function emailRecipients(value) {
  return String(value || '')
    .split(/[\n,;]+/)
    .map(email => email.trim())
    .filter(Boolean);
}

function primaryContactEmail(settings) {
  return emailRecipients(settings.contactEmail)[0] || 'frubilar@itesic.cl';
}

function isConfigured(value) {
  return value && !String(value).startsWith('tu-') && !String(value).includes('change-me');
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function smtpConfig(settings) {
  const mailerService = (process.env.MAILER_SERVICE || '').toLowerCase();
  const settingsConfigured = settings.smtpHost && settings.smtpUser && settings.smtpPass;
  const envHost = process.env.SMTP_HOST || (mailerService === 'gmail' ? 'smtp.gmail.com' : '');
  const envUser = process.env.SMTP_USER || process.env.MAILER_AUTH_USER;
  const envPass = process.env.SMTP_PASS || process.env.MAILER_AUTH_PASS;
  const host = settingsConfigured ? settings.smtpHost : envHost;
  const user = settingsConfigured ? settings.smtpUser : envUser;
  const pass = settingsConfigured ? settings.smtpPass : envPass;
  const port = Number(settingsConfigured ? settings.smtpPort : (process.env.SMTP_PORT || process.env.MAILER_PORT || 587));
  const from = (settingsConfigured ? settings.smtpFrom : (process.env.SMTP_FROM || process.env.MAILER_DEFAULT_FROM)) || user;
  const secureFromEnv = String(process.env.SMTP_SECURE || process.env.MAILER_SECURE || '').toLowerCase() === 'true';
  const secure = settingsConfigured ? settings.smtpSecure || port === 465 : secureFromEnv || port === 465;
  if (!isConfigured(host) || !isConfigured(user) || !isConfigured(pass)) return null;
  return { host, port, user, pass, from, secure };
}

async function sendLeadEmail(settings, lead) {
  const smtp = smtpConfig(settings);
  if (!smtp) return { sent: false, reason: 'SMTP no configurado. Completa host, usuario y contraseña SMTP en Admin > Configuración o en el .env.' };
  const replyTo = `${lead.name} <${lead.email}>`;
  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass }
  });
  const plainText = `Nuevo lead ITESICWS

Nombre: ${lead.name}
Empresa: ${lead.company || '-'}
Cargo: ${lead.role || '-'}
Email: ${lead.email}
Teléfono: ${lead.phone || '-'}
Interés: ${lead.interest}

Mensaje:
${lead.message}`;
  await transporter.sendMail({
    from: smtp.from,
    to: emailRecipients(settings.contactEmail),
    replyTo,
    subject: `Nuevo lead ITESICWS: ${lead.interest}`,
    text: plainText,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#111827">
        <h2 style="margin:0 0 12px">Nuevo lead desde ITESICWS</h2>
        <p style="color:#4b5563">Una persona completó el formulario del sitio.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          ${[
            ['Nombre', lead.name],
            ['Empresa', lead.company || '-'],
            ['Cargo', lead.role || '-'],
            ['Email', lead.email],
            ['Teléfono', lead.phone || '-'],
            ['Interés', lead.interest]
          ].map(([label, value]) => `<tr><td style="padding:10px;border:1px solid #e5e7eb;background:#f9fafb;font-weight:700">${escapeHtml(label)}</td><td style="padding:10px;border:1px solid #e5e7eb">${escapeHtml(value)}</td></tr>`).join('')}
        </table>
        <h3>Mensaje</h3>
        <p style="white-space:pre-line;background:#f9fafb;border:1px solid #e5e7eb;padding:14px;border-radius:8px">${escapeHtml(lead.message || '-')}</p>
        <p>
          <a href="mailto:${lead.email}" style="display:inline-block;background:#2f6bff;color:white;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700">Responder por correo</a>
          ${lead.phone ? `<a href="${whatsappUrl(lead.phone, `Hola ${lead.name}, te contacto por tu solicitud sobre ${lead.interest}.`)}" style="display:inline-block;margin-left:8px;background:#16b7a3;color:white;padding:12px 16px;border-radius:8px;text-decoration:none;font-weight:700">Responder por WhatsApp</a>` : ''}
        </p>
      </div>`
  });
  return { sent: true };
}

app.get('/', async (req, res) => {
  const [products, latestPosts] = await Promise.all([
    prisma.product.findMany({ where: { published: true }, orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }] }),
    prisma.blogPost.findMany({ where: { published: true }, include: { category: true }, orderBy: { publishedAt: 'desc' }, take: 3 })
  ]);
  res.render('home', { products, latestPosts, pageTitle: `${res.locals.settings.siteName} - Software, datos e IA para empresas`, pageDescription: res.locals.settings.heroSubtitle });
});

app.get('/productos', async (req, res) => {
  const products = await prisma.product.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  res.render('products', { products, pageTitle: `Productos - ${res.locals.settings.siteName}`, pageDescription: 'Soluciones empresariales de software, ERP, Power BI, formularios digitales, IA e integración de sistemas.' });
});

app.get('/productos/:slug', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { faqs: true } });
  if (!product || !product.published) return res.status(404).render('404');
  res.render('product-detail', { product, pageTitle: `${productTitle(product)} - ${res.locals.settings.siteName}`, pageDescription: product.summary || product.description });
});

app.get('/blog', async (req, res) => {
  const selectedCategory = String(req.query.categoria || '').trim();
  const search = String(req.query.q || '').trim();
  const where = {
    published: true,
    ...(selectedCategory ? { category: { slug: selectedCategory } } : {}),
    ...(search ? {
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    } : {})
  };
  const [categories, featuredPost, posts] = await Promise.all([
    prisma.blogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.blogPost.findFirst({
      where: { published: true, featured: true },
      include: { category: true },
      orderBy: { publishedAt: 'desc' }
    }),
    prisma.blogPost.findMany({
      where,
      include: { category: true },
      orderBy: { publishedAt: 'desc' }
    })
  ]);
  res.render('blog', { categories, featuredPost, posts, selectedCategory, search, pageTitle: `Blog - ${res.locals.settings.siteName}`, pageDescription: 'Noticias, guías y análisis sobre IA, software empresarial, automatización, Power BI y transformación digital.' });
});

app.get('/blog/:slug', async (req, res) => {
  const post = await prisma.blogPost.findUnique({
    where: { slug: req.params.slug },
    include: { category: true, faqs: true }
  });
  if (!post || !post.published) return res.status(404).render('404');
  const relatedPosts = await prisma.blogPost.findMany({
    where: { published: true, id: { not: post.id }, categoryId: post.categoryId },
    include: { category: true },
    orderBy: { publishedAt: 'desc' },
    take: 3
  });
  res.render('blog-detail', { post, relatedPosts, pageTitle: `${post.title} - Blog ${res.locals.settings.siteName}`, pageDescription: post.excerpt || `Artículo de ${post.category.name}` });
});

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: ' + `${req.protocol}://${req.get('host')}/sitemap.xml` + '\n');
});

app.get('/sitemap.xml', async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const [products, posts] = await Promise.all([
    prisma.product.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    prisma.blogPost.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } })
  ]);
  const urls = [
    ['/', new Date()],
    ['/productos', new Date()],
    ['/consultoria-ia', new Date()],
    ['/blog', new Date()],
    ...products.map(p => [`/productos/${p.slug}`, p.updatedAt]),
    ...posts.map(post => [`/blog/${post.slug}`, post.updatedAt])
  ];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([url, updatedAt]) => `  <url><loc>${base}${url}</loc><lastmod>${new Date(updatedAt).toISOString()}</lastmod></url>`).join('\n')}
</urlset>`);
});

app.get('/consultoria-ia', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: 'consultoria-ia' }, include: { faqs: true } });
  res.render('consultoria-ia', { product });
});

app.post('/leads', async (req, res) => {
  const settings = await getSettings();
  const lead = await prisma.lead.create({ data: {
    name: req.body.name,
    company: req.body.company || null,
    role: req.body.role || null,
    email: req.body.email,
    phone: req.body.phone || null,
    interest: req.body.interest || 'Contacto general',
    message: req.body.message || ''
  }});
  let emailResult = null;
  if ([DeliveryMode.EMAIL, DeliveryMode.EMAIL_AND_WHATSAPP].includes(settings.leadDeliveryMode)) {
    try { emailResult = await sendLeadEmail(settings, lead); } catch (e) { emailResult = { sent: false, reason: e.message }; }
  }
  let whatsapp = '';
  if ([DeliveryMode.WHATSAPP, DeliveryMode.EMAIL_AND_WHATSAPP].includes(settings.leadDeliveryMode)) {
    const msg = `${settings.whatsappMessage}\n\nNombre: ${lead.name}\nEmpresa: ${lead.company || '-'}\nEmail: ${lead.email}\nInterés: ${lead.interest}\nMensaje: ${lead.message}`;
    whatsapp = whatsappUrl(settings.whatsappNumber, msg);
  }
  res.render('lead-thanks', { lead, whatsapp, emailResult });
});



app.post('/api/chatbot/message', async (req, res) => {
  try {
    const message = String(req.body.message || '').trim();
    const state = req.body.state && typeof req.body.state === 'object' ? req.body.state : {};
    if (!message) return res.status(400).json({ ok: false, error: 'Escribe una consulta para responderte.' });
    const result = await chatbotAnswer(message, state);
    res.json(result);
  } catch (error) {
    console.error('Chatbot error:', error);
    res.status(500).json({ ok: false, error: 'No pude responder ahora. Puedes dejar tus datos o escribir por WhatsApp.' });
  }
});

app.post('/api/chatbot/lead', async (req, res) => {
  try {
    const settings = await getSettings();
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim();
    const phone = String(req.body.phone || '').trim();
    const message = String(req.body.message || '').trim();
    const interest = String(req.body.interest || 'Chatbot del sitio').trim();
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: 'Nombre, correo y mensaje son obligatorios.' });
    }
    const lead = await prisma.lead.create({ data: {
      name,
      company: req.body.company || null,
      role: req.body.role || null,
      email,
      phone: phone || null,
      interest,
      message
    }});
    let emailResult = null;
    if ([DeliveryMode.EMAIL, DeliveryMode.EMAIL_AND_WHATSAPP].includes(settings.leadDeliveryMode)) {
      try { emailResult = await sendLeadEmail(settings, lead); } catch (e) { emailResult = { sent: false, reason: e.message }; }
    }
    const whatsapp = whatsappUrl(settings.whatsappNumber, `${settings.whatsappMessage}\n\nNombre: ${lead.name}\nEmail: ${lead.email}\nInterés: ${lead.interest}\nMensaje: ${lead.message}`);
    res.json({ ok: true, message: 'Solicitud recibida. Te contactaremos pronto.', whatsapp, emailResult });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'No se pudo guardar la solicitud. Intenta nuevamente.' });
  }
});

app.get('/admin/login', (req, res) => res.render('admin/login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.render('admin/login', { error: 'Credenciales inválidas' });
  req.session.user = { id: user.id, email: user.email, name: user.name };
  res.redirect('/admin');
});
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/admin', requireAuth, async (req, res) => {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const [productCount, publishedProductCount, leadCount, newLeadCount, blogCount, publishedBlogCount, draftBlogCount, latestLeads, latestPosts, leadStatusGroups] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { published: true } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.blogPost.count(),
    prisma.blogPost.count({ where: { published: true } }),
    prisma.blogPost.count({ where: { published: false } }),
    prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    prisma.blogPost.findMany({ include: { category: true }, orderBy: { updatedAt: 'desc' }, take: 5 }),
    prisma.lead.groupBy({ by: ['status'], _count: { status: true } })
  ]);
  const leadStatusCounts = leadStatusGroups.reduce((acc, item) => ({ ...acc, [item.status]: item._count.status }), {});
  res.render('admin/dashboard', { productCount, publishedProductCount, leadCount, newLeadCount, blogCount, publishedBlogCount, draftBlogCount, latestLeads, latestPosts, leadStatusCounts });
});

app.get('/admin/products', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const category = String(req.query.category || '').trim();
  const where = {
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { slug: { contains: q, mode: 'insensitive' } }
    ] } : {}),
    ...(status === 'published' ? { published: true } : {}),
    ...(status === 'draft' ? { published: false } : {}),
    ...(status === 'featured' ? { featured: true } : {}),
    ...(category ? { category } : {})
  };
  const [products, categories] = await Promise.all([
    prisma.product.findMany({ where, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    prisma.product.findMany({ select: { category: true }, distinct: ['category'], orderBy: { category: 'asc' } })
  ]);
  res.render('admin/products', { products, categories: categories.map(x => x.category).filter(Boolean), filters: { q, status, category } });
});
app.post('/admin/upload-image', requireAuth, upload.single('imageFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se pudo procesar la imagen' });
  }
  res.json({ imageUrl: `/uploads/${req.file.filename}` });
});

app.get('/admin/products/new', requireAuth, (req, res) => res.render('admin/product-form', { product: null }));
app.post('/admin/products', requireAuth, async (req, res) => {
  const slug = req.body.slug || slugify(req.body.name, { lower: true, strict: true });
  await prisma.product.create({ data: {
    name: req.body.name, slug, category: req.body.category || 'General', summary: req.body.summary || '',
    description: req.body.description || '', problem: req.body.problem || '', image: req.body.image || '/images/product-ai.svg',
    benefits: splitLines(req.body.benefits), modules: splitLines(req.body.modules), industries: splitLines(req.body.industries),
    cta: req.body.cta || 'Solicitar demo', published: !!req.body.published, featured: !!req.body.featured, sortOrder: Number(req.body.sortOrder || 0)
  }});
  res.redirect('/admin/products');
});
app.get('/admin/products/:id/edit', requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  res.render('admin/product-form', { product });
});
app.post('/admin/products/:id', requireAuth, async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: {
    name: req.body.name, slug: req.body.slug || slugify(req.body.name, { lower: true, strict: true }), category: req.body.category || 'General',
    summary: req.body.summary || '', description: req.body.description || '', problem: req.body.problem || '', image: req.body.image || '/images/product-ai.svg',
    benefits: splitLines(req.body.benefits), modules: splitLines(req.body.modules), industries: splitLines(req.body.industries),
    cta: req.body.cta || 'Solicitar demo', published: !!req.body.published, featured: !!req.body.featured, sortOrder: Number(req.body.sortOrder || 0)
  }});
  res.redirect('/admin/products');
});
app.post('/admin/products/:id/toggle-published', requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (product) await prisma.product.update({ where: { id: product.id }, data: { published: !product.published } });
  res.redirect('/admin/products');
});
app.post('/admin/products/:id/duplicate', requireAuth, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: req.params.id } });
  if (product) {
    const copySlug = `${product.slug}-copia-${Date.now().toString().slice(-4)}`;
    await prisma.product.create({ data: {
      name: `${product.name} copia`, slug: copySlug, category: product.category, summary: product.summary, description: product.description,
      problem: product.problem, benefits: product.benefits, modules: product.modules, industries: product.industries, image: product.image,
      cta: product.cta, published: false, featured: false, sortOrder: product.sortOrder + 1
    }});
  }
  res.redirect('/admin/products');
});
app.post('/admin/products/:id/delete', requireAuth, async (req, res) => { await prisma.product.delete({ where: { id: req.params.id } }); res.redirect('/admin/products'); });

app.get('/admin/blog', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const categoryId = String(req.query.categoryId || '').trim();
  const where = {
    ...(q ? { OR: [
      { title: { contains: q, mode: 'insensitive' } },
      { excerpt: { contains: q, mode: 'insensitive' } },
      { content: { contains: q, mode: 'insensitive' } }
    ] } : {}),
    ...(status === 'published' ? { published: true } : {}),
    ...(status === 'draft' ? { published: false } : {}),
    ...(status === 'featured' ? { featured: true } : {}),
    ...(categoryId ? { categoryId } : {})
  };
  const [posts, categories] = await Promise.all([
    prisma.blogPost.findMany({ where, include: { category: true }, orderBy: { publishedAt: 'desc' } }),
    prisma.blogCategory.findMany({ include: { _count: { select: { posts: true } } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  ]);
  const counters = { total: await prisma.blogPost.count(), published: await prisma.blogPost.count({ where: { published: true } }), draft: await prisma.blogPost.count({ where: { published: false } }), featured: await prisma.blogPost.count({ where: { featured: true } }) };
  res.render('admin/blog', { posts, categories, filters: { q, status, categoryId }, counters });
});

app.get('/admin/blog/new', requireAuth, async (req, res) => {
  const categories = await prisma.blogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  res.render('admin/blog-form', { post: null, categories });
});

app.post('/admin/blog', requireAuth, async (req, res) => {
  const slug = req.body.slug || slugify(req.body.title, { lower: true, strict: true });
  const content = req.body.content || '';
  const post = await prisma.blogPost.create({ data: {
    title: req.body.title,
    slug,
    categoryId: req.body.categoryId,
    excerpt: req.body.excerpt || '',
    content,
    image: req.body.image || '/images/consultoria-ia.png',
    author: req.body.author || 'ITESICWS',
    readMinutes: Number(req.body.readMinutes || readMinutes(content)),
    published: !!req.body.published,
    featured: !!req.body.featured,
    publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()
  }});
  const faqs = splitFaqs(req.body.faqs);
  if (faqs.length) await prisma.blogFAQ.createMany({ data: faqs.map(f => ({ ...f, postId: post.id })) });
  res.redirect('/admin/blog');
});

app.get('/admin/blog/:id/edit', requireAuth, async (req, res) => {
  const [post, categories] = await Promise.all([
    prisma.blogPost.findUnique({ where: { id: req.params.id }, include: { faqs: true } }),
    prisma.blogCategory.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] })
  ]);
  res.render('admin/blog-form', { post, categories });
});

app.post('/admin/blog/:id', requireAuth, async (req, res) => {
  const content = req.body.content || '';
  await prisma.blogPost.update({ where: { id: req.params.id }, data: {
    title: req.body.title,
    slug: req.body.slug || slugify(req.body.title, { lower: true, strict: true }),
    categoryId: req.body.categoryId,
    excerpt: req.body.excerpt || '',
    content,
    image: req.body.image || '/images/consultoria-ia.png',
    author: req.body.author || 'ITESICWS',
    readMinutes: Number(req.body.readMinutes || readMinutes(content)),
    published: !!req.body.published,
    featured: !!req.body.featured,
    publishedAt: req.body.publishedAt ? new Date(req.body.publishedAt) : new Date()
  }});
  await prisma.blogFAQ.deleteMany({ where: { postId: req.params.id } });
  const faqs = splitFaqs(req.body.faqs);
  if (faqs.length) await prisma.blogFAQ.createMany({ data: faqs.map(f => ({ ...f, postId: req.params.id })) });
  res.redirect('/admin/blog');
});

app.post('/admin/blog/:id/toggle-published', requireAuth, async (req, res) => {
  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (post) await prisma.blogPost.update({ where: { id: post.id }, data: { published: !post.published } });
  res.redirect('/admin/blog');
});

app.post('/admin/blog/:id/toggle-featured', requireAuth, async (req, res) => {
  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
  if (post) await prisma.blogPost.update({ where: { id: post.id }, data: { featured: !post.featured } });
  res.redirect('/admin/blog');
});

app.post('/admin/blog/:id/duplicate', requireAuth, async (req, res) => {
  const post = await prisma.blogPost.findUnique({ where: { id: req.params.id }, include: { faqs: true } });
  if (post) {
    const copy = await prisma.blogPost.create({ data: {
      title: `${post.title} copia`, slug: `${post.slug}-copia-${Date.now().toString().slice(-4)}`, categoryId: post.categoryId,
      excerpt: post.excerpt, content: post.content, image: post.image, author: post.author,
      readMinutes: post.readMinutes, published: false, featured: false, publishedAt: new Date()
    }});
    if (post.faqs.length) await prisma.blogFAQ.createMany({ data: post.faqs.map(f => ({ question: f.question, answer: f.answer, postId: copy.id })) });
  }
  res.redirect('/admin/blog');
});

app.post('/admin/blog/:id/delete', requireAuth, async (req, res) => {
  await prisma.blogPost.delete({ where: { id: req.params.id } });
  res.redirect('/admin/blog');
});

app.post('/admin/blog/categories', requireAuth, async (req, res) => {
  await prisma.blogCategory.create({ data: {
    name: req.body.name,
    slug: req.body.slug || slugify(req.body.name, { lower: true, strict: true }),
    description: req.body.description || '',
    sortOrder: Number(req.body.sortOrder || 0)
  }});
  res.redirect('/admin/blog#categorias');
});

app.post('/admin/blog/categories/:id', requireAuth, async (req, res) => {
  await prisma.blogCategory.update({ where: { id: req.params.id }, data: {
    name: req.body.name,
    slug: req.body.slug || slugify(req.body.name, { lower: true, strict: true }),
    description: req.body.description || '',
    sortOrder: Number(req.body.sortOrder || 0)
  }});
  res.redirect('/admin/blog#categorias');
});

app.post('/admin/blog/categories/:id/delete', requireAuth, async (req, res) => {
  await prisma.blogCategory.delete({ where: { id: req.params.id } });
  res.redirect('/admin/blog#categorias');
});

app.get('/admin/leads', requireAuth, async (req, res) => {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const where = {
    ...(q ? { OR: [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { company: { contains: q, mode: 'insensitive' } },
      { interest: { contains: q, mode: 'insensitive' } },
      { message: { contains: q, mode: 'insensitive' } }
    ] } : {}),
    ...(status ? { status } : {})
  };
  const [leads, groups] = await Promise.all([
    prisma.lead.findMany({ where, orderBy: { createdAt: 'desc' } }),
    prisma.lead.groupBy({ by: ['status'], _count: { status: true } })
  ]);
  const counts = groups.reduce((acc, item) => ({ ...acc, [item.status]: item._count.status }), {});
  res.render('admin/leads', { leads, filters: { q, status }, counts });
});

app.get('/admin/leads/export.csv', requireAuth, async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  const header = ['Fecha','Nombre','Empresa','Cargo','Email','Telefono','Interes','Estado','Mensaje','Notas'];
  const rows = leads.map(l => [l.createdAt.toISOString(), l.name, l.company, l.role, l.email, l.phone, l.interest, l.status, l.message, l.notes].map(csvCell).join(','));
  res.header('Content-Type', 'text/csv; charset=utf-8');
  res.attachment('leads-itesicws.csv');
  res.send([header.map(csvCell).join(','), ...rows].join('\n'));
});
app.post('/admin/leads/:id', requireAuth, async (req, res) => {
  await prisma.lead.update({ where: { id: req.params.id }, data: { status: req.body.status, notes: req.body.notes || null } });
  res.redirect('/admin/leads');
});
app.post('/admin/leads/:id/delete', requireAuth, async (req, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } });
  res.redirect('/admin/leads');
});

app.get('/admin/settings', requireAuth, async (req, res) => res.render('admin/settings', { settings: await getSettings() }));
app.post('/admin/settings', requireAuth, async (req, res) => {
  const smtpPass = req.body.smtpPass ? req.body.smtpPass : undefined;
  await prisma.siteSetting.update({ where: { id: 'main' }, data: {
    contactEmail: req.body.contactEmail,
    whatsappNumber: req.body.whatsappNumber,
    leadDeliveryMode: req.body.leadDeliveryMode,
    whatsappMessage: req.body.whatsappMessage,
    smtpHost: req.body.smtpHost || null,
    smtpPort: Number(req.body.smtpPort || 587),
    smtpUser: req.body.smtpUser || null,
    ...(smtpPass !== undefined ? { smtpPass } : {}),
    smtpFrom: req.body.smtpFrom || null,
    smtpSecure: !!req.body.smtpSecure,
    heroTitle: req.body.heroTitle,
    heroSubtitle: req.body.heroSubtitle,
    chatbotEnabled: !!req.body.chatbotEnabled,
    chatbotTitle: req.body.chatbotTitle || 'Asistente ITESICWS',
    chatbotWelcome: req.body.chatbotWelcome || 'Hola, soy el asistente de ITESICWS. ¿En qué te puedo ayudar?',
    chatbotQuickReplies: req.body.chatbotQuickReplies || '',
    chatbotFallback: req.body.chatbotFallback || ''
  }});
  res.redirect('/admin/settings?saved=1');
});

app.use((req, res) => res.status(404).render('404'));
app.listen(PORT, () => console.log(`ITESICWS listo en http://localhost:${PORT}`));
