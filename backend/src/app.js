const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');

const swaggerSpec = require('./config/swagger');
const processoRoutes = require('./routes/processo.routes');
const authRoutes = require('./routes/auth.routes');
const { notFoundMiddleware, errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({
    mensagem: '⚖️ Backend Jurídico AdvogaFlow online'
  });
});

app.get('/teste-back', (req, res) => {
  console.log('🔥 BATEU NO BACKEND');
  res.json({ ok: true });
});

app.use('/api', authRoutes);
app.use('/api/processos', processoRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;