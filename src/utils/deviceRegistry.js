/**
 * Device Registry Utility
 * 
 * Manages the registry of known devices and their counters
 * In a production environment, this would be backed by a database
 */

class DeviceRegistry {
  constructor() {
    // In-memory storage for device counters
    // Format: { uid: counter }
    this.devices = {};
  }
  
  /**
   * Get the current counter for a device
   * @param {string} uid - Device UID
   * @returns {number} Current counter value or 0 if device not found
   */
  getCounter(uid) {
    return this.devices[uid] || 0;
  }
  
  /**
   * Update the counter for a device
   * @param {string} uid - Device UID
   * @param {number} counter - New counter value
   * @returns {boolean} Success status
   */
  updateCounter(uid, counter) {
    if (!uid) {
      throw new Error('Device UID is required');
    }
    
    if (typeof counter !== 'number' || counter < 0) {
      throw new Error('Counter must be a non-negative number');
    }
    
    const currentCounter = this.getCounter(uid);
    
    // Only update if new counter is greater than current
    if (counter <= currentCounter) {
      return false;
    }
    
    this.devices[uid] = counter;
    return true;
  }
  
  /**
   * Register a new device
   * @param {string} uid - Device UID
   * @param {number} initialCounter - Initial counter value (default: 0)
   * @returns {boolean} Success status
   */
  registerDevice(uid, initialCounter = 0) {
    if (this.devices[uid] !== undefined) {
      return false; // Device already exists
    }
    
    this.devices[uid] = initialCounter;
    return true;
  }
  
  /**
   * Check if a device exists in the registry
   * @param {string} uid - Device UID
   * @returns {boolean} Whether device exists
   */
  deviceExists(uid) {
    return this.devices[uid] !== undefined;
  }
  
  /**
   * Get all registered devices
   * @returns {Object} Map of devices and their counters
   */
  getAllDevices() {
    return { ...this.devices };
  }
  
  /**
   * Clear the registry (for testing purposes)
   */
  clear() {
    this.devices = {};
  }
}

module.exports = DeviceRegistry; 