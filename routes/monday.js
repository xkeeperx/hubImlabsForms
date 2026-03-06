const express = require('express');
const axios = require('axios');
const router = express.Router();

// Configuration constants from environment variables
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;
const MONDAY_STATUS_COLUMN_ID = process.env.MONDAY_STATUS_COLUMN_ID;
const MONDAY_STATUS_VALUE = process.env.MONDAY_STATUS_VALUE;
const MONDAY_STORE_COLUMN_ID = process.env.MONDAY_STORE_COLUMN_ID;

// Base URL for Monday.com API
const MONDAY_API_URL = 'https://api.monday.com/v2';

// Common headers for all Monday API calls
const getMondayHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': MONDAY_API_KEY,
  'API-Version': '2024-01'
});

/**
 * GET /api/monday/search?store=VALUE
 * Searches for a store by store number that is in "pending" status
 */
router.get('/search', async (req, res) => {
  try {
    const storeNumber = req.query.store;

    if (!storeNumber) {
      return res.status(400).json({
        found: false,
        message: 'Store number is required'
      });
    }

    // GraphQL query to search items by store number
    const query = `
      query {
        items_page_by_column_values(
          board_id: ${MONDAY_BOARD_ID}
          columns: [
            { column_id: "${MONDAY_STORE_COLUMN_ID}", column_values: ["${storeNumber}"] }
          ]
        ) {
          items {
            id
            name
            column_values(ids: ["${MONDAY_STATUS_COLUMN_ID}", "${MONDAY_STORE_COLUMN_ID}"]) {
              id
              text
              value
            }
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, {
      headers: getMondayHeaders()
    });

    const items = response.data.data?.items_page_by_column_values?.items || [];

    // Filter items with "En Proceso" status
    const pendingItem = items.find(item => {
      const statusColumn = item.column_values.find(
        col => col.id === MONDAY_STATUS_COLUMN_ID
      );
      return statusColumn && statusColumn.text === 'En Proceso';
    });

    if (pendingItem) {
      const storeColumn = pendingItem.column_values.find(
        col => col.id === MONDAY_STORE_COLUMN_ID
      );

      return res.json({
        found: true,
        itemId: pendingItem.id,
        storeName: pendingItem.name,
        storeNumber: storeColumn?.text || storeNumber
      });
    }

    return res.json({
      found: false,
      message: 'Store not found or not in "En Proceso" status.'
    });

  } catch (error) {
    console.error('Error searching for store:', error.response?.data || error.message);
    return res.status(500).json({
      found: false,
      message: 'Error searching for store. Please try again.'
    });
  }
});

/**
 * GET /api/monday/test
 * Test endpoint to retrieve all items from the board
 */
router.get('/test', async (req, res) => {
  try {
    const query = `
      query {
        boards(ids: [${MONDAY_BOARD_ID}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, {
      headers: getMondayHeaders()
    });

    const items = response.data.data?.boards?.[0]?.items_page?.items || [];
    
    return res.json({
      success: true,
      total: items.length,
      items: items
    });

  } catch (error) {
    console.error('[TEST] Error fetching items:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error fetching items from Monday.com',
      error: error.response?.data || error.message
    });
  }
});

/**
 * POST /api/monday/save
 * Saves form data to the existing Monday.com item
 */
router.post('/save', async (req, res) => {
  try {
    const { itemId, fields } = req.body;

    // Validation: itemId is required
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'itemId is required'
      });
    }

    // Verify that the item exists and is still in "pending" status
    const verifyQuery = `
      query {
        items(ids: [${itemId}]) {
          id
          name
          column_values(ids: ["${MONDAY_STATUS_COLUMN_ID}"]) {
            id
            text
            value
          }
        }
      }
    `;

    const verifyResponse = await axios.post(MONDAY_API_URL, { query: verifyQuery }, {
      headers: getMondayHeaders()
    });

    const item = verifyResponse.data.data?.items?.[0];

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Store not found'
      });
    }

    // Build values object for the mutation
    const columnValues = JSON.stringify(fields);

    // Mutation to update multiple columns
    const updateMutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${MONDAY_BOARD_ID}
          item_id: ${itemId}
          column_values: "${columnValues.replace(/"/g, '\\"')}"
        ) {
          id
        }
      }
    `;

    await axios.post(MONDAY_API_URL, { query: updateMutation }, {
      headers: getMondayHeaders()
    });

    // Update status to the configured value
    const statusValue = JSON.stringify({ label: MONDAY_STATUS_VALUE });
    const statusMutation = `
      mutation {
        change_column_value(
          board_id: ${MONDAY_BOARD_ID}
          item_id: ${itemId}
          column_id: "${MONDAY_STATUS_COLUMN_ID}"
          value: "${statusValue.replace(/"/g, '\\"')}"
        ) {
          id
        }
      }
    `;

    await axios.post(MONDAY_API_URL, { query: statusMutation }, {
      headers: getMondayHeaders()
    });

    return res.json({
      success: true,
      itemId: itemId,
      message: 'Data saved successfully'
    });

  } catch (error) {
    console.error('Error saving data:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error saving data. Please try again.'
    });
  }
});

module.exports = router;
