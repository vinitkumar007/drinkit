// Registers every API route module on the app.
module.exports = (app) => {
  require('./auth')(app);
  require('./catalog')(app);
  require('./addresses')(app);
  require('./orders')(app);
  require('./admin')(app);
  require('./rider')(app);
};
