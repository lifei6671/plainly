import {message} from "antd";

declare global {
  interface Window {
    mozIndexedDB?: IDBFactory;
    webkitIndexedDB?: IDBFactory;
    msIndexedDB?: IDBFactory;
  }
}

type StoreInit = (store: IDBObjectStore | null, db: IDBDatabase, transaction: IDBTransaction | null) => void;

type IndexDBOptions = {
  name?: string;
  version?: number;
  storeName?: string;
  storeOptions?: IDBObjectStoreParameters;
  storeInit?: StoreInit;
};

// In the following line, you should include the prefixes of implementations you want to test.
const indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
// DON'T use "var indexedDB = ..." if you're not in a function.
// Moreover, you may need references to some window.IDB* objects:
// const IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
// const IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;

// (Mozilla has never prefixed these objects, so we don't need window.mozIDB*)

export default class IndexDB {
  options: IndexDBOptions;

  storeName = "";

  storeOptions: IDBObjectStoreParameters = {};

  storeInit: StoreInit = () => {};

  constructor(options: IndexDBOptions = {}) {
    this.options = options;
  }

  async init(): Promise<IDBDatabase> {
    if (!indexedDB) {
      message.error("初始化 indexdb 失败！浏览器不支持");
      throw Error("浏览器不支持 indexdb");
    }

    const {name, version, storeName = "", storeOptions = {}, storeInit = () => {}} = this.options;

    this.storeName = storeName;
    this.storeOptions = storeOptions;
    this.storeInit = storeInit;

    const request = version ? indexedDB.open(name, version) : indexedDB.open(name);
    const result = await this.initEvent(request);
    return result;
  }

  initEvent(request: IDBOpenDBRequest): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => {
        message.error("初始化数据库失败！");
        reject(new Error("初始化数据库失败！"));
      };

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log("成功初始化数据库 ->", db.name);
        // this.db = db;
        resolve(db);
      };

      // 该事件仅在较新的浏览器中被实现
      request.onupgradeneeded = (event) => {
        // 更新对象存储空间和索引 ....
        const target = event.target as IDBOpenDBRequest;
        const db = target.result;
        const {transaction} = target;
        this.initStore(db, transaction, this.storeName, this.storeOptions, this.storeInit);
      };
    });
  }

  initStore(
    db: IDBDatabase,
    transaction: IDBTransaction | null,
    name: string,
    options: IDBObjectStoreParameters,
    func: StoreInit,
  ) {
    // 创建一个对象存储空间来持有信息。
    if (!name) {
      if (func) func(null, db, transaction);
      return;
    }
    let objectStore = null;
    if (db.objectStoreNames.contains(name)) {
      objectStore = transaction ? transaction.objectStore(name) : null;
    } else {
      objectStore = db.createObjectStore(name, options);
    }
    if (func) func(objectStore, db, transaction);
  }
}
