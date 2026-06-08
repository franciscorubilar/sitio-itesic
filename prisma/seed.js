const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const products = [
  {
    name: 'PERSEUS ERP', slug: 'perseus-erp', category: 'ERP Industrial', featured: true, sortOrder: 1, image: '/images/perseus-erp.png',
    summary: 'Suite modular para controlar producción, inventario, trazabilidad, documentos y logística.',
    description: 'PerseusERP conecta planta, administración y logística para entregar trazabilidad real, información confiable y control operativo diario. Está orientado a empresas industriales, productivas, forestales, madereras y logísticas.',
    problem: 'Reduce registros manuales, duplicidad de datos y desconexión entre producción, stock, despacho, documentos y reportabilidad.',
    benefits: ['Control operacional de planta', 'Trazabilidad por lote, proceso y bodega', 'Producción conectada con stock y despacho', 'Información confiable para jefaturas y gerencia', 'Reducción de planillas y registros duplicados', 'Gestión documental y comercial integrada', 'Reportes operacionales y etiquetas para terreno'],
    modules: ['Control de Producción', 'Planificación de Producción', 'HMI Planta', 'Detenciones y Eventos', 'Secado y Cámaras', 'Compras y Abastecimiento', 'Stock, Almacén y Bodegas', 'Ventas y Documentos Comerciales', 'DTE y Facturación Electrónica', 'Comercio Exterior', 'Contenedores', 'Trozos y Operación Maderera', 'Reportes', 'Impresión y Etiquetas', 'Usuarios, Roles y Permisos'],
    industries: ['Forestal', 'Maderera', 'Manufactura', 'Logística']
  },
  {
    name: 'Sistema de Calibraciones', slug: 'sistema-calibraciones', category: 'Operación Industrial', featured: true, sortOrder: 2, image: '/images/sistema-calibraciones.png',
    summary: 'Gestión integral de calibraciones de instrumentos, equipos, evidencias y auditoría.',
    description: 'Sistema Calibraciones es una plataforma web para administrar instrumentos, divisiones, tipos de instrumento, programas mensuales, validaciones, registros de ejecución, evidencias, revisión final, auditoría y monitoreo de envíos hacia PI Web API.',
    problem: 'Digitaliza el proceso de calibración, mejora la trazabilidad, reduce controles manuales y entrega visibilidad completa sobre cada ciclo.',
    benefits: ['Trazabilidad del ciclo completo', 'Evidencias centralizadas', 'Auditoría del proceso', 'Monitor de envíos a PI', 'Programación mensual controlada', 'Validación técnica antes de ejecución', 'Estados visibles por división, período y responsable'],
    modules: ['Instrumentos y equipos', 'Divisiones', 'Tipos de instrumento', 'Programación mensual', 'Validación', 'Ejecución', 'Evidencias', 'Revisión final', 'Auditoría', 'Monitor PI'],
    industries: ['Minería', 'Industria', 'Energía', 'Operaciones']
  },
  {
    name: 'FORMS', slug: 'forms', category: 'Formularios Digitales', featured: false, sortOrder: 3, image: '/images/forms-formularios-digitales.png',
    summary: 'Formularios empresariales para capturar datos, digitalizar procesos y eliminar papel.',
    description: 'Permite construir formularios digitales, capturar información estructurada y activar flujos de revisión o reportabilidad.',
    problem: 'Evita registros dispersos, formularios físicos y procesos manuales difíciles de auditar.',
    benefits: ['Captura móvil', 'Validaciones', 'Flujos internos', 'Reportabilidad', 'Eliminación de papel', 'Historial de respuestas', 'Datos listos para auditoría y BI'],
    modules: ['Constructor de formularios', 'Campos configurables', 'Validaciones', 'Respuestas', 'Aprobaciones', 'Adjuntos', 'Estados', 'Exportación', 'Reportabilidad', 'Usuarios y permisos'],
    industries: ['Administración', 'Operaciones', 'Terreno']
  },
  {
    name: 'Portal de Balances', slug: 'portal-balances', category: 'Gestión Operacional', featured: false, sortOrder: 4, image: '/images/portal-balances.png',
    summary: 'Dashboards e indicadores para monitoreo de balances operacionales.',
    description: 'Portal de Balances permite visualizar KPIs, revisar calidad de información, controlar consistencia de resultados, analizar recuperaciones, monitorear divisiones y acceder a documentación o vistas PI Vision.',
    problem: 'Centraliza indicadores críticos, facilita el seguimiento operacional y entrega información clara para la toma de decisiones.',
    benefits: ['KPIs operacionales', 'Monitoreo corporativo y divisional', 'Calidad de información', 'Acceso a PI Vision', 'Consistencia de resultados visible', 'Biblioteca documental centralizada', 'Seguimiento de recuperaciones y calibraciones'],
    modules: ['Dashboard principal', 'KPI Balance', 'Monitoreo divisional', 'Calidad de información base', 'Calidad de proceso', 'Consistencia de resultados', 'Recuperaciones', 'Biblioteca documental', 'PI Vision'],
    industries: ['Finanzas', 'Operaciones', 'Gerencia']
  },
  {
    name: 'Bitácoras', slug: 'bitacoras', category: 'Operación', featured: false, sortOrder: 5, image: '/images/bitacoras-operacionales.png',
    summary: 'Registro digital de eventos, turnos, novedades y seguimiento operacional.',
    description: 'Permite transformar bitácoras manuales en registros digitales trazables, consultables y auditables.',
    problem: 'Reduce pérdida de información entre turnos, eventos no registrados y falta de historial operativo.',
    benefits: ['Trazabilidad', 'Registro por turno', 'Búsqueda rápida', 'Seguimiento', 'Historial consultable', 'Menos pérdida de información entre equipos', 'Base para reportabilidad operacional'],
    modules: ['Registro de eventos', 'Turnos', 'Novedades', 'Categorías', 'Responsables', 'Adjuntos', 'Búsqueda', 'Filtros', 'Reportes', 'Seguimiento'],
    industries: ['Operaciones', 'Transporte', 'Industria']
  },
  {
    name: 'Plataforma Zebbra', slug: 'plataforma-zebbra', category: 'Monitoreo Operacional', featured: false, sortOrder: 6, image: '/images/plataforma-zebbra.png',
    summary: 'Monitoreo operacional, reportabilidad SMA/DGA y control de continuidad de datos.',
    description: 'Plataforma Zebbra permite consultar dashboards, gráficos, reportes de cobertura, datos faltantes, errores de recepción, errores de envío y retransmisiones.',
    problem: 'Ayuda a monitorear información crítica, detectar brechas de datos y mejorar la gestión operacional mediante tableros claros y trazables.',
    benefits: ['Control de continuidad de datos', 'Reportabilidad SMA/DGA', 'Errores y retransmisiones visibles', 'Integración con SQL Server y servicios externos', 'Detección de datos faltantes', 'Notificaciones internas', 'Exportación para análisis y cumplimiento'],
    modules: ['Dashboards operacionales', 'Reportes SMA', 'Reportes DGA', 'Datos faltantes', 'Errores de recepción', 'Errores de envío', 'Retransmisiones', 'Notificaciones', 'Roles y permisos'],
    industries: ['Operaciones', 'Medio ambiente', 'Gestión hídrica', 'Industria']
  },
  {
    name: 'Sistema de Venta de Pasajes de Buses', slug: 'venta-pasajes-buses', category: 'Transporte', featured: false, sortOrder: 7, image: '/images/venta-pasajes-buses.png',
    summary: 'Administración de venta, emisión, impresión y anulación de pasajes de buses.',
    description: 'Sistema web para consultar viajes, seleccionar asientos, administrar buses, servicios, tarifas, pasajeros, puntos de venta, anulaciones, reportes de caja e impresión de tickets.',
    problem: 'Ordena la operación de boletería, controla servicios y asientos, mejora la trazabilidad de ventas y facilita reportes comerciales.',
    benefits: ['Selección visual de asientos', 'Control de servicios y tarifas', 'Reportes de caja y ventas', 'Impresión de boletos', 'Anulación y cambio de viaje controlados', 'Administración de pasajeros y puntos de venta', 'Trazabilidad comercial por servicio'],
    modules: ['Venta de pasajes', 'Asientos', 'Buses', 'Servicios', 'Tarifas', 'Pasajeros', 'Puntos de venta', 'Anulación de boletos', 'Cambio de viaje', 'Caja y ventas', 'Webservice PHP/SOAP'],
    industries: ['Transporte']
  },
  {
    name: 'PERSEUS OFA', slug: 'perseus-ofa', category: 'Producción', featured: false, sortOrder: 8, image: '/images/perseus-ofa-ofp.png',
    summary: 'Aplicación web para administrar procesos OFA, OFP y productos principales.',
    description: 'PERSEUS OFA permite consultar registros, planificar, editar, abrir, cerrar, eliminar, revisar progreso y exportar información operacional dentro del ecosistema Perseus.',
    problem: 'Ordena procesos productivos, reduce dependencia de planillas y entrega mayor control sobre registros OFA/OFP.',
    benefits: ['Administración OFA/OFP', 'Planificación y avance', 'Acciones masivas', 'Exportación a Excel', 'Control de productos principales', 'Filtros por fecha y búsqueda', 'Validación de acceso mediante token'],
    modules: ['OFA', 'OFP', 'Productos principales', 'Planificación', 'Apertura y cierre', 'Eliminación', 'Filtros por fecha', 'Búsqueda', 'Exportación Excel', 'Validación por token'],
    industries: ['Producción', 'Industria', 'Operaciones']
  },
  {
    name: 'OPMS Caitán', slug: 'opms-caitan', category: 'Gestión Empresarial', featured: false, sortOrder: 9, image: '/images/img-opms-caitan.svg',
    summary: 'Suite web para gestión operacional, nominaciones, proformas, reportes y documentos.',
    description: 'OPMS Caitán administra usuarios, roles, permisos, flujos internos, nominaciones por período, información operacional, proformas, reportes y documentos desde una interfaz moderna y segura.',
    problem: 'Ayuda a ordenar procesos internos, mejorar el control operacional y fortalecer la seguridad de acceso a los sistemas.',
    benefits: ['Control de acceso por funcionalidad', 'Nominaciones por período', 'Proformas parametrizables', 'Gestor documental', 'Flujos internos configurables', 'Reportes operacionales', 'Notificaciones internas y seguridad de usuarios'],
    modules: ['Usuarios', 'Roles y permisos', 'Transacciones', 'Nominaciones anuales', 'Nominaciones mensuales', 'Nominaciones semanales', 'Nominaciones diarias', 'IMD', 'Proformas', 'Reportes', 'Gestor de archivos', 'Notificaciones'],
    industries: ['Operaciones', 'Administración', 'Gestión empresarial']
  },
  {
    name: 'BI / Power BI', slug: 'bi-powerbi', category: 'Business Intelligence', featured: true, sortOrder: 10, image: '/images/bi-power-bi.png',
    summary: 'Extracción, transformación y visualización de datos mediante dashboards ejecutivos.',
    description: 'Convertimos datos dispersos en información ejecutiva lista para decidir mediante pipelines, modelos y tableros Power BI.',
    problem: 'Resuelve reportes manuales, datos inconsistentes y falta de visibilidad ejecutiva.',
    benefits: ['KPIs confiables', 'Dashboards automáticos', 'Modelamiento de datos', 'Conexión con sistemas', 'Menos reportes manuales', 'Indicadores para gerencia y operación', 'Visualización histórica y comparativa'],
    modules: ['Extracción de datos', 'ETL', 'Modelo semántico', 'Dashboards', 'Automatización', 'KPIs', 'Alertas', 'Publicación', 'Capacitación de usuarios'],
    industries: ['Gerencia', 'Producción', 'Logística', 'Ventas']
  },
  {
    name: 'Consultoría IA', slug: 'consultoria-ia', category: 'Inteligencia Artificial', featured: true, sortOrder: 11, image: '/images/consultoria-ia.png',
    summary: 'Diagnóstico, roadmap, asistentes inteligentes, automatización documental y agentes IA.',
    description: 'Ayudamos a identificar oportunidades reales de IA, diseñar soluciones aplicables y construir asistentes, automatizaciones, modelos y plataformas que generan impacto operativo.',
    problem: 'Evita implementar IA sin foco, sin datos preparados o sin conexión real con procesos de negocio.',
    benefits: ['Roadmap IA', 'Asistentes internos', 'RAG con documentos', 'Automatización documental', 'Agentes IA', 'Integración con datos internos', 'Acompañamiento para adopción y medición de impacto'],
    modules: ['Diagnóstico IA', 'Roadmap', 'Asistentes', 'Automatización documental', 'RAG corporativo', 'Integración con sistemas', 'Agentes IA', 'Gobernanza', 'Adopción', 'Medición de impacto'],
    industries: ['Administración', 'Operaciones', 'Soporte', 'Gerencia']
  }
];

