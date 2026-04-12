const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');

const { projectId } = require('./config/firebase');
const swaggerSpec = require('./config/swagger');
const processoRoutes = require('./routes/processo.routes');
const authRoutes = require('./routes/auth.routes');
const clienteRoutes = require('./routes/cliente.routes');
const conviteRoutes = require('./routes/convite.routes');
const honorarioRoutes = require('./routes/honorario.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

const app = express();
app.set('trust proxy', 1);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function montarOrigensPermitidas() {
  const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaults = ['http://localhost:4200', 'http://localhost:3000'];
  const firebaseHostingOrigins = projectId
    ? [`https://${projectId}.web.app`, `https://${projectId}.firebaseapp.com`]
    : [];

  return new Set([...defaults, ...firebaseHostingOrigins, ...configuredOrigins]);
}

function isFirebasePreviewChannel(origin) {
  if (!origin || !projectId) {
    return false;
  }

  const previewPattern = new RegExp(`^https://${escapeRegex(projectId)}--[a-z0-9-]+\\.web\\.app$`, 'i');
  return previewPattern.test(origin);
}

// ============================================================
// SEGURANÇA — Helmet + CSP
// ============================================================
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://*.googleusercontent.com',
          'https://firebasestorage.googleapis.com',
          'https://*.firebasestorage.app'
        ],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://firebasestorage.googleapis.com',
          'https://securetoken.googleapis.com',
          'https://identitytoolkit.googleapis.com'
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);

// ============================================================
// CORS — whitelist por ambiente
// ============================================================
const allowedOrigins = montarOrigensPermitidas();

app.use(
  cors({
    origin: (origin, callback) => {
      // Permite tools como Postman/curl (sem origin) e origens da whitelist
      if (!origin || allowedOrigins.has(origin) || isFirebasePreviewChannel(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS bloqueado para origem: ${origin}`));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// ============================================================
// RATE LIMITING
// ============================================================
// Limit global suave (100 reqs / 15min por IP) para todas as rotas /api
const limiteGlobal = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: 'Muitas requisições, tente novamente em alguns minutos.' }
});

// Limit estrito (10 tentativas / 15min) para login
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: 'Muitas tentativas de login, aguarde 15 minutos.' }
});

// Limit estrito para envio de convites (evita spam)
const limiteConvite = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { mensagem: 'Limite de convites por hora atingido.' }
});

app.use('/api/', limiteGlobal);
app.use('/api/login-seguro', limiteLogin);
app.use('/api/equipe/convidar', limiteConvite);

// ============================================================
// ROTAS PÚBLICAS
// ============================================================
app.get('/', (req, res) => {
  res.json({
    mensagem: '⚖️ Backend Jurídico AdvogaFlow online'
  });
});

app.get('/teste-back', (req, res) => {
  console.log('🔥 BATEU NO BACKEND');
  res.json({ ok: true });
});

app.get('/healthz', (req, res) => {
  res.status(200).json({ ok: true });
});

// ============================================================
// ROTAS API
// ============================================================
app.use('/api', authRoutes);
app.use('/api', conviteRoutes);
app.use('/api', usuarioRoutes);
app.use('/api', clienteRoutes);
app.use('/api', honorarioRoutes);
app.use('/api/processos', processoRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
