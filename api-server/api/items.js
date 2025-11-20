// api/sync-deals-to-webflow.js

const axios = require('axios');

// ID колекції Webflow
const WEBFLOW_COLLECTION_ID = '691f618c34b4f8127ecf1703';

// ⚠️ СЮДИ ВСТАВ СВОЇ ТОКЕНИ
const WEBFLOW_API_TOKEN = 'ТУТ_ТВІЙ_WEBFLOW_TOKEN';
const PE_GATE_API_TOKEN = 'ТУТ_ТВІЙ_PE_GATE_TOKEN';

// Базовий URL Webflow v2
const webflowApiUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

// ⚠️ ID полів з API Reference колекції Webflow
// Зайди в Collection → Settings → API Reference і заміни значення праворуч на свої
const FIELD_IDS = {
  dealName: 'deal-name',                 // ID поля "Deal Name"
  dealDescription: 'deal-description',   // ID поля "Deal Description"
  dealTile1Key: 'deal-tile-1-key',       // ID поля "Tile 1 Key"
  dealTile1Value: 'deal-tile-1-value',   // ID поля "Tile 1 Value"
  dealTile2Key: 'deal-tile-2-key',
  dealTile2Value: 'deal-tile-2-value',
  dealTile3Key: 'deal-tile-3-key',
  dealTile3Value: 'deal-tile-3-value',
};

// Проста функція для slug
function slugify(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

module.exports = async (req, res) => {
  try {
    // 1. Тягнемо дані з твого API
    const apiResponse = await axios.get(
      'https://app.pe-gate.com/api/v1/client-admins/deals',
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'PostmanRuntime/7.32.3',
          Authorization: `Bearer ${PE_GATE_API_TOKEN}`,
        },
      }
    );

    let deals = apiResponse.data;

    // якщо бек повертає { data: [...] }
    if (!Array.isArray(deals) && Array.isArray(deals?.data)) {
      deals = deals.data;
    }

    if (!Array.isArray(deals)) {
      return res.status(500).json({
        error: 'Очікував масив deals від API',
        raw: apiResponse.data,
      });
    }

    const createdItems = [];
    const errors = [];

    // 2. Створюємо айтем у Webflow для кожного deal
    for (const deal of deals) {
      try {
        // тут підлаштуй під реальні поля твого deals API
        const name = deal.dealName || deal.name || 'Deal';
        const slugBase = slugify(deal.dealName || deal.name || `deal-${Date.now()}`);
        const slug = `${slugBase}-${deal.id || ''}`.replace(/-+$/g, '');

        const dealItemData = {
          isArchived: false,
          isDraft: false,
          fieldData: {
            // стандартні поля Webflow
            name,
            slug,

            // кастомні поля з ID з API Reference
            [FIELD_IDS.dealName]: deal.dealName,
            [FIELD_IDS.dealDescription]: deal.dealDescription,
            [FIELD_IDS.dealTile1Key]: deal.dealTile1Key,
            [FIELD_IDS.dealTile1Value]: deal.dealTile1Value,
            [FIELD_IDS.dealTile2Key]: deal.dealTile2Key,
            [FIELD_IDS.dealTile2Value]: deal.dealTile2Value,
            [FIELD_IDS.dealTile3Key]: deal.dealTile3Key,
            [FIELD_IDS.dealTile3Value]: deal.dealTile3Value,
          },
        };

        const webflowResponse = await axios.post(webflowApiUrl, dealItemData, {
          headers: {
            Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });

        createdItems.push(webflowResponse.data);
      } catch (err) {
        console.error('Помилка створення айтема в Webflow:', err.response?.data || err.message);

        errors.push({
          dealId: deal.id,
          error: err.response?.data || err.message,
        });
      }
    }

    return res.status(200).json({
      message: 'Синхронізація з Webflow завершена',
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      createdItems,
      errors,
    });
  } catch (error) {
    console.error('Глобальна помилка:', error.response?.data || error.message);

    return res.status(500).json({
      error: 'Щось пішло не так!',
      details: error.response?.data || error.message,
    });
  }
};
