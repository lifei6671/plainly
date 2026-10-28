import {BrowserDataStore} from "../data/store/browser/BrowserDataStore";
import {getDataStore} from "../data/store";
import {
  ALIOSS_IMAGE_HOSTING,
  QINIUOSS_IMAGE_HOSTING,
  R2_IMAGE_HOSTING,
  SM_MS_TOKEN,
  IMAGE_HOSTING_TYPE,
  DEFAULT_CATEGORY_NAME,
  DEFAULT_CATEGORY_UUID,
} from "./constant";

export const syncLocalToRemote = async (user: {id: number}, contentStore: any) => {
  if (!user || !user.id) return;
  try {
    const localStore = new BrowserDataStore(0);
    await localStore.init();
    const remoteStore = getDataStore(Number(user.id) || 0);
    const configKeysToSync = [
      ALIOSS_IMAGE_HOSTING,
      QINIUOSS_IMAGE_HOSTING,
      R2_IMAGE_HOSTING,
      SM_MS_TOKEN,
      IMAGE_HOSTING_TYPE,
    ];

    await Promise.all(
      configKeysToSync.map(async (key) => {
        try {
          const value = await localStore.getConfig(key, null);
          if (value === null || value === undefined || value === "") {
            return;
          }
          await remoteStore.setConfig(key, value);
        } catch (e) {
          console.error(`同步配置失败: ${key}`, e);
        }
      }),
    );

    const localCategories = await localStore.listCategories();
    const categoryUuidMap = new Map();
    const categoryItems = localCategories
      .filter((category) => category && category.category_id !== DEFAULT_CATEGORY_UUID)
      .map((category) => ({
        name: category.name,
        category_id: category.category_id,
        source: "local" as const,
        version: category.version ?? 1,
      }));
    if (categoryItems.length > 0) {
      try {
        const result = await remoteStore.batchCreateCategories(categoryItems as any);
        const items = (result && result.items) || [];
        await Promise.all(
          items.map(async (item) => {
            const clientId = item?.client_id;
            const created = item?.category;
            if (!clientId || !created || !created.category_id) return;
            categoryUuidMap.set(clientId, created.category_id);
            if (created.category_id !== clientId) {
              await localStore.remapCategoryUuid(clientId, created.category_id);
              if (contentStore.documentCategoryUuid === clientId) {
                contentStore.setDocumentCategory(created.category_id, created.name || DEFAULT_CATEGORY_NAME);
              }
            }
          }),
        );
      } catch (e) {
        console.error(e);
      }
    }

    const localDocuments = await localStore.listAllDocuments();
    const documentItems = await Promise.all(
      localDocuments
        .filter((doc) => doc && doc.document_id)
        .map(async (doc) => {
          const content = await localStore.getDocumentContent(doc.document_id);
          const mappedCategoryUuid = categoryUuidMap.get(doc.category_id) || doc.category_id || DEFAULT_CATEGORY_UUID;
          return {
            meta: {
              document_id: doc.document_id,
              name: doc.name,
              category_id: mappedCategoryUuid,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
              charCount: doc.charCount,
              source: "local" as const,
              version: doc.version ?? 1,
            },
            content: content || "",
          };
        }),
    );
    const filteredDocs = documentItems.filter((item) => item && item.meta && item.meta.document_id);
    if (filteredDocs.length > 0) {
      try {
        const result = await remoteStore.batchCreateDocuments(filteredDocs as any);
        const items = (result && result.items) || [];
        await Promise.all(
          items.map(async (item) => {
            const clientId = item?.client_id;
            const created = item?.document;
            if (!clientId || !created || !created.document_id) return;
            if (created.document_id !== clientId) {
              await localStore.remapDocumentUuid(clientId, created.document_id);
              if (contentStore.documentUuid === clientId) {
                contentStore.setDocumentUuid(created.document_id);
              }
            }
          }),
        );
      } catch (e) {
        console.error(e);
      }
    }
  } catch (e) {
    console.error(e);
  }
};
