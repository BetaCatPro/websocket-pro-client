# WebSocket Pro Client

[![npm version](https://img.shields.io/npm/v/websocket-pro-client)](https://www.npmjs.com/package/websocket-pro-client)
[![test coverage](https://img.shields.io/badge/coverage-100%25-success)](https://github.com/BetaCatPro/websocket-pro-client/actions)

高性能 WebSocket 客户端，专为现代 Web 应用设计。

## 特性

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

client.send({ action: "subscribe" });
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

## 后续工作

1. 自定义心跳包
2. 添加更多配置项
3. 添加完整测试用例(单元测试/集成测试)
4. 完善说明 API 文档

## 许可证

MIT © 2023 BetaCatPro
