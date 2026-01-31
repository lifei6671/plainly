import React, {Component} from "react";
import {Input, Form, InputNumber, Select} from "antd";
import {R2_IMAGE_HOSTING} from "../../utils/constant";
import {getDataStore} from "../../data/store";

const {Option} = Select;

const formItemLayout = {
  labelCol: {
    xs: {span: 6},
  },
  wrapperCol: {
    xs: {span: 16},
  },
};

class R2 extends Component {
  dataStore = getDataStore();

  constructor(props) {
    super(props);
    const defaults = {
      accountId: "",
      accessKeyId: "",
      secretAccessKey: "",
      bucket: "",
      publicBaseUrl: "",
      namespace: "",
      size: 0,
      quality: 88,
      filenameTemplate: "image_${YYYY}${MM}${DD}_${Timestamp}_${RAND:6}.${EXT}",
    };
    this.state = {
      imageHosting: defaults,
    };
  }

  async componentDidMount() {
    await this.dataStore.init?.();
    const stored = (await this.dataStore.getConfig(R2_IMAGE_HOSTING)) || {};
    const imageHosting = {...this.state.imageHosting, ...stored};
    this.setState({imageHosting});
  }

  persistConfig = (nextConfig) => {
    this.dataStore.setConfig(R2_IMAGE_HOSTING, nextConfig).catch(console.error);
  };

  accountIdChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.accountId = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  accessKeyIdChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.accessKeyId = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  secretAccessKeyChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.secretAccessKey = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  bucketChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.bucket = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  publicBaseUrlChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.publicBaseUrl = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  namespaceChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.namespace = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  sizeChange = (value) => {
    const {imageHosting} = this.state;
    imageHosting.size = value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  qualityChange = (value) => {
    const nextValue = Number.isFinite(value) ? value : 88;
    const quality = Math.max(50, Math.min(100, nextValue));
    const {imageHosting} = this.state;
    imageHosting.quality = quality;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  filenameTemplateChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.filenameTemplate = e.target.value;
    this.setState({imageHosting});
    this.persistConfig(imageHosting);
  };

  render() {
    const {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket,
      publicBaseUrl,
      namespace,
      size,
      quality,
      filenameTemplate,
    } = this.state.imageHosting;
    return (
      <Form {...formItemLayout}>
        <Form.Item label="Account ID" style={style.formItem}>
          <Input value={accountId} onChange={this.accountIdChange} placeholder="例如：a1b2c3d4e5f6" />
        </Form.Item>
        <Form.Item label="Bucket" style={style.formItem}>
          <Input value={bucket} onChange={this.bucketChange} placeholder="例如：mdnice-images" />
        </Form.Item>
        <Form.Item label="AccessKey ID" style={style.formItem}>
          <Input value={accessKeyId} onChange={this.accessKeyIdChange} placeholder="例如：xxxx" />
        </Form.Item>
        <Form.Item label="SecretAccessKey" style={style.formItem}>
          <Input.Password value={secretAccessKey} onChange={this.secretAccessKeyChange} placeholder="例如：xxxx" />
        </Form.Item>
        <Form.Item label="Public URL" style={style.formItem}>
          <Input
            value={publicBaseUrl}
            onChange={this.publicBaseUrlChange}
            placeholder="例如：https://img.example.com/"
          />
        </Form.Item>
        <Form.Item label="Namespace" style={style.formItem}>
          <Input value={namespace} onChange={this.namespaceChange} placeholder="例如：image/" />
        </Form.Item>
        <Form.Item
          label="文件名"
          style={style.formItem}
          extra="示例：image_${YYYY}${MM}${DD}${hh}${mm}${ss}_${Timestamp}_${RAND:6}.${EXT}（留空则不修改文件名）"
        >
          <Input
            value={filenameTemplate}
            onChange={this.filenameTemplateChange}
            placeholder="image_${YYYY}${MM}${DD}${hh}${mm}${ss}_${Timestamp}_${RAND:6}.${EXT}"
          />
        </Form.Item>
        <Form.Item label="尺寸" style={style.formItem}>
          <Select value={size} onChange={this.sizeChange}>
            <Option value={0}>原图</Option>
            <Option value={2560}>高清</Option>
            <Option value={1920}>标准</Option>
            <Option value={1280}>省流</Option>
          </Select>
        </Form.Item>
        <Form.Item label="质量" style={style.formItem}>
          <InputNumber min={50} max={100} value={quality} onChange={this.qualityChange} />
        </Form.Item>
        <Form.Item label="提示" style={style.formItem}>
          <span>
            Public URL 用于图片访问地址，建议绑定自定义域名。
            <a href="https://developers.cloudflare.com/r2/" target="_blank" rel="noreferrer">
              Cloudfare R2 配置文档
            </a>
          </span>
          <p style={{color: "red"}}>秘钥会保存到本地浏览器，可能导致你的秘钥泄漏！</p>
        </Form.Item>
      </Form>
    );
  }
}

const style = {
  formItem: {
    marginBottom: "10px",
  },
};

export default R2;
