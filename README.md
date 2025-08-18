# WebSocket Pro Client

[![npm version](https://img.shields.io/npm/v/websocket-pro-client)](https://www.npmjs.com/package/websocket-pro-client)
[![test coverage](https://img.shields.io/badge/coverage-100%25-success)](https://github.com/BetaCatPro/websocket-pro-client/actions)

高性能 WebSocket 客户端，专为现代 Web 应用设计。

## 特性

### v1.0.2-Beta

- 支持自定义心跳消息
- 支持动态更新部分 websocket 配置

下个版本迭代内容：

1. 配置校验以及支持回滚
2. 完善的配置动态更新支持

### v1.0.1

- 🚀 自动重连 + 智能退避算法
- 💓 可配置心跳检测
- 🎯 消息优先级调度
- 📦 多连接池管理
- 🔍 完整的 TypeScript 支持

## 安装

```bash
npm install websocket-pro-client
# 或
yarn add websocket-pro-client
```

## 快速开始

```typescript
import { createWebSocketManager } from "websocket-pro-client";

const manager = createWebSocketManager({
  maxReconnectAttempts: 5,
});

const client = manager.connect("wss://api.example.com");

client.on("message", (data) => {
  console.log("Received:", data);
});

client.send("hello word");
```

## 开发调试

```bash
# 启动测试
npm test

# 构建库
npm run build

# 运行demo
npm run demo
```

## 贡献指南

1. Fork 仓库
2. 创建分支 (`git checkout -b dev/feature/fix-xxx`)
3. 提交更改 (`git commit -am 'feat/fix xxx'`)
4. 推送到分支 (`git push origin dev/feature/fix-xxx`)
5. 创建 Pull Request

## 许可证

MIT © 2023 BetaCatPro
