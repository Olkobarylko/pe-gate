const axios = require('axios');

module.exports = async (req, res) => {
  try {
    // Виконуємо GET запит до API
    const response = await axios.get('https://dog.ceo/api/breeds/image/random');

    // Виводимо отримані факти
    res.status(200).json(response.data);
  } catch (error) {
    // Обробка помилок
    console.error(error);
    res.status(500).json({ error: 'Не вдалося отримати дані з API' });
  }
};