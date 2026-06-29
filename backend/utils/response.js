const successResponse = (data, message = 'success') => {
  return {
    code: 0,
    message,
    data,
  };
};

const errorResponse = (message, code = 1) => {
  return {
    code,
    message,
    data: null,
  };
};

module.exports = {
  successResponse,
  errorResponse,
};
