const { decryptWithAES, verifyWithAESCMAC } = require('../crypto/crypto');
const PaymentVerifier = require('../server/paymentVerifier');
const ClientDevice = require('../nfc/clientDevice');
const POSTerminal = require('../nfc/posSimulator');

// Test keys
const TEST_META_KEY = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';
const TEST_FILE_KEY = 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6';

describe('Rozo Tap to Pay Flow', () => {
  let clientDevice;
  let posTerminal;
  let paymentVerifier;
  
  beforeEach(() => {
    // Initialize test components
    clientDevice = new ClientDevice({
      uid: 'TEST-DEVICE-1',
      initialCounter: 0,
      metaKey: TEST_META_KEY,
      fileKey: TEST_FILE_KEY
    });
    
    posTerminal = new POSTerminal({
      serverUrl: 'http://localhost:3000',
      merchant: {
        id: 'TEST-MERCHANT-1',
        name: 'Test Store'
      }
    });
    
    paymentVerifier = new PaymentVerifier({
      metaKey: TEST_META_KEY,
      fileKey: TEST_FILE_KEY,
      deviceRegistry: {}
    });
  });
  
  test('Complete payment flow should succeed', async () => {
    // 1. Device generates tap data
    const tapResult = clientDevice.tap();
    expect(tapResult.success).toBe(true);
    
    // 2. POS terminal reads the NFC data
    const posResult = await posTerminal.readNfcTag(tapResult.ndefData);
    
    // 3. Verify the POS result (mocked in this test)
    expect(posResult.success).toBe(true);
    
    // 4. Additional verification directly using the verifier
    // Extract d and c parameters from the NDEF URL
    const ndefString = tapResult.ndefData.toString('utf8');
    const urlParams = new URL(ndefString);
    const d = urlParams.searchParams.get('d');
    const c = urlParams.searchParams.get('c');
    
    // Verify with our server-side verifier
    const verificationResult = paymentVerifier.verifyPaymentRequest(d, c);
    expect(verificationResult.success).toBe(true);
    expect(verificationResult.uid).toBe('TEST-DEVICE-1');
    
    // 5. Verify the counter incremented
    expect(verificationResult.counter).toBe(1);
    expect(clientDevice.counter).toBe(1);
  });
  
  test('Replay attack should be detected', async () => {
    // 1. First tap is successful
    const tapResult1 = clientDevice.tap();
    expect(tapResult1.success).toBe(true);
    
    // Extract parameters
    const ndefString1 = tapResult1.ndefData.toString('utf8');
    const urlParams1 = new URL(ndefString1);
    const d1 = urlParams1.searchParams.get('d');
    const c1 = urlParams1.searchParams.get('c');
    
    // Verify first payment
    const verificationResult1 = paymentVerifier.verifyPaymentRequest(d1, c1);
    expect(verificationResult1.success).toBe(true);
    
    // 2. Try to replay the same NDEF message (same d and c parameters)
    const verificationResult2 = paymentVerifier.verifyPaymentRequest(d1, c1);
    
    // Should detect replay attack
    expect(verificationResult2.success).toBe(false);
    expect(verificationResult2.code).toBe('REPLAY_ATTACK');
  });
  
  test('Modified message should fail integrity check', () => {
    // 1. Generate valid parameters
    const tapResult = clientDevice.tap();
    const ndefString = tapResult.ndefData.toString('utf8');
    const urlParams = new URL(ndefString);
    const d = urlParams.searchParams.get('d');
    
    // 2. Create a fake c parameter
    const fakeC = 'F459EEA788E37E44AAAABBBBCCCCDDDDEEEEFFFF';
    
    // 3. Verify with tampered parameters
    const verificationResult = paymentVerifier.verifyPaymentRequest(d, fakeC);
    
    // Should fail integrity check
    expect(verificationResult.success).toBe(false);
    expect(verificationResult.code).toBe('INVALID_SIGNATURE');
  });
}); 