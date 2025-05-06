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
  deviceRegistry: {} // In production, this would be a database
});

// Routes
app.get('/', (req, res) => {
  res.send('Rozo Tap to Pay Server');
});

// Endpoint to verify a tap payment
app.get('/tap', (req, res) => {
  const { d, c } = req.query;
  
  if (!d || !c) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters',
      code: 'MISSING_PARAMS'
    });
  }
  
  const result = paymentVerifier.verifyPaymentRequest(d, c);
  if (result.success) {
    return res.json({
      success: true,
      message: 'Payment verified successfully',
      uid: result.uid,
      counter: result.counter
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
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Rozo Tap to Pay server running on port ${PORT}`);
});

module.exports = app; 