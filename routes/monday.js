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
 * Saves form data to the existing Monday.com item
 */
router.post("/save", async (req, res) => {
  try {
    const { itemId, fields } = req.body;
    
    // Validation: itemId is required
    if (!itemId) {
      console.log("❌ ERROR: itemId es requerido");
      return res.status(400).json({
        success: false,
        message: "itemId is required",
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

    const verifyResponse = await axios.post(
      MONDAY_API_URL,
      { query: verifyQuery },
      {
        headers: getMondayHeaders(),
      },
    );

    const item = verifyResponse.data.data?.items?.[0];

    if (!item) {
      console.log("❌ ERROR: Item no encontrado");
      return res.status(404).json({
        success: false,
        message: "Store not found",
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

    try {
      const updateResponse = await axios.post(
        MONDAY_API_URL,
        { query: updateMutation },
        {
          headers: getMondayHeaders(),
        },
      );
    } catch (updateError) {
      console.log(
        "❌ ERROR en actualización de columnas:",
        updateError.response?.data || updateError.message,
      );
      throw updateError;
    }

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

    try {
      const statusResponse = await axios.post(
        MONDAY_API_URL,
        { query: statusMutation },
        {
          headers: getMondayHeaders(),
        },
      );
    } catch (statusError) {
      console.log(
        "❌ ERROR en actualización de estado:",
        statusError.response?.data || statusError.message,
      );
      throw statusError;
    }

    // Prepare data for Google Sheets
    const googleSheetsData = {
      storeId: item.id,
      storeName: item.name,
      accountState: fields.dropdown_mkzna8xm || '',
      storeOwner: fields.text_mkzn3j45 || '',
      adsAddress: fields.text_mkzng7d9 || '',
      mailboxColor: fields.color_mkztj02s || '',
      manager: fields.text_mm0e3nk4 || '',
      timeSavingKiosk: fields.color_mm0ee5w9 || '',
      productsNotOffered: fields.text_mm0exkpv || '',
      generalFocus: fields.text_mm0e6sh4 || ''
    };

    // Try to save to Google Sheets
    try {
      const googleSheetsResult = await appendToGoogleSheet(googleSheetsData);
      
      if (googleSheetsResult.success) {
        return res.json({
          success: true,
          itemId: itemId,
          message: "Data saved successfully",
          googleSheets: googleSheetsResult
        });
      } else {
        return res.json({
          success: true,
          itemId: itemId,
          message: "Data saved successfully, but there was an issue with Google Sheets",
          googleSheets: googleSheetsResult
        });
      }
    } catch (sheetsError) {
      console.log("❌ ERROR CRÍTICO AL GUARDAR EN GOOGLE SHEETS:", sheetsError.message);
      console.log("Stack trace:", sheetsError.stack);
      
      // Continue even if Google Sheets fails
      return res.json({
        success: true,
        itemId: itemId,
        message: "Data saved successfully, but there was an issue with Google Sheets",
        googleSheets: {
          success: false,
          error: sheetsError.message
        }
      });
    }
  } catch (error) {
    console.log(
      "❌ ERROR GENERAL EN GUARDADO:",
      error.response?.data || error.message,
    );
    console.log("Stack trace:", error.stack);
    console.log("========================================");

    return res.status(500).json({
      success: false,
      message: "Error saving data. Please try again.",
      error: error.response?.data || error.message,
    });
  }
});

module.exports = router;
