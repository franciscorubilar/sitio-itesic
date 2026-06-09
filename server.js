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

function createChatbotAiRuntime() {
  const explicitProvider = process.env.CHATBOT_AI_PROVIDER;
  const hasDeepseekKey = !!process.env.DEEPSEEK_API_KEY;
  const baseUrlHasDeepseek = String(process.env.OPENAI_BASE_URL || '').toLowerCase().includes('deepseek');
  const provider = String(explicitProvider || (hasDeepseekKey || baseUrlHasDeepseek ? 'deepseek' : 'openai')).toLowerCase();
  const isDeepseek = provider === 'deepseek';
  const apiKey = isDeepseek
    ? (process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY)
    : process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  return {
    client: new OpenAI({
      apiKey,
      baseURL: isDeepseek ? (process.env.DEEPSEEK_BASE_URL || process.env.OPENAI_BASE_URL || 'https://api.deepseek.com') : (process.env.OPENAI_BASE_URL || undefined)
    }),
    model: isDeepseek ? (process.env.DEEPSEEK_MODEL || 'deepseek-chat') : (process.env.OPENAI_MODEL || 'gpt-4o-mini'),
    provider,
    isDeepseek
  };
}

const chatbotAi = createChatbotAiRuntime();

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
  res.locals.productUseCases = productUseCases;
  res.locals.productConceptFlow = productConceptFlow;
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

function productUseCases(product = {}) {
  const useCases = {
    'perseus-erp': [
      {
        title: 'Controlar producción y stock por lote',
        context: 'Una planta necesita saber qué se produjo, qué insumos se usaron, dónde quedó el stock y qué falta despachar.',
        steps: ['Orden de producción', 'Registro en planta', 'Stock y bodega', 'Despacho trazable'],
        result: 'La operación deja de depender de planillas sueltas y puede responder rápido ante auditorías, reclamos o diferencias de inventario.'
      },
      {
        title: 'Conectar ventas, documentos y logística',
        context: 'El equipo comercial vende, administración emite documentos y logística prepara contenedores o despachos.',
        steps: ['Venta', 'Documento', 'Preparación', 'Entrega'],
        result: 'Cada área ve el mismo estado del proceso y se reducen errores por doble digitación o información atrasada.'
      },
      {
        title: 'Trazabilidad industrial para jefaturas',
        context: 'Gerencia necesita indicadores confiables de producción, detenciones, inventario y cumplimiento.',
        steps: ['Datos operativos', 'Validación', 'Reportes', 'Decisión'],
        result: 'Los reportes muestran lo que ocurre en planta y permiten priorizar mejoras con evidencia.'
      }
    ],
    'sistema-calibraciones': [
      {
        title: 'Plan mensual de calibraciones',
        context: 'El área técnica debe programar instrumentos por división, responsable y período sin perder vencimientos.',
        steps: ['Instrumentos', 'Programa mensual', 'Validación', 'Ejecución'],
        result: 'El ciclo queda ordenado por estado y responsable, con seguimiento claro de pendientes.'
      },
      {
        title: 'Evidencia y revisión para auditoría',
        context: 'Cada calibración requiere respaldo, revisión final y trazabilidad de quién ejecutó y aprobó.',
        steps: ['Registro', 'Adjuntos', 'Revisión', 'Auditoría'],
        result: 'Las evidencias quedan centralizadas y consultables cuando llega una auditoría interna o externa.'
      },
      {
        title: 'Monitoreo de envíos a PI',
        context: 'La operación necesita confirmar que los datos técnicos llegan correctamente a PI Web API.',
        steps: ['Ejecución', 'Envío PI', 'Monitor', 'Corrección'],
        result: 'Los errores se detectan antes y el equipo puede corregir brechas de datos con trazabilidad.'
      }
    ],
    forms: [
      {
        title: 'Digitalizar formularios de terreno',
        context: 'Supervisores o técnicos completan registros en terreno y adjuntan evidencia desde el móvil.',
        steps: ['Formulario', 'Validación', 'Adjuntos', 'Registro'],
        result: 'La información entra estructurada, sin papel y lista para revisión o reportabilidad.'
      },
      {
        title: 'Flujos de aprobación internos',
        context: 'Una solicitud necesita pasar por responsables antes de cerrarse o convertirse en tarea.',
        steps: ['Solicitud', 'Aprobación', 'Estado', 'Cierre'],
        result: 'Se sabe quién tiene la responsabilidad y qué solicitudes siguen pendientes.'
      },
      {
        title: 'Datos listos para BI y auditoría',
        context: 'Los formularios deben alimentar reportes y dejar historial consultable.',
        steps: ['Captura', 'Historial', 'Exportación', 'Dashboard'],
        result: 'La empresa obtiene indicadores sin reconstruir datos manualmente al final del mes.'
      }
    ],
    'portal-balances': [
      {
        title: 'Monitorear KPIs operacionales',
        context: 'Gerencia y operación necesitan revisar balances, recuperaciones y consistencia de resultados.',
        steps: ['Fuentes', 'KPI', 'Comparación', 'Seguimiento'],
        result: 'Los indicadores críticos se revisan en un portal común y con menor dependencia de reportes manuales.'
      },
      {
        title: 'Controlar calidad de información',
        context: 'Los datos base o de proceso pueden tener diferencias que afectan el balance final.',
        steps: ['Dato base', 'Validación', 'Alerta', 'Corrección'],
        result: 'El equipo identifica brechas antes de tomar decisiones con información incompleta.'
      },
      {
        title: 'Centralizar documentación operacional',
        context: 'Los usuarios requieren documentos, vistas PI Vision y respaldos en un mismo lugar.',
        steps: ['Documento', 'Vista PI', 'Consulta', 'Uso'],
        result: 'La información operacional queda disponible para consulta diaria y auditoría.'
      }
    ],
    bitacoras: [
      {
        title: 'Registrar eventos por turno',
        context: 'Los equipos necesitan dejar novedades, incidentes y acciones realizadas durante cada turno.',
        steps: ['Turno', 'Evento', 'Responsable', 'Seguimiento'],
        result: 'El cambio de turno queda documentado y no se pierde información crítica.'
      },
      {
        title: 'Buscar historial operativo',
        context: 'Cuando ocurre un problema, el equipo necesita revisar antecedentes por fecha, categoría o responsable.',
        steps: ['Registro', 'Filtro', 'Historial', 'Hallazgo'],
        result: 'Las causas y acciones previas se encuentran rápido sin revisar cuadernos o planillas.'
      },
      {
        title: 'Seguimiento de compromisos',
        context: 'Una novedad puede requerir una acción posterior y quedar asignada a un responsable.',
        steps: ['Novedad', 'Asignación', 'Estado', 'Cierre'],
        result: 'Las tareas no quedan olvidadas y jefatura puede controlar pendientes.'
      }
    ],
    'plataforma-zebbra': [
      {
        title: 'Detectar datos faltantes SMA/DGA',
        context: 'El área ambiental debe controlar continuidad de datos para reportabilidad regulatoria.',
        steps: ['Recepción', 'Cobertura', 'Brecha', 'Reporte'],
        result: 'Las brechas se detectan a tiempo y se reducen riesgos por reportes incompletos.'
      },
      {
        title: 'Controlar errores de recepción y envío',
        context: 'Los datos pueden fallar al recibirse, procesarse o enviarse a servicios externos.',
        steps: ['Error', 'Diagnóstico', 'Retransmisión', 'Confirmación'],
        result: 'El equipo sabe qué falló, cuándo ocurrió y cómo corregirlo.'
      },
      {
        title: 'Dashboards para operación ambiental',
        context: 'Operación necesita gráficos y reportes claros para revisar estado diario y cumplimiento.',
        steps: ['Datos', 'Dashboard', 'Reporte', 'Acción'],
        result: 'La gestión pasa de revisión reactiva a monitoreo continuo.'
      }
    ],
    'venta-pasajes-buses': [
      {
        title: 'Venta de pasajes con selección de asiento',
        context: 'El punto de venta necesita consultar viajes, elegir asiento y emitir ticket sin confusión.',
        steps: ['Viaje', 'Asiento', 'Pago', 'Ticket'],
        result: 'La venta queda trazable por servicio, pasajero, asiento y caja.'
      },
      {
        title: 'Control de caja y anulaciones',
        context: 'Administración necesita revisar ventas, anular boletos y cuadrar caja por punto de venta.',
        steps: ['Venta', 'Caja', 'Anulación', 'Reporte'],
        result: 'Se reducen diferencias comerciales y queda respaldo de cada operación.'
      },
      {
        title: 'Administrar servicios, buses y tarifas',
        context: 'La empresa debe mantener rutas, buses, horarios y precios actualizados.',
        steps: ['Servicio', 'Bus', 'Tarifa', 'Disponibilidad'],
        result: 'La operación comercial se mantiene ordenada y visible para boletería.'
      }
    ],
    'perseus-ofa': [
      {
        title: 'Planificar y controlar OFA/OFP',
        context: 'Producción necesita abrir, cerrar y revisar avances de órdenes sin depender de planillas.',
        steps: ['Planificación', 'Apertura', 'Avance', 'Cierre'],
        result: 'El avance productivo queda controlado y consultable por fecha, estado y producto.'
      },
      {
        title: 'Gestionar productos principales',
        context: 'El equipo requiere mantener productos y procesos asociados dentro del ecosistema Perseus.',
        steps: ['Producto', 'Proceso', 'Registro', 'Exportación'],
        result: 'La información productiva queda ordenada para análisis y continuidad operacional.'
      },
      {
        title: 'Exportar información operacional',
        context: 'Jefatura necesita revisar avances y respaldos en formatos simples.',
        steps: ['Filtro', 'Consulta', 'Excel', 'Revisión'],
        result: 'Los datos se entregan rápido sin reconstruir reportes manuales.'
      }
    ],
    'opms-caitan': [
      {
        title: 'Controlar nominaciones por período',
        context: 'La empresa gestiona nominaciones anuales, mensuales, semanales o diarias con reglas internas.',
        steps: ['Período', 'Nominación', 'Validación', 'Reporte'],
        result: 'Cada nominación queda ordenada, trazable y disponible para revisión.'
      },
      {
        title: 'Administrar proformas y documentos',
        context: 'El equipo necesita generar, consultar y respaldar documentos asociados al proceso operacional.',
        steps: ['Datos', 'Proforma', 'Documento', 'Archivo'],
        result: 'La documentación queda centralizada y con permisos de acceso.'
      },
      {
        title: 'Seguridad por roles y permisos',
        context: 'Distintos usuarios requieren acceso solo a funciones autorizadas.',
        steps: ['Usuario', 'Rol', 'Permiso', 'Acción'],
        result: 'El sistema protege operaciones sensibles y reduce errores por accesos amplios.'
      }
    ],
    'bi-powerbi': [
      {
        title: 'Dashboard ejecutivo automático',
        context: 'Gerencia necesita KPIs confiables sin esperar planillas manuales.',
        steps: ['Fuente', 'ETL', 'Modelo', 'Dashboard'],
        result: 'Las decisiones se toman con datos actualizados, comparables y consistentes.'
      },
      {
        title: 'Unificar datos de varios sistemas',
        context: 'La información vive en ERP, planillas, bases SQL o APIs distintas.',
        steps: ['Conexión', 'Limpieza', 'Modelo', 'Indicador'],
        result: 'Los equipos ven una versión común de la información y reducen discusiones por datos distintos.'
      },
      {
        title: 'Alertas e indicadores operacionales',
        context: 'Operación necesita detectar desviaciones sin revisar manualmente todos los reportes.',
        steps: ['KPI', 'Umbral', 'Alerta', 'Acción'],
        result: 'Las desviaciones se atienden antes y con responsables claros.'
      }
    ],
    'consultoria-ia': [
      {
        title: 'Asistente interno con documentos',
        context: 'Los equipos preguntan por manuales, procedimientos, contratos o información interna.',
        steps: ['Documentos', 'RAG', 'Respuesta', 'Derivación'],
        result: 'El asistente responde con contexto real y deriva cuando la consulta requiere gestión humana.'
      },
      {
        title: 'Automatizar reportes y clasificación',
        context: 'La empresa recibe solicitudes, correos o documentos que se revisan manualmente.',
        steps: ['Entrada', 'Clasificación', 'Extracción', 'Reporte'],
        result: 'Se reduce trabajo repetitivo y el equipo se enfoca en casos que requieren criterio.'
      },
      {
        title: 'Roadmap IA para procesos reales',
        context: 'La organización quiere usar IA, pero necesita priorizar casos con datos, impacto y viabilidad.',
        steps: ['Diagnóstico', 'Priorización', 'Piloto', 'Escalamiento'],
        result: 'La inversión en IA parte por casos concretos y medibles, no por generalidades.'
      }
    ]
  };

  const fallbackSteps = (product.modules || []).slice(0, 4);
  return useCases[product.slug] || [
    {
      title: `Caso operativo para ${product.name || 'la solución'}`,
      context: product.problem || 'Proceso operativo con datos dispersos, seguimiento manual y baja visibilidad.',
      steps: fallbackSteps.length ? fallbackSteps : ['Levantamiento', 'Configuración', 'Operación', 'Reportabilidad'],
      result: 'El proceso queda trazable, ordenado y listo para reportes o integraciones.'
    }
  ];
}

