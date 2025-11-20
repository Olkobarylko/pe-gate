const axios = require('axios');

// Ваш API Token і URL
const apiToken = 'MTk1Mzc0ODIwMTpGLz5ySnw5MF9XRGw6dTdvUTdQJEBUJVFaTj0wIUhuUl8pSTBSO2k2';
const apiUrl = 'https://app.pe-gate.com/api/v1/client-admins/deals';

module.exports = async (req, res) => {
  try {
    // Виконання запиту до API
    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    // Повернення отриманих даних
    res.status(200).json(response.data);
  } catch (error) {
    // Обробка помилок
    console.error(error);
    res.status(500).json({ error: 'Щось пішло не так' });
  }
};
