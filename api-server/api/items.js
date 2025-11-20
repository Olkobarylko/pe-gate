// api/sync-deals-to-webflow.js

const axios = require('axios');

// ID колекції Webflow
const WEBFLOW_COLLECTION_ID = '691f618c34b4f8127ecf1703';

// ТВОЇ ТОКЕНИ (як ти й давав)
const WEBFLOW_API_TOKEN = '27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53';
const PE_GATE_API_TOKEN = 'MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl';

// Webflow v2 endpoint
const webflowApiUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

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
          Authorization: `Bearer ${PE_GATE_API_TOKEN.trim()}`,
        },
      }
    );

    let deals = apiResponse.data;

    // Якщо бек повертає { data: [...] }
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

    // 2. Створюємо айтеми в Webflow (тільки name + slug)
    for (const deal of deals) {
      try {
        // Підлаштуй під реальні поля твого deals API:
        const name = deal.dealName || deal.name || 'Deal';
        const slugBase = slugify(deal.dealName || deal.name || `deal-${Date.now()}`);
        const slug = `${slugBase}-${deal.id || ''}`.replace(/-+$/g, '');

        const dealItemData = {
          isArchived: false,
          isDraft: false,
          fieldData: {
            // стандартні поля Webflow (Name + Slug)
            name,
            slug,
            dealname: deal.dealName
          },
        };

        const webflowResponse = await axios.post(webflowApiUrl, dealItemData, {
          headers: {
            Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
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
