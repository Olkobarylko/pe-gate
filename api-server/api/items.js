// api/sync-deals-to-webflow.js

const axios = require("axios");

// ID коллекции Webflow
const WEBFLOW_COLLECTION_ID = "691f618c34b4f8127ecf1703";

// Токены берем из env (НЕ хардкодим)
const WEBFLOW_API_TOKEN =
  process.env.WEBFLOW_API_TOKEN ||
  "27a1da0aeecafa64480b31bd281d1ba1224ad1095e9418d8144567e6cddfea53";
const PE_GATE_API_TOKEN =
  process.env.PE_GATE_API_TOKEN ||
  "MTk1Mzc0ODIwMTpTfHxYZH1wP3BiIUg1dChTa1B2JHxrUXJ1bUc5TlQ2VkZmYD5eWWMl";
// Базовые URL Webflow v2 для CMS айтемов
const webflowItemsBaseUrl = `https://api.webflow.com/v2/collections/${WEBFLOW_COLLECTION_ID}/items`;
const webflowItemsLiveUrl = `${webflowItemsBaseUrl}/live`;

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
    const resp = await axios.get(webflowItemsBaseUrl, {
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
      const dealIdValue = item.fieldData?.dealid;
      if (dealIdValue != null) {
        itemsByDealId.set(String(dealIdValue), item);
      }
    }

    const createdItems = [];
    const updatedItems = [];
    const errors = [];

    // 3. Проходим по каждому deal и делаем upsert (СРАЗУ В LIVE)
    for (const deal of deals) {
      const dealId = String(deal.id ?? "");

      if (!dealId) {
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
          dealid: dealId,
        };

        const existingItem = itemsByDealId.get(dealId);

        if (existingItem) {
          // 3а. Айтем уже есть — ОБНОВЛЯЕМ LIVE
          const updateUrl = `${webflowItemsBaseUrl}/${existingItem.id}/live`;

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

          if (webflowResponse.status >= 200 && webflowResponse.status < 300) {
            const itemId = webflowResponse.data?.id || existingItem.id;

            updatedItems.push({
              dealId,
              itemId,
            });

            console.log(
              `✅ Обновлен LIVE-айтем для deal ${dealId}, ID: ${itemId}`
            );
          }
        } else {
          // 3б. Нет айтема с таким dealid — СОЗДАЁМ СРАЗУ LIVE
          const createBody = {
            isArchived: false,
            isDraft: false,
            fieldData,
          };

          const webflowResponse = await axios.post(
            webflowItemsLiveUrl,
            createBody,
            {
              headers: {
                Authorization: `Bearer ${WEBFLOW_API_TOKEN.trim()}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );

          if (webflowResponse.status >= 200 && webflowResponse.status < 300) {
            const itemId = webflowResponse.data.id;

            createdItems.push({
              dealId,
              itemId,
            });

            console.log(
              `✅ Создан LIVE-айтем для deal ${dealId}, ID: ${itemId}`
            );
          }
        }
      } catch (err) {
        console.error(
          `❌ Ошибка при создании/обновлении айтема для deal ${dealId}:`,
          err.response?.data || err.message
        );
        errors.push({
          dealId,
          error: err.response?.data || err.message,
          status: err.response?.status,
        });
      }
    }

    // 4. Паблиш больше не нужен — мы уже работаем с LIVE айтемами
    const publishedItemsCount = createdItems.length + updatedItems.length;

    return res.status(200).json({
      message: "Синхронизация с Webflow завершена (LIVE items)",
      totalDeals: deals.length,
      createdItemsCount: createdItems.length,
      updatedItemsCount: updatedItems.length,
      publishedItemsCount, // для совместимости с прежним ответом
      createdItems,
      updatedItems,
      publishResult: null,
      errors,
    });
  } catch (error) {
    console.error("❌ Глобальная ошибка:", {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
    });

    return res.status(500).json({
      error: "Что-то пошло не так при синхронизации!",
      details: error.response?.data || error.message,
      status: error.response?.status,
    });
  }
};