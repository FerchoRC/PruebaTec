const REQUIRED = ['DATABASE_URL'];

const OPTIONAL_DEFAULTS = {
  PORT: '3001',
  NODE_ENV: 'development',
  CORS_ORIGIN: '*',
  DB_POOL_MAX: '10',
};

export function loadConfig(source = process.env) {
  const missing = REQUIRED.filter((key) => {
    const value = source[key];
    return value === undefined || String(value).trim() === '';
  });

  if (missing.length > 0) {
    throw new Error(
      `Faltan variables de entorno obligatorias: ${missing.join(', ')}. ` +
        'Revise el archivo .env.example y defina los valores antes de arrancar.',
    );
  }

  const get = (key) => source[key] ?? OPTIONAL_DEFAULTS[key];

  const port = Number(get('PORT'));
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`PORT invalido: ${get('PORT')}`);
  }

  return {
    databaseUrl: source.DATABASE_URL,
    port,
    nodeEnv: get('NODE_ENV'),
    corsOrigin: get('CORS_ORIGIN'),
    dbPoolMax: Number(get('DB_POOL_MAX')) || 10,
  };
}
