const axios = require('axios');

// Ваш API Token і URL
const apiToken = 'TVRrMU16YzBPREl3TVRwVGZIeFlaSDF3UDNCaUlVZzFkQ2hUYTFCMkpIeHJVWEoxYlVjNVRsUTJWa1ptWUQ1ZVdXTWwg';
const apiUrl = 'https://app.pe-gate.com/api/v1/client-admins/deals';

module.exports = async (req, res) => {
    console.log("olko test");
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
    });

    // Вивести отриману відповідь для перевірки
    console.log(response.data);

    res.status(200).json(response.data);
  } catch (error) {
    console.error(error);  // Покажемо помилки для зручності
    res.status(500).json({ error: 'Щось пішло не так' });
  }
};
