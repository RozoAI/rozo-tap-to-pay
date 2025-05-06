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
    
    // Device authorizations via Paymaster
    this.deviceAuthorizations = config.deviceAuthorizations || {}; // { uid: { userAddress, contractAddress } }
    
    // Paymaster contract reference
    this.paymasterContract = config.paymasterContract || null;
    
    // Transaction history
    this.transactions = config.transactions || [];
  }

  /**
   * Verify a payment request
   * @param {string} dParam - The d parameter from URL
   * @param {string} cParam - The c parameter from URL
   * @param {number} amount - Payment amount in USDC (optional)
   * @param {string} merchantAddress - Merchant wallet address (optional)
   * @returns {Object} Verification result containing success status and details
   */
  verifyPaymentRequest(dParam, cParam, amount = 0, merchantAddress = null) {
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
      
      // 5. Check if the device is authorized via Paymaster
      if (!this.isDeviceAuthorized(uid)) {
        return {
          success: false,
          error: 'Device not authorized for payments',
          code: 'UNAUTHORIZED_DEVICE'
        };
      }
      
      // 6. If payment amount is provided, process payment through Paymaster
      let paymentResult = null;
      if (amount > 0 && merchantAddress && this.paymasterContract) {
        try {
          paymentResult = this.paymasterContract.processPayment(uid, amount, merchantAddress);
        } catch (paymentError) {
          return {
            success: false,
            error: `Payment processing failed: ${paymentError.message}`,
            code: 'PAYMENT_FAILED'
          };
        }
      }
      
      // 7. Update the counter in the registry
      this.deviceRegistry[uid] = counter;
      
      // 8. Return success
      return {
        success: true,
        uid,
        counter,
        amount: amount > 0 ? amount : undefined,
        merchantAddress: merchantAddress || undefined,
        paymentResult
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
   * Check if a device is authorized for payments
   * @param {string} uid - Device UID
   * @returns {boolean} Authorization status
   * @private
   */
  isDeviceAuthorized(uid) {
    if (!this.deviceAuthorizations[uid]) {
      return false;
    }
    
    // If we have a Paymaster contract, check with it
    if (this.paymasterContract) {
      const walletAddress = this.paymasterContract.getDeviceWallet(uid);
      return walletAddress !== null;
    }
    
    // Otherwise just check local authorization data
    return true;
  }
  
  /**
   * Register a device with a Paymaster contract
   * @param {string} uid - Device UID
   * @param {string} userAddress - User wallet address
   * @param {string} contractAddress - Paymaster contract address
   * @returns {boolean} Success status
   */
  registerDeviceWithPaymaster(uid, userAddress, contractAddress) {
    if (!uid || !userAddress || !contractAddress) {
      throw new Error('Device UID, user address, and contract address are required');
    }
    
    this.deviceAuthorizations[uid] = {
      userAddress,
      contractAddress,
      authorizedAt: new Date().toISOString()
    };
    
    return true;
  }
  
  /**
   * Deregister a device from Paymaster
   * @param {string} uid - Device UID
   * @returns {boolean} Success status
   */
  deregisterDevice(uid) {
    if (!uid) {
      throw new Error('Device UID is required');
    }
    
    if (this.deviceAuthorizations[uid]) {
      delete this.deviceAuthorizations[uid];
      return true;
    }
    
    return false;
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
  
  /**
   * Get transaction history for a device
   * @param {string} uid - Device UID (optional, if not provided returns all transactions)
   * @returns {Array} Transaction history
   */
  getTransactionHistory(uid = null) {
    if (uid) {
      return this.transactions.filter(tx => tx.uid === uid);
    }
    return [...this.transactions];
  }
  
  /**
   * Check if a device has sufficient allowance for a payment
   * @param {string} uid - Device UID
   * @param {number} amount - Payment amount
   * @returns {Object} Check result
   */
  checkDeviceAllowance(uid, amount) {
    if (!this.paymasterContract) {
      return { sufficient: false, reason: 'No Paymaster contract available' };
    }
    
    return this.paymasterContract.checkDeviceAllowance(uid, amount);
  }
  
  /**
   * Get remaining USDC allowance for a device
   * @param {string} uid - Device UID
   * @returns {number} Remaining allowance or 0 if not found
   */
  getDeviceAllowance(uid) {
    if (!this.paymasterContract || !uid) {
      return 0;
    }
    
    const walletAddress = this.paymasterContract.getDeviceWallet(uid);
    if (!walletAddress) {
      return 0;
    }
    
    return this.paymasterContract.getRemainingAllowance(walletAddress);
  }
}

module.exports = PaymentVerifier; 