const productFaqs = {
  'perseus-erp': [
    ['¿PERSEUS ERP se implementa completo o por módulos?', 'Puede implementarse por etapas. Normalmente se priorizan producción, stock, documentos, reportes o módulos críticos según la operación.'],
    ['¿Puede integrarse con sistemas existentes?', 'Sí. Puede conectarse con bases de datos, APIs, DTE, reportes, etiquetas, sistemas internos y fuentes de información operacionales.'],
    ['¿Qué tipo de empresas lo aprovechan mejor?', 'Empresas industriales, forestales, madereras, manufactureras y logísticas que necesitan trazabilidad entre planta, administración y despacho.']
  ],
  'sistema-calibraciones': [
    ['¿Qué controla el sistema de calibraciones?', 'Controla instrumentos, divisiones, programas mensuales, validaciones, ejecución, evidencias, revisión final, auditoría y envíos hacia PI.'],
    ['¿Permite adjuntar evidencia?', 'Sí. La solución considera carga, descarga y revisión de evidencias para mantener respaldo técnico y auditoría del ciclo.'],
    ['¿Puede monitorear estados por división?', 'Sí. El seguimiento puede organizarse por división, período, responsable, instrumento, estado y etapa del flujo.']
  ],
  forms: [
    ['¿Los formularios se pueden configurar?', 'Sí. El objetivo es construir formularios con campos, validaciones, adjuntos, estados y reportes según el proceso.'],
    ['¿Sirve para terreno?', 'Sí. Puede orientarse a captura móvil, operación en terreno, revisión posterior y exportación de información.'],
    ['¿Los datos se pueden usar en reportes?', 'Sí. Las respuestas pueden alimentar consultas, exportaciones, tableros o integraciones con otros sistemas.']
  ],
  'portal-balances': [
    ['¿Qué indicadores puede mostrar?', 'Puede mostrar KPI Balance, monitoreo corporativo y divisional, calidad de información, calidad de proceso, consistencia y recuperaciones.'],
    ['¿Puede enlazar con PI Vision?', 'Sí. La documentación considera acceso a vistas PI Vision y biblioteca documental asociada al monitoreo.'],
    ['¿Está pensado para gerencia u operación?', 'Para ambos. Entrega visibilidad ejecutiva y detalle operacional para seguimiento diario.']
  ],
  bitacoras: [
    ['¿Reemplaza bitácoras manuales?', 'Sí. Digitaliza eventos, turnos, novedades, adjuntos, responsables y seguimiento para evitar pérdida de información.'],
    ['¿Se puede buscar historial?', 'Sí. La información queda estructurada para búsqueda, filtros y reportes por fecha, turno, categoría o responsable.'],
    ['¿Puede usarse en distintas áreas?', 'Sí. Aplica a operaciones, transporte, industria, mantenimiento, turnos y cualquier proceso con registro periódico.']
  ],
  'plataforma-zebbra': [
    ['¿Qué reportabilidad considera Zebbra?', 'Incluye reportes SMA, DGA, cobertura, datos faltantes, errores de recepción, errores de envío y retransmisiones.'],
    ['¿Puede integrarse con SQL Server?', 'Sí. La documentación considera integración con SQL Server y servicios externos.'],
    ['¿Para qué sirve el control de continuidad?', 'Permite detectar brechas de datos, errores y retransmisiones para mejorar trazabilidad y cumplimiento operacional.']
  ],
  'venta-pasajes-buses': [
    ['¿Incluye selección de asientos?', 'Sí. El sistema considera selección visual de asientos, consulta de viajes, tarifas, servicios y emisión de boletos.'],
    ['¿Controla caja y ventas?', 'Sí. Incluye reportes de caja y ventas, puntos de venta, anulaciones, cambio de viaje e impresión de tickets.'],
    ['¿Puede integrarse con servicios externos?', 'La documentación considera webservice PHP/SOAP, por lo que se puede trabajar integración según el entorno existente.']
  ],
  'perseus-ofa': [
    ['¿Qué procesos administra?', 'Administra OFA, OFP y productos principales dentro del ecosistema Perseus.'],
    ['¿Tiene acciones masivas?', 'Sí. Considera apertura, cierre, eliminación, revisión de progreso, búsqueda, filtros y exportación a Excel.'],
    ['¿Cómo controla el acceso?', 'La documentación considera validación de acceso mediante token y puede complementarse con permisos del ecosistema.']
  ],
  'opms-caitan': [
    ['¿Qué procesos cubre OPMS Caitán?', 'Cubre usuarios, roles, permisos, transacciones, nominaciones, IMD, proformas, reportes, documentos y notificaciones.'],
    ['¿Las nominaciones se gestionan por período?', 'Sí. Considera nominaciones anuales, mensuales, semanales y diarias.'],
    ['¿Incluye seguridad de acceso?', 'Sí. Contempla administración de usuarios, roles, permisos y control de acceso por funcionalidad.']
  ],
  'bi-powerbi': [
    ['¿Solo construyen dashboards?', 'No. También se puede trabajar extracción, transformación, modelo semántico, automatización, KPIs y publicación.'],
    ['¿Puede conectar datos de varios sistemas?', 'Sí. Se puede integrar información desde bases de datos, planillas, APIs y sistemas internos.'],
    ['¿Sirve para seguimiento operacional?', 'Sí. Los tableros pueden diseñarse para gerencia, producción, logística, ventas u operación diaria.']
  ],
  'consultoria-ia': [
    ['¿Por dónde conviene partir con IA?', 'Por un diagnóstico breve que detecte procesos repetitivos, información disponible y oportunidades con impacto medible.'],
    ['¿Pueden conectar IA con nuestros sistemas?', 'Sí. Diseñamos integraciones con APIs, bases de datos, correos, documentos, Power BI y plataformas internas.'],
    ['¿La IA puede trabajar con documentos internos?', 'Sí. Podemos construir asistentes RAG para consultar PDFs, manuales, procedimientos, correos o bases documentales.']
  ]
};

