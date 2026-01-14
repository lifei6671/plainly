import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Input, Form} from "antd";
import {ALIOSS_IMAGE_HOSTING} from "../../utils/constant";

const formItemLayout = {
  labelCol: {
    xs: {span: 6},
  },
  wrapperCol: {
    xs: {span: 16},
  },
};

@inject("imageHosting")
@observer
class AliOSS extends Component {
  constructor(props) {
    super(props);
    // 从localstorage里面读取
    const imageHosting = JSON.parse(localStorage.getItem(ALIOSS_IMAGE_HOSTING));
    this.state = {
      imageHosting,
    };
  }

  regionChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.region = e.target.value;
    this.setState({imageHosting});
    localStorage.setItem(ALIOSS_IMAGE_HOSTING, JSON.stringify(imageHosting));
  };

  accessKeyIdChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.accessKeyId = e.target.value;
    this.setState({imageHosting});
    localStorage.setItem(ALIOSS_IMAGE_HOSTING, JSON.stringify(imageHosting));
  };

  accessKeySecretChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.accessKeySecret = e.target.value;
    this.setState({imageHosting});
    localStorage.setItem(ALIOSS_IMAGE_HOSTING, JSON.stringify(imageHosting));
  };

  bucketChange = (e) => {
    const {imageHosting} = this.state;
    imageHosting.bucket = e.target.value;
    this.setState({imageHosting});
    localStorage.setItem(ALIOSS_IMAGE_HOSTING, JSON.stringify(imageHosting));
  };

  render() {
    const {region, accessKeyId, accessKeySecret, bucket} = this.state.imageHosting;
    return (
      <Form {...formItemLayout}>
        <Form.Item label="Bucket" style={style.formItem}>
          <Input value={bucket} onChange={this.bucketChange} placeholder="例如：my-wechat" />
        </Form.Item>
        <Form.Item label="Region" style={style.formItem}>
          <Input value={region} onChange={this.regionChange} placeholder="例如：oss-cn-hangzhou" />
        </Form.Item>
        <Form.Item label="AccessKey ID" style={style.formItem}>
          <Input value={accessKeyId} onChange={this.accessKeyIdChange} placeholder="例如：qweASDF1234zxcvb" />
        </Form.Item>
        <Form.Item label="AccessKey Secret" style={style.formItem}>
          <Input
            value={accessKeySecret}
            onChange={this.accessKeySecretChange}
            placeholder="例如：qweASDF1234zxcvbqweASD"
          />
        </Form.Item>
        <Form.Item label="提示" style={style.formItem}>
          <span>配置后请在右上角进行切换，</span>
          <a
            rel="noopener noreferrer"
            target="_blank"
            href="https://help.aliyun.com/zh/oss/user-guide/obtain-signature-information-from-the-server-and-upload-data-to-oss?spm=a2c4g.11186623.help-menu-31815.d_0_3_2_0_0.788b2e966z1KCw&scm=20140722.H_31926._.OR_help-T_cn~zh-V_1"
          >
            阿里云图床配置文档
          </a>
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

export default AliOSS;
