module.exports = {
  ...require('./router'),
  ...require('./body'),
  ...require('./static'),
  ...require('./security'),
  jwt: require('./jwt'),
  validate: require('./validate'),
  errors: require('./errors'),
};
