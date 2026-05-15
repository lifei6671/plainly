import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message, Checkbox, Radio, Button, Alert} from "antd";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore} from "../../data/store";
import {BrowserDataStore} from "../../data/store/browser/BrowserDataStore";
import {isShareSnapshotConflictError, syncShareSnapshotIfEnabled} from "../../share/browserSnapshot";
import {getDefaultListedValue} from "../../share/policy";
import {DocumentShareSettings} from "../../share/types";
import {DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_UUID} from "../../utils/constant";

type ShareSettingsAccessType = DocumentShareSettings["accessType"];
type ShareSettingsDurationType = DocumentShareSettings["durationType"];

export const resolveShareListedState = (
  share: Pick<DocumentShareSettings, "listed"> | null | undefined,
  accessType: ShareSettingsAccessType = "public",
  durationType: ShareSettingsDurationType = "permanent",
) => {
  if (share) return Boolean(share.listed);
  return getDefaultListedValue({accessType, durationType});
};

@inject("dialog")
@inject("content")
@inject("navbar")
@observer
class RenameFileDialog extends Component<any, any> {
  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      name: "",
      categories: [],
      categoryUuid: DEFAULT_CATEGORY_UUID,
      isRemoteMode: false,
      canEditShare: false,
      shareEnabled: false,
      listed: resolveShareListedState(null),
      accessType: "public",
      durationType: "permanent",
      startAt: "",
      endAt: "",
      password: "",
      passwordConfigured: false,
      passwordVersion: null,
      publicUrl: "",
      regenerateShareId: false,
      saving: false,
    };
  }

  componentDidMount() {
    this.wasOpen = this.props.dialog.isRenameFileOpen;
    if (this.wasOpen) {
      this.openDialog();
    }
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isRenameFileOpen;
    if (isOpen && !this.wasOpen) {
      this.openDialog();
    }
    this.wasOpen = isOpen;
  }

  getDataStore() {
    const uid = (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
    return getDataStore(Number(uid) || 0);
  }

  resolveDataStoreMode() {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DATA_STORE) {
      return import.meta.env.VITE_DATA_STORE;
    }
    if (typeof window !== "undefined" && window.__DATA_STORE_MODE__) {
      return window.__DATA_STORE_MODE__;
    }
    if (typeof process !== "undefined" && process.env?.DATA_STORE_MODE) {
      return process.env.DATA_STORE_MODE;
    }
    return "browser";
  }

  getRuntimeUserId() {
    if (typeof window === "undefined") return 0;
    return window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__ || 0;
  }

  shouldCacheRemote() {
    return this.resolveDataStoreMode() === "remote" && this.getRuntimeUserId() > 0;
  }

  getCacheStore() {
    if (!this.shouldCacheRemote()) return null;
    return new BrowserDataStore(this.getRuntimeUserId());
  }

  openDialog = async () => {
    this.resetNameFromStore();
    const {meta, categories, share} = await this.loadDocumentSettings();
    await this.cacheCategories(categories);
    this.setState({
      categories,
      isRemoteMode: this.resolveDataStoreMode() === "remote",
      canEditShare: this.resolveDataStoreMode() === "remote" && this.getRuntimeUserId() > 0,
    });
    this.applyCategoryFromMeta(meta, categories);
    this.applyShareSettings(share);
  };

  loadDocumentSettings = async () => {
    const {documentUuid} = this.props.content;
    const store = this.getDataStore();
    try {
      if (documentUuid) {
        const payload = await store.getDocumentSettings(documentUuid);
        return {
          meta: payload?.meta || null,
          categories: Array.isArray(payload?.categories) ? payload.categories : [],
          share: payload?.share || null,
        };
      }
      const categories = await store.listCategories();
      return {meta: null, categories, share: null};
    } catch (e) {
      console.error(e);
      return {meta: null, categories: [], share: null};
    }
  };

  applyShareSettings = (share) => {
    const accessType = share?.accessType || "public";
    const durationType = share?.durationType || "permanent";
    this.setState({
      shareEnabled: Boolean(share?.enabled),
      listed: resolveShareListedState(share, accessType, durationType),
      accessType,
      durationType,
      startAt: this.formatDateTimeLocal(share?.startAt),
      endAt: this.formatDateTimeLocal(share?.endAt),
      password: "",
      passwordConfigured: Boolean(share?.passwordConfigured),
      passwordVersion: share?.passwordVersion ?? null,
      publicUrl: share?.publicUrl || "",
      regenerateShareId: false,
    });
  };

  normalizeCategoryInfo = (value, categories) => {
    const mapByUuid = new Map();
    const mapByName = new Map();
    const mapByLegacyId = new Map();
    categories.forEach((category) => {
      mapByUuid.set(category.category_id, category);
      if (typeof category.id === "number") {
        mapByLegacyId.set(category.id, category);
      }
      if (category.name) {
        mapByName.set(category.name, category);
      }
    });
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (mapByUuid.has(trimmed)) {
        const category = mapByUuid.get(trimmed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
      if (mapByName.has(trimmed)) {
        const category = mapByName.get(trimmed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && mapByLegacyId.has(parsed)) {
        const category = mapByLegacyId.get(parsed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
    }
    if (typeof value === "number" && mapByLegacyId.has(value)) {
      const category = mapByLegacyId.get(value);
      return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
    }
    return {uuid: DEFAULT_CATEGORY_UUID, name: DEFAULT_CATEGORY_NAME};
  };

  applyCategoryFromMeta = (meta, categories) => {
    const normalized = this.normalizeCategoryInfo(meta ? meta.category_id || meta.category : null, categories);
    this.setState({categoryUuid: normalized.uuid});
    this.props.content.setDocumentCategory(normalized.uuid, normalized.name);
  };

  resetNameFromStore = () => {
    const currentName = this.props.content.documentName || "未命名.md";
    this.setState({name: this.normalizeName(currentName)});
  };

  normalizeName = (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.toLowerCase().endsWith(".md")) {
      return trimmed.slice(0, -3);
    }
    return trimmed;
  };

  buildFileName = (name) => {
    const normalized = this.normalizeName(name);
    if (!normalized) {
      return "";
    }
    return `${normalized}.md`;
  };

  formatDateTimeLocal = (value) => {
    if (value == null) return "";
    const date = typeof value === "number" ? new Date(value) : new Date(String(value));
    if (Number.isNaN(date.getTime())) return "";
    const pad = (num) => String(num).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  parseDateTimeLocal = (value) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  };

  buildShareInput = () => {
    const shareEnabled = Boolean(this.state.shareEnabled);
    const accessType = this.state.accessType || "public";
    const durationType = this.state.durationType || "permanent";
    const startAt = durationType === "range" ? this.parseDateTimeLocal(this.state.startAt) : null;
    const endAt = durationType === "range" ? this.parseDateTimeLocal(this.state.endAt) : null;
    return {
      enabled: shareEnabled,
      listed: Boolean(this.state.listed),
      accessType,
      durationType,
      startAt,
      endAt,
      password: accessType === "password" ? (this.state.password || null) : null,
      regenerateShareId: Boolean(this.state.regenerateShareId),
    };
  };

  getSnapshotRenderMode = () => (this.props.navbar?.codeNum === 0 ? "wechat" : "default");

  handleOk = async () => {
    const fileName = this.buildFileName(this.state.name);
    if (!fileName) {
      message.error("请输入文件名称");
      return;
    }
    const {documentUuid} = this.props.content;
    if (!documentUuid) {
      message.error("未找到当前文档");
      return;
    }
    try {
      this.setState({saving: true});
      const categoryUuid = this.state.categoryUuid || DEFAULT_CATEGORY_UUID;
      const store = this.getDataStore();
      const {canEditShare} = this.state;
      let payload = null;
      if (canEditShare) {
        payload = await store.updateDocumentSettings(documentUuid, {
          meta: {
            name: fileName,
            category_id: categoryUuid,
          },
          share: this.buildShareInput(),
        });
      } else {
        await store.updateDocumentMeta(documentUuid, {
          name: fileName,
          category_id: categoryUuid,
          updatedAt: new Date(),
        });
      }
      const category = this.state.categories.find((item) => item.category_id === categoryUuid);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentCategory(categoryUuid, category ? category.name : DEFAULT_CATEGORY_NAME);
      await this.cacheUpdatedDocument(documentUuid, fileName, categoryUuid);
      if (payload?.share) {
        this.applyShareSettings(payload.share);
      }
      let successMessage = "文档设置已保存";
      if (canEditShare && payload?.share?.enabled) {
        try {
          const snapshotResult = await syncShareSnapshotIfEnabled({
            store,
            documentUuid,
            documentName: fileName,
            markdown: this.props.content.content || "",
            snapshotVersion: this.props.content.documentUpdatedAt || Date.now(),
            renderMode: this.getSnapshotRenderMode(),
            currentShare: payload.share,
          });
          if (snapshotResult.share) {
            this.applyShareSettings(snapshotResult.share);
          }
        } catch (snapshotError) {
          console.error(snapshotError);
          successMessage = isShareSnapshotConflictError(snapshotError)
            ? "文档设置已保存，但公开快照版本冲突，请刷新后重试"
            : "文档设置已保存，但公开快照刷新失败，请稍后重试";
        }
      }
      this.props.dialog.setRenameFileOpen(false);
      if (successMessage === "文档设置已保存") {
        message.success(successMessage);
      } else {
        message.warning(successMessage);
      }
      try {
        await markIndexDirty();
        scheduleIndexRebuild();
      } catch (err) {
        console.error(err);
      }
    } catch (e) {
      console.error(e);
      message.error(e?.message || "保存文档设置失败");
    } finally {
      this.setState({saving: false});
    }
  };

  handleCancel = () => {
    this.props.dialog.setRenameFileOpen(false);
  };

  handleChange = (e) => {
    const value = this.normalizeName(e.target.value);
    this.setState({name: value});
  };

  handleCopyLink = async () => {
    const {publicUrl} = this.state;
    if (!publicUrl) {
      message.warning("当前还没有可复制的公开链接");
      return;
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(publicUrl);
      }
      message.success("已复制公开链接");
    } catch (error) {
      console.error(error);
      message.error("复制失败，请手动复制");
    }
  };

  render() {
    const isRange = this.state.durationType === "range";
    const isPassword = this.state.accessType === "password";
    const showShareSection = this.state.isRemoteMode;
    const shareItemStyle = {marginBottom: 12};
    return (
      <Modal
        title="文档设置"
        okText="确认"
        cancelText="取消"
        visible={this.props.dialog.isRenameFileOpen}
        onOk={this.handleOk}
        onCancel={this.handleCancel}
        confirmLoading={this.state.saving}
      >
        <Form.Item label="文件名称">
          <Input placeholder="请输入文件名称" value={this.state.name} onChange={this.handleChange} addonAfter=".md" />
        </Form.Item>
        <Form.Item label="目录">
          <Select
            value={this.state.categoryUuid}
            onChange={(value) => this.setState({categoryUuid: value})}
            placeholder="请选择目录"
          >
            {this.state.categories.map((category) => (
              <Select.Option key={category.category_id || category.id} value={category.category_id || category.id}>
                {category.name || DEFAULT_CATEGORY_NAME}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        {showShareSection ? (
          <div>
            <h4 style={{marginTop: 24}}>公开设置</h4>
            {this.state.canEditShare ? null : (
              <Alert style={{marginBottom: 16}} type="info" showIcon message="登录后才可配置公开分享。" />
            )}
            {this.state.canEditShare ? (
              <>
                <Form.Item>
                  <Checkbox
                    checked={this.state.shareEnabled}
                    onChange={(e) => this.setState({shareEnabled: e.target.checked})}
                  >
                    启用公开分享
                  </Checkbox>
                </Form.Item>
                {this.state.shareEnabled ? (
                  <>
                    <Form.Item style={shareItemStyle}>
                      <Checkbox
                        checked={this.state.listed}
                        onChange={(e) => this.setState({listed: e.target.checked})}
                      >
                        显示在公开首页
                      </Checkbox>
                    </Form.Item>
                    <Form.Item label="访问方式" style={shareItemStyle}>
                      <Radio.Group
                        value={this.state.accessType}
                        onChange={(e) => {
                          const nextAccessType = e.target.value;
                          this.setState((prevState) => ({
                            accessType: nextAccessType,
                            listed: getDefaultListedValue({accessType: nextAccessType, durationType: prevState.durationType}),
                          }));
                        }}
                      >
                        <Radio.Button value="public">完全公开</Radio.Button>
                        <Radio.Button value="password">密码访问</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    {isPassword ? (
                      <Form.Item
                        label={this.state.passwordConfigured ? "访问密码（留空表示不修改）" : "访问密码"}
                        extra={
                          this.state.passwordVersion ? `当前密码版本：v${this.state.passwordVersion}` : "首次设置密码后才会生成版本号"
                        }
                        style={shareItemStyle}
                      >
                        <Input.Password
                          value={this.state.password}
                          onChange={(e) => this.setState({password: e.target.value})}
                          placeholder={this.state.passwordConfigured ? "不修改密码可留空" : "请输入访问密码"}
                        />
                      </Form.Item>
                    ) : null}
                    <Form.Item label="公开时长" style={shareItemStyle}>
                      <Radio.Group
                        value={this.state.durationType}
                        onChange={(e) => {
                          const nextDurationType = e.target.value;
                          this.setState((prevState) => ({
                            durationType: nextDurationType,
                            listed: getDefaultListedValue({accessType: prevState.accessType, durationType: nextDurationType}),
                          }));
                        }}
                      >
                        <Radio.Button value="permanent">长期公开</Radio.Button>
                        <Radio.Button value="range">时间范围</Radio.Button>
                      </Radio.Group>
                    </Form.Item>
                    {isRange ? (
                      <>
                        <Form.Item label="开始时间" style={shareItemStyle}>
                          <Input
                            type="datetime-local"
                            value={this.state.startAt}
                            onChange={(e) => this.setState({startAt: e.target.value})}
                          />
                        </Form.Item>
                        <Form.Item label="结束时间" style={shareItemStyle}>
                          <Input
                            type="datetime-local"
                            value={this.state.endAt}
                            onChange={(e) => this.setState({endAt: e.target.value})}
                          />
                        </Form.Item>
                      </>
                    ) : null}
                    <Form.Item label="公开链接">
                      <Input
                        readOnly
                        value={this.state.regenerateShareId ? "保存后会生成新的公开链接" : this.state.publicUrl || ""}
                        placeholder="保存后会生成公开链接"
                        addonAfter={
                          <div style={{display: "flex", gap: 8}}>
                            <Button size="small" type="link" onClick={this.handleCopyLink}>
                              复制
                            </Button>
                            <Button
                              size="small"
                              type="link"
                              onClick={() => this.setState({regenerateShareId: true})}
                            >
                              重置
                            </Button>
                          </div>
                        }
                      />
                    </Form.Item>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>
    );
  }

  cacheUpdatedDocument = async (documentUuid, name, categoryUuid) => {
    if (!documentUuid) return;
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await cache.upsertDocumentSnapshot({
      document_id: documentUuid,
      name,
      category_id: categoryUuid,
      updatedAt: new Date(),
      createdAt: new Date(),
      source: "remote",
      uid: this.getRuntimeUserId(),
    });
  };

  cacheCategories = async (categories) => {
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await Promise.all(
      categories.map((category) =>
        cache.upsertCategorySnapshot({
          ...category,
          source: "remote",
          uid: this.getRuntimeUserId(),
        }),
      ),
    );
  };
}

export default RenameFileDialog;
