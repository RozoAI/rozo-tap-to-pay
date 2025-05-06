# Rozo Tap to Pay
Crypto native tap to pay between wearable and POS

## Overview

Rozo enables a customer to make payment to a merchant with crypto. To improve the experience, we introduce Tap to Pay via Rozo (not Visa).

## System Sequencing

The customer and the merchant need to have the supported infrastructure for tap to pay. On the merchants side, it needs POS terminal that follows Rozo protocol.


<img width="935" alt="Screenshot 2025-05-06 at 3 56 34 PM" src="https://github.com/user-attachments/assets/bf7f511d-5403-49ac-982c-81670bd35f4e" />

## Specification

The tap to pay isystem is built on the technologies below
- NFC Data Exchange Format (NDEF)
- Replay protectio

### Interaction
The point-of-sale (POS) will read a NDEF message when customer tap. The NDEF will change with each use.

https://tap.rozo.ai?d=A3EF40F6D46F1BB36E6EBF2314D4A432&c=F459EEA788E37E44

### Server side verification of the payment request
- d: stands for decrypto. It's the SDM Meta Read Access Key value, decrypt the UID and counter with AES
- c: value and the SDM File Read Access Key value, check with AES-CMAC
- the UID and counter is used on the Rozo service to verify that the request is valid


