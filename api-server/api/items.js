const axios = require("axios");

// Your API Token and URL
const apiToken =
  "TVrrMU16YzBPRE1jTVRrwR0x6NXK1bTnc1TUY5WFJHddzZkVGR2VRkKUpFQ1VKVkZhVGowd0lVaHVbDhwU1RCU08yzazIg";
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
