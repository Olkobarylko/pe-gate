// api/sync-deals-to-webflow.js

const axios = require("axios");

// ID коллекции Webflow
const WEBFLOW_COLLECTION_ID = "691f618c34b4f8127ecf1703";

// Токены берем из env (НЕ хардкодим)
const WEBFLOW_API_TOKEN =
  "27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53";
const PE_GATE_API_TOKEN =
  "MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl";

// Базовый URL Webflow v2 для CMS айтемов (staged items)
const webflowApiUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;

// Утилита для slug
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

// Тянем ВСЕ айтемы с коллекции (с пагинацией)
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

// Основной handler (например, Next.js /api route)
module.exports = async (req, res) => {
  try {
    // 0. Проверим, что токены есть
    if (!WEBFLOW_API_TOKEN || !PE_GATE_API_TOKEN) {
      return res.status(500).json({
        error: "Отсутствуют WEBFLOW_API_TOKEN или PE_GATE_API_TOKEN в env",
      });
    }

    // 1. Тянем данные из внешнего API (все deals)
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

    // Если бек вернул { data: [...] }
    if (!Array.isArray(deals) && Array.isArray(deals?.data)) {
      deals = deals.data;
    }

    if (!Array.isArray(deals)) {
      return res.status(500).json({
        error: "Ожидался массив deals от внешнего API",
        raw: apiResponse.data,
      });
    }

    // 2. Тянем все айтемы из Webflow и строим мапу по кастомному полю dealid
    const existingItems = await fetchAllWebflowItems();

    // Map: dealid(string) -> item
    const itemsByDealId = new Map();
    for (const item of existingItems) {
      const dealIdValue = item.fieldData?.dealid; // API Name поля в Webflow должен быть "dealid"
      if (dealIdValue != null) {
        itemsByDealId.set(String(dealIdValue), item);
      }
    }

    const createdItems = [];
    const updatedItems = [];
    const errors = [];
    const itemIdsToPublish = []; // сюда собираем все id для publish

    // 3. Проходим по каждому deal и делаем upsert
    for (const deal of deals) {
      const dealId = String(deal.id ?? "");

      if (!dealId) {
        // Если у deal нет id — пропускаем
        errors.push({
          deal,
          error: "Пропущен deal без id",
        });
        continue;
      }

      try {
        const name = deal.dealName || deal.name || "Deal";

        // slug стабильно привязан к dealId
        const slugBase =
          slugify(deal.dealName || deal.name || `deal-${dealId}`) || "deal";
        const slug = `${slugBase}-${dealId}`.replace(/-+$/g, "");

        // fieldData — имена полей ДОЛЖНЫ 1-в-1 совпадать с API Name в Webflow
        const fieldData = {
          // стандартные поля
          name,
          slug,

          // кастомные поля
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
          // поле, по которому мы матчимся
          dealid: dealId,
        };

        const existingItem = itemsByDealId.get(dealId);

        if (existingItem) {
          // 3а. Айтем уже есть — ОБНОВЛЯЕМ (PATCH /collections/{collection_id}/items/{item_id})
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

          const itemId = webflowResponse.data?.id || existingItem.id;

          updatedItems.push({
            dealId,
            itemId,
          });

          itemIdsToPublish.push(itemId);
        } else {
          // 3б. Нет айтема с таким dealid — СОЗДАЁМ (POST /collections/{collection_id}/items)
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

          const itemId = webflowResponse.data.id;

          createdItems.push({
            dealId,
            itemId,
          });

          itemIdsToPublish.push(itemId);
        }
      } catch (err) {
        console.error(
          "Ошибка при создании/обновлении айтема в Webflow:",
          err.response?.data || err.message
        );
        errors.push({
          dealId,
          error: err.response?.data || err.message,
        });
      }
    }

    // 4. После upsert — делаем publish для всех созданных/обновлённых айтемов
    // на всякий случай уберем дубли
    const uniqueItemIdsToPublish = [...new Set(itemIdsToPublish)];

    if (uniqueItemIdsToPublish.length > 0) {
      try {
        const publishResp = await axios.post(
          `${webflowApiUrl}/publish`,
          {
            itemIds: uniqueItemIdsToPublish,
          },
          {
            headers: {
              Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        console.log("Publish result:", publishResp.data);
      } catch (e) {
        console.error("Помилка при publish:", e.response?.data || e.message);
        errors.push({
          step: "publish",
          error: e.response?.data || e.message,
        });
      }
    }

    return res.status(200).json({
      message: "Синхронизация с Webflow завершена (upsert по dealid + publish)",
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      updatedItemsCount: updatedItems.length,
      publishedItemsCount: uniqueItemIdsToPublish.length,
      createdItems,
      updatedItems,
      errors,
    });
  } catch (error) {
    console.error("Глобальная ошибка:", error.response?.data || error.message);

    return res.status(500).json({
      error: "Что-то пошло не так при синхронизации!",
      details: error.response?.data || error.message,
    });
  }
};
