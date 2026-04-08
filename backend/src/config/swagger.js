const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'AdvogaFlow API',
      version: '1.0.0',
      description: 'API do sistema jurídico AdvogaFlow'
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Informe o token Firebase no formato Bearer'
        }
      },
      schemas: {
        Processo: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'abc123'
            },
            titulo: {
              type: 'string',
              example: 'Ação de obrigação de fazer'
            },
            descricao: {
              type: 'string',
              example: 'Cliente solicita cumprimento contratual'
            },
            clienteId: {
              type: 'string',
              example: 'uid_cliente_001'
            },
            advogadoId: {
              type: 'string',
              example: 'uid_advogado_001'
            },
            status: {
              type: 'string',
              example: 'Em Andamento'
            },
            statusCalculado: {
              type: 'string',
              example: 'Urgente'
            },
            prazo: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2026-04-10T00:00:00.000Z'
            },
            arquivado: {
              type: 'boolean',
              example: false
            },
            deletado: {
              type: 'boolean',
              example: false
            },
            criadoEm: {
              type: 'string',
              format: 'date-time',
              example: '2026-03-24T23:00:00.000Z'
            },
            criadoPor: {
              type: 'string',
              example: 'uid_advogado_001'
            }
          }
        },
        CriarProcessoInput: {
          type: 'object',
          required: ['titulo', 'clienteId'],
          properties: {
            titulo: {
              type: 'string',
              example: 'Teste Processo'
            },
            descricao: {
              type: 'string',
              example: 'Primeiro teste do backend'
            },
            clienteId: {
              type: 'string',
              example: 'uid_cliente_001'
            },
            advogadoId: {
              type: 'string',
              example: 'uid_advogado_001'
            },
            prazo: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '2026-04-10'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            mensagem: {
              type: 'string',
              example: 'Acesso negado'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;