const express = require("express");
const axios = require("axios");
const { appendToGoogleSheet } = require("./googleSheets");
const router = express.Router();

// Configuration constants from environment variables
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;
const MONDAY_STATUS_COLUMN_ID = process.env.MONDAY_STATUS_COLUMN_ID;
const MONDAY_STATUS_VALUE = process.env.MONDAY_STATUS_VALUE;
const MONDAY_STORE_COLUMN_ID = process.env.MONDAY_STORE_COLUMN_ID;
const MONDAY_ADS_BOARD_ID = process.env.MONDAY_ADS_BOARD_ID;
const MONDAY_ADS_STORE_NUMBER_COLUMN_ID = process.env.MONDAY_ADS_STORE_NUMBER_COLUMN_ID;

// Base URL for Monday.com API
const MONDAY_API_URL = "https://api.monday.com/v2";

// Common headers for all Monday API calls
const getMondayHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: MONDAY_API_KEY,
  "API-Version": "2024-01",
});

/**
 * GET /api/monday/search?store=VALUE
 * Searches for a store by store number that is in "Pending Kick-Off" or "Kick Off Booked" status
 */
router.get("/search", async (req, res) => {
  try {
    const storeNumber = req.query.store;

    if (!storeNumber) {
      return res.status(400).json({
        found: false,
        message: "Store number is required",
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

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: getMondayHeaders(),
      },
    );

    const items = response.data.data?.items_page_by_column_values?.items || [];

    // Filter items with "Pending Kick-Off" or "Kick Off Booked" status
    const pendingItem = items.find((item) => {
      const statusColumn = item.column_values.find(
        (col) => col.id === MONDAY_STATUS_COLUMN_ID,
      );
      if (!statusColumn || !statusColumn.text) return false;
      const statusText = statusColumn.text.trim();
      return (
        statusText === "Pending Kick-Off" ||
        statusText === "Kick Off Booked" ||
        statusText === "Kick-Off Booked"
      );
    });

    if (pendingItem) {
      const storeColumn = pendingItem.column_values.find(
        (col) => col.id === MONDAY_STORE_COLUMN_ID,
      );

      return res.json({
        found: true,
        itemId: pendingItem.id,
        storeName: pendingItem.name,
        storeNumber: storeColumn?.text || storeNumber,
        storeStatus:
          pendingItem.column_values.find(
            (col) => col.id === MONDAY_STATUS_COLUMN_ID,
          )?.text || "",
      });
    }

    return res.json({
      found: false,
      message:
        'Store not found or not in "Pending Kick-Off" or "Kick Off Booked" status.',
    });
  } catch (error) {
    console.error(
      "Error searching for store:",
      error.response?.data || error.message,
    );
    return res.status(500).json({
      found: false,
      message: "Error searching for store. Please try again.",
    });
  }
});

/**
 * GET /api/monday/stores
 * Retrieves all stores with "Pending Kick-Off" or "Kick Off Booked" status
 */
router.get("/stores", async (req, res) => {
  try {
    // GraphQL query to get items with specific statuses directly from the API
    const query = `
      query {
        items_page_by_column_values(
          board_id: ${MONDAY_BOARD_ID}
          columns: [
            { 
              column_id: "${MONDAY_STATUS_COLUMN_ID}", 
              column_values: ["Pending Kick-Off", "Kick Off Booked", "Kick-Off Booked"] 
            }
          ]
          limit: 500
        ) {
          cursor
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

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: getMondayHeaders(),
      },
    );

    const items = response.data.data?.items_page_by_column_values?.items || [];

    // Filter items again just to be safe and ensure exact matches
    const pendingItems = items.filter((item) => {
      const statusColumn = item.column_values.find(
        (col) => col.id === MONDAY_STATUS_COLUMN_ID,
      );
      if (!statusColumn || !statusColumn.text) return false;
      const statusText = statusColumn.text.trim();
      return (
        statusText === "Pending Kick-Off" ||
        statusText === "Kick Off Booked" ||
        statusText === "Kick-Off Booked"
      );
    });

    // Format data for dropdown
    const stores = pendingItems.map((item) => {
      const storeColumn = item.column_values.find(
        (col) => col.id === MONDAY_STORE_COLUMN_ID,
      );
      const statusColumn = item.column_values.find(
        (col) => col.id === MONDAY_STATUS_COLUMN_ID,
      );

      const storeText = storeColumn?.text || item.name;

      return {
        id: item.id,
        value: storeText,
        label: `${storeText} - ${item.name} (${statusColumn?.text || ""})`,
      };
    });

    return res.json({
      success: true,
      count: stores.length,
      stores: stores,
    });
  } catch (error) {
    console.error(
      "Error fetching stores:",
      error.response?.data || error.message,
    );
    return res.status(500).json({
      success: false,
      message: "Error fetching stores. Please try again.",
    });
  }
});

/**
 * GET /api/monday/autocomplete
 * Searches stores by partial text match and status
 */
router.get("/autocomplete", async (req, res) => {
  try {
    const queryStr = req.query.query?.toLowerCase() || "";

    if (!queryStr || queryStr.length < 4) {
      return res.json({ success: true, count: 0, stores: [] });
    }

    const query = `
      query {
        items_page_by_column_values(
          board_id: ${MONDAY_BOARD_ID}
          columns: [
            { 
              column_id: "${MONDAY_STATUS_COLUMN_ID}", 
              column_values: ["Pending Kick-Off", "Kick Off Booked", "Kick-Off Booked"] 
            }
          ]
          limit: 500
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

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      { headers: getMondayHeaders() }
    );

    const items = response.data.data?.items_page_by_column_values?.items || [];

    // Filter items by status again (safety check) and by substring match
    const pendingItems = items.filter((item) => {
      const statusColumn = item.column_values.find(
        (col) => col.id === MONDAY_STATUS_COLUMN_ID,
      );
      if (!statusColumn || !statusColumn.text) return false;
      const statusText = statusColumn.text.trim();
      const isValidStatus = (
        statusText === "Pending Kick-Off" ||
        statusText === "Kick Off Booked" ||
        statusText === "Kick-Off Booked"
      );
      if (!isValidStatus) return false;

      const storeColumn = item.column_values.find(
        (col) => col.id === MONDAY_STORE_COLUMN_ID,
      );
      const storeText = storeColumn?.text || item.name;
      const searchableText = `${storeText} ${item.name}`.toLowerCase();
      
      return searchableText.includes(queryStr);
    });

    const stores = pendingItems.map((item) => {
      const storeColumn = item.column_values.find(
        (col) => col.id === MONDAY_STORE_COLUMN_ID,
      );
      const statusColumn = item.column_values.find(
        (col) => col.id === MONDAY_STATUS_COLUMN_ID,
      );

      const storeText = storeColumn?.text || item.name;

      return {
        id: item.id,
        value: storeText,
        label: `${storeText} - ${item.name} (${statusColumn?.text || ""})`,
      };
    });

    return res.json({
      success: true,
      count: stores.length,
      stores: stores,
    });
  } catch (error) {
    console.error("Error autocomplete stores:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Error autocomplete stores." });
  }
});

/**
 * GET /api/monday/item/:itemId
 * Fetches all form-relevant column values for a specific item (for prefilling)
 */
router.get("/item/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({ success: false, message: "itemId is required" });
    }

    // Column IDs that match the form fields
    const formColumnIds = [
      "dropdown_mkzna8xm",
      "text_mkzn3j45",
      "long_text_mkztccnb",
      "color_mm1tkp4y",
      "phone_mm0e9qe0",
      "person",
      "long_text_mm1yxr45",
      "text_mm0e9v1j",
      "long_text_mm1ym5z5",
      "text_mkzng7d9",
      "color_mkztj02s",
      "text_mm0e3nk4",
      "color_mm0ee5w9",
      "text_mm0exkpv",
      "text_mm0e6sh4"
    ];

    const columnIdsGql = formColumnIds.map(id => `"${id}"`).join(", ");

    const query = `
      query {
        items(ids: [${itemId}]) {
          id
          name
          column_values(ids: [${columnIdsGql}]) {
            id
            text
            value
          }
        }
      }
    `;

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      { headers: getMondayHeaders() }
    );

    const item = response.data.data?.items?.[0];

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    // Build fields map: { columnId: textValue }
    const fields = {};
    item.column_values.forEach(col => {
      fields[col.id] = col.text || "";
    });

    return res.json({
      success: true,
      itemId: item.id,
      storeName: item.name,
      fields
    });
  } catch (error) {
    console.error("Error fetching item:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Error fetching item data." });
  }
});

