declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

export {};

jest.mock("../data/store", () => ({
  resolveDataStoreInfo: (userId) => ({
    userId,
    effectiveMode: userId > 0 ? window.__DATA_STORE_MODE__ : "browser",
  }),
}));

const {sortCategories, getCategoryOrderConfigKey} = require("./categoryOrder");
const categories = [{category_id: "a"}, {category_id: "b"}, {category_id: "new"}];

beforeEach(() => {
  window.localStorage.clear();
  window.__DATA_STORE_MODE__ = "remote";
});

it("restores saved order, ignores removed IDs, and appends new directories without mutating input", () => {
  window.localStorage.setItem(getCategoryOrderConfigKey(0), '["removed","b","a"]');
  expect(sortCategories(categories, 0)).toEqual([categories[1], categories[0], categories[2]]);
  expect(categories.map((category) => category.category_id)).toEqual(["a", "b", "new"]);
});

it("isolates account and source order preferences", () => {
  window.localStorage.setItem(getCategoryOrderConfigKey(42), '["b","a"]');
  expect(sortCategories(categories, 42)[0].category_id).toBe("b");
  expect(sortCategories(categories, 43)).toEqual(categories);
  window.__DATA_STORE_MODE__ = "browser";
  expect(sortCategories(categories, 42)).toEqual(categories);
});

it("preserves the original order when saved data is invalid or absent", () => {
  expect(sortCategories(categories, 0)).toEqual(categories);
  for (const raw of ["invalid", "null", "{}", '["b",null]', '["b",1]']) {
    window.localStorage.setItem(getCategoryOrderConfigKey(0), raw);
    expect(sortCategories(categories, 0)).toEqual(categories);
  }
});

it("can still list directories when browser storage cannot be read", () => {
  const getItem = jest.spyOn(Object.getPrototypeOf(window.localStorage), "getItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    expect(sortCategories(categories, 0)).toEqual(categories);
  } finally {
    getItem.mockRestore();
    consoleError.mockRestore();
  }
});
