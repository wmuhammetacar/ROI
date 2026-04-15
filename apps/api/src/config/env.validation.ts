import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('1h'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(8).max(15).default(12),
  CORS_ORIGINS: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow('').optional(),
  }),
  REALTIME_ALLOWED_ORIGINS: Joi.string().allow('').optional(),
  TRUST_PROXY: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(false),
  ENABLE_REQUEST_LOGS: Joi.boolean().truthy('true').truthy('1').falsy('false').falsy('0').default(true),
  REQUEST_LOG_EXCLUDE_HEALTH: Joi.boolean()
    .truthy('true')
    .truthy('1')
    .falsy('false')
    .falsy('0')
    .default(true),
  RATE_LIMIT_TTL_SECONDS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(200),
  AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(20),
  PUBLIC_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(30),
  PUBLIC_ORDER_IDEMPOTENCY_WINDOW_MINUTES: Joi.number().integer().min(1).max(1440).default(15),
  INTEGRATION_TEST_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(15),
  READINESS_DB_TIMEOUT_MS: Joi.number().integer().min(100).max(30000).default(2500),
  ERROR_TRACKING_DSN: Joi.string().uri().allow('').optional(),
});
