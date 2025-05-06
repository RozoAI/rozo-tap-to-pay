const PaymentVerifier = require('../server/paymentVerifier');
const ClientDevice = require('../nfc/clientDevice');
const POSTerminal = require('../nfc/posSimulator');
const CryptoWallet = require('../wallet/cryptoWallet');

// Test keys
const TEST_META_KEY = 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';
const TEST_FILE_KEY = 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6';

describe('Rozo Tap to Pay with USDC', () => {
  let baseDevice;
  let solanaDevice;
  let baseWallet;
  let solanaWallet;
  let basePOS;
  let solanaPOS;
  let paymentVerifier;
  
  beforeEach(async () => {
    // Initialize test components
    baseDevice = new ClientDevice({
      uid: 'TEST-BASE-DEVICE',
      initialCounter: 0,
      network: 'base',
      metaKey: TEST_META_KEY,
      fileKey: TEST_FILE_KEY
    });
    
    solanaDevice = new ClientDevice({
      uid: 'TEST-SOLANA-DEVICE',
      initialCounter: 0,
      network: 'solana',
      metaKey: TEST_META_KEY,
      fileKey: TEST_FILE_KEY
    });
    
    basePOS = new POSTerminal({
      network: 'base',
      merchant: {
        id: 'TEST-BASE-MERCHANT',
        name: 'Test Base Store'
      }
    });
    
    solanaPOS = new POSTerminal({
      network: 'solana',
      merchant: {
        id: 'TEST-SOLANA-MERCHANT',
        name: 'Test Solana Store'
      }
    });
    
    paymentVerifier = new PaymentVerifier({
      metaKey: TEST_META_KEY,
      fileKey: TEST_FILE_KEY,
      deviceRegistry: {},
      deviceBalances: {},
      deviceAuthorizations: {},
      transactions: []
    });
    
    // Set up wallets
    baseWallet = new CryptoWallet({ network: 'base' });
    solanaWallet = new CryptoWallet({ network: 'solana' });
    
    await baseWallet.connect();
    await solanaWallet.connect();
  });
  
  test('Device should be able to top up with Base USDC', async () => {
    // Top up Base device
    const topUpAmount = 100;
    const topUpResult = await baseDevice.topUp(topUpAmount, {
      wallet: baseWallet,
      network: 'base'
    });
    
    expect(topUpResult.success).toBe(true);
    expect(baseDevice.usdcBalance).toBe(topUpAmount);
    expect(baseDevice.authorized).toBe(true);
    
    // Verify wallet balance was reduced
    expect(baseWallet.getUSDCBalance()).toBeLessThan(1000); // Initial balance is random but less than original
  });
  
  test('Device should be able to top up with Solana USDC', async () => {
    // Top up Solana device
    const topUpAmount = 150;
    const topUpResult = await solanaDevice.topUp(topUpAmount, {
      wallet: solanaWallet,
      network: 'solana'
    });
    
    expect(topUpResult.success).toBe(true);
    expect(solanaDevice.usdcBalance).toBe(topUpAmount);
    expect(solanaDevice.authorized).toBe(true);
    
    // Verify wallet balance was reduced
    expect(solanaWallet.getUSDCBalance()).toBeLessThan(1000); // Initial balance is random but less than original
  });
  
  test('Base payment flow should succeed with USDC', async () => {
    // 1. Top up the device
    await baseDevice.topUp(100, { wallet: baseWallet });
    
    // Register with payment verifier
    paymentVerifier.updateDeviceBalance(baseDevice.uid, 100, 'base');
    paymentVerifier.authorizeDevice(baseDevice.uid);
    
    // 2. Make a payment
    const paymentAmount = 25;
    const tapResult = baseDevice.tap(paymentAmount);
    
    expect(tapResult.success).toBe(true);
    expect(tapResult.remainingBalance).toBe(75);
    
    // 3. Process through POS
    const posResult = await basePOS.readNfcTag(tapResult.ndefData, paymentAmount);
    expect(posResult.success).toBe(true);
    
    // 4. Verify with server
    const ndefUrl = tapResult.ndefData.toString('utf8');
    const urlMatch = ndefUrl.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
    const d = urlMatch[1];
    const c = urlMatch[2];
    
    const verificationResult = paymentVerifier.verifyPaymentRequest(
      d, c, paymentAmount, basePOS.walletAddress
    );
    
    expect(verificationResult.success).toBe(true);
    expect(verificationResult.amount).toBe(paymentAmount);
  });
  
  test('Payment should fail without authorization', async () => {
    // Try to tap without authorization
    const tapResult = baseDevice.tap(10);
    
    expect(tapResult.success).toBe(false);
    expect(tapResult.message).toContain('not authorized');
  });
  
  test('Payment should fail with insufficient balance', async () => {
    // 1. Top up a small amount
    await baseDevice.topUp(5, { wallet: baseWallet });
    
    // Register with payment verifier
    paymentVerifier.updateDeviceBalance(baseDevice.uid, 5, 'base');
    paymentVerifier.authorizeDevice(baseDevice.uid);
    
    // 2. Try to pay more than balance
    const tapResult = baseDevice.tap(10);
    
    expect(tapResult.success).toBe(false);
    expect(tapResult.message).toContain('Insufficient USDC balance');
  });
  
  test('Server should detect unauthorized device', () => {
    // 1. Generate payment parameters but don't authorize
    const { d, c } = baseDevice.generatePaymentNdef();
    
    // 2. Verify with server
    const verificationResult = paymentVerifier.verifyPaymentRequest(d, c, 10);
    
    expect(verificationResult.success).toBe(false);
    expect(verificationResult.code).toBe('UNAUTHORIZED_DEVICE');
  });
  
  test('Server should detect insufficient balance', () => {
    // 1. Authorize device but with no balance
    paymentVerifier.authorizeDevice(baseDevice.uid);
    paymentVerifier.updateDeviceBalance(baseDevice.uid, 5, 'base');
    
    // 2. Generate payment parameters
    const { d, c } = baseDevice.generatePaymentNdef();
    
    // 3. Verify with server using larger amount
    const verificationResult = paymentVerifier.verifyPaymentRequest(d, c, 10);
    
    expect(verificationResult.success).toBe(false);
    expect(verificationResult.code).toBe('INSUFFICIENT_BALANCE');
  });
  
  test('Multiple payments should reduce balance correctly', async () => {
    // 1. Top up the device
    await baseDevice.topUp(100, { wallet: baseWallet });
    
    // Register with payment verifier
    paymentVerifier.updateDeviceBalance(baseDevice.uid, 100, 'base');
    paymentVerifier.authorizeDevice(baseDevice.uid);
    
    // 2. Make first payment
    const firstPayment = baseDevice.tap(30);
    expect(firstPayment.success).toBe(true);
    expect(firstPayment.remainingBalance).toBe(70);
    
    // Verify with server
    const ndefUrl1 = firstPayment.ndefData.toString('utf8');
    const urlMatch1 = ndefUrl1.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
    paymentVerifier.verifyPaymentRequest(
      urlMatch1[1], urlMatch1[2], 30, basePOS.walletAddress
    );
    
    // 3. Make second payment
    const secondPayment = baseDevice.tap(20);
    expect(secondPayment.success).toBe(true);
    expect(secondPayment.remainingBalance).toBe(50);
    
    // Verify with server
    const ndefUrl2 = secondPayment.ndefData.toString('utf8');
    const urlMatch2 = ndefUrl2.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
    paymentVerifier.verifyPaymentRequest(
      urlMatch2[1], urlMatch2[2], 20, basePOS.walletAddress
    );
    
    // 4. Check final balance
    expect(baseDevice.usdcBalance).toBe(50);
    expect(paymentVerifier.getDeviceBalance(baseDevice.uid)).toBe(50);
  });
}); 