const blogCategories = [
  { name: 'Noticias IA', slug: 'noticias-ia', description: 'Actualidad, cambios relevantes y tendencias de inteligencia artificial.', sortOrder: 1 },
  { name: 'Lanzamientos', slug: 'lanzamientos', description: 'Nuevas herramientas, modelos, agentes y plataformas IA.', sortOrder: 2 },
  { name: 'Guias practicas', slug: 'guias-practicas', description: 'Contenido aplicable para empresas que quieren empezar con IA.', sortOrder: 3 },
  { name: 'Chatbots y agentes', slug: 'chatbots-agentes', description: 'Asistentes, FAQ inteligentes, RAG y automatizacion conversacional.', sortOrder: 4 },
  { name: 'FAQ IA', slug: 'faq-ia', description: 'Preguntas frecuentes sobre adopcion, riesgos, datos y costos.', sortOrder: 5 }
];

const blogPosts = [
  {
    title: 'NVIDIA Vera Rubin entra en produccion completa: por que importa para la IA empresarial',
    slug: 'nvidia-vera-rubin-produccion-completa-2026',
    categorySlug: 'lanzamientos',
    featured: true,
    image: '/images/blog/nvidia-vera-rubin-2026.png',
    publishedAt: '2026-06-01T10:00:00.000Z',
    excerpt: 'NVIDIA anuncio el 31 de mayo de 2026 que su plataforma Vera Rubin entro en produccion completa para fabricas de IA agentica.',
    content: `El 31 de mayo de 2026, NVIDIA anuncio que Vera Rubin entro en produccion completa. La compania presento esta plataforma como base para una nueva etapa de fabricas de IA agentica, donde el entrenamiento, la inferencia y los agentes operan a gran escala.

## Que significa para una empresa

Aunque una pyme o una empresa industrial no compre estos chips directamente, el impacto se siente en servicios cloud, asistentes corporativos, modelos multimodales y automatizacion mas potente. Mas capacidad de computo suele traducirse en mejores herramientas, menor latencia y nuevas formas de integrar IA en procesos reales.

![Infraestructura de fabricas de IA conectando chips, nube y automatizacion empresarial](/images/blog/ai-factory-infrastructure.png)

## Donde mirar el impacto

- Asistentes internos con documentos y datos de negocio.
- Automatizacion de reportes, clasificacion y busqueda.
- Agentes IA que ejecutan pasos sobre sistemas empresariales.
- Analisis mas rapido de imagenes, documentos, voz y datos.

La lectura practica es simple: los lanzamientos de hardware no son solo noticias tecnicas. Son senales de hacia donde iran las plataformas que despues usaran las empresas.`,
    faqs: [
      ['¿Tengo que comprar hardware NVIDIA para usar IA?', 'No necesariamente. Muchas empresas consumen esta capacidad mediante servicios cloud, APIs o plataformas empresariales.'],
      ['¿Por que una noticia de chips importa para software?', 'Porque la capacidad de computo define que tan rapidos, baratos y complejos pueden ser los modelos y agentes disponibles.'],
      ['¿Que deberia hacer una empresa ahora?', 'Identificar procesos con datos, documentos y tareas repetitivas donde un asistente o agente IA pueda generar impacto medible.']
    ]
  },
  {
    title: 'Chatbot IA para FAQ: cuando conviene y cuando no',
    slug: 'chatbot-ia-para-faq',
    categorySlug: 'chatbots-agentes',
    featured: false,
    image: '/images/blog/chatbot-faq-enterprise.png',
    publishedAt: '2026-05-20T10:00:00.000Z',
    excerpt: 'Un chatbot de preguntas frecuentes puede mejorar atencion y soporte, pero solo si tiene informacion confiable y buen diseno conversacional.',
    content: `Un chatbot IA de FAQ no deberia ser solo una ventana que conversa. Debe conocer las preguntas importantes, responder con informacion validada y derivar a una persona cuando el tema necesita criterio humano.

## Cuando si conviene

- Hay preguntas repetidas sobre servicios, precios, procesos o soporte.
- Existe una base de conocimiento, documentos o respuestas oficiales.
- El equipo quiere capturar leads o clasificar solicitudes.
- Se necesita atencion fuera del horario de oficina.

## Cuando no conviene todavia

Si la informacion cambia todos los dias y nadie la mantiene, el chatbot puede entregar respuestas inconsistentes. En ese caso conviene partir ordenando contenidos, categorias y responsables.

Un buen chatbot IA se disena como un sistema: contenido, permisos, tono, limites, registro de conversaciones y mejora continua.`,
    faqs: [
      ['¿El chatbot puede enviar clientes a WhatsApp?', 'Si. Puede abrir WhatsApp con un mensaje prearmado o derivar solicitudes segun la pregunta.'],
      ['¿Puede responder con datos de mi empresa?', 'Si, usando documentos, bases de datos o integraciones controladas.'],
      ['¿Se puede administrar desde el panel?', 'El blog, las categorias y el WhatsApp quedan configurables. Un chatbot avanzado puede sumarse como siguiente modulo.']
    ]
  },
  {
    title: 'Noticias IA de abril: como separar avances utiles de puro ruido',
    slug: 'noticias-ia-abril-avances-utiles-ruido',
    categorySlug: 'noticias-ia',
    featured: false,
    image: '/images/blog/ai-news-timeline.png',
    publishedAt: '2026-04-18T10:00:00.000Z',
    excerpt: 'No toda noticia de IA merece implementarse. Revisa seguridad, integraciones, costos, soporte y valor operativo antes de mover procesos.',
    content: `Cada semana aparecen herramientas nuevas de IA. Algunas son brillantes, otras son muestras bonitas sin base operacional. Para una empresa, la pregunta no es si la herramienta sorprende, sino si mejora un proceso real.

## Criterios de evaluacion

- Seguridad y manejo de datos.
- Integracion con sistemas actuales.
- Costos por usuario, uso o volumen.
- Calidad de respuestas en casos reales.
- Control de permisos, auditoria y soporte.

## La prueba correcta

Antes de contratar, define un caso pequeno y prueba con informacion real pero controlada. Evalua si el equipo entiende la herramienta, si reduce trabajo y si sus respuestas son confiables.

La mejor tecnologia no siempre es la mas nueva. Es la que el equipo puede usar, medir y sostener.`,
    faqs: [
      ['¿Hay que adoptar todos los lanzamientos de IA?', 'No. Conviene filtrarlos segun impacto, seguridad e integracion con el proceso.'],
      ['¿Como pruebo una herramienta sin riesgo?', 'Con un piloto acotado, datos controlados y usuarios internos que midan resultados.'],
      ['¿Que pasa si la herramienta no integra?', 'Puede servir para tareas aisladas, pero no deberia convertirse en pieza critica del proceso.']
    ]
  },
  {
    title: 'Guia marzo 2026: como partir con agentes IA en procesos internos',
    slug: 'guia-marzo-2026-agentes-ia-procesos-internos',
    categorySlug: 'guias-practicas',
    featured: false,
    image: '/images/blog/enterprise-ai-agents.png',
    publishedAt: '2026-03-14T10:00:00.000Z',
    excerpt: 'Una ruta simple para detectar procesos repetitivos, ordenar datos y construir primeros agentes IA con impacto real.',
    content: `La inteligencia artificial sirve cuando resuelve una friccion concreta. Antes de pensar en modelos, conviene mirar donde el equipo pierde tiempo: busqueda de documentos, reportes manuales, respuestas repetidas, clasificacion de correos o revision de informacion operacional.

## El primer paso es elegir un problema pequeno

Un buen primer caso de IA debe tener informacion disponible, usuarios claros y una metrica simple. Por ejemplo: reducir tiempo de respuesta, bajar errores de digitacion o acelerar la preparacion de reportes.

## Casos que suelen funcionar

- Asistentes que responden sobre manuales, procedimientos o politicas internas.
- Automatizacion de resumen y clasificacion de documentos.
- Chatbots para preguntas frecuentes de clientes o usuarios internos.
- Agentes que preparan borradores, consultas o reportes.

La clave no es automatizar todo de una vez. Es construir una primera version controlada, medirla y mejorarla con feedback real.`,
    faqs: [
      ['¿Necesito muchos datos para partir?', 'No siempre. Para un asistente RAG puedes partir con documentos internos bien seleccionados y reglas claras de uso.'],
      ['¿Conviene conectar IA a sistemas internos desde el inicio?', 'Conviene si el caso requiere datos actualizados. Si no, puede partir con documentos y luego integrar APIs o bases de datos.'],
      ['¿Como se mide si valio la pena?', 'Con metricas simples: tiempo ahorrado, errores evitados, consultas resueltas o tareas repetitivas reducidas.']
    ]
  }
];

