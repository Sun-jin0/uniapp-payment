const crypto = require('crypto');

const generateRedeemCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const generateMultipleCodes = (count) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(generateRedeemCode());
  }
  return codes;
};

module.exports = {
  generateRedeemCode,
  generateMultipleCodes,
};
