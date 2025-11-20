const axios = require('axios');

const COLLECTION_ID = '691f618c34b4f8127ecf1703';

// ТВОЇ токени прямо в коді
const webflowToken = '27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53';
const peGateToken = 'MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl';

const webflowApiUrl = `https://api.webflow.com/v2/collections/${COLLECTION_ID}/items`;

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
          'Authorization': `Bearer ${peGateToken}`,
        },
      }
    );

    const raw = apiResponse.data;
    const deals = Array.isArray(raw) ? raw : raw.data || [];

    if (!deals.length) {
      return res.status(200).json({ message: 'Немає deals з API' });
    }

    const createdItems = [];

    // 2. Створюємо айтеми в Webflow CMS
    for (const deal of deals) {
      const dealItemData = {
        isArchived: false,
        isDraft: false,
        fieldData: {
          // ОБОВʼЯЗКОВО: Name і Slug
          name: deal.dealName || 'No name',
          slug: `deal-${deal.id || Date.now()}`,

          // ДАЛІ — ПОЛЯ З API Reference КОЛЕКЦІЇ
          // !!!! заміни ці ключі на реальні, які бачиш у Webflow API Reference
          'dealName': deal.dealName,
          'dealDescription': deal.dealDescription,
          'dealTile1Key': deal.dealTile1Key,
          'dealTile1Value': deal.dealTile1Value,
          'dealTile2Key': deal.dealTile2Key,
          'dealTile2Value': deal.dealTile2Value,
          'dealTile3Key': deal.dealTile3Key,
          'dealTile3Value': deal.dealTile3Value,
        },
      };

      const webflowResponse = await axios.post(webflowApiUrl, dealItemData, {
        headers: {
          Authorization: `Bearer ${webflowToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      console.log('Webflow API Response:', webflowResponse.data);
      createdItems.push(webflowResponse.data);
    }

    return res.status(200).json({
      message: 'Deals запушені в Webflow',
      count: createdItems.length,
      items: createdItems,
    });
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    return res.status(500).json({
      error: 'Щось пішло не так!',
      details: error.response?.data || error.message,
    });
  }
};
