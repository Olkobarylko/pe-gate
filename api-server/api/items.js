const axios = require('axios');

// Ваш API Token і URL
const apiToken = 'TVRrMU16YzBPREl3TVRwR0x6NXlTbnc1TUY5WFJHdzZkVGR2VVRkUUpFQlVKVkZhVGowd0lVaHVVbDhwU1RCU08yazIg';
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
     console.log("error olko");
    console.error(error);  // Покажемо помилки для зручності
    res.status(500).json({ error: 'Щось пішло не так' });
  }
};
