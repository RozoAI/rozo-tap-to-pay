const { decryptWithAES, verifyWithAESCMAC } = require('../crypto/crypto');

/**
 * Payment verification class for Rozo Tap to Pay
 * Handles verification of tap-to-pay requests
 */
class PaymentVerifier {
  constructor(config) {
    this.metaKey = config.metaKey; // SDM Meta Read Access Key
    this.fileKey = config.fileKey; // SDM File Read Access Key
    this.deviceRegistry = config.deviceRegistry || {}; // Registry of known devices with their last counter
  }

  /**
   * Verify a payment request
   * @param {string} dParam - The d parameter from URL
   * @param {string} cParam - The c parameter from URL
   * @returns {Object} Verification result containing success status and details
   */
  verifyPaymentRequest(dParam, cParam) {
    try {
      // 1. Decrypt the d parameter to get UID and counter
      const { uid, counter } = decryptWithAES(dParam, this.metaKey);
      
      // 2. Create data object for verification
      const data = { uid, counter };
      
      // 3. Verify the integrity with CMAC
      const isValid = verifyWithAESCMAC(data, cParam, this.fileKey);
      
      if (!isValid) {
        return {
          success: false,
          error: 'Invalid signature',
          code: 'INVALID_SIGNATURE'
        };
      }
      
      // 4. Check for replay attacks by comparing with the last known counter
      const lastCounter = this.deviceRegistry[uid] || 0;
      if (counter <= lastCounter) {
        return {
          success: false,
          error: 'Potential replay attack detected',
          code: 'REPLAY_ATTACK'
        };
      }
      
      // 5. Update the counter in the registry
      this.deviceRegistry[uid] = counter;
      
      // 6. Return success
      return {
        success: true,
        uid,
        counter
      };
    } catch (error) {
      return {
        success: false,
        error: `Verification failed: ${error.message}`,
        code: 'VERIFICATION_ERROR'
      };
    }
  }
  
  /**
   * Get the last known counter for a device
   * @param {string} uid - Device UID
   * @returns {number} Last known counter or 0 if device not found
   */
  getDeviceCounter(uid) {
    return this.deviceRegistry[uid] || 0;
  }
  
  /**
   * Register a new device or update existing device counter
   * @param {string} uid - Device UID
   * @param {number} counter - Current counter value
   */
  updateDeviceCounter(uid, counter) {
    this.deviceRegistry[uid] = counter;
  }
}

module.exports = PaymentVerifier; 