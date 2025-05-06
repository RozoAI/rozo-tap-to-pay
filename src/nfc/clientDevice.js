const { createNdefUrlMessage } = require('./ndefHandler');
const { generatePaymentParameters } = require('../crypto/crypto');

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
  }
  
  /**
   * Generate a new payment NDEF message
   * @returns {Buffer} NDEF message data to be transmitted over NFC
   */
  generatePaymentNdef() {
    try {
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
   * @returns {Object} Details about the tap action
   */
  tap() {
    try {
      // Generate NFC data
      const ndefData = this.generatePaymentNdef();
      
      return {
        success: true,
        message: 'Tap initiated successfully',
        timestamp: new Date().toISOString(),
        deviceId: this.uid,
        counter: this.counter,
        ndefDataLength: ndefData.length,
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
   * Get device information
   * @returns {Object} Device details
   */
  getDeviceInfo() {
    return {
      uid: this.uid,
      counter: this.counter,
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = ClientDevice; 