const ClientDevice = require('./nfc/clientDevice');
const POSTerminal = require('./nfc/posSimulator');
const PaymentVerifier = require('./server/paymentVerifier');

// Demo keys
const DEMO_META_KEY = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';
const DEMO_FILE_KEY = 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6';

// Initialize components
const deviceRegistry = {};
const paymentVerifier = new PaymentVerifier({
  metaKey: DEMO_META_KEY,
  fileKey: DEMO_FILE_KEY,
  deviceRegistry
});

const clientDevice = new ClientDevice({
  uid: 'DEMO-DEVICE-1234',
  initialCounter: 0,
  metaKey: DEMO_META_KEY,
  fileKey: DEMO_FILE_KEY
});

const posTerminal = new POSTerminal({
  merchant: {
    id: 'DEMO-MERCHANT-ABCD',
    name: 'Rozo Demo Store'
  }
});

/**
 * Run a complete payment flow demonstration
 */
async function runDemoFlow() {
  console.log('=== Rozo Tap to Pay Demonstration ===');
  console.log('\n1. Customer Device Information:');
  console.log(clientDevice.getDeviceInfo());
  
  console.log('\n2. POS Terminal Status:');
  console.log(posTerminal.checkStatus());
  
  console.log('\n3. Customer initiates payment (taps device):');
  const tapResult = clientDevice.tap();
  console.log(tapResult);
  
  console.log('\n4. POS Terminal reads the NFC data:');
  const posResult = await posTerminal.readNfcTag(tapResult.ndefData);
  console.log(posResult);
  
  // Extract URL parameters for direct verification
  const ndefUrl = tapResult.ndefData.toString('utf8');
  console.log('\nNDEF URL:', ndefUrl);
  
  // Parse d and c parameters
  const urlMatch = ndefUrl.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
  const d = urlMatch[1];
  const c = urlMatch[2];
  
  console.log('\n5. Server-side verification:');
  const verificationResult = paymentVerifier.verifyPaymentRequest(d, c);
  console.log(verificationResult);
  
  console.log('\n6. Try to replay the same parameters (replay attack):');
  const replayResult = paymentVerifier.verifyPaymentRequest(d, c);
  console.log(replayResult);
  
  console.log('\n7. Generate another payment from the same device:');
  const secondTapResult = clientDevice.tap();
  const secondNdefUrl = secondTapResult.ndefData.toString('utf8');
  const secondUrlMatch = secondNdefUrl.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
  const d2 = secondUrlMatch[1];
  const c2 = secondUrlMatch[2];
  
  console.log('\n8. Verify the second payment:');
  const secondVerificationResult = paymentVerifier.verifyPaymentRequest(d2, c2);
  console.log(secondVerificationResult);
  
  console.log('\n=== Demonstration Complete ===');
}

// Run the demo
runDemoFlow().catch(console.error); 