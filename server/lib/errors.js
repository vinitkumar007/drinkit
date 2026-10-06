// Typed HTTP errors. Throw these anywhere; the error middleware turns them into JSON responses.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

module.exports = {
  HttpError,
  badRequest: (m = 'Bad request') => new HttpError(400, m),
  unauthorized: (m = 'Login required') => new HttpError(401, m),
  forbidden: (m = 'Forbidden') => new HttpError(403, m),
  notFound: (m = 'Not found') => new HttpError(404, m),
  conflict: (m = 'Conflict') => new HttpError(409, m),
  tooMany: (m = 'Too many requests') => new HttpError(429, m),
};
