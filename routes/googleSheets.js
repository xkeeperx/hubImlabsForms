const { google } = require('googleapis');

// Configuration constants from environment variables
const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
const GOOGLE_SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Sheet1';

// Column mapping configuration (case insensitive)
const GOOGLE_SHEET_TIMESTAMP_COLUMN = process.env.GOOGLE_SHEET_TIMESTAMP_COLUMN;
const GOOGLE_SHEET_STORENAME_COLUMN = process.env.GOOGLE_SHEET_STORENAME_COLUMN;
const GOOGLE_SHEET_ACCOUNTSTATE_COLUMN = process.env.GOOGLE_SHEET_ACCOUNTSTATE_COLUMN;
const GOOGLE_SHEET_STOREOWNER_COLUMN = process.env.GOOGLE_SHEET_STOREOWNER_COLUMN;
const GOOGLE_SHEET_ADSADDRESS_COLUMN = process.env.GOOGLE_SHEET_ADSADDRESS_COLUMN;
const GOOGLE_SHEET_MAILBOXCOLOR_COLUMN = process.env.GOOGLE_SHEET_MAILBOXCOLOR_COLUMN;
const GOOGLE_SHEET_MANAGER_COLUMN = process.env.GOOGLE_SHEET_MANAGER_COLUMN;
const GOOGLE_SHEET_TIMESAVINGKIOSK_COLUMN = process.env.GOOGLE_SHEET_TIMESAVINGKIOSK_COLUMN;
const GOOGLE_SHEET_PRODUCTSNOTOFFERED_COLUMN = process.env.GOOGLE_SHEET_PRODUCTSNOTOFFERED_COLUMN;
const GOOGLE_SHEET_GENERALFOCUS_COLUMN = process.env.GOOGLE_SHEET_GENERALFOCUS_COLUMN;

/**
 * Converts column letter to index (A=1, B=2, ..., Z=26, AA=27, etc.)
 * @param {string} column - Column letter (case insensitive)
 * @returns {number} - Column index (1-based)
 */
const columnToIndex = (column) => {
  if (!column || typeof column !== 'string') {
    throw new Error('Invalid column name');
  }
  
  const upperColumn = column.toUpperCase();
  let index = 0;
  
  for (let i = 0; i < upperColumn.length; i++) {
    const charCode = upperColumn.charCodeAt(i);
    if (charCode < 65 || charCode > 90) {
      throw new Error(`Invalid column letter: ${column}`);
    }
    index = index * 26 + (charCode - 64);
  }
  
  return index;
};

/**
 * Converts index to column letter (1=A, 2=B, ..., 26=Z, 27=AA, etc.)
 * @param {number} index - Column index (1-based)
 * @returns {string} - Column letter
 */
const indexToColumn = (index) => {
  if (!index || index < 1) {
    throw new Error('Invalid column index');
  }
  
  let letters = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    index = Math.floor((index - 1) / 26);
  }
  
  return letters;
};

/**
 * Creates a row array with data placed in the correct columns based on configuration
 * @param {Object} formData - Form data
 * @returns {Array} - Row array with data in correct positions
 */
