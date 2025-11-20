// items.js

const express = require("express");
const axios = require("axios");
const app = express();
const port = 3000;

// Ваш API Token і URL
const apiToken =
  "TVrrMU16YzBPRE1jTVRrwR0x6NXK1bTnc1TUY5WFJHddzZkVGR2VRkKUpFQ1VKVkZhVGowd0lVaHVbDhwU1RCU08yzazIg";
const apiUrl = "https://app.pe-gate.com/api/v1/client-admins/deals";

// Маршрут для отримання даних
app.get("/fetch-deals", async (req, res) => {
  try {
    // Виконання запиту до API
    const response = await axios.get(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
    });

    // Виведення отриманої відповіді
    console.log("Response Data:", response.data);

    // Повернення отриманих даних клієнту
    res.status(200).json(response.data);
  } catch (error) {
    // Логування помилок
    console.error(
      "Error fetching API data:",
      error.response ? error.response.data : error.message
    );

    // Повернення помилки клієнту
    res.status(500).json({ error: "Щось пішло не так" });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
