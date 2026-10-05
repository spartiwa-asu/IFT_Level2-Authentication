// Copy only allow-listed fields from req.body.
// This blocks "mass assignment" - a client sending fields you never meant to accept.
module.exports = (source, allowedFields) =>
  Object.fromEntries(
    allowedFields.filter((key) => source[key] !== undefined).map((key) => [key, source[key]])
  );
