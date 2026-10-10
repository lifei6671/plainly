import {resolveDataStoreInfo} from "../data/store";
import {Category} from "../data/store/types";
import {getConfigSync} from "./configStore";

export const CATEGORY_ORDER_CHANGED_EVENT = "nice-category-order-changed";

export const getCategoryOrderConfigKey = (userId: number) => {
  const scope = resolveDataStoreInfo(userId);
  return `categoryOrder:${scope.effectiveMode}:${scope.userId}`;
};

export const sortCategories = <T extends Pick<Category, "category_id">>(categories: T[], userId: number): T[] => {
  let order: unknown;
  try {
    order = getConfigSync(getCategoryOrderConfigKey(userId), []);
  } catch (error) {
    console.error(error);
    return categories;
  }
  if (!Array.isArray(order) || !order.every((id) => typeof id === "string")) return categories;
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...categories].sort(
    (left, right) =>
      (positions.get(left.category_id) ?? order.length) - (positions.get(right.category_id) ?? order.length),
  );
};
