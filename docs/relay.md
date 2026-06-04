# Relay - 缩短互联网信息排泄链

## 一句话介绍

把海外互联网发现的内容，一键分享到中文互联网。

用户在 X、Reddit、YouTube、网页等平台看到有价值的内容，点击插件按钮，即可自动生成素材并填充到小红书、知乎、微博、公众号等中文平台发布页。

---

# 项目背景

中文互联网存在一个经典梗图：

海外互联网：

* X
* Reddit
* YouTube
* ChatGPT

↓

经过层层搬运

↓

中文互联网：

* B站
* 微博
* 知乎
* 微信
* 小红书

这个过程被戏称为：

> 互联网信息排泄链

我们的目标：

> 缩短互联网信息排泄链。

---

# 产品定位

不是：

* AI运营工具
* 内容矩阵系统
* 自动营销机器人

而是：

> 分享工具（Share Tool）

类似：

* Notion Web Clipper
* Pocket
* Instapaper

只不过目标不是收藏，而是发布到中文社区。

---

# 核心场景

用户每天刷：

* X
* Reddit
* YouTube

发现有价值内容。

目前流程：

发现内容
↓
截图
↓
保存图片
↓
打开小红书
↓
上传图片
↓
填写标题
↓
发布

大约需要：

3~5分钟

Relay流程：

发现内容
↓
点击「Share」
↓
自动打开目标平台
↓
自动上传
↓
自动填充
↓
发布

10秒完成

---

# MVP范围

第一版只做：

X
↓
小红书

---

# MVP流程

用户浏览X

↓

点击：

Share to XHS

↓

插件自动：

1. 截取当前 Tweet
2. 裁剪为图片
3. 保存到本地
4. 打开小红书发布页
5. 自动上传图片
6. 自动填写标题
7. 自动填写正文

↓

用户手动点击发布

---

# MVP不做什么

暂时不做：

* AI改写
* 自动翻译
* 自动发布
* 多账号
* 定时发布
* 内容管理后台
* 数据分析
* SaaS系统

---

# 技术架构

Chrome Extension

技术栈：

* WXT
* React
* TypeScript
* Manifest V3

结构：

entrypoints/x.content.ts
↓
background
↓
storage
↓
entrypoints/xhs.content.ts

---

# 实现逻辑

## X页面

PopUp 显示一个按钮

Share to XHS

点击后：

获取当前Tweet

记录：

* URL
* 文本
* 图片
* Tweet区域位置

---

## 截图

使用：

chrome.tabs.captureVisibleTab()

截图当前页面

根据Tweet位置：

boundingClientRect

裁剪出Tweet区域

生成：

tweet.png

---

## 数据存储

使用：

chrome.storage.local

保存：

{
image,
title,
content,
sourceUrl
}

---

## 小红书页面

自动打开：

creator.xiaohongshu.com

检测发布页

自动：

* 上传图片
* 填标题
* 填正文
* 可在 Popup 设置是否把作者名/handle 追加到正文

最终由用户手动发布

---

# 后续扩展路线

V1

X
↓
小红书

V1.5

Reddit
↓
小红书

YouTube
↓
小红书

网页
↓
小红书

---

V2

X
↓
知乎

X
↓
微博

X
↓
公众号

---

V3

Any Website
↓
Any Chinese Platform

---

# 商业模式

## 第一阶段

买断制

价格：

¥29

永久授权

---

免费版

每天：

3次

---

Pro版

无限制

---

# 支付方案

初期：

ZPAY

流程：

支付
↓
Webhook
↓
生成License
↓
发送邮箱
↓
激活插件

技术：

* ZPAY
* Supabase
* Resend

---

# 用户画像

核心用户：

1. AI博主

天天看：

* OpenAI
* Anthropic
* Karpathy

需要同步到小红书

---

2. 出海开发者

天天看：

* X
* Reddit
* HackerNews

需要同步到中文社区

---

3. 科技内容创作者

需要快速搬运海外信息

---

# 品牌方向

产品名称候选：

* Relay
* RelayCN
* Port
* Porter
* CrossPostCN

当前推荐：

Relay

---

# Slogan

缩短互联网信息排泄链

或者：

把海外互联网内容一键分享到中文社区

---

# Logo方向

风格：

* 手绘
* Meme
* 互联网梗

不要：

* AI风
* 科技渐变
* SaaS企业风

Logo元素：

X → ~~~~~ → 小红书

用一条手绘的「信息管道」作为核心视觉。

让用户一眼联想到：

互联网信息排泄链。

---

# 核心价值

Relay不是一个复杂的SaaS。

它只是把：

发现内容
↓
发布内容

这个动作从3分钟缩短到10秒。

这是一个简单但高频的效率工具。

产品本质：

Share Tool > Marketing Tool

用户买的不是技术。

用户买的是：

省时间。
