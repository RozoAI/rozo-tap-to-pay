const CryptoJS = require('crypto-js');

/**
 * Decrypt UID and counter using AES
 * @param {string} encryptedData - Encrypted data (d parameter)
 * @param {string} key - SDM Meta Read Access Key
 * @returns {Object} Object containing UID and counter
 */
function decryptWithAES(encryptedData, key) {
  try {
    // Convert hex string to WordArray
    const ciphertext = CryptoJS.enc.Hex.parse(encryptedData);
    const keyBytes = CryptoJS.enc.Hex.parse(key);
    
    // AES decryption
    const decrypted = CryptoJS.AES.decrypt(
      { ciphertext: ciphertext },
      keyBytes,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: CryptoJS.enc.Hex.parse('00000000000000000000000000000000')
      }
    );
    
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    const data = JSON.parse(decryptedText);
    
    return {
      uid: data.uid,
      counter: data.counter
    };
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Verify data integrity using AES-CMAC
 * @param {string} data - Data to verify (containing UID and counter)
 * @param {string} cmacValue - Verification value (c parameter)
 * @param {string} key - SDM File Read Access Key
 * @returns {boolean} Whether verification passed
 */
function verifyWithAESCMAC(data, cmacValue, key) {
  try {
    // Using CryptoJS HmacSHA256 as a substitute
    // In a real project, a dedicated AES-CMAC library should be used
    const keyBytes = CryptoJS.enc.Hex.parse(key);
    const dataBytes = CryptoJS.enc.Utf8.parse(JSON.stringify(data));
    
    const calculatedCMAC = CryptoJS.HmacSHA256(dataBytes, keyBytes).toString(CryptoJS.enc.Hex);
    
    // Compare the first 16 bytes with the c parameter
    const truncatedCMAC = calculatedCMAC.substring(0, 32).toUpperCase();
    return truncatedCMAC === cmacValue.toUpperCase();
  } catch (error) {
    throw new Error(`CMAC verification failed: ${error.message}`);
  }
}

/**
 * Generate encrypted parameters for a new NFC interaction
 * @param {string} uid - Device UID
 * @param {number} counter - Current counter value
 * @param {string} metaKey - SDM Meta Read Access Key
 * @param {string} fileKey - SDM File Read Access Key
 * @returns {Object} Object containing d and c parameters
 */
function generatePaymentParameters(uid, counter, metaKey, fileKey) {
  try {
    // Construct data object
    const data = { uid, counter: counter + 1 };
    
    // Serialize data object
    const jsonData = JSON.stringify(data);
    
    // Encrypt data to generate d parameter
    const metaKeyBytes = CryptoJS.enc.Hex.parse(metaKey);
    const encrypted = CryptoJS.AES.encrypt(
      jsonData,
      metaKeyBytes,
      {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: CryptoJS.enc.Hex.parse('00000000000000000000000000000000')
      }
    );
    const dParam = encrypted.ciphertext.toString(CryptoJS.enc.Hex).toUpperCase();
    
    // Calculate CMAC to generate c parameter
    const fileKeyBytes = CryptoJS.enc.Hex.parse(fileKey);
    const dataBytes = CryptoJS.enc.Utf8.parse(jsonData);
    const cmac = CryptoJS.HmacSHA256(dataBytes, fileKeyBytes).toString(CryptoJS.enc.Hex);
    const cParam = cmac.substring(0, 32).toUpperCase();
    
    return {
      d: dParam,
      c: cParam,
      paymentUrl: `https://tap.rozo.ai?d=${dParam}&c=${cParam}`
    };
  } catch (error) {
    throw new Error(`Parameter generation failed: ${error.message}`);
  }
}

module.exports = {
  decryptWithAES,
  verifyWithAESCMAC,
  generatePaymentParameters
}; 