async function main() {
  const passwordHash = await bcrypt.hash('Admin12345!', 10);
  await prisma.user.upsert({
    where: { email: 'admin@itesicws.cl' },
    update: { passwordHash, name: 'Administrador ITESICWS' },
    create: { email: 'admin@itesicws.cl', name: 'Administrador ITESICWS', passwordHash }
  });

  await prisma.siteSetting.upsert({
    where: { id: 'main' },
    update: {
      heroTitle: 'Software para ordenar tu operación sin enredarte',
      heroSubtitle: 'Hacemos sistemas web, reportes, integraciones e IA para empresas que quieren dejar atrás planillas eternas, datos dispersos y procesos difíciles de seguir.'
    },
    create: {
      id: 'main',
      contactEmail: 'frubilar@itesic.cl',
      leadDeliveryMode: 'EMAIL_AND_WHATSAPP',
      heroTitle: 'Software para ordenar tu operación sin enredarte',
      heroSubtitle: 'Hacemos sistemas web, reportes, integraciones e IA para empresas que quieren dejar atrás planillas eternas, datos dispersos y procesos difíciles de seguir.'
    }
  });

  await prisma.product.deleteMany({
    where: { slug: { in: ['proyecto-zebbra', 'buses-laja'] } }
  });

  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: p,
      create: p
    });
    await prisma.productFAQ.deleteMany({ where: { productId: product.id } });
    const faqs = productFaqs[p.slug] || [
      ['¿Se puede adaptar a mi proceso?', 'Sí. La solución puede ajustarse a usuarios, reglas de negocio, reportes, datos e integraciones de tu empresa.'],
      ['¿Incluye soporte de implementación?', 'Sí. Podemos acompañar levantamiento, configuración, capacitación y mejoras evolutivas.']
    ];
    await prisma.productFAQ.createMany({
      data: faqs.map(([question, answer]) => ({ productId: product.id, question, answer }))
    });
  }

  const categoryBySlug = {};
  for (const category of blogCategories) {
    const savedCategory = await prisma.blogCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category
    });
    categoryBySlug[category.slug] = savedCategory;
  }

  await prisma.blogPost.deleteMany({
    where: {
      slug: {
        in: [
          'como-partir-con-ia-en-una-empresa',
          'lanzamientos-ia-que-mirar-antes-de-adoptar',
          'noticias-ia-para-equipos-operacionales'
        ]
      }
    }
  });

  for (const entry of blogPosts) {
    const postData = {
      title: entry.title,
      slug: entry.slug,
      excerpt: entry.excerpt,
      content: entry.content,
      image: entry.image,
      featured: entry.featured,
      published: true,
      author: 'ITESICWS',
      publishedAt: new Date(entry.publishedAt),
      readMinutes: Math.max(3, Math.ceil(entry.content.split(/\s+/).length / 190)),
      categoryId: categoryBySlug[entry.categorySlug].id
    };
    const post = await prisma.blogPost.upsert({
      where: { slug: entry.slug },
      update: {},
      create: postData
    });
    const faqCount = await prisma.blogFAQ.count({ where: { postId: post.id } });
    if (!faqCount) {
      await prisma.blogFAQ.createMany({
        data: entry.faqs.map(([question, answer]) => ({ postId: post.id, question, answer }))
      });
    }
  }

  console.log('Seed listo: admin, settings, productos y blog cargados.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
