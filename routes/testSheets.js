const { google } = require('googleapis');
const { appendToGoogleSheet } = require('./googleSheets');

/**
 * Test function to save hardcoded data to Google Sheets
 * @returns {Promise<Object>} - Result of the test operation
 */
const testGoogleSheets = async () => {
  try {
    console.log('========================================');
    console.log('🧪 INICIANDO PRUEBA DIRECTA DE GOOGLE SHEETS');
    console.log('========================================');

    // Hardcoded test data
    const testFormData = {
      storeId: '12345',
      storeName: 'Test Store',
      accountState: 'CA',
      storeOwner: 'John Doe',
      adsAddress: '123 Test St',
      mailboxColor: 'Blue',
      manager: 'Jane Smith',
      timeSavingKiosk: 'Green',
      productsNotOffered: 'Product A',
      generalFocus: 'Customer Service'
    };

    console.log('📝 Datos de prueba:', testFormData);

    // Test with RAW input option
    console.log('🔄 Intentando con valueInputOption: RAW');
    try {
      const result = await appendToGoogleSheet(testFormData);
      console.log('✅ Éxito con RAW:', result);
      return result;
    } catch (error) {
      console.log('❌ Error con RAW:', error.message);
      
      // Try with USER_ENTERED if RAW fails
      console.log('🔄 Intentando con valueInputOption: USER_ENTERED');
      
      // We need to modify the appendToGoogleSheet function to accept valueInputOption
      // For now, let's try a different approach
      const sheets = await google.sheets({ version: 'v4', auth: await getGoogleAuth() });
      
      const rowData = createDataRow(testFormData);
      const usedColumns = rowData.filter(cell => cell !== '').length;
      const lastColumn = indexToColumn(Math.min(usedColumns, rowData.length));
      const range = `TEST!A:${lastColumn}`;

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
        range: range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData]
        }
      });

      console.log('✅ Éxito con USER_ENTERED:', response.data);
      return {
        success: true,
        message: 'Test data saved successfully with USER_ENTERED',
        row: response.data.updates.updatedRange
      };
    }
  } catch (error) {
    console.error('❌ ERROR EN PRUEBA DE GOOGLE SHEETS:', error.message);
    console.log('Stack trace:', error.stack);
    console.log('========================================');

    return {
      success: false,
      message: 'Error testing Google Sheets',
      error: error.message
    };
  }
};

// Helper functions (simplified versions)
const getGoogleAuth = async () => {
  return new google.auth.GoogleAuth({
    credentials: {
      type: 'service_account',
      project_id: process.env.GOOGLE_PROJECT_ID,
      private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_KEY ? 
        Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, 'base64').toString() : 
        process.env.GOOGLE_PRIVATE_KEY,
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      client_id: process.env.GOOGLE_CLIENT_ID,
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: process.env.GOOGLE_CLIENT_X509_CERT_URL
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
};

const createDataRow = (formData) => {
  const columnMap = {
    'B': new Date().toISOString(),
    'C': formData.storeId || '',
    'A': formData.storeName || '',
    'I': formData.accountState || '',
    'D': formData.storeOwner || '',
    'K': formData.adsAddress || '',
    'L': formData.mailboxColor || '',
    'O': formData.manager || '',
    'AC': formData.timeSavingKiosk || '',
    'AD': formData.productsNotOffered || '',
    'AE': formData.generalFocus || ''
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

module.exports = {
  testGoogleSheets
};