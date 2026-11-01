function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function httpError(status, message, extra = {}) {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ message: 'Files must be 10 MB or smaller.' });
    return;
  }
  if (err.name === 'CastError') {
    res.status(404).json({ message: 'Not found.' });
    return;
  }
  if (err.code === 11000 && err.keyPattern?.email) {
    res.status(409).json({
      message: 'Check the form and try again.',
      errors: { email: 'An account with that email already exists.' },
    });
    return;
  }
  if (err.type === 'entity.parse.failed') {
    res.status(400).json({ message: 'The request body could not be read.' });
    return;
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  const body = {
    message: status >= 500 && status !== 503 ? 'Something went wrong.' : err.message,
  };
  if (err.errors) body.errors = err.errors;
  if (err.retryAfter) body.retryAfter = err.retryAfter;
  res.status(status).json(body);
}

module.exports = { asyncHandler, httpError, errorHandler };
