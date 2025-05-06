/**
 * Paymaster Contract Simulator
 * 
 * Handles USDC allowances and automatic payment processing
 * Supports both Base (EVM-compatible) and Solana networks
 */

class PaymasterContract {
  constructor(config = {}) {
    this.network = config.network || 'base'; // 'base' or 'solana'
    this.contractAddress = config.contractAddress || '';
    
    // Maps user wallet address -> authorized allowance amount
    this.authorizations = {};
    
    // Maps user wallet address -> used amount
    this.usedAllowances = {};
    
    // Maps device UID -> user wallet address
    this.deviceBindings = {};
    
    // Transaction history
    this.transactions = [];
  }
  
  /**
   * Authorize USDC allowance to the contract
   * @param {string} userAddress - User's wallet address
   * @param {number} amount - Amount of USDC to authorize
   * @param {string} deviceUID - Device UID to bind with the wallet
   * @returns {Object} Authorization result
   */
  authorizeUSDC(userAddress, amount, deviceUID) {
    if (!userAddress) {
      throw new Error('User wallet address is required');
    }
    
    if (amount <= 0) {
      throw new Error('Allowance amount must be greater than zero');
    }
    
    // Record the authorization
    this.authorizations[userAddress] = amount;
    this.usedAllowances[userAddress] = 0;
    
    // Bind device to wallet if provided
    if (deviceUID) {
      this.deviceBindings[deviceUID] = userAddress;
    }
    
    // Record transaction
    const transaction = {
      type: 'authorization',
      userAddress,
      amount,
      deviceUID: deviceUID || null,
      timestamp: new Date().toISOString(),
      network: this.network
    };
    
    this.transactions.push(transaction);
    
    return {
      success: true,
      userAddress,
      contractAddress: this.contractAddress,
      allowance: amount,
      deviceUID: deviceUID || null,
      network: this.network
    };
  }
  
  /**
   * Process a payment by automatically deducting from user's allowance
   * @param {string} deviceUID - Device UID making the payment
   * @param {number} amount - Payment amount
   * @param {string} merchantAddress - Merchant's address to receive payment
   * @returns {Object} Payment result
   */
  processPayment(deviceUID, amount, merchantAddress) {
    if (!deviceUID) {
      throw new Error('Device UID is required');
    }
    
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }
    
    if (!merchantAddress) {
      throw new Error('Merchant address is required');
    }
    
    // Find the user wallet bound to this device
    const userAddress = this.deviceBindings[deviceUID];
    if (!userAddress) {
      throw new Error(`No wallet bound to device ${deviceUID}`);
    }
    
    // Check authorization
    const authorizedAmount = this.authorizations[userAddress] || 0;
    const usedAmount = this.usedAllowances[userAddress] || 0;
    
    // Check if there's enough remaining allowance
    const remainingAllowance = authorizedAmount - usedAmount;
    if (remainingAllowance < amount) {
      throw new Error(`Insufficient allowance for payment (required: ${amount}, remaining: ${remainingAllowance})`);
    }
    
    // Process the payment
    this.usedAllowances[userAddress] = usedAmount + amount;
    
    // Record transaction
    const transaction = {
      type: 'payment',
      deviceUID,
      userAddress,
      merchantAddress,
      amount,
      timestamp: new Date().toISOString(),
      network: this.network,
      remainingAllowance: authorizedAmount - this.usedAllowances[userAddress]
    };
    
    this.transactions.push(transaction);
    
    return {
      success: true,
      transactionId: `tx-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      deviceUID,
      userAddress,
      merchantAddress,
      amount,
      remainingAllowance: authorizedAmount - this.usedAllowances[userAddress],
      timestamp: transaction.timestamp
    };
  }
  
  /**
   * Get remaining allowance for a user
   * @param {string} userAddress - User's wallet address
   * @returns {number} Remaining allowance
   */
  getRemainingAllowance(userAddress) {
    if (!userAddress) {
      throw new Error('User wallet address is required');
    }
    
    const authorizedAmount = this.authorizations[userAddress] || 0;
    const usedAmount = this.usedAllowances[userAddress] || 0;
    
    return authorizedAmount - usedAmount;
  }
  
  /**
   * Get the wallet address bound to a device
   * @param {string} deviceUID - Device UID
   * @returns {string} User wallet address or null if not found
   */
  getDeviceWallet(deviceUID) {
    return this.deviceBindings[deviceUID] || null;
  }
  
  /**
   * Check if a device has enough allowance for a payment
   * @param {string} deviceUID - Device UID
   * @param {number} amount - Payment amount
   * @returns {Object} Check result
   */
  checkDeviceAllowance(deviceUID, amount) {
    if (!deviceUID) {
      return { sufficient: false, reason: 'Device UID is required' };
    }
    
    // Find the user wallet bound to this device
    const userAddress = this.deviceBindings[deviceUID];
    if (!userAddress) {
      return { sufficient: false, reason: 'No wallet bound to device' };
    }
    
    // Check authorization
    const authorizedAmount = this.authorizations[userAddress] || 0;
    const usedAmount = this.usedAllowances[userAddress] || 0;
    const remainingAllowance = authorizedAmount - usedAmount;
    
    if (remainingAllowance < amount) {
      return {
        sufficient: false,
        reason: 'Insufficient allowance',
        required: amount,
        remaining: remainingAllowance
      };
    }
    
    return {
      sufficient: true,
      userAddress,
      remaining: remainingAllowance
    };
  }
  
  /**
   * Get transaction history
   * @param {string} deviceUID - Device UID (optional)
   * @param {string} userAddress - User wallet address (optional)
   * @returns {Array} Transaction history filtered by parameters
   */
  getTransactionHistory(deviceUID, userAddress) {
    let filtered = [...this.transactions];
    
    if (deviceUID) {
      filtered = filtered.filter(tx => tx.deviceUID === deviceUID);
    }
    
    if (userAddress) {
      filtered = filtered.filter(tx => tx.userAddress === userAddress);
    }
    
    return filtered;
  }
}

module.exports = PaymasterContract; 