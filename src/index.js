require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const PaymentVerifier = require('./server/paymentVerifier');
const { generatePaymentParameters } = require('./crypto/crypto');

// Initialize the app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up payment verifier with keys from environment variables
const paymentVerifier = new PaymentVerifier({
  metaKey: process.env.META_KEY || 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
  fileKey: process.env.FILE_KEY || 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6',
  deviceRegistry: {}, // In production, this would be a database
  deviceBalances: {},
  deviceAuthorizations: {},
  transactions: []
});

// Routes
app.get('/', (req, res) => {
  res.send('Rozo Tap to Pay Server');
});

// Endpoint to verify a tap payment
app.get('/tap', (req, res) => {
  const { d, c, amount, merchantAddress } = req.query;
  
  if (!d || !c) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters',
      code: 'MISSING_PARAMS'
    });
  }
  
  // Parse amount if provided
  const paymentAmount = amount ? parseFloat(amount) : 0;
  
  const result = paymentVerifier.verifyPaymentRequest(d, c, paymentAmount, merchantAddress);
  if (result.success) {
    return res.json({
      success: true,
      message: paymentAmount > 0 
        ? `Payment of ${paymentAmount} USDC verified successfully` 
        : 'Payment verified successfully',
      uid: result.uid,
      counter: result.counter,
      amount: result.amount,
      balance: result.balance
    });
  } else {
    return res.status(400).json(result);
  }
});

// Endpoint to generate new payment parameters for a device
// In a real implementation, this would be authenticated
app.post('/generate', (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Missing device UID',
      code: 'MISSING_UID'
    });
  }
  
  // Check if device is authorized
  if (!paymentVerifier.isDeviceAuthorized(uid)) {
    return res.status(403).json({
      success: false,
      error: 'Device not authorized for payments',
      code: 'UNAUTHORIZED_DEVICE'
    });
  }
  
  // Check if device has sufficient balance
  const balance = paymentVerifier.getDeviceBalance(uid);
  if (balance <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Insufficient USDC balance',
      code: 'INSUFFICIENT_BALANCE',
      balance
    });
  }
  
  const counter = paymentVerifier.getDeviceCounter(uid);
  const params = generatePaymentParameters(
    uid,
    counter,
    process.env.META_KEY || 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6',
    process.env.FILE_KEY || 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6'
  );
  
  return res.json({
    success: true,
    paymentUrl: params.paymentUrl,
    params: {
      d: params.d,
      c: params.c
    },
    balance
  });
});

// Endpoint to authorize a device for payments
app.post('/authorize', (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Missing device UID',
      code: 'MISSING_UID'
    });
  }
  
  const result = paymentVerifier.authorizeDevice(uid);
  
  return res.json({
    success: true,
    message: 'Device authorized for payments',
    uid
  });
});

// Endpoint to deauthorize a device for payments
app.post('/deauthorize', (req, res) => {
  const { uid } = req.body;
  
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Missing device UID',
      code: 'MISSING_UID'
    });
  }
  
  const result = paymentVerifier.deauthorizeDevice(uid);
  
  return res.json({
    success: true,
    message: 'Device deauthorized for payments',
    uid
  });
});

// Endpoint to top up a device's USDC balance
app.post('/topup', (req, res) => {
  const { uid, amount, sourceAddress, network } = req.body;
  
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Missing device UID',
      code: 'MISSING_UID'
    });
  }
  
  if (!amount || amount <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Invalid amount',
      code: 'INVALID_AMOUNT'
    });
  }
  
  if (!sourceAddress) {
    return res.status(400).json({
      success: false,
      error: 'Missing source address',
      code: 'MISSING_SOURCE'
    });
  }
  
  try {
    const result = paymentVerifier.topUpDeviceBalance(uid, amount, sourceAddress, network || 'base');
    
    return res.json({
      success: true,
      message: `Successfully topped up ${amount} USDC`,
      balance: result.balance,
      uid
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: error.message,
      code: 'TOPUP_FAILED'
    });
  }
});

// Endpoint to get device balance
app.get('/balance/:uid', (req, res) => {
  const { uid } = req.params;
  
  if (!uid) {
    return res.status(400).json({
      success: false,
      error: 'Missing device UID',
      code: 'MISSING_UID'
    });
  }
  
  const balance = paymentVerifier.getDeviceBalance(uid);
  const authorized = paymentVerifier.isDeviceAuthorized(uid);
  const counter = paymentVerifier.getDeviceCounter(uid);
  
  return res.json({
    success: true,
    uid,
    balance,
    authorized,
    counter
  });
});

// Endpoint to get transaction history for a device
app.get('/transactions/:uid?', (req, res) => {
  const { uid } = req.params;
  
  const transactions = paymentVerifier.getTransactionHistory(uid);
  
  return res.json({
    success: true,
    transactions
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rozo Tap to Pay server running on port ${PORT}`);
});

module.exports = app; 