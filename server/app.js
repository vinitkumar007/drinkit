// Builds the HTTP app (no listening here, so tests can start it on a random port).
const config = require('./config');
const { createApp, json, serveStatic, cors, helmet } = require('./lib');
const { apiNotFound, errorHandler } = require('./middleware/errors');
const { seed } = require('./db/seed');

function buildApp() {
  seed(); // no-op when the database already has data

  const app = createApp();
  app.use(helmet());
  app.use(cors());
  app.use(json({ limit: 100 * 1024 }));
  app.use(serveStatic(config.publicDir));
  require('./routes')(app);
  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}

module.exports = { buildApp };