function productConceptFlow(product = {}) {
  const flows = {
    'perseus-erp': ['Producción', 'Lotes', 'Stock', 'Documentos', 'Despacho', 'Reportes'],
    'sistema-calibraciones': ['Instrumentos', 'Programa mensual', 'Validación', 'Ejecución', 'Evidencias', 'Auditoría'],
    forms: ['Formulario', 'Captura móvil', 'Validación', 'Aprobación', 'Historial', 'BI'],
    'portal-balances': ['Fuentes de datos', 'Calidad', 'KPIs', 'Balances', 'PI Vision', 'Decisión'],
    bitacoras: ['Turno', 'Evento', 'Responsable', 'Seguimiento', 'Historial', 'Reporte'],
    'plataforma-zebbra': ['Recepción de datos', 'Cobertura', 'Errores', 'Retransmisión', 'SMA/DGA', 'Cumplimiento'],
    'venta-pasajes-buses': ['Viaje', 'Asientos', 'Pasajero', 'Pago', 'Ticket', 'Caja'],
    'perseus-ofa': ['Planificación', 'OFA/OFP', 'Avance', 'Cierre', 'Exportación', 'Control'],
    'opms-caitan': ['Usuarios', 'Permisos', 'Nominaciones', 'Proformas', 'Documentos', 'Reportes'],
    'bi-powerbi': ['Fuentes', 'ETL', 'Modelo semántico', 'Dashboards', 'Alertas', 'Decisión'],
    'consultoria-ia': ['Diagnóstico', 'Datos', 'Asistente/RAG', 'Automatización', 'Integración', 'Impacto']
  };
  return flows[product.slug] || ['Problema', 'Datos', 'Flujo', 'Módulos', 'Reporte', 'Resultado'];
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

// Fuzzy matching: Levenshtein distance for typo tolerance
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(text, term, threshold = 0.8) {
  const clean = normalizeText(text);
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;
  
  const maxDist = Math.ceil(normalizedTerm.length * (1 - threshold));
  const words = clean.split(' ');
  
  // Exact match in phrase
  if (clean.includes(normalizedTerm)) return true;
  
  // Fuzzy match any word
  for (const word of words) {
    const dist = levenshteinDistance(word, normalizedTerm);
    if (dist <= maxDist) return true;
  }
  return false;
}

function anyIncludes(text, terms) {
  const clean = normalizeText(text);
  const words = clean.split(' ').filter(Boolean);
  return terms.some(term => {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) return false;
    if (normalizedTerm.length <= 3 && !normalizedTerm.includes(' ')) {
      return words.includes(normalizedTerm) || fuzzyMatch(text, term, 0.75);
    }
    return fuzzyMatch(text, term);
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
    const useCases = productUseCases(product)
      .map(useCase => [
        `${useCase.title}: ${useCase.context}`,
        `Flujo: ${(useCase.steps || []).join(' -> ')}`,
        `Resultado: ${useCase.result}`
      ].filter(Boolean).join(' '))
      .join('\n');
    const conceptFlow = productConceptFlow(product).join(' -> ');
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
      `Casos de uso:\n${useCases}`,
      `Mapa conceptual: ${conceptFlow}`,
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
  return !!chatbotAi && String(process.env.CHATBOT_AI_ENABLED || 'true').toLowerCase() !== 'false';
}

async function chatbotAnswerWithAI({ message, state, settings, products, posts }) {
  if (!openAiConfigured()) return null;

  try {
    const isDeepseek = chatbotAi.isDeepseek;
    const previousMessages = Array.isArray(state.history)
      ? state.history.slice(-8).map(item => `${item.from || 'user'}: ${item.text}`).join('\n')
      : '';

    const systemPrompt = [
      'Eres el asistente comercial y técnico de ITESICWS.',
      'Responde en español chileno, directo, práctico y sin rodeos.',
      'REGLA CRÍTICA: Si el usuario describe un caso de negocio real (empresa, proceso, industria), responde SIEMPRE con: (1) diagnóstico en 1-2 líneas, (2) qué producto o solución ITESICWS aplica mejor, (3) qué módulos o capacidades concretas resolver primero. NUNCA respondas con artículos del blog.',
      'REGLA CRÍTICA: Si el usuario pregunta cómo contactar, comunicarse o hablar con alguien, SIEMPRE ofrece WhatsApp y el formulario de contacto. Nunca respondas con blog ni con preguntas genéricas.',
      'Si no existe un producto exacto para la necesidad, recomienda software a medida y explica brevemente qué cubriría.',
      'No inventes certificaciones, normas legales ni precios.',
      'Si el caso es manufactura, madera, producción industrial, importación o exportación: recomienda PERSEUS ERP o software a medida con trazabilidad de lotes, stock, despacho y reportes.',
      'Si pregunta por IA o automatización: sé específico, no filosófico. Di qué proceso exacto se puede automatizar con IA en su caso.',
      'Nunca uses el blog para responder necesidades de negocio. El blog es solo referencia informativa.',
      'Devuelve SOLO JSON válido, sin markdown, con estas claves: answer, suggestions, actions, intent, leadHint, lastProductSlug.',
      'actions debe ser un arreglo de objetos {type:"link", label, url} o {type:"lead", label}.'
    ].join('\n');

    const userContent = [
      `Fecha: ${todayInChile()} - Hora Chile: ${timeInChile()}`,
      `Estado anterior: ${JSON.stringify(state || {})}`,
      previousMessages ? `Historial reciente:\n${previousMessages}` : '',
      `Contexto del negocio:\n${chatbotKnowledgeBase(products, posts).slice(0, 9000)}`,
      `Pregunta del usuario: ${message}`
    ].filter(Boolean).join('\n\n');

    const response = await chatbotAi.client.chat.completions.create({
      model: chatbotAi.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ],
      temperature: 0.25,
      ...(chatbotAi.isDeepseek ? {} : { response_format: { type: 'json_object' } }),
      max_tokens: 900
    });

    let answer = response.choices[0]?.message?.content;

    if (!answer) return null;

    // Intenta parsear JSON si lo devuelve
    let parsed = safeJsonFromText(answer);
    if (!parsed) {
      parsed = {
        answer: answer.trim(),
        suggestions: ['Ver productos', 'Hablar por WhatsApp'],
        intent: 'ai'
      };
    }

    const actions = Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : [];
    if (!actions.some(action => action.type === 'lead')) actions.push({ type: 'lead', label: 'Dejar mis datos' });

    return {
      ok: true,
      intent: parsed.intent || 'ai',
      lead: false,
      answer: String(parsed.answer).trim(),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : ['Ver productos'],
      actions,
      state: {
        intent: parsed.intent || 'ai',
        leadHint: parsed.leadHint || message,
        lastProductSlug: parsed.lastProductSlug
      }
    };
  } catch (error) {
    console.error('Error en IA:', error.message);
    return null;
  }
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

  // ── Pain point detection ────────────────────────────────────────────────
  const hasPainExcel      = anyIncludes(text, ['excel', 'planilla', 'planillas', 'google sheets', 'hoja de calculo', 'todo en excel', 'manejamos en excel']);
  const hasPainVisibility = anyIncludes(text, ['no vemos', 'no tenemos visibilidad', 'no sabemos cuanto', 'no se cuanto', 'perdemos', 'perdemos trazabilidad', 'perdemos informacion', 'no tenemos control', 'sin control']);
  const hasPainManual     = anyIncludes(text, ['manual', 'a mano', 'doble digitacion', 'doble digitar', 'copiar y pegar', 'digitalizar', 'papel', 'formulario en papel', 'proceso manual']);
  const hasPainErrors     = anyIncludes(text, ['errores', 'error humano', 'equivocaciones', 'inconsistencias', 'datos incorrectos', 'informacion duplicada', 'duplicada', 'datos erroneos']);
  const hasPainTime       = anyIncludes(text, ['perdemos tiempo', 'toma mucho tiempo', 'lento', 'demora', 'demoras', 'horas en eso', 'no da abasto', 'sin tiempo']);
  const hasPainScale      = anyIncludes(text, ['crecer', 'crecimiento', 'escalar', 'no escala', 'mas sucursales', 'mas personal', 'expansion']);
  const hasPainIntegration= anyIncludes(text, ['sistemas separados', 'no se conectan', 'islas', 'sistemas islas', 'no hay integracion', 'datos dispersos', 'multiples sistemas']);
  const hasPainVisual     = anyIncludes(text, ['no tenemos reportes', 'sin reportes', 'no vemos metricas', 'no hay dashboard', 'necesito ver los datos', 'necesito un reporte']);
  const anyPain = hasPainExcel || hasPainVisibility || hasPainManual || hasPainErrors || hasPainTime || hasPainScale || hasPainIntegration || hasPainVisual;

  // ── Company/team size extraction ────────────────────────────────────────
  const sizeMatch = text.match(/(\d+)\s*(persona|personas|usuario|usuarios|empleado|empleados|colaborador|colaboradores|trabajador|trabajadores)/);
  const teamSize = sizeMatch ? parseInt(sizeMatch[1]) : null;
  const sizeLabel = teamSize ? (teamSize <= 5 ? 'equipo pequeño' : teamSize <= 20 ? 'equipo mediano' : 'empresa con volumen') : null;

  // ── Enhanced product scoring ─────────────────────────────────────────────
  const SCORE_BOOSTS = [
    { keywords: ['inventario', 'stock', 'bodega', 'almacen', 'existencias', 'bodegas'],        slug: 'perseus-erp',           boost: 10 },
    { keywords: ['madera', 'maderera', 'tablero', 'tableros', 'importa', 'exporta'],           slug: 'perseus-erp',           boost: 10 },
    { keywords: ['produccion', 'planta', 'fabricacion', 'manufactura', 'lote', 'lotes'],       slug: 'perseus-erp',           boost: 10 },
    { keywords: ['pasaje', 'pasajes', 'bus', 'buses', 'asiento', 'boleto', 'terminal'],        slug: 'venta-pasajes-buses',   boost: 12 },
    { keywords: ['sma', 'dga', 'zebbra', 'ambiental', 'datos faltantes', 'medicion ambiental'],slug: 'plataforma-zebbra',    boost: 12 },
    { keywords: ['power bi', 'dashboard', 'tablero ejecutivo', 'indicador', 'kpi', 'grafico'], slug: 'bi-powerbi',            boost: 10 },
    { keywords: ['chatbot', 'bot', 'asistente virtual', 'ia conversacional', 'whatsapp bot'],  slug: 'chatbot-ia',            boost: 10 },
    { keywords: ['flota', 'camion', 'despacho', 'ruta', 'chofer', 'conductor', 'gps'],         slug: 'control-flota',         boost: 10 },
    { keywords: ['web', 'landing', 'sitio web', 'pagina web', 'ecommerce', 'tienda online'],   slug: 'sitio-web',             boost: 8  },
    { keywords: ['calibracion', 'instrumento', 'equipo calibrar', 'mantenimiento'],             slug: 'perseus-erp',           boost: 8  },
    { keywords: ['formulario', 'checklist', 'digitalizacion', 'digitalizar'],                  slug: 'perseus-erp',           boost: 7  },
    { keywords: ['reporte', 'reportes', 'informe', 'analitica'],                               slug: 'bi-powerbi',            boost: 7  },
  ];

  const productMatches = products
    .map(product => {
      const haystack = normalizeText([
        product.name, product.slug, product.category, product.summary,
        product.description, product.problem,
        (product.benefits || []).join(' '),
        (product.modules  || []).join(' '),
        (product.industries || []).join(' '),
        (product.faqs || []).map(faq => `${faq.question} ${faq.answer}`).join(' ')
      ].join(' '));
      let score = queryWords.filter(w => haystack.includes(w)).length;
      // Apply boosts
      for (const boost of SCORE_BOOSTS) {
        if (product.slug === boost.slug && anyIncludes(text, boost.keywords)) score += boost.boost;
      }
      // Pain-point boosts: if user has pain + product solves it, give extra points
      if (anyPain && anyIncludes(normalizeText(product.problem || ''), significantWords(clean))) score += 3;
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

  // ── FAQ search from real product data ───────────────────────────────────
  const faqMatches = [];
  for (const product of products) {
    for (const faq of (product.faqs || [])) {
      const faqText = normalizeText(`${faq.question} ${faq.answer}`);
      const faqScore = queryWords.filter(w => faqText.includes(w)).length;
      if (faqScore >= 2) faqMatches.push({ faq, product, score: faqScore });
    }
  }
  faqMatches.sort((a, b) => b.score - a.score);
  const topFaq = faqMatches[0] || null;

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

  // ── Helper: build pain context string ───────────────────────────────────
  function describePains() {
    const pains = [];
    if (hasPainExcel)       pains.push('manejan procesos en Excel o planillas');
    if (hasPainManual)      pains.push('tienen trabajo manual o doble digitación');
    if (hasPainVisibility)  pains.push('les falta visibilidad de datos en tiempo real');
    if (hasPainErrors)      pains.push('sufren errores o inconsistencias de datos');
    if (hasPainTime)        pains.push('pierden tiempo en tareas repetitivas');
    if (hasPainIntegration) pains.push('tienen sistemas desconectados');
    if (hasPainVisual)      pains.push('no tienen reportes o dashboards');
    if (hasPainScale)       pains.push('necesitan escalar la operación');
    return pains.length ? `Entiendo que ${pains.join(', ')}.` : '';
  }

  // ── Intent flags ─────────────────────────────────────────────────────────
  const isGreeting    = anyIncludes(text, ['hola', 'buenas', 'buen dia', 'buenas tardes', 'necesito ayuda', 'ayuda', 'buen dia', 'buenos dias', 'buenas noches']);
  const wantsHuman    = anyIncludes(text, ['humano', 'ejecutivo', 'vendedor', 'contacto', 'llamar', 'telefono', 'whatsapp', 'hablar con alguien', 'comunicarme', 'comunico', 'contactarme', 'hablar con ustedes', 'comunicarme con ustedes', 'como los contacto', 'como me comunico', 'como los llamo', 'hablar con una persona', 'un asesor', 'correo']);
  const wantsQuote    = anyIncludes(text, ['cotizacion', 'cotizar', 'precio', 'valor', 'cuanto cuesta', 'presupuesto', 'demo', 'reunion', 'agendar', 'cuanto vale', 'que valor tiene']);
  const wantsChatbot  = anyIncludes(text, ['chatbot', 'bot', 'asistente virtual', 'atencion automatica', 'whatsapp bot', 'ia conversacional', 'asistente inteligente']);
  const wantsAI       = anyIncludes(text, ['ia', 'inteligencia artificial', 'agente', 'rag', 'documentos', 'automatizar', 'automatizacion', 'gpt', 'machine learning', 'modelo de lenguaje']);
  const wantsAdminBlog= anyIncludes(text, ['blog', 'seo', 'contenido', 'articulos', 'noticias', 'admin', 'administrar', 'publicar']);
  const wantsBI       = anyIncludes(text, ['power bi', 'dashboard', 'indicador', 'reporte', 'reportes', 'datos', 'analitica', 'kpi', 'metricas', 'grafico', 'visualizar datos']);
  const wantsERP      = anyIncludes(text, ['erp', 'stock', 'produccion', 'trazabilidad', 'calibracion', 'formularios', 'operacion', 'operacional', 'fabricacion', 'manufactura', 'madera', 'maderera', 'tablero', 'tableros', 'planta', 'lote', 'lotes', 'control de produccion', 'importacion', 'exportacion', 'despacho internacional', 'planta productiva', 'proceso productivo', 'orden de produccion', 'materia prima', 'materias primas']);
  const wantsInventory= anyIncludes(text, ['inventario', 'stock', 'bodega', 'bodegas', 'almacen', 'almacenes', 'existencias', 'control de materiales', 'quiebre de stock', 'stock critico']);
  const wantsSoftware = anyIncludes(text, ['software a medida', 'sistema web', 'aplicacion web', 'plataforma', 'desarrollo', 'app interna', 'sistema a medida', 'sistema personalizado', 'aplicacion a medida']);
  const wantsAutomation=anyIncludes(text, ['automatizacion', 'automatizar', 'flujo', 'workflow', 'doble digitacion', 'excel', 'correos', 'proceso repetitivo', 'tarea repetitiva', 'sin intervenccion']);
  const wantsWebsite  = anyIncludes(text, ['pagina web', 'sitio web', 'landing', 'web corporativa', 'tienda online', 'ecommerce', 'rediseño web', 'redisenar web', 'web moderna', 'web nueva']);
  const wantsIntegration=anyIncludes(text, ['integracion', 'integrar', 'api', 'conectar sistemas', 'base de datos', 'sql server', 'sap', 'erp existente', 'conectar plataformas', 'sincronizar']);
  const wantsSupport  = anyIncludes(text, ['soporte', 'mantencion', 'error', 'problema', 'bug', 'no funciona', 'caido', 'lento', 'falla', 'fallo']);
  const wantsFleetDispatch = anyIncludes(text, ['flota', 'camion', 'camiones', 'despacho', 'despachos', 'ruta', 'rutas', 'conductores', 'choferes', 'gps', 'tracking', 'seguimiento vehicular', 'materiales radioactivos', 'materiales radiactivos', 'carga peligrosa', 'mercancia peligrosa', 'sustancias peligrosas']);
  const asksCapability= anyIncludes(text, ['que haces', 'que pueden hacer', 'servicios', 'como me ayudas', 'que ofrecen', 'que venden', 'para que sirves', 'en que ayudas']);
  const asksSecurity  = anyIncludes(text, ['seguridad', 'permisos', 'roles', 'usuarios', 'auditoria', 'accesos', 'acceso por rol', 'control de acceso']);
  const asksProductDetail = anyIncludes(text, ['modulo', 'modulos', 'area', 'areas', 'que hace', 'para que sirve', 'funcionalidad', 'funcionalidades', 'beneficio', 'beneficios', 'industria', 'industrias', 'como funciona', 'me explicas']);
  const asksDate      = anyIncludes(text, ['que dia es', 'que fecha es', 'dia es hoy', 'fecha de hoy', 'hoy que dia']);
  const asksTime      = anyIncludes(text, ['que hora es', 'hora actual', 'hora es']);
  const saysThanks    = anyIncludes(text, ['gracias', 'muchas gracias', 'te pasaste', 'vale', 'ok gracias', 'genial gracias', 'perfecto gracias']);
  const saysConfused  = anyIncludes(text, ['no entiendo', 'no entendi', 'explicame mejor', 'mas simple', 'en simple', 'no comprendo', 'puedes explicar']);
  const isFrustrated  = anyIncludes(text, ['malo', 'pesimo', 'inutil', 'no sirve', 'penca', 'estupido', 'ordinario', 'frustrante', 'no me ayuda', 'mala respuesta']);
  const asksFollowUpProduct = asksProductDetail && previousIntent === 'producto_detalle';

  // ── Multi-intent combinations ────────────────────────────────────────────
  const isERPplusAI = (wantsERP || wantsInventory) && wantsAI;
  const isBIplusPain = wantsBI && anyPain;
  const isFleetPlusAI = wantsFleetDispatch && wantsAI;

  // ── User context already given? (skip qualifying questions) ─────────────
  const userAlreadyGaveContext = text.length > 60 || anyPain || teamSize !== null;

  const actions = [];
  const whatsappUrl = settings.whatsappNumber
    ? `https://wa.me/${String(settings.whatsappNumber).replace(/[^0-9]/g, '')}`
    : null;
  if (whatsappUrl) actions.push({ type: 'link', label: '💬 WhatsApp', url: whatsappUrl });
  actions.push({ type: 'lead', label: 'Dejar mis datos' });


  if (openAiConfigured()) {
    try {
      const aiAnswer = await chatbotAnswerWithAI({ message: text, state, settings, products, posts });
      if (aiAnswer) return aiAnswer;
    } catch (error) {
      console.error('Chatbot IA no disponible, usando reglas locales:', error.message);
    }
  }

  // ── FAQ direct match: answer from real product FAQs ─────────────────────
  if (topFaq && queryWords.length >= 2 && !isGreeting) {
    const { faq, product } = topFaq;
    return {
      ok: true,
      intent: 'faq',
      lead: false,
      answer: `**${faq.question}**\n\n${faq.answer}\n\n_(Esta respuesta es de ${product.name})_`,
      suggestions: [`Ver ${product.name}`, 'Módulos incluidos', 'Quiero una cotización', 'Hablar con el equipo'],
      actions: [{ type: 'link', label: `Ver ${product.name}`, url: `/productos/${product.slug}` }, ...actions],
      state: { intent: 'faq', leadHint: text, lastProductSlug: product.slug }
    };
  }

  // ── Multi-intent: ERP + AI ───────────────────────────────────────────────
  if (isERPplusAI) {
    const perseus = products.find(p => p.slug === 'perseus-erp');
    const painCtx = describePains();
    return {
      ok: true,
      intent: 'operacional_ia',
      lead: false,
      answer: [
        painCtx,
        'Para un caso como el tuyo conviene combinar dos capas:',
        '🔹 **Sistema operacional** (tipo PERSEUS ERP): controla stock, trazabilidad, órdenes, bodegas y reportes en tiempo real.',
        '🔸 **Capa de IA**: sobre esa base puede ir un asistente que interprete documentos, genere resúmenes automáticos, detecte anomalías o responda consultas del equipo.',
        sizeLabel ? `Con un ${sizeLabel} la implementación se puede hacer por fases: primero el control base, luego la IA.` : 'Lo hacemos por fases: primero el control base, luego la IA.',
      ].filter(Boolean).join('\n\n'),
      suggestions: ['Primero el ERP', 'Primero la IA', 'Cuánto demora', 'Quiero una cotización'],
      actions: [
        perseus ? { type: 'link', label: `Ver ${perseus.name}`, url: `/productos/${perseus.slug}` } : null,
        { type: 'link', label: 'Consultoría IA', url: '/consultoria-ia' },
        ...actions
      ].filter(Boolean),
      state: { intent: 'operacional_ia', leadHint: text, lastProductSlug: perseus?.slug }
    };
  }

  // ── Multi-intent: Fleet + AI ─────────────────────────────────────────────
  if (isFleetPlusAI) {
    return {
      ok: true,
      intent: 'flota_ia',
      lead: false,
      answer: 'Para transporte + IA lo más útil es: (1) plataforma de control de flota con estados, rutas y evidencias, y (2) encima una capa de IA que procese documentos de despacho, detecte incidentes automáticamente y genere informes de cumplimiento sin trabajo manual.',
      suggestions: ['Control de flota primero', 'IA para documentos', 'Ver una demo', 'Quiero cotizar'],
      actions,
      state: { intent: 'flota_ia', leadHint: text }
    };
  }

  // ── Multi-intent: BI + Pain ──────────────────────────────────────────────
  if (isBIplusPain) {
    const painCtx = describePains();
    return {
      ok: true,
      intent: 'bi_pain',
      lead: false,
      answer: [
        painCtx,
        'Power BI puede resolver eso conectándose directamente a tu fuente de datos (Excel, SQL, ERP, etc.) y mostrando los reportes que hoy construyes a mano en forma automática.',
        'El primer tablero debería mostrar lo que más duele: stock, ventas, costos o eficiencia según tu caso.',
        sizeLabel ? `Con un ${sizeLabel} el tiempo de implementación es generalmente de 2-4 semanas para el primer dashboard.` : ''
      ].filter(Boolean).join('\n\n'),
      suggestions: ['Ver dashboard de ejemplo', 'Cuánto demora', 'Conectar desde Excel', 'Quiero cotizar'],
      actions,
      state: { intent: 'bi_pain', leadHint: text }
    };
  }

  if (asksDate) {
    return {
      ok: true,
      intent: previousIntent || 'casual',
      lead: false,
      answer: `Hoy es ${todayInChile()}.`,
      suggestions: ['Volver a productos', 'Qué hace PERSEUS', 'Ver servicios'],
      actions: [],
      state: { intent: previousIntent || 'casual', leadHint }
    };
  }

  if (asksTime) {
    return {
      ok: true,
      intent: previousIntent || 'casual',
      lead: false,
      answer: `En Chile son aproximadamente las ${timeInChile()}.`,
      suggestions: ['Volver a productos', 'Qué hace Zebbra', 'Ver servicios'],
      actions: [],
      state: { intent: previousIntent || 'casual', leadHint }
    };
  }

  if (saysThanks) {
    return {
      ok: true,
      intent: previousIntent || 'thanks',
      lead: false,
      answer: '¡Gracias por escribir! Estoy listo para seguir ayudándote. Si quieres, puedo darte una recomendación concreta para tu caso o derivarte con el equipo.',
      suggestions: ['Qué hace PERSEUS', 'Qué hace Zebbra', 'Revisar una solución similar'],
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
      suggestions: ['Módulos de inventario', 'Control por bodega', 'Reportes de stock', 'Ver solución similar'],
      actions: inventoryActions,
      state: { intent: 'inventario', leadHint: text, lastProductSlug: perseus?.slug || 'perseus-erp' }
    };
  }

  // ── CRITICAL: Check manufacturing/production context BEFORE fleet dispatch ──
  // 'despacho' in a manufacturing message means 'shipment of product', NOT 'fleet of trucks'
  const wantsManufacturing = anyIncludes(text, [
    'produccion', 'producción', 'planta', 'fabricacion', 'manufactura', 'tornea', 'tornear',
    'embalaje', 'embalar', 'madera', 'maderera', 'tablero', 'tableros', 'pino', 'pino oregon',
    'exporta', 'exportar', 'exportacion', 'importa', 'importar', 'importacion',
    'lote', 'lotes', 'trazabilidad', 'proceso productivo', 'orden de produccion',
    'materia prima', 'materias primas', 'aserradero', 'aserrar', 'corte', 'secado'
  ]);

  // ERP / Production handler fires FIRST when there's manufacturing context
  if (wantsERP || (wantsManufacturing && !wantsFleetDispatch)) {
    const perseus = products.find(p => p.slug === 'perseus-erp');
    const perseusModules = (perseus?.modules || []).slice(0, 6).join(', ') || 'Stock, Producción, Compras, Ventas, Despacho, Reportes';
    const painCtx = describePains();

    const diagnosis = [];
    if (painCtx) diagnosis.push(painCtx);

    if (anyIncludes(text, ['pino', 'pino oregon', 'madera', 'maderera', 'aserradero', 'aserrar'])) {
      diagnosis.push('Para una empresa maderera o forestal que exporta, el flujo clave a controlar es:\n\n1️⃣ **Recepción de materia prima** (pino, trozos, tableros) con registro de lote, proveedor y fecha\n2️⃣ **Proceso productivo** (torneado, corte, secado, cepillado) con estados por etapa\n3️⃣ **Control de stock** del producto terminado por bodega\n4️⃣ **Embalaje y despacho** con trazabilidad hacia el cliente o mercado (p.ej. España)\n5️⃣ **Reportes** de rendimiento, mermas, producción por período y cumplimiento de órdenes.');
      diagnosis.push('Cada lote queda rastreado de punta a punta: desde que entra el pino hasta que sale el palet embalado. Así tienes visibilidad total y puedes generar documentación para exportación.');
    } else if (anyIncludes(text, ['exporta', 'exportar', 'exportacion', 'importa', 'importar', 'importacion'])) {
      diagnosis.push('Para empresa importadora/exportadora el control clave es: trazabilidad de lotes desde recepción hasta despacho internacional, stock por bodega, alertas de stock crítico y documentación de despacho.');
    } else if (anyIncludes(text, ['produccion', 'planta', 'fabricacion', 'manufactura', 'orden de produccion'])) {
      diagnosis.push('Para planta productiva lo crítico es: órdenes de producción con estados, control de materias primas, trazabilidad por etapa y reportes de eficiencia.');
    } else if (anyIncludes(text, ['inventario', 'stock', 'bodega', 'existencias'])) {
      diagnosis.push('Para control de inventario: bodegas, movimientos de entrada/salida, stock mínimo con alertas, y conexión con compras y ventas para cerrar el ciclo sin duplicar datos.');
    } else {
      diagnosis.push('Para procesos operacionales lo más útil es: usuarios por rol, estados de avance, trazabilidad de cada acción y reportes automáticos que reemplacen el Excel.');
    }
    if (sizeLabel) diagnosis.push(`Con un ${sizeLabel}, lo recomendable es partir por el módulo más crítico y escalar desde ahí.`);

    const perseusText = perseus
      ? `\n\n**${perseus.name}** es la solución más cercana para esto: incluye módulos de ${perseusModules}.`
      : '\n\n**PERSEUS ERP** o un sistema a medida pueden cubrir esto.';

    return {
      ok: true,
      intent: 'operacional',
      lead: false,
      answer: diagnosis.join('\n\n') + perseusText + '\n\n¿Quieres que te cuente cuál sería el primer módulo para tu caso?',
      suggestions: ['Sí, cuéntame', 'Trazabilidad de lotes', 'Control de bodegas', 'Quiero una cotización'],
      actions: [
        perseus ? { type: 'link', label: `Ver ${perseus.name}`, url: `/productos/${perseus.slug}` } : { type: 'link', label: 'Ver productos', url: '/productos' },
        ...actions
      ],
      state: { intent: 'operacional', leadHint: text, lastProductSlug: perseus?.slug || 'perseus-erp' }
    };
  }

  // Fleet/dispatch handler: only fires when there is NO manufacturing/production context
  if (wantsFleetDispatch && !wantsManufacturing) {
    const hasHazmat = anyIncludes(text, ['radiactivo', 'radioactivo', 'peligroso', 'materiales peligrosos', 'carga peligrosa', 'mercancia peligrosa', 'sustancias peligrosas', 'hazmag']);
    const fleetAnswer = hasHazmat
      ? [
          'Para una empresa de despacho de materiales regulados o peligrosos, la trazabilidad es la parte crítica.',
          'El sistema debería cubrir: vehículos, conductores, rutas autorizadas, órdenes de despacho, estados del viaje, evidencias, alertas, permisos, documentos del material y reportes para supervisión y cumplimiento normativo.'
        ].join('\n\n')
      : [
          'Para control de flota y despachos lo más útil es una plataforma operacional con: órdenes de despacho, asignación de vehículos y conductores, estados en tiempo real, evidencias de entrega y reportes de cumplimiento.',
          'Esto elimina el seguimiento por WhatsApp o Excel y da visibilidad completa desde el centro de operaciones.'
        ].join('\n\n');
    return {
      ok: true,
      intent: 'flota_despacho',
      lead: false,
      answer: fleetAnswer,
      suggestions: ['Control de flota', 'Trazabilidad de despachos', 'Reportes de cumplimiento', 'Ver una solución similar'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, ...actions],
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
        suggestions: ['Módulos críticos', 'Áreas que lo usan', 'Beneficios principales', 'Ver un caso similar'],
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
      ? ['Qué módulos tiene', 'Qué áreas lo usan', 'Beneficios principales', 'Ver un caso similar']
      : focusedProducts.map(product => `Ver ${product.name}`).slice(0, 3).concat(['Ver un caso similar']);
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
      suggestions: ['Sistema caído', 'Error de usuario', 'Problema de reportes'],
      actions,
      state: { intent: 'soporte', leadHint: text }
    };
  }

  if (wantsHuman) {
    const whatsappContactUrl = whatsappUrl || 'https://wa.me/56900000000';
    return {
      ok: true,
      intent: 'contacto',
      lead: false,
      answer: 'Para hablar directamente con el equipo tienes dos opciones:\n\n📱 **WhatsApp**: respuesta rápida, te atienden en horario comercial.\n📋 **Formulario de contacto**: déjanos tus datos y te llamamos o escribimos.',
      suggestions: ['Formulario de contacto', 'Dejar mis datos', 'Quiero una cotización'],
      actions: [
        { type: 'link', label: '💬 Ir a WhatsApp', url: whatsappContactUrl },
        { type: 'lead', label: '📋 Dejar mis datos' }
      ],
      state: { intent: 'contacto', leadHint }
    };
  }

  if (wantsQuote || previousIntent === 'qualification') {
    const painCtx = describePains();
    const contextNote = userAlreadyGaveContext && painCtx
      ? `${painCtx} Con eso ya tengo buen contexto para orientarte.\n\n`
      : '';
    const nextQuestion = !teamSize
      ? '¿Cuántas personas usarían el sistema?'
      : !anyPain
        ? '¿Hoy cómo manejan ese proceso (Excel, papel, otro sistema)?'
        : '¿Tienes una fecha límite o urgencia para implementar?';
    return {
      ok: true,
      intent: 'cotizacion',
      lead: false,
      answer: `${contextNote}Para darte un estimado real necesito entender un poco más tu caso:\n\n${nextQuestion}`,
      suggestions: teamSize ? ['Tenemos urgencia', 'No hay urgencia definida', 'Dejar mis datos'] : ['Menos de 10', 'Entre 10 y 50', 'Más de 50', 'Dejar mis datos'],
      actions,
      state: { intent: 'cotizacion', leadHint }
    };
  }

  if (wantsSoftware) {
    return {
      ok: true,
      intent: 'software',
      lead: false,
      answer: 'Perfecto, vamos con una solución práctica. Primero entiendo tu proceso y quién lo usa, luego propongo una versión mínima que funcione rápido y que puedas escalar sin complicaciones.',
      suggestions: ['Tengo un proceso en Excel', 'Necesito usuarios y permisos', 'Ver una solución práctica', 'Hablar con humano'],
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
    // Try to detect specific AI use case from the message
    const aiUseCases = [];
    if (anyIncludes(text, ['documento', 'documentos', 'pdf', 'contrato', 'contratos', 'ficha', 'informe'])) {
      aiUseCases.push('Extracción y clasificación automática de documentos (contratos, informes, fichas) con IA que lee, resume y extrae datos clave.');
    }
    if (anyIncludes(text, ['atencion', 'cliente', 'clientes', 'consultas', 'preguntas frecuentes', 'soporte'])) {
      aiUseCases.push('Chatbot inteligente para atención de clientes que responde 24/7 con contexto real de tu empresa.');
    }
    if (anyIncludes(text, ['reporte', 'reportes', 'datos', 'analisis', 'excel', 'planilla'])) {
      aiUseCases.push('IA para analizar planillas y reportes automáticamente: detecta patrones, anomalías y genera resúmenes ejecutivos.');
    }
    if (anyIncludes(text, ['email', 'correo', 'correos', 'responder', 'clasificar'])) {
      aiUseCases.push('Clasificación y respuesta automática de correos según prioridad, tipo de consulta y área responsable.');
    }
    if (anyIncludes(text, ['proceso', 'flujo', 'aprobacion', 'formulario', 'digitacion'])) {
      aiUseCases.push('Automatización de flujos: digitalizar formularios, eliminar doble digitación y automatizar aprobaciones.');
    }
    const aiAnswer = aiUseCases.length
      ? `Para tu caso, la IA puede aplicarse de forma concreta:\n\n${aiUseCases.map(uc => `• ${uc}`).join('\n\n')}\n\nEl primer paso es siempre mapear el proceso exacto y los datos que ya tienes. ¿Quieres que avancemos en eso?`
      : 'Con IA se pueden automatizar cosas muy concretas: leer documentos, responder clientes, clasificar correos, analizar planillas y eliminar trabajo repetitivo. La clave es partir por un proceso específico que hoy te quite tiempo. ¿Cuál sería el primero?';
    return {
      ok: true,
      intent: 'ia',
      lead: false,
      answer: aiAnswer,
      suggestions: ['IA para documentos', 'Chatbot para clientes', 'Automatizar reportes', 'Asistente interno con mis datos'],
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

  // wantsERP is now handled earlier (manufacturing-aware block above)

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
      suggestions: ['Recomiéndame una opción', 'Ver una solución similar', 'Hablar con el equipo'],
      actions: [{ type: 'link', label: `Ver ${productMatches[0].name}`, url: `/productos/${productMatches[0].slug}` }, ...actions],
      state: { intent: 'producto', leadHint: text, lastProductSlug: productMatches[0].slug }
    };
  }

  // Blog matches are only shown as supplementary when the intent is clearly informational
  // and there is no detected business/product/contact intent
  const hasBusinessIntent = wantsHuman || wantsQuote || wantsERP || wantsBI || wantsSoftware || wantsAI || wantsAutomation || wantsIntegration || wantsSupport || wantsChatbot || wantsInventory || wantsFleetDispatch || wantsWebsite;
  if (blogMatches.length && !hasBusinessIntent && !isGreeting) {
    const lines = blogMatches.map(post => `• ${post.title}: ${compactText(post.excerpt || post.content, 130)}`).join('\n');
    return {
      ok: true,
      intent: 'blog_match',
      lead: false,
      answer: `Encontré un artículo que puede orientarte:\n${lines}\n\n¿Tienes un proceso específico que quieras mejorar? Cuéntame y te doy una recomendación concreta.`,
      suggestions: ['Quiero implementar algo parecido', 'Ver productos', 'Hablar con el equipo'],
      actions: [{ type: 'link', label: 'Leer artículo', url: `/blog/${blogMatches[0].slug}` }, ...actions],
      state: { intent: 'blog_match', leadHint: text }
    };
  }

  if (isGreeting) {
    return {
      ok: true,
      intent: 'welcome',
      lead: false,
      answer: settings.chatbotWelcome || 'Hola, soy el asistente de ITESICWS. Puedo orientarte sobre software a medida, IA, Power BI, ERP, formularios digitales o soluciones operativas.',
      suggestions: ['Necesito software a medida', 'Quiero un asistente inteligente', 'Ver una solución concreta', 'Ver productos'],
      actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, { type: 'link', label: 'Consultoría IA', url: '/consultoria-ia' }],
      state: { intent: 'welcome', leadHint }
    };
  }

  // Smart contextual analysis: extract industry/process keywords and map to best product
  const industryMap = [
    { keywords: ['restaurant', 'restaurante', 'gastronomia', 'cocina', 'pedidos', 'mesas', 'carta', 'menu'], intent: 'software',
      answer: 'Para gastronomía lo más útil es: punto de venta, control de insumos por receta, caja y reportes de ventas diarias. Podemos construirlo adaptado a tu operación (delivery, local, cadena).' },
    { keywords: ['salud', 'clinica', 'medico', 'paciente', 'ficha', 'agenda', 'hora medica', 'doctor', 'hospital', 'policlinico'], intent: 'software',
      answer: 'Para salud lo clave es: gestión de fichas clínicas, agenda de horas, historial de atenciones y privacidad de datos. Un sistema a medida permite adaptarse a la normativa y flujo de tu centro.' },
    { keywords: ['transporte', 'logistica', 'camion', 'entrega', 'carga', 'flete', 'courier', 'ultima milla'], intent: 'flota_despacho',
      answer: 'Para logística y transporte la prioridad es: órdenes de despacho, estados de entrega en tiempo real, evidencias fotográficas y reportes de cumplimiento. Podemos armar una plataforma operacional completa.' },
    { keywords: ['construccion', 'obra', 'proyecto', 'faena', 'materiales', 'subcontrato', 'avance de obra', 'partidas'], intent: 'software',
      answer: 'Para construcción lo más útil es: control de avance por proyecto, materiales en faena, subcontratos y costos. Un sistema a medida puede cubrir desde la cotización hasta el cierre de obra.' },
    { keywords: ['mineria', 'mina', 'mineral', 'extraccion', 'seguridad industrial', 'epp', 'turno', 'faena minera'], intent: 'software',
      answer: 'Para minería lo crítico es: trazabilidad de equipos, control de turnos y personal, seguridad industrial y reportes de producción. Podemos construir una plataforma operacional a medida.' },
    { keywords: ['retail', 'tienda', 'punto de venta', 'caja', 'pos', 'venta minorista', 'comercio', 'sucursales'], intent: 'software',
      answer: 'Para retail lo clave es: punto de venta, control de stock por sucursal, ventas y reportes por producto y local. Podemos integrarlo todo en una plataforma que funcione en múltiples sucursales.' },
    { keywords: ['agricola', 'campo', 'cosecha', 'fruta', 'verdura', 'temporada', 'temporeros', 'campo fruticola'], intent: 'software',
      answer: 'Para el agro lo útil es: control de temporadas, producción por campo o cuartel, despachos y trazabilidad de lotes. Un sistema a medida puede cubrir esto sin complicar la operación en terreno.' },
    { keywords: ['banco', 'finanzas', 'credito', 'prestamo', 'cobranza', 'contabilidad', 'factura', 'tesoreria'], intent: 'software',
      answer: 'Para procesos financieros lo clave es: trazabilidad de transacciones, reportes automáticos y alertas de vencimiento. Podemos conectar eso con Power BI para que el equipo directivo tenga visibilidad en tiempo real.' },
    { keywords: ['municipal', 'municipio', 'gobierno', 'tramite', 'formulario', 'ciudadano', 'ventanilla', 'servicio publico'], intent: 'software',
      answer: 'Para entidades públicas lo prioritario es digitalizar trámites y flujos de aprobación. Eso reduce tiempo de respuesta, elimina papel y mejora la atención al ciudadano con trazabilidad de cada solicitud.' },
    { keywords: ['educacion', 'colegio', 'universidad', 'alumno', 'alumnos', 'notas', 'asistencia', 'matricula', 'docente'], intent: 'software',
      answer: 'Para educación lo más útil es: control de asistencia, notas, matrículas y comunicación con apoderados. Un sistema a medida puede adaptarse al flujo del establecimiento sin depender de plataformas genéricas.' },
    { keywords: ['inmobiliaria', 'arriendo', 'propiedad', 'propiedades', 'contrato de arriendo', 'administracion de propiedades'], intent: 'software',
      answer: 'Para el sector inmobiliario lo clave es: control de propiedades, contratos de arriendo, cobros, vencimientos y reportes para propietarios. Un sistema a medida puede automatizar los avisos y reducir el trabajo manual.' },
    { keywords: ['juridico', 'legal', 'abogado', 'expediente', 'causa', 'tribunal', 'juzgado', 'estudio juridico'], intent: 'software',
      answer: 'Para estudios jurídicos lo más útil es: gestión de expedientes, plazos procesales con alertas, historial de actuaciones y documentos. Un sistema a medida reduce el riesgo de perder fechas críticas.' },
    { keywords: ['farmacia', 'farmaceutico', 'medicamento', 'medicamentos', 'vencimiento', 'lote farmaceutico'], intent: 'software',
      answer: 'Para farmacias o laboratorios lo crítico es: control de stock de medicamentos, trazabilidad de lotes, alertas de vencimiento y registro de transacciones. Todo debe ser trazable para cumplir con normativas sanitarias.' },
  ];

  // Pain-only fallback: if user described pain without clear industry → ask the right question
  if (anyPain && !wantsERP && !wantsBI && !wantsAI && !wantsSoftware && !wantsInventory && !wantsFleetDispatch && !wantsWebsite && !wantsAutomation) {
    const painCtx = describePains();
    return {
      ok: true,
      intent: 'pain_diagnosis',
      lead: false,
      answer: `${painCtx}\n\nEso es exactamente lo que resolvemos. Para recomendarte la solución correcta cuéntame:\n\n¿Qué área o proceso es el que más te complica hoy? (producción, inventario, reportes, atención de clientes, etc.)`,
      suggestions: ['Producción y stock', 'Reportes y datos', 'Atención de clientes', 'Procesos manuales'],
      actions,
      state: { intent: 'pain_diagnosis', leadHint: text }
    };
  }

  for (const map of industryMap) {
    if (anyIncludes(text, map.keywords)) {
      const painCtx = describePains();
      const painNote = painCtx ? `\n\n${painCtx}` : '';
      return {
        ok: true,
        intent: map.intent,
        lead: false,
        answer: map.answer + painNote + '\n\n¿Quieres que te cuente cómo lo haríamos para tu caso específico?',
        suggestions: ['Sí, cuéntame más', 'Quiero una cotización', 'Ver productos similares', 'Dejar mis datos'],
        actions: [{ type: 'link', label: 'Ver productos', url: '/productos' }, ...actions],
        state: { intent: map.intent, leadHint: text }
      };
    }
  }

  return {
    ok: true,
    intent: 'fallback',
    lead: false,
    answer: 'Cuéntame con tus palabras qué quieres mejorar o qué te complica hoy. Por ejemplo:\n\n• _"Manejamos todo en Excel y se nos escapa información"_\n• _"Necesito ver el stock en tiempo real"_\n• _"Quiero automatizar aprobaciones"_\n\nCon eso te doy una recomendación concreta y directa.',
    suggestions: ['Tengo procesos en Excel', 'Quiero IA en mi empresa', 'Necesito control de inventario', 'Conectar mis sistemas'],
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
  const unwanted = ['quiero una demo', 'necesito un chatbot ia', 'quiero mejorar mi blog', 'hablar por whatsapp'];
  return splitLines(settings.chatbotQuickReplies || '')
    .filter(line => !unwanted.includes(line.toLowerCase().trim()))
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
    cta: req.body.cta || 'Solicitar consultoría', published: !!req.body.published, featured: !!req.body.featured, sortOrder: Number(req.body.sortOrder || 0)
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
    cta: req.body.cta || 'Solicitar consultoría', published: !!req.body.published, featured: !!req.body.featured, sortOrder: Number(req.body.sortOrder || 0)
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
