# FRAMEFORGE 私有电影分镜制作系统

首个可用版本支持电影、TVC、MG、3D 与纪录片项目；所有业务数据、媒体代理、日志与下载包保存在公司内网服务器，外网 VPS 仅承担 HTTPS 入口与无缓存转发。

## 已实现

- 项目创建与参数：制作类型、画幅、帧率、目标片长、默认起始时码 `01:00:00:00`
- 分镜板与执行表双视图，镜头新增、删除、拖动排序、批量保存
- 旁白按文字量、标点停顿与目标片长自动分配时长，支持单镜锁定与手动修改
- `.xlsx`、`.csv`、`.tsv` 上传与常见中英文字段自动识别
- 图片在浏览器压缩为最长边 2560px、WebP 0.88；视频在支持的 Chromium 浏览器压缩为 1080p 内 WebM
- 匿名永久只读链接，可查看和下载 ZIP；后台可随时撤销
- SQLite WAL、PBKDF2 密码、服务端会话、CSRF、防登录暴力尝试与审计日志
- AI 功能当前关闭；后续 Provider API 位于内网数据层扩展，不改变外网入口架构

## 数据边界

- 应用：`/mnt/Media2/Apps/storyboard/app`
- 数据库与媒体：`/mnt/Media2/Apps/storyboard/data`
- 机密配置：`/mnt/Media2/Apps/storyboard/config/storyboard.env`
- 隧道密钥：`/mnt/Media2/Apps/storyboard/tunnel`
- 内网地址：`http://192.168.13.5:18765`
- 外网只经反向 SSH 隧道到 VPS `127.0.0.1:18766`，不写业务文件

## 本地测试

运行 `python -m unittest discover -s tests -v`。生产部署由 systemd 管理，并使用 Caddy 校验后热加载。
