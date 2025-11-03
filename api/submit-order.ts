// @ts-nocheck
import { importPKCS8, SignJWT } from 'jose';
import type { CartItem, Address } from '../types';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_URI = 'https://oauth2.googleapis.com/token';

async function getAccessToken(clientEmail, privateKey) {
  const key = await importPKCS8(privateKey, 'RS256');
  
  const jwt = await new SignJWT({
    scope: SCOPES.join(' '),
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(clientEmail)
    .setAudience(TOKEN_URI)
    .setExpirationTime('1h')
    .setIssuedAt()
    .sign(key);

  const response = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`Failed to get access token: ${data.error_description || 'Unknown error'}`);
  }
  return data.access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end('Method Not Allowed');
  }

  const {
    GOOGLE_SHEETS_CLIENT_EMAIL,
    GOOGLE_SHEETS_PRIVATE_KEY,
    GOOGLE_SHEETS_SPREADSHEET_ID,
    GOOGLE_SHEETS_SHEET_NAME,
  } = process.env;

  if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !GOOGLE_SHEETS_SPREADSHEET_ID || !GOOGLE_SHEETS_SHEET_NAME) {
    console.error('Missing required environment variables for Google Sheets integration.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n');

  try {
    const { cart, address, total } = req.body;

    if (!cart || !address || total === undefined) {
      return res.status(400).json({ message: 'Missing required order data.' });
    }

    const accessToken = await getAccessToken(GOOGLE_SHEETS_CLIENT_EMAIL, privateKey);
    const range = `${GOOGLE_SHEETS_SHEET_NAME}!A1`;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
    
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const fullAddress = `Tower ${address.tower}, Floor ${address.floor}, Flat ${address.flat}`;
    const itemsString = cart.map(item => `${item.name} (x${item.quantity})`).join(', ');

    const values = [
      [timestamp, fullAddress, itemsString, total]
    ];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Google Sheets API Error:', data);
      throw new Error(data.error?.message || 'Failed to write to Google Sheet.');
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing order:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return res.status(500).json({ message });
  }
}
