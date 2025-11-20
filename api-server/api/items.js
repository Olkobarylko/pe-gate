const axios = require("axios");
console.log("olko test");
// Your API Token and URL
const apiToken =
  "MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl";
const apiUrl = "https://app.pe-gate.com/api/v1/client-admins/deals";

module.exports = async (req, res) => {
  console.log("olko test");
  try {
    const response = await axios.get(apiUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
    });

    // Log response data for debugging
    console.log("Response Data: ", response.data);

    res.status(200).json(response.data);
  } catch (error) {
    // Log more detailed error info
    console.error(
      "Error fetching API data: ",
      error.response ? error.response.data : error.message
    );

    res.status(500).json({ error: "Щось пішло не так" });
  }
};
