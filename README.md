# Rozo Tap to Pay
Crypto Native Tap to Pay Between Mobile, Wearables and POS

## Overview

Rozo enables a customer to make payment to a merchant with crypto. To improve the experience, we introduce Tap to Pay via Rozo (not Visa).

## Why we need this?

While Visa offers Tap to Pay, it’s built on legacy rails—centralized, custodial, and fiat-based. Every transaction passes through multiple intermediaries, incurs fees, and exposes sensitive data like plaintext CVVs.

Rozo Tap to Pay reimagines this system from first principles, using crypto and decentralized protocols. It reflects the values of autonomy, privacy, and open infrastructure.

## System Sequencing

The customer and the merchant need to have the supported infrastructure for tap to pay. On the merchants side, it needs POS terminal that follows Rozo protocol.

<img width="935" alt="Tap to pay sequence" src="https://github.com/user-attachments/assets/bf7f511d-5403-49ac-982c-81670bd35f4e" />

## Specification

The tap to pay system is built on the technologies below:
- NFC Data Exchange Format (NDEF)
- Replay protection using counters
- AES encryption and AES-CMAC for security

### Interaction
The point-of-sale (POS) will read a NDEF message when customer tap. The NDEF will change with each use.

Example URL format: https://tap.rozo.ai?d=A3EF40F6D46F1BB36E6EBF2314D4A432&c=F459EEA788E37E44

### Server side verification of the payment request
- d: stands for decrypto. It's the SDM Meta Read Access Key value, decrypt the UID and counter with AES
- c: value and the SDM File Read Access Key value, check with AES-CMAC
- the UID and counter is used on the Rozo service to verify that the request is valid

## Implementation

This repository contains a reference implementation of the Rozo Tap to Pay system, including:

1. Crypto modules for encryption and verification
2. NFC message handling
3. Client device simulator
4. POS terminal simulator
5. Server-side payment verification

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
git clone https://github.com/yourusername/rozo-tap-to-pay.git
cd rozo-tap-to-pay
npm install
```

### Running the Demo

```bash
node src/demo.js
```

This will simulate a complete payment flow including:
1. Customer tapping their device
2. POS terminal reading the NFC data
3. Server verifying the payment
4. Replay attack prevention demonstration

### Running the Server

```bash
npm start
```

The server will start on port 3000 by default. You can change this by setting the PORT environment variable.

### Testing

```bash
npm test
```

## Security Features

The implementation includes several security features:

1. **Encryption**: Customer data is encrypted using AES
2. **Data Integrity**: AES-CMAC ensures message integrity
3. **Replay Protection**: Counter mechanism prevents replay attacks
4. **Secure Keys**: Keys should be securely stored (not hardcoded as in this demo)

## API Endpoints

- `GET /tap?d=<value>&c=<value>` - Verify a tap payment
- `POST /generate` - Generate new payment parameters for a device

## License

This project is licensed under the MIT License.


