const { parseNdefUrlMessage } = require('./ndefHandler');

/**
 * POS Terminal Simulator
 * Simulates a point-of-sale terminal that can read NFC messages from customer devices
 */
class POSTerminal {
  constructor(config = {}) {
    this.serverUrl = config.serverUrl || 'http://localhost:3000';
    this.merchant = config.merchant || {
      id: 'MERCHANT123',
      name: 'Rozo Demo Store'
    };
    this.isReady = true;
  }
  
  /**
   * Simulate reading an NFC tag
   * @param {Buffer} nfcData - Raw NFC data read from a customer device
   * @returns {Promise<Object>} Result of payment verification
   */
  async readNfcTag(nfcData) {
    try {
      // 1. Parse the NDEF message from the NFC data
      const { d, c } = parseNdefUrlMessage(nfcData);
      
      // 2. Send the parameters to the server for verification
      const response = await this.verifyPayment(d, c);
      
      // 3. Return the verification result
      return {
        success: response.success,
        transactionId: response.success ? `TX-${Date.now()}` : null,
        merchantId: this.merchant.id,
        timestamp: new Date().toISOString(),
        message: response.message || response.error,
        details: response
      };
    } catch (error) {
      return {
        success: false,
        message: `NFC reading failed: ${error.message}`,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * Verify payment with the server
   * @param {string} d - d parameter from the NFC message
   * @param {string} c - c parameter from the NFC message
   * @returns {Promise<Object>} Verification result from server
   */
  async verifyPayment(d, c) {
    try {
      // In a real implementation, use proper HTTP client
      console.log(`Verifying payment with parameters d=${d} and c=${c}`);
      console.log(`Would send request to ${this.serverUrl}/tap?d=${d}&c=${c}`);
      
      // Simulate verification result
      // In a real implementation, this would be an actual API call
      
      // This is a mock function that would normally call the server
      const mockServerVerification = (d, c) => {
        // For demonstration purposes only
        // In production, this would be a real server request
        return {
          success: true,
          message: 'Payment verified successfully',
          uid: 'SIMULATED-UID-12345',
          counter: 42
        };
      };
      
      return mockServerVerification(d, c);
    } catch (error) {
      return {
        success: false,
        error: `Payment verification failed: ${error.message}`
      };
    }
  }
  
  /**
   * Check if the terminal is ready to accept payments
   * @returns {boolean} Terminal ready status
   */
  checkStatus() {
    return {
      ready: this.isReady,
      merchantId: this.merchant.id,
      merchantName: this.merchant.name
    };
  }
}

module.exports = POSTerminal; 