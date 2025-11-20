// api/sync-deals-to-webflow.js (наприклад для Vercel)

const axios = require('axios');

// !!! ВАЖЛИВО: ці значення винеси в Environment Variables на Vercel
const WEBFLOW_COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID || '691f618c34b4f8127ecf1703';
const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN; // твій Webflow token
const PE_GATE_API_TOKEN = process.env.PE_GATE_API_TOKEN; // токен до https://app.pe-gate.com

// Базовий URL Webflow v2
const webflowApiUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

// Мапа ID полів Webflow колекції
// ⚠️ ЗАМІНИ ці значення на ТІ, ЩО В ТЕБЕ В API Reference колекції
const FIELD_IDS = {
  dealName: 'deal-name',
  dealDescription: 'deal-description',
  dealTile1Key: 'deal-tile-1-key',
  dealTile1Value: 'deal-tile-1-value',
  dealTile2Key: 'deal-tile-2-key',
  dealTile2Value: 'deal-tile-2-value',
  dealTile3Key: 'deal-tile-3-key',
  dealTile3Value: 'deal-tile-3-value',
};

// Проста функція для генерації slug
function slugify(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD') // прибрати діакритику
    .replace(/[\u0300-\u036f]/g, '') // ще трохи діакритики
    .replace(/[^a-z0-9]+/g, '-') // все не-латиницю/цифри в "-"
    .replace(/^-+|-+$/g, '') // обрізати тире з країв
    .substring(0, 60); // обмеження, щоб не було надто довго
}

module.exports = async (req, res) => {
  // (опціонально) можна обмежити метод:
  // if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!WEBFLOW_API_TOKEN) {
      return res.status(500).json({ error: 'WEBFLOW_API_TOKEN is not set' });
    }
    if (!PE_GATE_API_TOKEN) {
      return res.status(500).json({ error: 'PE_GATE_API_TOKEN is not set' });
    }

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

    // Якщо бек віддає { data: [...] }, а не [...]:
    if (!Array.isArray(deals) && Array.isArray(deals?.data)) {
      deals = deals.data;
    }

    if (!Array.isArray(deals)) {
      return res.status(500).json({
        error: 'Несподіваний формат відповіді від deals API (очікував масив)',
        raw: apiResponse.data,
      });
    }

    // 2. Проходимося по кожному deal і створюємо айтем в Webflow
    const createdItems = [];
    const errors = [];

    for (const deal of deals) {
      try {
        // Тут припускаємо, що в об’єкта є поля типу:
        // deal.dealName, deal.dealDescription, deal.dealTile1Key, deal.id і т.д.
        // Якщо назви інші — заміни під себе.
        const name = deal.dealName || deal.name || 'Deal';
        const slugBase = slugify(deal.dealName || deal.name || `deal-${Date.now()}`);
        const slug = `${slugBase}-${deal.id || ''}`.replace(/-+$/g, '');

        const dealItemData = {
          isArchived: false,
          isDraft: false,
          fieldData: {
            // ОБОВ’ЯЗКОВІ стандартні поля Webflow
            name, // стандартне поле Name
            slug, // стандартне поле Slug

            // Кастомні поля (строго по ID з API Reference)
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
        console.error('Webflow item create error:', err.response?.data || err.message);

        errors.push({
          dealId: deal.id,
          error: err.response?.data || err.message,
        });
      }
    }

    return res.status(200).json({
      message: 'Синхронізація завершена',
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      createdItems,
      errors,
    });
  } catch (error) {
    console.error('Global error:', error.response?.data || error.message);

    return res.status(500).json({
      error: 'Щось пішло не так!',
      details: error.response?.data || error.message,
    });
  }
};
