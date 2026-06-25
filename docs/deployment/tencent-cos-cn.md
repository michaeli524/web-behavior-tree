# 腾讯云 COS 国内展示版部署

当前推荐流程：

```text
push showcase -> GitHub Actions -> build:showcase:cn -> 上传 COS -> mikolee.cn
```

GitHub Secrets 需要配置：

| 名称 | 内容 |
| --- | --- |
| `TENCENT_CLOUD_SECRET_ID` | 腾讯云访问密钥 ID |
| `TENCENT_CLOUD_SECRET_KEY` | 腾讯云访问密钥 Key |
| `COS_BUCKET` | `mikolee-web-behavior-tree-1321311126` |
| `COS_REGION` | `ap-shanghai` |

本地只准备上传包：

```bash
npm run prepare:cos:cn
```

输出目录：

```text
deploy/cos-cn
```

之前访问网页变成下载，是因为 COS 上的 `index.html` 被设置了 `Content-Disposition: attachment`。
自动部署会重新上传 `index.html`，并明确设置为 `text/html`。
