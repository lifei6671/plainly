import React, {Component} from "react";
import {Input, Form} from "antd";
import {SM_MS_TOKEN} from "../../utils/constant";
import {getConfigSync, setConfigSync} from "../../utils/configStore";

type SmmsState = {
  token: string;
};

const formItemLayout = {
  labelCol: {
    xs: {span: 6},
  },
  wrapperCol: {
    xs: {span: 16},
  },
};

class Smms extends Component {
  state: SmmsState = {
    token: String(getConfigSync(SM_MS_TOKEN, "") || ""),
  };

  tokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const token = e.target.value;
    this.setState({token});
    setConfigSync(SM_MS_TOKEN, token);
  };

  render() {
    return (
      <Form {...formItemLayout}>
        <Form.Item label="Token" style={style.formItem}>
          <Input.Password value={this.state.token} onChange={this.tokenChange} placeholder="从 SM.MS 后台获取" />
        </Form.Item>
        <Form.Item label="提示" style={style.formItem}>
          <span>保存后请在右上角切换到 SM.MS 图床。</span>
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

export default Smms;