const createDataRow = (formData) => {
  // Find the maximum column index needed
  const columnMap = {
    [GOOGLE_SHEET_TIMESTAMP_COLUMN]: new Date().toISOString(),
    [GOOGLE_SHEET_STORENAME_COLUMN]: formData.storeName || '',
    [GOOGLE_SHEET_ACCOUNTSTATE_COLUMN]: formData.accountState || '',
    [GOOGLE_SHEET_STOREOWNER_COLUMN]: formData.storeOwner || '',
    [GOOGLE_SHEET_ADSADDRESS_COLUMN]: formData.adsAddress || '',
    [GOOGLE_SHEET_MAILBOXCOLOR_COLUMN]: formData.mailboxColor || '',
    [GOOGLE_SHEET_MANAGER_COLUMN]: formData.manager || '',
    [GOOGLE_SHEET_TIMESAVINGKIOSK_COLUMN]: formData.timeSavingKiosk === '6' ? 'Sí' : (formData.timeSavingKiosk === '4' ? 'No' : (formData.timeSavingKiosk || '')),
    [GOOGLE_SHEET_PRODUCTSNOTOFFERED_COLUMN]: formData.productsNotOffered || '',
    [GOOGLE_SHEET_GENERALFOCUS_COLUMN]: formData.generalFocus || ''
  };
  
  // Find the maximum column index needed
  let maxIndex = 0;
  Object.keys(columnMap).forEach(column => {
    const index = columnToIndex(column);
    if (index > maxIndex) maxIndex = index;
  });
  
  // Initialize array with empty strings (size based on max column index)
  const row = new Array(maxIndex).fill('');
  
  // Place values in correct positions
  Object.entries(columnMap).forEach(([column, value]) => {
    try {
      const index = columnToIndex(column) - 1; // Convert to 0-based index
      if (index >= 0 && index < row.length) {
        row[index] = value;
      } else {
        console.warn(`Column ${column} is out of range (index: ${index})`);
      }
    } catch (error) {
      console.error(`Error processing column ${column}:`, error.message);
    }
  });
  
  return row;
};

// Initialize Google Sheets client
const getGoogleSheetsClient = async () => {
  try {
    // The GOOGLE_SERVICE_ACCOUNT_KEY is a base64-encoded JSON credentials file.
    // Strip any whitespace/newlines that dotenv may have injected from a multiline value.
    const rawKey = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/[\r\n\t ]/g, '');

    if (!rawKey) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not set in environment variables');
    }

    // Decode the full credentials JSON from base64
    const decoded = Buffer.from(rawKey, 'base64').toString('utf8');
    const credentials = JSON.parse(decoded);

    // OpenSSL 3 (Node ≥ 22) requires real newline characters in PEM blocks,
    // not the two-character sequence '\n'. Ensure we convert either way.
    if (credentials.private_key && !credentials.private_key.includes('\n')) {
      credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
  } catch (error) {
    console.error('Error initializing Google Sheets client:', error);
    throw error;
  }
};

/**
 * Appends form data to Google Sheets
 * @param {Object} formData - Form data to be saved
 * @returns {Promise<Object>} - Result of the operation
 */
const appendToGoogleSheet = async (formData) => {
  try {
    // Validate required environment variables
    if (!GOOGLE_SERVICE_ACCOUNT_EMAIL || !GOOGLE_SERVICE_ACCOUNT_KEY || !GOOGLE_SPREADSHEET_ID) {
      throw new Error('Missing required Google Sheets configuration in environment variables');
    }
    const sheets = await getGoogleSheetsClient();

    // Create data row with column mapping
    const rowData = createDataRow(formData);

    // Calculate the range based on the MAXIMUM column index needed (not the count of filled cells).
    // rowData.length equals the max column index, because createDataRow sizes the array that way.
    const lastColumn = indexToColumn(rowData.length);
    const range = `${GOOGLE_SHEET_NAME}!A:${lastColumn}`;

    // Append data to spreadsheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData]
      }
    });

    return {
      success: true,
      message: 'Data saved successfully to Google Sheets',
      row: response.data.updates.updatedRange
    };
  } catch (error) {
    console.error('ERROR AL GUARDAR EN GOOGLE SHEETS:', error.message);

    return {
      success: false,
      message: 'Error saving data to Google Sheets',
      error: error.message
    };
  }
};

/**
 * Gets the last row from Google Sheets
 * @returns {Promise<Object>} - Result with last row data
 */
const getLastRow = async () => {
  try {
    const sheets = await getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOOGLE_SPREADSHEET_ID,
      range: `${GOOGLE_SHEET_NAME}!A:A`,
      majorDimension: 'COLUMNS'
    });

    const values = response.data.values;
    if (!values || values.length === 0) {
      return { success: true, lastRow: 0 };
    }

    return {
      success: true,
      lastRow: values[0].length
    };
  } catch (error) {
    console.error('Error getting last row:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  appendToGoogleSheet,
  getLastRow,
  getGoogleSheetsClient
};