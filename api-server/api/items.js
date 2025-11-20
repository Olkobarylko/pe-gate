const axios = require('axios');

const TEST_ID = "691f618c34b4f8127ecf1703";

// API Token для Webflow
const webflowToken = '27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53';
const webflowApiUrl = `https://api.webflow.com/collections/${TEST_ID}/items`;

module.exports = async (req, res) => {
  try {
    // 1. Отримуємо дані з вашого API
    const apiResponse = await axios.get('https://app.pe-gate.com/api/v1/client-admins/deals', {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl',
      },
    });

    const dealData = apiResponse.data; // Отримуємо дані з вашого API

    // 2. Формуємо об'єкт для оновлення Webflow CMS
    const dealItemData = {
      fields: {
        dealName: dealData.dealName,
        dealDescription: dealData.dealDescription,
        dealTile1Key: dealData.dealTile1Key,
        dealTile1Value: dealData.dealTile1Value,
        dealTile2Key: dealData.dealTile2Key,
        dealTile2Value: dealData.dealTile2Value,
        dealTile3Key: dealData.dealTile3Key,
        dealTile3Value: dealData.dealTile3Value,
      }
    };

    // 3. Оновлюємо елемент у Webflow CMS
    const webflowResponse = await axios.put(`${webflowApiUrl}/{item_id}`, dealItemData, {
      headers: {
        Authorization: `Bearer ${webflowToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Логування відповіді від Webflow
    console.log('Webflow API Response:', webflowResponse.data);

    // Відповідаємо на запит
    res.status(200).json(webflowResponse.data);
  } catch (error) {
    // Обробка помилок
    console.error('Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Щось пішло не так!' });
  }
};
