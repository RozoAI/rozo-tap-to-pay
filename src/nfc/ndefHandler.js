/**
 * NDEF Message Handler Module
 * 
 * Handles NFC Data Exchange Format (NDEF) messages
 */

/**
 * Parse NDEF URL message
 * @param {Buffer} ndefMessage - Raw NDEF message data
 * @returns {Object} Parsed URL parameters
 */
function parseNdefUrlMessage(ndefMessage) {
  try {
    // Simplified implementation - in practice, a dedicated NFC library should be used for parsing
    // Convert binary NDEF message to string
    const message = ndefMessage.toString('utf8');
    
    // Assume message contains Rozo Tap to Pay URL
    const urlMatch = message.match(/https:\/\/tap\.rozo\.ai\?d=([^&]+)&c=([^&]+)/);
    
    if (!urlMatch) {
      throw new Error('Invalid NDEF URL message format');
    }
    
    return {
      d: urlMatch[1],
      c: urlMatch[2]
    };
  } catch (error) {
    throw new Error(`NDEF message parsing failed: ${error.message}`);
  }
}

/**
 * Create NDEF URL message
 * @param {string} d - d parameter value
 * @param {string} c - c parameter value
 * @returns {Buffer} NDEF message data
 */
function createNdefUrlMessage(d, c) {
  try {
    // Create URL
    const url = `https://tap.rozo.ai?d=${d}&c=${c}`;
    
    // Simplified implementation - in practice, a dedicated NFC library should be used to build standard NDEF messages
    // In a real implementation, NDEF message headers and formatted data would need to be added
    const ndefRecord = {
      type: 'url',
      id: '',
      payload: Buffer.from(url, 'utf8')
    };
    
    // In a real application, this should return properly formatted NDEF message
    // Simplified here to just return URL as Buffer
    return Buffer.from(url, 'utf8');
  } catch (error) {
    throw new Error(`NDEF message creation failed: ${error.message}`);
  }
}

module.exports = {
  parseNdefUrlMessage,
  createNdefUrlMessage
}; 