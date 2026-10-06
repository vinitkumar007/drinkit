const { HttpError } = require('../lib/errors');

// Unknown /api route.
const apiNotFound = (req, res) => res.status(404).json({ error: 'Not found' });

// Error handler (4 args). HttpError -> its status; anything else -> 500 without leaking details.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Server error' });
};

module.exports = { apiNotFound, errorHandler };
