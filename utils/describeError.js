// Turn Mongoose / MongoDB errors into { statusCode, message } a client can read
module.exports = (err) => {
  if (err.name === 'ValidationError') {
    return { statusCode: 400, message: Object.values(err.errors).map((e) => e.message).join(' ') };
  }
  if (err.name === 'CastError') {
    return { statusCode: 400, message: `Invalid ${err.path}: ${err.value}` };
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    return { statusCode: 409, message: `That ${field} is already in use.` };
  }
  if (err.type === 'entity.parse.failed') {
    return { statusCode: 400, message: 'Request body is not valid JSON.' };
  }
  return { statusCode: err.statusCode || 500, message: err.message };
};
