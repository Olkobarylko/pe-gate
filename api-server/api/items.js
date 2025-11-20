const axios = require('axios');

// Ваш API Token для Webflow
const webflowToken = '27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53';
// Ваш collection_id для Webflow колекції
const collectionId = '68c1e87046098c5c59d2f4d8'; // Заміни на реальний collection_id
const webflowApiUrl = `https://api.webflow.com/v2/collections/${collectionId}/items`;

module.exports = async (req, res) => {
  try {
    // Запит для отримання всіх айтемів колекції
    const response = await axios.get(webflowApiUrl, {
      headers: {
        Authorization: `Bearer ${webflowToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Логування отриманих даних
    console.log('Webflow API Response:', response.data);

    // Відповідаємо з отриманими даними
    res.status(200).json(response.data);
  } catch (error) {
    // Обробка помилок
    console.error('Error fetching items from Webflow:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Щось пішло не так!' });
  }
};
