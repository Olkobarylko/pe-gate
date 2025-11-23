// api/sync-deals-to-webflow.js

const axios = require("axios");

// ID колекції Webflow
const WEBFLOW_COLLECTION_ID = "691f618c34b4f8127ecf1703";

// ТВОЇ ТОКЕНИ (як ти й давав)
const WEBFLOW_API_TOKEN =
  "27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53";
const PE_GATE_API_TOKEN =
  "MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl";
// Базові URL Webflow v2
const WEBFLOW_BASE = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}`;
const webflowItemsUrl = `${WEBFLOW_BASE}/items`; // GET: всі айтеми (staged)
const webflowItemsLiveCreateUrl = `${WEBFLOW_BASE}/items/live`; // POST: створити live
const webflowItemsLiveUpdateUrl = (itemId) =>
  `${WEBFLOW_BASE}/items/${itemId}/live`; // PATCH: оновити live

// Простий slugify
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

// Тягнемо ВСІ айтеми з колекції (з пагінацією)
async function fetchAllWebflowItems() {
  const allItems = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const resp = await axios.get(webflowItemsUrl, {
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

// Основний handler (Next.js /api route або звичайний express handler)
module.exports = async (req, res) => {
  try {
    // 1. Тягнемо всі deals із зовнішнього API
    const apiResponse = await axios.get(
      "https://app.pe-gate.com/api/v1/client-admins/deals",
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "PostmanRuntime/7.32.3",
          Authorization: `Bearer ${PE_GATE_API_TOKEN?.trim()}`,
        },
      }
    );

    let deals = apiResponse.data;

    // Якщо бек вернув { data: [...] }
    if (!Array.isArray(deals) && Array.isArray(deals?.data)) {
      deals = deals.data;
    }

    if (!Array.isArray(deals)) {
      return res.status(500).json({
        error: "Очікувався масив deals від зовнішнього API",
        raw: apiResponse.data,
      });
    }

    // 2. Тягнемо всі айтеми з Webflow і будуємо мапи:
    //  - по кастомному полю dealid
    //  - по slug
    const existingItems = await fetchAllWebflowItems();

    const itemsByDealId = new Map();
    const itemsBySlug = new Map();

    for (const item of existingItems) {
      const dealIdValue = item.fieldData?.dealid;
      if (dealIdValue != null) {
        itemsByDealId.set(String(dealIdValue), item);
      }

      if (item.slug) {
        itemsBySlug.set(String(item.slug), item);
      }
    }

    const createdItems = [];
    const updatedItems = [];
    const errors = [];

    // 3. Upsert по кожному deal (create / update) + одразу live
    for (const deal of deals) {
      const dealId = String(deal.id ?? "");

      if (!dealId) {
        errors.push({
          deal,
          error: "Пропущений deal без id",
        });
        continue;
      }

      try {
        const name = deal.dealName || deal.name || "Deal";

        // *** ВАЖЛИВО ***
        // slug рахуємо ОДИН раз і використовуємо і для пошуку, і для fieldData
        const slugBase =
          slugify(deal.dealName || deal.name || `deal-${dealId}`) || "deal";
        const slug = `${slugBase}-${dealId}`.replace(/-+$/g, "");

        // fieldData: API Name полів МАЄ збігатися з API Name у Webflow CMS
        const fieldData = {
          // стандартні поля
          name,
          slug,

          // кастомні поля
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

          // ключове поле для upsert
          dealid: dealId,
        };

        // Спочатку шукаємо айтем по dealid
        const existingItemById = itemsByDealId.get(dealId);
        // Якщо не знайшли по dealid, пробуємо знайти по slug
        const existingItemBySlug = itemsBySlug.get(slug);

        const existingItem = existingItemById || existingItemBySlug;

        if (existingItem) {
          // 3a. Айтем уже є — ОНОВЛЮЄМО live
          const updateUrl = webflowItemsLiveUpdateUrl(existingItem.id);

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

          updatedItems.push({
            dealId,
            itemId: webflowResponse.data.id,
          });
        } else {
          // 3б. Немає такого dealid/slug — СТВОРЮЄМО новий live-айтем
          const createBody = {
            isArchived: false,
            isDraft: false,
            fieldData,
          };

          const webflowResponse = await axios.post(
            webflowItemsLiveCreateUrl,
            createBody,
            {
              headers: {
                Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          createdItems.push({
            dealId,
            itemId: webflowResponse.data.id,
          });
        }
      } catch (err) {
        console.error(
          "[sync-deals-to-webflow] Помилка при створенні/оновленні LIVE-айтема в Webflow:",
          err.response?.data || err.message
        );
        errors.push({
          dealId,
          error: err.response?.data || err.message,
        });
      }
    }

    return res.status(200).json({
      message: "Синхронізація з Webflow завершена (upsert + одразу live)",
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      updatedItemsCount: updatedItems.length,
      createdItems,
      updatedItems,
      errors,
    });
  } catch (error) {
    console.error(
      "[sync-deals-to-webflow] Глобальна помилка:",
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: "Щось пішло не так при синхронізації!",
      details: error.response?.data || error.message,
    });
  }
};
