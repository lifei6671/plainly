#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::Manager;
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Region, primitives::ByteStream, Client};
use base64::Engine;
use hmac::{Hmac, Mac};
use httpdate::fmt_http_date;
use reqwest::header::{AUTHORIZATION, CONTENT_TYPE, DATE};
use reqwest::Url;
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use std::time::SystemTime;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct R2UploadPayload {
  account_id: String,
  access_key_id: String,
  secret_access_key: String,
  bucket: String,
  key: String,
  content_type: Option<String>,
  file_path: Option<String>,
  body_base64: Option<String>,
  body: Option<Vec<u8>>,
}

#[derive(Serialize)]
struct R2UploadResponse {
  key: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AliOssUploadPayload {
  region: String,
  access_key_id: String,
  access_key_secret: String,
  bucket: String,
  key: String,
  content_type: Option<String>,
  file_path: Option<String>,
  body_base64: Option<String>,
  body: Option<Vec<u8>>,
}

#[derive(Serialize)]
struct AliOssUploadResponse {
  key: String,
}

#[tauri::command]
async fn r2_upload(payload: R2UploadPayload) -> Result<R2UploadResponse, String> {
  let R2UploadPayload {
    account_id,
    access_key_id,
    secret_access_key,
    bucket,
    key,
    content_type,
    file_path,
    body_base64,
    body,
  } = payload;
  let file_path = file_path.and_then(|path| if path.trim().is_empty() { None } else { Some(path) });
  let body_base64_len = body_base64.as_ref().map(|value| value.len()).unwrap_or(0);
  let body_len = body.as_ref().map(|value| value.len()).unwrap_or(0);
  println!(
    "r2_upload start: key={}, file_path={}, body_base64_len={}, body_len={}",
    key,
    file_path.is_some(),
    body_base64_len,
    body_len
  );
  let body = if let Some(file_path) = file_path {
    tauri::async_runtime::spawn_blocking(move || std::fs::read(&file_path))
      .await
      .map_err(|_| "读取文件失败".to_string())?
      .map_err(|err| err.to_string())?
  } else if let Some(body_base64) = body_base64 {
    base64::engine::general_purpose::STANDARD
      .decode(body_base64.as_bytes())
      .map_err(|_| "解码图片失败".to_string())?
  } else if let Some(body) = body {
    body
  } else {
    return Err("未提供上传内容".to_string());
  };
  let endpoint = format!(
    "https://{}.r2.cloudflarestorage.com",
    account_id
  );
  let credentials = Credentials::new(
    access_key_id,
    secret_access_key,
    None,
    None,
    "r2-upload",
  );
  let config = aws_sdk_s3::Config::builder()
    .region(Region::new("auto"))
    .endpoint_url(endpoint)
    .force_path_style(true)
    .credentials_provider(credentials)
    .build();
  let client = Client::from_conf(config);

  let mut request = client
    .put_object()
    .bucket(&bucket)
    .key(&key)
    .body(ByteStream::from(body));
  if let Some(content_type) = content_type {
    if !content_type.is_empty() {
      request = request.content_type(content_type);
    }
  }
  request
    .send()
    .await
    .map_err(|err| format!("R2 上传失败: {err}"))?;

  Ok(R2UploadResponse { key })
}

#[tauri::command]
async fn alioss_upload(payload: AliOssUploadPayload) -> Result<AliOssUploadResponse, String> {
  let AliOssUploadPayload {
    region,
    access_key_id,
    access_key_secret,
    bucket,
    key,
    content_type,
    file_path,
    body_base64,
    body,
  } = payload;
  let file_path = file_path.and_then(|path| if path.trim().is_empty() { None } else { Some(path) });
  let body = if let Some(file_path) = file_path {
    tauri::async_runtime::spawn_blocking(move || std::fs::read(&file_path))
      .await
      .map_err(|_| "读取文件失败".to_string())?
      .map_err(|err| err.to_string())?
  } else if let Some(body_base64) = body_base64 {
    base64::engine::general_purpose::STANDARD
      .decode(body_base64.as_bytes())
      .map_err(|_| "解码图片失败".to_string())?
  } else if let Some(body) = body {
    body
  } else {
    return Err("未提供上传内容".to_string());
  };

  let content_type = content_type.unwrap_or_else(|| "application/octet-stream".to_string());
  let host = format!("{}.{}.aliyuncs.com", bucket, region);
  let base_url = format!("https://{}", host);
  let key_path = key.trim_start_matches('/');
  let mut url = Url::parse(&base_url).map_err(|err| err.to_string())?;
  url.set_path(&format!("/{}", key_path));

  let date = fmt_http_date(SystemTime::now());
  let canonicalized_resource = format!("/{bucket}{}", url.path());
  let string_to_sign = format!("PUT\n\n{}\n{}\n{}", content_type, date, canonicalized_resource);

  let mut mac: Hmac<Sha1> =
    Hmac::new_from_slice(access_key_secret.as_bytes()).map_err(|_| "AccessKeySecret 无效".to_string())?;
  mac.update(string_to_sign.as_bytes());
  let signature = base64::engine::general_purpose::STANDARD.encode(mac.finalize().into_bytes());
  let authorization = format!("OSS {}:{}", access_key_id, signature);

  let client = reqwest::Client::new();
  let response = client
    .put(url)
    .header(DATE, date)
    .header(CONTENT_TYPE, content_type)
    .header(AUTHORIZATION, authorization)
    .body(body)
    .send()
    .await
    .map_err(|err| format!("阿里云上传请求失败: {err}"))?;

  if !response.status().is_success() {
    let status = response.status();
    let text = response.text().await.unwrap_or_default();
    return Err(format!("阿里云上传失败: {status} {text}"));
  }

  Ok(AliOssUploadResponse { key })
}

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![r2_upload, alioss_upload])
    .setup(|app| {
      let enable_devtools = cfg!(debug_assertions)
        || matches!(
          std::env::var("TAURI_DEVTOOLS").as_deref(),
          Ok("1") | Ok("true") | Ok("TRUE")
        );
      if enable_devtools {
        if let Some(window) = app.get_window("main") {
          window.open_devtools();
        }
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
