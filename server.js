require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const slugify = require('slugify');
const { PrismaClient, DeliveryMode } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const prisma = new PrismaClient();
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
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(__dirname + '/public'));
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

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/admin/login');
  next();
}

function splitLines(value) {
  if (Array.isArray(value)) return value;
  return (value || '').split('\n').map(x => x.trim()).filter(Boolean);
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
  const products = await prisma.product.findMany({ where: { published: true }, orderBy: [{ featured: 'desc' }, { sortOrder: 'asc' }] });
  res.render('home', { products });
});

app.get('/productos', async (req, res) => {
  const products = await prisma.product.findMany({ where: { published: true }, orderBy: { sortOrder: 'asc' } });
  res.render('products', { products });
});

app.get('/productos/:slug', async (req, res) => {
  const product = await prisma.product.findUnique({ where: { slug: req.params.slug }, include: { faqs: true } });
  if (!product || !product.published) return res.status(404).render('404');
  res.render('product-detail', { product });
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

app.get('/admin/login', (req, res) => res.render('admin/login', { error: null }));
app.post('/admin/login', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.render('admin/login', { error: 'Credenciales inválidas' });
  req.session.user = { id: user.id, email: user.email, name: user.name };
  res.redirect('/admin');
});
app.post('/admin/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.get('/admin', requireAuth, async (req, res) => {
  const [productCount, leadCount, latestLeads] = await Promise.all([
    prisma.product.count(), prisma.lead.count(), prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })
  ]);
  res.render('admin/dashboard', { productCount, leadCount, latestLeads });
});

app.get('/admin/products', requireAuth, async (req, res) => {
  const products = await prisma.product.findMany({ orderBy: { sortOrder: 'asc' } });
  res.render('admin/products', { products });
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
app.post('/admin/products/:id/delete', requireAuth, async (req, res) => { await prisma.product.delete({ where: { id: req.params.id } }); res.redirect('/admin/products'); });

app.get('/admin/leads', requireAuth, async (req, res) => {
  const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
  res.render('admin/leads', { leads });
});
app.post('/admin/leads/:id', requireAuth, async (req, res) => {
  await prisma.lead.update({ where: { id: req.params.id }, data: { status: req.body.status, notes: req.body.notes || null } });
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
    heroSubtitle: req.body.heroSubtitle
  }});
  res.redirect('/admin/settings?saved=1');
});

app.use((req, res) => res.status(404).render('404'));
app.listen(PORT, () => console.log(`ITESICWS listo en http://localhost:${PORT}`));
