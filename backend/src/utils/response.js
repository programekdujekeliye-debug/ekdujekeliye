export const sendSuccess = (res, data = {}, message = '', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...data
  });
};

export const sendError = (res, message = 'Internal Server Error', statusCode = 500, code = 'INTERNAL_ERROR') => {
  return res.status(statusCode).json({
    success: false,
    error: message,
    code
  });
};