/**
 * GET /api/monday/item/:itemId/full
 * Fetches ALL column values for a specific item (for testing/inspection)
 */
router.get("/item/:itemId/full", async (req, res) => {
  try {
    const { itemId } = req.params;

    if (!itemId) {
      return res.status(400).json({ success: false, message: "itemId is required" });
    }

    const query = `
      query {
        items(ids: [${itemId}]) {
          id
          name
          column_values {
            id
            text
            value
            type
          }
        }
      }
    `;

    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      { headers: getMondayHeaders() }
    );

    const item = response.data.data?.items?.[0];

    if (!item) {
      return res.status(404).json({ success: false, message: "Item not found" });
    }

    return res.json({
      success: true,
      itemId: item.id,
      storeName: item.name,
      totalColumns: item.column_values.length,
      columns: item.column_values
    });
  } catch (error) {
    console.error("Error fetching full item:", error.response?.data || error.message);
    return res.status(500).json({ success: false, message: "Error fetching item data." });
  }
});

/**
 * GET /api/monday/test
 * Test endpoint to retrieve all items from the board
 */
router.get("/test", async (req, res) => {
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
    const response = await axios.post(
      MONDAY_API_URL,
      { query },
      {
        headers: getMondayHeaders(),
      },
    );

    const items = response.data.data?.boards?.[0]?.items_page?.items || [];

    console.log("✅ Diagnóstico completado:");
    console.log(`   - Total de items: ${items.length}`);
    console.log(
      "   - Items encontrados:",
      items.map((item) => ({ id: item.id, name: item.name })),
    );

    // Extraer IDs de columna únicos
    const uniqueColumns = new Set();
    items.forEach((item) => {
      item.column_values.forEach((col) => {
        uniqueColumns.add(col.id);
      });
    });

    console.log("   - IDs de columna encontrados:", Array.from(uniqueColumns));

    return res.json({
      success: true,
      total: items.length,
      items: items,
      columns: Array.from(uniqueColumns),
      config: {
        boardId: MONDAY_BOARD_ID,
        statusColumnId: MONDAY_STATUS_COLUMN_ID,
        statusValue: MONDAY_STATUS_VALUE,
        storeColumnId: MONDAY_STORE_COLUMN_ID,
      },
    });
  } catch (error) {
    console.error(
      "[TEST] Error fetching items:",
      error.response?.data || error.message,
    );
    console.log("❌ Stack trace:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Error fetching items from Monday.com",
      error: error.response?.data || error.message,
    });
  }
});

