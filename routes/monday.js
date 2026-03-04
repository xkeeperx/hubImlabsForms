const express = require('express');
const axios = require('axios');
const router = express.Router();

// Constantes de configuración desde variables de entorno
const MONDAY_API_KEY = process.env.MONDAY_API_KEY;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID;
const MONDAY_STATUS_COLUMN_ID = process.env.MONDAY_STATUS_COLUMN_ID;
const MONDAY_STATUS_VALUE = process.env.MONDAY_STATUS_VALUE;
const MONDAY_STORE_COLUMN_ID = process.env.MONDAY_STORE_COLUMN_ID;

// URL base de la API de Monday.com
const MONDAY_API_URL = 'https://api.monday.com/v2';

// Headers comunes para todas las llamadas a Monday API
const getMondayHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': MONDAY_API_KEY,
  'API-Version': '2024-01'
});

/**
 * GET /api/monday/search?store=VALUE
 * Busca una tienda por número de tienda que esté en estado "pendiente"
 */
router.get('/search', async (req, res) => {
  try {
    const storeNumber = req.query.store;

    if (!storeNumber) {
      return res.status(400).json({
        found: false,
        message: 'El número de tienda es requerido'
      });
    }

    // Query GraphQL para buscar items por número de tienda
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

    // Filtrar items que tengan estado "pendiente" (case-insensitive)
    const pendingItem = items.find(item => {
      const statusColumn = item.column_values.find(
        col => col.id === MONDAY_STATUS_COLUMN_ID
      );
      return statusColumn && statusColumn.text.toLowerCase() === 'pendiente';
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
      message: 'La tienda no fue encontrada o no está en estado pendiente.'
    });

  } catch (error) {
    console.error('Error al buscar tienda:', error.response?.data || error.message);
    return res.status(500).json({
      found: false,
      message: 'Error al buscar la tienda. Por favor intenta nuevamente.'
    });
  }
});

/**
 * POST /api/monday/save
 * Guarda los datos del formulario en el item existente de Monday.com
 */
router.post('/save', async (req, res) => {
  try {
    const { itemId, fields } = req.body;

    // Validación: itemId es obligatorio
    if (!itemId) {
      return res.status(400).json({
        success: false,
        message: 'El itemId es requerido'
      });
    }

    // Verificar que el item existe y sigue en estado "pendiente"
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
        message: 'Tienda no encontrada'
      });
    }

    const statusColumn = item.column_values.find(
      col => col.id === MONDAY_STATUS_COLUMN_ID
    );

    if (!statusColumn || statusColumn.text.toLowerCase() !== 'pendiente') {
      return res.status(400).json({
        success: false,
        message: 'Tienda no válida o no está en estado pendiente.'
      });
    }

    // Construir el objeto de valores para la mutation
    const columnValues = JSON.stringify(fields);

    // Mutation para actualizar múltiples columnas
    const updateMutation = `
      mutation {
        change_multiple_column_values(
          board_id: ${MONDAY_BOARD_ID}
          item_id: ${itemId}
          column_values: ${columnValues}
        ) {
          id
        }
      }
    `;

    await axios.post(MONDAY_API_URL, { query: updateMutation }, {
      headers: getMondayHeaders()
    });

    // Actualizar el estado al valor configurado
    const statusMutation = `
      mutation {
        change_column_value(
          board_id: ${MONDAY_BOARD_ID}
          item_id: ${itemId}
          column_id: "${MONDAY_STATUS_COLUMN_ID}"
          value: "${JSON.stringify(MONDAY_STATUS_VALUE)}"
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
      message: 'Datos guardados exitosamente'
    });

  } catch (error) {
    console.error('Error al guardar datos:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al guardar los datos. Por favor intenta nuevamente.'
    });
  }
});

module.exports = router;
