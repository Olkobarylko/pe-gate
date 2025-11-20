// api/sync-deals-to-webflow.js

const axios = require("axios");

// ID колекції Webflow
const WEBFLOW_COLLECTION_ID = "691f618c34b4f8127ecf1703";

// ТВОЇ ТОКЕНИ (як ти й давав)
const WEBFLOW_API_TOKEN =
  "27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53";
const PE_GATE_API_TOKEN =
  "MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl";

// Webflow v2 endpoint для CMS айтемів (стейджд)
const webflowApiUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

// Проста функція для slug
function slugify(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

// Тягнемо ВСІ айтеми з колекції (з урахуванням пагінації)
async function fetchAllWebflowItems() {
  const allItems = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const resp = await axios.get(webflowApiUrl, {
      params: { limit, offset },
      headers: {
        Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
        Accept: "application/json",
      },
    });

    const { items = [], pagination } = resp.data || {};
    allItems.push(...items);

    const total = pagination?.total ?? items.length;
    offset += limit;

    if (!pagination || offset >= total) break;
  }

  return allItems;
}

module.exports = async (req, res) => {
  try {
    // 1. Тягнемо дані з твого API
    const apiResponse = await axios.get(
      "https://app.pe-gate.com/api/v1/client-admins/deals",
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "PostmanRuntime/7.32.3",
          Authorization: `Bearer ${PE_GATE_API_TOKEN.trim()}`,
        },
      }
    );

    let deals = apiResponse.data;

    // Якщо бек повертає { data: [...] }
    if (!Array.isArray(deals) && Array.isArray(deals?.data)) {
      deals = deals.data;
    }

    if (!Array.isArray(deals)) {
      return res.status(500).json({
        error: "Очікував масив deals від API",
        raw: apiResponse.data,
      });
    }

    // 2. Тягнемо всі айтеми з Webflow і будуємо мапу по кастомному полю dealid
    const existingItems = await fetchAllWebflowItems();

    // мапа: dealid (string) -> item
    const itemsByDealId = new Map();
    for (const item of existingItems) {
      const dealIdValue = item.fieldData?.dealid;
      if (dealIdValue != null) {
        itemsByDealId.set(String(dealIdValue), item);
      }
    }

    const createdItems = [];
    const updatedItems = [];
    const errors = [];

    // 3. Upsert по кожному deal
    for (const deal of deals) {
      try {
        const dealId = String(deal.id ?? "");
        const name = deal.dealName || deal.name || "Deal";

        // slug прив’язуємо до dealId, щоб був стабільний
        const slugBase =
          slugify(deal.dealName || deal.name || `deal-${dealId}`) || "deal";
        const slug = `${slugBase}-${dealId}`.replace(/-+$/g, "");

        const fieldData = {
          name,
          slug,
          dealname: deal.dealName,
          dealdescription: deal.dealDescription,
          dealtile1key: deal.dealTile1Key,
          dealtile1value: deal.dealTile1Value,
          dealtile2key: deal.dealTile2Key,
          dealtile2value: deal.dealTile2Value,
          dealtile3key: deal.dealTile3Key,
          dealtile3value: deal.dealTile3Value,
          dealoverviewcontent: deal.dealOverviewContent,
          "dealbackgroundimg-2": deal.dealBackgroundImg,

          // важливо: кастомне поле в колекції Webflow з API Name = "dealid"
          dealid: dealId,
        };

        const existingItem = dealId ? itemsByDealId.get(dealId) : null;

        if (existingItem) {
          // 3а. Айтем вже є — ОНОВЛЮЄМО ЧЕРЕЗ PATCH /collections/{collection_id}/items/{item_id}
          const updateUrl = `${webflowApiUrl}/${existingItem.id}`;

          const patchBody = {
            isArchived: false,
            isDraft: false,
            fieldData,
          };

          const webflowResponse = await axios.patch(updateUrl, patchBody, {
            headers: {
              Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          updatedItems.push(webflowResponse.data);
        } else {
          // 3б. Нема такого dealid — створюємо новий айтем (POST /collections/:collection_id/items)
          const createBody = {
            isArchived: false,
            isDraft: false,
            fieldData,
          };

          const webflowResponse = await axios.post(webflowApiUrl, createBody, {
            headers: {
              Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          createdItems.push(webflowResponse.data);
        }
      } catch (err) {
        console.error(
          "Помилка створення/оновлення айтема в Webflow:",
          err.response?.data || err.message
        );
        errors.push({
          dealId: deal.id,
          error: err.response?.data || err.message,
        });
      }
    }

    return res.status(200).json({
      message: "Синхронізація з Webflow завершена (upsert)",
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      updatedItemsCount: updatedItems.length,
      createdItems,
      updatedItems,
      errors,
    });
  } catch (error) {
    console.error("Глобальна помилка:", error.response?.data || error.message);

    return res.status(500).json({
      error: "Щось пішло не так!",
      details: error.response?.data || error.message,
    });
  }
};