/**
 * GET /api/monday/diagnose
 * Enhanced diagnostic endpoint to verify configuration
 */
router.get("/diagnose", async (req, res) => {
  try {
    console.log("========================================");
    console.log("🔍 DIAGNÓSTICO COMPLETO DE MONDAY.COM");
    console.log("========================================");

    const diagnosis = {
      config: {
        boardId: MONDAY_BOARD_ID,
        statusColumnId: MONDAY_STATUS_COLUMN_ID,
        statusValue: MONDAY_STATUS_VALUE,
        storeColumnId: MONDAY_STORE_COLUMN_ID,
        apiKeyPresent: !!MONDAY_API_KEY,
        boardIdValid:
          !!MONDAY_BOARD_ID && MONDAY_BOARD_ID !== "__REPLACE_WITH_BOARD_ID__",
        statusColumnValid:
          !!MONDAY_STATUS_COLUMN_ID && MONDAY_STATUS_COLUMN_ID !== "Status",
        statusValueValid:
          !!MONDAY_STATUS_VALUE && MONDAY_STATUS_VALUE !== "Completed",
        storeColumnValid:
          !!MONDAY_STORE_COLUMN_ID &&
          MONDAY_STORE_COLUMN_ID !== "numeric_mm10p284",
      },
      connectivity: false,
      boardInfo: null,
      columns: [],
      sampleItems: [],
    };

    console.log("📋 Verificando configuración...");
    diagnosis.config.summary = {
      valid:
        diagnosis.config.apiKeyPresent &&
        diagnosis.config.boardIdValid &&
        diagnosis.config.statusColumnValid &&
        diagnosis.config.statusValueValid &&
        diagnosis.config.storeColumnValid,
      issues: [],
    };

    if (!diagnosis.config.apiKeyPresent) {
      diagnosis.config.summary.issues.push("API Key no configurada");
    }
    if (!diagnosis.config.boardIdValid) {
      diagnosis.config.summary.issues.push(
        "Board ID inválido o no configurado",
      );
    }
    if (!diagnosis.config.statusColumnValid) {
      diagnosis.config.summary.issues.push(
        "Status Column ID inválido o no configurado",
      );
    }
    if (!diagnosis.config.statusValueValid) {
      diagnosis.config.summary.issues.push(
        "Status Value inválido o no configurado",
      );
    }
    if (!diagnosis.config.storeColumnValid) {
      diagnosis.config.summary.issues.push(
        "Store Column ID inválido o no configurado",
      );
    }

    console.log("🔗 Verificando conectividad...");
    try {
      const boardQuery = `
        query {
          boards(ids: [${MONDAY_BOARD_ID}]) {
            id
            name
            state
            item_count
          }
        }
      `;

      const response = await axios.post(
        MONDAY_API_URL,
        { query: boardQuery },
        {
          headers: getMondayHeaders(),
        },
      );

      diagnosis.connectivity = true;
      diagnosis.boardInfo = response.data.data?.boards?.[0];
      console.log("✅ Conectividad exitosa:", diagnosis.boardInfo);
    } catch (connectivityError) {
      diagnosis.connectivity = false;
      console.log("❌ Error de conectividad:", connectivityError.message);
    }

    if (diagnosis.connectivity && diagnosis.boardInfo) {
      console.log("📊 Extrayendo información del tablero...");
      try {
        const itemsQuery = `
          query {
            boards(ids: [${MONDAY_BOARD_ID}]) {
              items_page(limit: 5) {
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

        const itemsResponse = await axios.post(
          MONDAY_API_URL,
          { query: itemsQuery },
          {
            headers: getMondayHeaders(),
          },
        );

        const items =
          itemsResponse.data.data?.boards?.[0]?.items_page?.items || [];
        diagnosis.sampleItems = items;

        // Extraer IDs de columna
        const uniqueColumns = new Set();
        items.forEach((item) => {
          item.column_values.forEach((col) => {
            uniqueColumns.add(col.id);
          });
        });
        diagnosis.columns = Array.from(uniqueColumns);

        console.log("✅ Información extraída:", {
          itemCount: items.length,
          columns: diagnosis.columns.length,
        });
      } catch (itemsError) {
        console.log(
          "❌ Error extrayendo información del tablero:",
          itemsError.message,
        );
      }
    }

    console.log("📋 Resumen de diagnóstico:", diagnosis.config.summary);
    console.log("========================================");

    return res.json({
      success: true,
      diagnosis: diagnosis,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "[DIAGNOSE] Error en diagnóstico:",
      error.response?.data || error.message,
    );
    console.log("❌ Stack trace:", error.stack);
    return res.status(500).json({
      success: false,
      message: "Error performing diagnosis",
      error: error.response?.data || error.message,
    });
  }
});

/**
 * POST /api/monday/save
 * Saves form data to one or multiple Monday.com items.
 * Body can be: { itemId, fields } (single) or { stores: [{ itemId, fields }] } (batch)
 */
router.post("/save", async (req, res) => {
  try {
    // Normalize to always work with an array
    let storesToSave = [];
    if (req.body.stores && Array.isArray(req.body.stores)) {
      storesToSave = req.body.stores;
    } else if (req.body.itemId) {
      storesToSave = [{ itemId: req.body.itemId, fields: req.body.fields }];
    } else {
      return res.status(400).json({ success: false, message: "itemId or stores array is required" });
    }

    // Process stores SEQUENTIALLY to avoid Monday.com API rate limits.
    // Promise.all (parallel) triggers rate limit errors for the 2nd+ store.
    const results = [];
    for (const { itemId, fields } of storesToSave) {
      const result = await saveOneStore(itemId, fields);
      results.push(result);
    }

    const allSuccess = results.every(r => r.success);
    return res.json({
      success: allSuccess,
      results,
      message: allSuccess ? "All stores saved successfully" : "Some stores had errors"
    });
  } catch (error) {
    console.error("Error in batch save:", error.message);
    return res.status(500).json({ success: false, message: "Error saving data." });
  }
});

/**
 * Internal helper: saves a single store's fields to Monday.com and Google Sheets
 */
async function saveOneStore(itemId, fields) {
  try {
    const { itemId: _id, fields: _f } = { itemId, fields };
    if (!itemId) return { success: false, itemId, message: "itemId is required" };
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

    const verifyResponse = await axios.post(
      MONDAY_API_URL,
      { query: verifyQuery },
      { headers: getMondayHeaders() }
    );

    const item = verifyResponse.data.data?.items?.[0];
    if (!item) return { success: false, itemId, message: "Store not found" };

    // Remove "person" from fields to update, since passing a string to a person column will cause a parse error
    const mondayFields = { ...fields };
    delete mondayFields["person"];

    const updateMutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnValues: JSON!) {
        change_multiple_column_values(
          board_id: $boardId
          item_id: $itemId
          column_values: $columnValues
        ) {
          id
        }
      }
    `;
    const updateVariables = {
      boardId: String(MONDAY_BOARD_ID),
      itemId: String(itemId),
      columnValues: JSON.stringify(mondayFields)
    };
    const updateRes = await axios.post(
      MONDAY_API_URL, 
      { query: updateMutation, variables: updateVariables }, 
      { headers: getMondayHeaders() }
    );
    if (updateRes.data?.errors) {
      const errMsg = JSON.stringify(updateRes.data.errors);
      console.error(`[MONDAY UPDATE ERROR] Store ${itemId}:`, errMsg);
      return { success: false, itemId, message: `Monday update error: ${updateRes.data.errors[0]?.message}` };
    }

    // Update status
    const statusMutation = `
      mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
        change_column_value(
          board_id: $boardId
          item_id: $itemId
          column_id: $columnId
          value: $value
        ) {
          id
        }
      }
    `;
    const statusVariables = {
      boardId: String(MONDAY_BOARD_ID),
      itemId: String(itemId),
      columnId: MONDAY_STATUS_COLUMN_ID,
      value: JSON.stringify({ label: MONDAY_STATUS_VALUE })
    };
    const statusRes = await axios.post(
      MONDAY_API_URL, 
      { query: statusMutation, variables: statusVariables }, 
      { headers: getMondayHeaders() }
    );
    if (statusRes.data?.errors) {
      console.error(`[MONDAY STATUS ERROR] Store ${itemId}:`, JSON.stringify(statusRes.data.errors));
      // Don't block — status update failure is non-critical; data was already saved.
    }


    // Safe extractor to prevent objects leaking into Google Sheets cells
    const safeStr = (obj) => {
      if (obj === null || obj === undefined) return '';
      if (typeof obj === 'string') return obj;
      if (typeof obj === 'number') return String(obj);
      if (Array.isArray(obj)) return obj.join(', ');
      if (obj.labels !== undefined) return Array.isArray(obj.labels) ? obj.labels.join(', ') : String(obj.labels); // Dropdown column
      if (obj.label !== undefined) return String(obj.label);   // Status column
      if (obj.phone !== undefined) return String(obj.phone);   // Phone column
      if (obj.index !== undefined) return obj.index === 6 ? 'YES' : 'NO'; // Checkbox-like status
      if (typeof obj === 'object') return JSON.stringify(obj);
      return String(obj);
    };

    // Google Sheets
    const googleSheetsData = {
      storeId: safeStr(item.id),
      storeName: safeStr(item.name),
      accountState: safeStr(fields.dropdown_mkzna8xm),
      storeOwner: safeStr(fields.text_mkzn3j45),
      ownerEmail: safeStr(fields.long_text_mkztccnb),
      storeType: safeStr(fields.color_mm1tkp4y),
      ownerMobile: safeStr(fields.phone_mm0e9qe0),
      accountManager: safeStr(fields.person),
      mco: safeStr(fields.long_text_mm1yxr45),
      storeAddress: safeStr(fields.text_mm0e9v1j),
      coopBoardMember: safeStr(fields.long_text_mm1ym5z5),
      adsAddress: safeStr(fields.text_mkzng7d9),
      mailboxColor: safeStr(fields.color_mkztj02s),
      manager: safeStr(fields.text_mm0e3nk4),
      timeSavingKiosk: safeStr(fields.color_mm0ee5w9),
      productsNotOffered: safeStr(fields.text_mm0exkpv),
      generalFocus: safeStr(fields.text_mm0e6sh4)
    };

    let sheetsResult = { success: false };
    try {
      sheetsResult = await appendToGoogleSheet(googleSheetsData);
    } catch (sheetsError) {
      console.error("Google Sheets error for item", itemId, sheetsError.message);
    }

    return { success: true, itemId, storeName: item.name, googleSheets: sheetsResult };
  } catch (error) {
    console.error("Error saving store", itemId, error.response?.data || error.message);
    return { success: false, itemId, message: error.message };
  }
}

/**
 * POST /api/monday/save-ads
 * Saves ad request data to a separate dashboard
 */
router.post("/save-ads", async (req, res) => {
  try {
    const { ads } = req.body;
    const ADS_BOARD_ID = MONDAY_ADS_BOARD_ID;

    if (!ADS_BOARD_ID) {
      return res.status(500).json({ success: false, message: "ADS_BOARD_ID not configured in environment" });
    }
    if (!MONDAY_ADS_STORE_NUMBER_COLUMN_ID) {
      return res.status(500).json({
        success: false,
        message: "MONDAY_ADS_STORE_NUMBER_COLUMN_ID not configured in environment",
      });
    }

    if (!ads || !Array.isArray(ads)) {
      return res.status(400).json({ success: false, message: "Invalid payload: 'ads' array required" });
    }

    console.log(`[DEBUG] Processing ${ads.length} ad requests...`);
    const results = [];
    const storeNumberRelationColumnId = MONDAY_ADS_STORE_NUMBER_COLUMN_ID;

    const PROFIT_CENTER_LABELS = {
      "0": "MB + BNF",
      "7": "MB + BNF + PROMO",
      "1": "PR",
      "8": "PR + PROMO",
      "3": "PACK AND SHIP",
      "10": "PCK & SHIP + PROMO",
      "9": "AIR SHIPPING",
      "2": "RETURNS",
      "11": "NOTARY",
      "13": "SHR",
      "4": "NOW OPEN",
      "12": "ONE STOP SHOP",
      "6": "OTHER",
      "14": "FREIGHT",
    };

    const MONTH_LABELS = {
      "0": "January",
      "1": "February",
      "2": "March",
      "3": "April",
      "4": "May",
      "6": "June",
      "7": "July",
      "8": "August",
      "9": "September",
      "10": "October",
      "11": "November",
      "12": "December",
    };

    for (const adItem of ads) {
      const { itemId, storeName, fields } = adItem;
      const storeNumber = fields.storeNumber || "Unknown";
      const sourceStoreItemId = parseInt(itemId, 10);

      // Helper to format values based on Monday column type
      // Format: { column_id: value_object }
      const columnValues = {};

      if (isNaN(sourceStoreItemId)) {
        results.push({
          success: false,
          storeName,
          message: "Missing or invalid source store itemId for Store Number relation",
        });
        continue;
      }

      // Link this ad request back to the source store item from form 1.
      columnValues[storeNumberRelationColumnId] = { item_ids: [sourceStoreItemId] };
      
      // 1. Identification (usually the name of the item, but if you have a column too...)
      // The name of the item is handled by item_name in the mutation below.

      // 2. Long Text fields
      if (fields.struggle) columnValues["long_text_mm1mahw1"] = { text: fields.struggle };
      if (fields.designReq) columnValues["long_text_mm0826s6"] = { text: fields.designReq };
      if (fields.notes) columnValues["long_text_mm1mjnc0"] = { text: fields.notes };

      // Helper to format Status/Color columns (supports Label or Index)
      const formatStatusValue = (val) => {
        if (!val && val !== 0) return null;
        if (!isNaN(val) && val.toString().trim() !== "") {
          return { index: parseInt(val, 10) };
        }
        return { label: val };
      };

      // 3. Status fields (color_...)
      if (fields.profitCenter) columnValues["color_mm0emr3y"] = formatStatusValue(fields.profitCenter);
      if (fields.month) columnValues["color_mkztmrwm"] = formatStatusValue(fields.month);
      if (fields.objective) columnValues["color_mkztnkcm"] = formatStatusValue(fields.objective);
      
      // 4. Boolean / Checkbox
      columnValues["boolean_mkztx9ks"] = { checked: !!fields.budgetCheck };

      // 5. Numeric
      if (fields.budgetValue) {
        const val = parseFloat(fields.budgetValue.toString().replace(/[^0-9.]/g, ''));
        if (!isNaN(val)) columnValues["numeric_mkztgwh4"] = val;
      }

      // 6. Text
      if (fields.radius) columnValues["text_mkztjkth"] = fields.radius;

      // 7. Board Relation (Caution: requires Item IDs, labels usually don't work)
      if (fields.adRef) {
        const itemId = parseInt(fields.adRef, 10);
        if (!isNaN(itemId)) {
          columnValues["board_relation_mm1rqd3x"] = { item_ids: [itemId] }; 
        } else {
          // Fallback if user mapped it to a Status column instead of Board Relation
          columnValues["board_relation_mm1rqd3x"] = formatStatusValue(fields.adRef); 
        }
      }

      const createMutation = `
        mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
          create_item (
            board_id: $boardId,
            item_name: $itemName,
            column_values: $columnValues
          ) {
            id
          }
        }
      `;

      const variables = {
        boardId: ADS_BOARD_ID,
        itemName: `${storeName} - ${PROFIT_CENTER_LABELS[String(fields.profitCenter)] || fields.profitCenter || "Unknown Profit"} - ${MONTH_LABELS[String(fields.month)] || fields.month || "Unknown Month"}`,
        columnValues: JSON.stringify(columnValues)
      };

      try {
        const response = await axios.post(MONDAY_API_URL, 
          { query: createMutation, variables }, 
          { headers: getMondayHeaders() }
        );

        const data = response.data;

        if (data.errors) {
          console.error(`[MONDAY ERROR] for ${storeName}:`, JSON.stringify(data.errors, null, 2));
          results.push({ success: false, storeName, message: data.errors[0]?.message });
        } else {
          console.log(`[SUCCESS] Created item ${data.data.create_item.id} for ${storeName}`);
          results.push({ success: true, storeName, id: data.data.create_item.id });
        }
      } catch (err) {
        console.error(`[AXIOS ERROR] for ${storeName}:`, err.response?.data || err.message);
        results.push({ success: false, storeName, message: err.message });
      }
    }

    const overallSuccess = results.some(r => r.success);
    res.json({
      success: overallSuccess,
      results,
      message: overallSuccess ? "Ad requests processed" : "Failed to process ad requests"
    });

  } catch (error) {
    console.error("Critical error in save-ads:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/monday/ad-references
 * Fetches approved items from the ad references board (ID: 9800780291) to populate the form
 */
router.get("/ad-references", async (req, res) => {
  try {
    const boardId = "9800780291";
    
    // We fetch items from the board and then filter locally for "Approved"
    const query = `
      query {
        boards(ids: [${boardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              assets {
                public_url
                file_extension
              }
              column_values {
                id
                text
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, { headers: getMondayHeaders() });
    
    if (!response.data.data?.boards?.[0]) {
      return res.status(404).json({ success: false, message: "References board not found" });
    }

    const items = response.data.data.boards[0].items_page.items;
    
    const approvedItems = items
      .filter(item => item.column_values.some(col => col.text && col.text.toLowerCase() === 'approved'))
      .map(item => {
        let mediaUrl = null;
        let mediaType = null;
        
        if (item.assets && item.assets.length > 0) {
          const asset = item.assets[0];
          mediaUrl = asset.public_url || null;
          if (mediaUrl) {
            const ext = (asset.file_extension || '').toLowerCase();
            if (ext.match(/^\.?(mp4|webm|ogg|mov)$/)) {
              mediaType = 'video';
            } else {
              mediaType = 'image';
            }
          }
        }

        return { 
          id: item.id, 
          name: item.name,
          mediaUrl,
          mediaType
        };
      });

    res.json({ success: true, references: approvedItems });
  } catch (error) {
    console.error("Error in ad-references:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monday/ads/items
 * Lists items from the Ads board to find IDs for testing
 */
router.get("/ads/items", async (req, res) => {
  try {
    if (!MONDAY_ADS_BOARD_ID) {
      return res.status(500).json({ success: false, message: "ADS_BOARD_ID not configured" });
    }

    const query = `
      query {
        boards (ids: [${MONDAY_ADS_BOARD_ID}]) {
          name
          items_page (limit: 10) {
            items {
              id
              name
            }
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, { headers: getMondayHeaders() });
    const data = response.data.data;
    
    if (!data || !data.boards || data.boards.length === 0) {
      return res.status(404).json({ success: false, message: "Ads board not found" });
    }

    const board = data.boards[0];
    res.json({
      success: true,
      boardName: board.name,
      items: board.items_page.items
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monday/ads/diagnosis
 * Full diagnosis for the Ads board
 */
router.get("/ads/diagnosis", async (req, res) => {
  try {
    if (!MONDAY_ADS_BOARD_ID) {
      return res.status(500).json({ success: false, message: "ADS_BOARD_ID not configured" });
    }

    const query = `
      query {
        boards (ids: [${MONDAY_ADS_BOARD_ID}]) {
          id
          name
          columns {
            id
            title
            type
          }
          items_page (limit: 5) {
            items {
              id
              name
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, { headers: getMondayHeaders() });
    res.json({
      success: true,
      data: response.data.data?.boards?.[0] || null
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/monday/ads/column-settings
 * Obtiene las etiquetas (labels) de todas las columnas de estatus/dropdown del tablero de Ads
 */
router.get("/ads/column-settings", async (req, res) => {
  try {
    if (!MONDAY_ADS_BOARD_ID) {
      return res.status(500).json({ success: false, message: "ADS_BOARD_ID not configured" });
    }

    const query = `
      query {
        boards (ids: [${MONDAY_ADS_BOARD_ID}]) {
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;

    const response = await axios.post(MONDAY_API_URL, { query }, { headers: getMondayHeaders() });
    
    if (!response.data.data?.boards?.[0]) {
      return res.status(404).json({ success: false, message: "Ads board not found" });
    }

    const cols = response.data.data.boards[0].columns;
    
    const settings = cols.map(c => {
      let options = null;
      try {
        const parsed = JSON.parse(c.settings_str || "{}");
        // Status use labels, Dropdowns use options
        options = parsed.labels || parsed.options || null;
      } catch (e) {}
      
      return {
        id: c.id,
        title: c.title,
        type: c.type,
        available_labels: options
      };
    }).filter(c => c.available_labels || c.type === 'board_relation');

    res.json({ success: true, columns: settings });
  } catch (error) {
    console.error("Error in column-settings:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/monday/test-save-ads
 * Endpoint de prueba con datos quemados
 */
router.post("/test-save-ads", async (req, res) => {
  const testPayload = {
    ads: [
      {
        storeName: "Test Store #999",
        fields: {
          storeNumber: "999",
          struggle: "Testing struggle field (Long Text)",
          profitCenter: "PR",
          designReq: "Focus: This is a design test",
          budgetCheck: true,
          budgetValue: "1500",
          month: "January",
          objective: "Leads",
          radius: "10 miles",
          notes: "General test notes",
          adRef: "Mailbox"
        }
      }
    ]
  };

  // Redirigimos internamente a save-ads o simplemente llamamos a la misma lógica
  // Pero para simplicidad de prueba, haremos un fetch interno o simplemente informamos
  try {
    // Simulamos req.body
    req.body = testPayload;
    // Llamamos a la lógica enviando la respuesta directamente
    console.log("[TEST] Disparando guardado de prueba...");
    return await router.handle(req, res); // Esto es un hack pero efectivo
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;


