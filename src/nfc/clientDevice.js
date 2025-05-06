const { createNdefUrlMessage } = require('./ndefHandler');
const { generatePaymentParameters } = require('../crypto/crypto');
const CryptoWallet = require('../wallet/cryptoWallet');

/**
 * Client Device Simulator
 * Simulates a customer's wearable or mobile device that can emit NFC signals
 */
class ClientDevice {
  constructor(config = {}) {
    this.uid = config.uid || `DEVICE-${Math.floor(Math.random() * 10000)}`;
    this.counter = config.initialCounter || 0;
    this.metaKey = config.metaKey || 'A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6';
    this.fileKey = config.fileKey || 'F1E2D3C4B5A6F7E8D9C0B1A2F3E4D5C6';
    this.serverUrl = config.serverUrl || 'http://localhost:3000';
    
    // Optional user wallet address
    this.userWalletAddress = config.userWalletAddress || null;
    
    // Network for USDC payments
    this.network = config.network || 'base'; // 'base' or 'solana'
    
    // Create wallet address for the device
    this.walletAddress = config.walletAddress || '';
    
    // Transaction history
    this.transactions = [];
    
    // Authorization status
    this.authorized = false;
    
    // Paymaster contract address (will be set when authorized)
    this.paymasterContract = null;
  }
  
  /**
   * Generate a new payment NDEF message
   * @returns {Buffer} NDEF message data to be transmitted over NFC
   */
  generatePaymentNdef() {
    try {
      if (!this.authorized) {
        throw new Error('Device not authorized for payments');
      }
      
      // 1. Generate new payment parameters
      const { d, c } = generatePaymentParameters(
        this.uid,
        this.counter,
        this.metaKey,
        this.fileKey
      );
      
      // 2. Increment the counter after successful generation
      this.counter++;
      
      // 3. Create NDEF message with the parameters
      return createNdefUrlMessage(d, c);
    } catch (error) {
      console.error(`Failed to generate payment NDEF: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Simulate the tap-to-pay action
   * @param {number} amount - Payment amount in USDC
   * @returns {Object} Details about the tap action
   */
  tap(amount = 0.01) {
    try {
      if (!this.authorized) {
        return {
          success: false,
          message: 'Device not authorized for payments',
          timestamp: new Date().toISOString()
        };
      }
      
      // Generate NFC data
      const ndefData = this.generatePaymentNdef();
      
      // Record the transaction
      const transaction = {
        type: 'payment_request',
        amount,
        timestamp: new Date().toISOString(),
        network: this.network,
        status: 'pending' // Would be updated after confirmation
      };
      
      this.transactions.push(transaction);
      
      return {
        success: true,
        message: 'Tap initiated successfully',
        timestamp: new Date().toISOString(),
        deviceId: this.uid,
        counter: this.counter,
        ndefDataLength: ndefData.length,
        amount,
        userWalletAddress: this.userWalletAddress,
        // In a real implementation, this data would be transmitted via NFC
        // Here we just return it for simulation purposes
        ndefData
      };
    } catch (error) {
      return {
        success: false,
        message: `Tap failed: ${error.message}`,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Authorize the device for payments
   * @param {Object} paymasterContract - The paymaster contract instance
   * @param {string} userWalletAddress - User's wallet address
   * @returns {Object} Authorization result
   */
  authorize(paymasterContract, userWalletAddress) {
    if (!paymasterContract) {
      throw new Error('Paymaster contract is required');
    }
    
    if (!userWalletAddress) {
      throw new Error('User wallet address is required');
    }
    
    this.authorized = true;
    this.paymasterContract = paymasterContract.contractAddress;
    this.userWalletAddress = userWalletAddress;
    
    // Record the authorization
    const transaction = {
      type: 'authorization',
      userWalletAddress,
      paymasterContract: paymasterContract.contractAddress,
      timestamp: new Date().toISOString(),
      network: this.network
    };
    
    this.transactions.push(transaction);
    
    return {
      success: true,
      message: 'Device authorized for payments',
      deviceId: this.uid,
      userWalletAddress,
      paymasterContract: paymasterContract.contractAddress,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Deauthorize the device for payments
   * @returns {Object} Deauthorization result
   */
  deauthorize() {
    this.authorized = false;
    this.paymasterContract = null;
    
    return {
      success: true,
      message: 'Device deauthorized for payments',
      deviceId: this.uid,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get device information
   * @returns {Object} Device details
   */
  getDeviceInfo() {
    return {
      uid: this.uid,
      counter: this.counter,
      network: this.network,
      walletAddress: this.walletAddress,
      authorized: this.authorized,
      userWalletAddress: this.userWalletAddress,
      paymasterContract: this.paymasterContract,
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Get transaction history
   * @returns {Array} Transaction history
   */
  getTransactionHistory() {
    return [...this.transactions];
  }
}

module.exports = ClientDevice; 