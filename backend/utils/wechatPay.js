/**
 * 微信支付V3工具类 - JSAPI/小程序支付
 * 参考文档: https://pay.weixin.qq.com/doc/v3/merchant/4012062524
 */
const WxPay = require('wechatpay-node-v3');
const fs = require('fs');
const path = require('path');

// 微信支付V3配置
const config = {
  appid: process.env.WX_APP_ID,
  mchid: process.env.WX_PAY_MCH_ID,
  publicKey: fs.existsSync(path.join(__dirname, '..', process.env.WX_PAY_CERT_PATH || 'certs/apiclient_cert.pem'))
    ? fs.readFileSync(path.join(__dirname, '..', process.env.WX_PAY_CERT_PATH || 'certs/apiclient_cert.pem'))
    : Buffer.from(''),
  privateKey: fs.existsSync(path.join(__dirname, '..', process.env.WX_PAY_KEY_PATH || 'certs/apiclient_key.pem'))
    ? fs.readFileSync(path.join(__dirname, '..', process.env.WX_PAY_KEY_PATH || 'certs/apiclient_key.pem'))
    : Buffer.from(''),
  // APIv3密钥，用于回调解密
  key: process.env.WX_PAY_API_V3_KEY
};

// 初始化微信支付
let pay;
try {
  pay = new WxPay({
    appid: config.appid,
    mchid: config.mchid,
    publicKey: config.publicKey,
    privateKey: config.privateKey,
    key: config.key
  });
  console.log('✅ 微信支付V3初始化成功');
} catch (error) {
  console.error('❌ 微信支付V3初始化失败:', error.message);
  // 未配置时创建空对象，避免启动失败
  pay = null;
}

/**
 * JSAPI统一下单
 * 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012525167
 * @param {Object} params
 * @param {string} params.orderNo 商户订单号
 * @param {number} params.totalFee 金额（分）
 * @param {string} params.body 商品描述
 * @param {string} params.openId 用户openid
 * @param {string} params.attach 附加数据（可选）
 * @returns {Promise<Object>} prepay_id和前端支付参数
 */
async function createJsapiOrder(params) {
  if (!pay) {
    throw new Error('微信支付未配置，请检查环境变量');
  }

  const { orderNo, totalFee, body, openId, attach = '' } = params;

  // 构造请求参数
  const orderData = {
    appid: config.appid,
    mchid: config.mchid,
    description: body,
    out_trade_no: orderNo,
    attach,
    notify_url: `${process.env.FRONTEND_URL}/api/membership/payment/notify`,
    amount: {
      total: totalFee,
      currency: 'CNY'
    },
    payer: {
      openid: openId
    }
  };

  try {
    // 调用微信V3 JSAPI下单接口
    const result = await pay.transactions_jsapi({
      description: orderData.description,
      out_trade_no: orderData.out_trade_no,
      attach: orderData.attach,
      notify_url: orderData.notify_url,
      amount: orderData.amount,
      payer: orderData.payer
    });

    if (!result || !result.prepay_id) {
      throw new Error(result.message || '下单失败，未返回prepay_id');
    }

    // 生成前端调起支付参数
    const payParams = pay.jsapi(orderData.out_trade_no, result.prepay_id);

    return {
      prepayId: result.prepay_id,
      payParams: {
        appId: payParams.appId,
        timeStamp: payParams.timeStamp,
        nonceStr: payParams.nonceStr,
        package: payParams.package,
        signType: payParams.signType,
        paySign: payParams.paySign
      }
    };
  } catch (error) {
    console.error('微信支付下单失败:', error);
    throw error;
  }
}

/**
 * 查询订单
 * 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012526916
 * @param {string} orderNo 商户订单号
 */
async function queryOrder(orderNo) {
  if (!pay) {
    throw new Error('微信支付未配置');
  }

  try {
    const result = await pay.query({ out_trade_no: orderNo });
    return result;
  } catch (error) {
    console.error('查询订单失败:', error);
    throw error;
  }
}

/**
 * 关闭订单
 * 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012526915
 * @param {string} orderNo 商户订单号
 */
async function closeOrder(orderNo) {
  if (!pay) {
    throw new Error('微信支付未配置');
  }

  try {
    await pay.close({ out_trade_no: orderNo });
    return true;
  } catch (error) {
    console.error('关闭订单失败:', error);
    throw error;
  }
}

/**
 * 验证并解密支付回调
 * 参考: https://pay.weixin.qq.com/doc/v3/merchant/4012365342
 * @param {Object} headers 请求头
 * @param {Object} body 请求体
 */
function decryptNotify(headers, body) {
  if (!pay) {
    throw new Error('微信支付未配置');
  }

  try {
    const result = pay.callback_decrypt(headers, body);
    return result;
  } catch (error) {
    console.error('回调解密失败:', error);
    throw error;
  }
}

/**
 * 验证签名
 */
function verifySignature(headers, body) {
  if (!pay) {
    throw new Error('微信支付未配置');
  }

  try {
    return pay.verify_sign(headers, body);
  } catch (error) {
    console.error('签名验证失败:', error);
    return false;
  }
}

module.exports = {
  createJsapiOrder,
  queryOrder,
  closeOrder,
  decryptNotify,
  verifySignature,
  isConfigured: () => pay !== null
};