import { Buffer } from 'node:buffer';

const payload = { test: 123, privateKey: '-----BEGIN RSA PRIVATE KEY-----' };
const payloadStr = JSON.stringify(payload);
const encoded = Buffer.from(encodeURIComponent(payloadStr)).toString('base64').split('').reverse().join('');
console.log('Encoded:', encoded);

const reversed = encoded.split('').reverse().join('');
const decodedStr = decodeURIComponent(Buffer.from(reversed, 'base64').toString('utf-8'));
const decoded = JSON.parse(decodedStr);
console.log('Decoded:', decoded);
