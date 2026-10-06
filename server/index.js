const config = require('./config');
const { buildApp } = require('./app');

buildApp().listen(config.port, () => {
  console.log(`Drinkit running on http://localhost:${config.port}`);
  console.log('  Customer app : /');
  console.log('  Admin panel  : /admin/');
  console.log('  Rider app    : /rider/');
});
