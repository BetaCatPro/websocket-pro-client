const h = {
  maxReconnectAttempts: 10,
  reconnectDelay: 1e3,
  reconnectExponent: 1.5,
  maxReconnectDelay: 3e4,
  connectionPoolSize: 5,
  maxConcurrent: 1,
  defaultPriority: 1,
  enableCompression: !1,
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse
  },
  isNeedHeartbeat: !0,
  heartbeat: {
    interval: 25e3,
    timeout: 1e4,
    message: "PING"
  }
};
class u {
  constructor() {
    this.events = {};
  }
  on(e, t) {
    return this.events[e] || (this.events[e] = []), this.events[e].push(t), () => this.off(e, t);
  }
  off(e, t) {
    this.events[e] && (this.events[e] = this.events[e].filter((i) => i !== t));
  }
  emit(e, ...t) {
    this.events[e] && this.events[e].forEach((i) => {
      try {
        i(...t);
      } catch (s) {
        console.error(`Event "${e}" listener error:`, s);
      }
    });
  }
  once(e, t) {
    const i = (...s) => {
      this.off(e, i), t(...s);
    };
    this.on(e, i);
  }
  removeAllListeners(e) {
    e ? delete this.events[e] : this.events = {};
  }
}
class f extends u {
  constructor(e = {}, t) {
    super(), this.config = e, this.sendPing = t, this.lastPongTime = 0;
  }
  start() {
    this.config || console.log("[Heartbeat] config is empty"), this.stop(), this.lastPongTime = Date.now(), this.intervalId = setInterval(() => {
      this.sendPing(), this.timeoutId = setTimeout(() => {
        this.handleDefaultTimeout(this.config.onTimeout);
      }, this.config.timeout);
    }, this.config.interval);
  }
  stop() {
    clearInterval(this.intervalId), clearTimeout(this.timeoutId);
  }
  handleDefaultTimeout(e) {
    this.stop(), e && e(), this.emit("timeout");
  }
  recordPong() {
    this.lastPongTime = Date.now(), clearTimeout(this.timeoutId), this.emit("pong", Date.now() - this.lastPongTime);
  }
  getLastPongTime() {
    return this.lastPongTime;
  }
  updateConfig(e) {
    if (!(e != null && e.isNeedHeartbeat)) {
      this.stop();
      return;
    }
    this.config = { ...this.config, ...e.heartbeat }, this.stop(), this.start();
  }
}
class g {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((i, s) => {
      const r = async () => {
        var o;
        try {
          await e(), i();
        } catch (a) {
          (o = this.onTaskError) == null || o.call(this, a), s(a);
        }
      };
      this.queue.push({ task: r, priority: t }), this.queue.sort((o, a) => a.priority - o.priority), this.run();
    });
  }
  run() {
    for (; this.runningCount < this.maxConcurrent && this.queue.length > 0; ) {
      const { task: e } = this.queue.shift();
      this.runningCount++, e().finally(() => {
        this.runningCount--, this.run();
      });
    }
  }
  clear() {
    this.queue = [];
  }
  updateThresholds(e) {
    e !== void 0 && (this.maxConcurrent = e), this.run();
  }
}
const c = (n, e) => {
  const t = { ...n };
  for (const i in e)
    e[i] instanceof Object && !Array.isArray(e[i]) ? t[i] = c(n[i] || {}, e[i]) : t[i] = e[i];
  return t;
}, l = (n, e) => {
  if (n === e)
    return !0;
  if (n == null || e == null || typeof n != "object" || typeof e != "object")
    return n === e;
  if (Array.isArray(n) && Array.isArray(e)) {
    if (n.length !== e.length)
      return !1;
    for (let s = 0; s < n.length; s++)
      if (!l(n[s], e[s]))
        return !1;
    return !0;
  }
  if (Array.isArray(n) || Array.isArray(e))
    return !1;
  const t = Object.keys(n), i = Object.keys(e);
  if (t.length !== i.length)
    return !1;
  for (const s of t)
    if (!e.hasOwnProperty(s) || !l(n[s], e[s]))
      return !1;
  return !0;
};
class m extends u {
  constructor(e, t, i) {
    super(), this.url = e, this.protocols = t, this.config = i, this.socket = null, this.reconnectAttempts = 0, this.messageQueue = [], this.isUpdatingConfig = !1, this.configQueue = [], this.currentConfig = c(h, this.config), this.initHeartbeat(), this.scheduler = new g(
      this.currentConfig.maxConcurrent,
      (s) => this.emit("error", s)
    ), this.connect();
  }
  // 初始化心跳
  initHeartbeat() {
    this.currentConfig.isNeedHeartbeat && (this.heartbeat = new f(this.currentConfig.heartbeat, () => {
      var e;
      this.send(((e = this.currentConfig.heartbeat) == null ? void 0 : e.message) || "PING");
    }), this.heartbeat.on("timeout", () => {
      var e;
      console.log("Heartbeat timeout, triggering reconnect..."), ((e = this.socket) == null ? void 0 : e.readyState) === WebSocket.OPEN && this.close(1e3, "heartbeat timeout"), this.scheduleReconnect();
    }));
  }
  connect() {
    this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      this.reconnectAttempts = 0, clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.start(), this.flushMessageQueue(), this.emit("open", e);
    }, this.socket.onmessage = (e) => {
      if (e.data === "pong") {
        this.heartbeat && this.heartbeat.recordPong();
        return;
      }
      this.emit("message", e.data);
    }, this.socket.onclose = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit("close", e);
    }, this.socket.onerror = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit("error", e), this.scheduleReconnect();
    };
  }
  sendRaw(e) {
    var t;
    ((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN && this.socket.send(e);
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.emit("overMaxReconnectAttempts");
      return;
    }
    const e = Math.min(
      this.currentConfig.reconnectDelay * Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
    ), i = e * 0.2 * (Math.random() * 2 - 1), s = Math.max(1e3, e + i);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++, this.connect();
    }, s);
  }
  flushMessageQueue() {
    for (; this.messageQueue.length > 0; ) {
      const { data: e, resolve: t, reject: i } = this.messageQueue.shift();
      this.send(e).then(t).catch(i);
    }
  }
  send(e, t = this.currentConfig.defaultPriority) {
    var i;
    return ((i = this.socket) == null ? void 0 : i.readyState) === WebSocket.OPEN ? this.scheduler.add(() => new Promise((s, r) => {
      try {
        this.sendRaw(e), s();
      } catch (o) {
        r(o);
      }
    }), t) : new Promise((s, r) => {
      this.messageQueue.push({ data: e, priority: t, resolve: s, reject: r });
    });
  }
  close(e, t) {
    var i;
    clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.stop(), (i = this.socket) == null || i.close(e, t), this.socket = null;
  }
  reconnect() {
    clearTimeout(this.reconnectTimer), this.reconnectAttempts = 0, this.close(), this.connect();
  }
  // 配置更新方法
  async updateConfig(e) {
    if (this.configQueue.push(e), !this.isUpdatingConfig) {
      for (this.isUpdatingConfig = !0; this.configQueue.length > 0; ) {
        const t = this.configQueue.shift();
        await this.applyConfigSafely(t);
      }
      this.isUpdatingConfig = !1;
    }
  }
  applyConfigSafely(e) {
    const t = { ...this.currentConfig };
    this.currentConfig = c(this.currentConfig, e), this.handleConfigChange(t, this.currentConfig), this.applyConfig();
  }
  // 处理特定配置变更
  handleConfigChange(e, t) {
    l(e.heartbeat, t.heartbeat) || this.reInitHeartbeat(), (e.maxReconnectAttempts !== t.maxReconnectAttempts || e.reconnectDelay !== t.reconnectDelay || e.reconnectExponent !== t.reconnectExponent || e.maxReconnectDelay !== t.maxReconnectDelay) && this.resetReconnectTimer();
  }
  // 应用新配置到各模块
  applyConfig() {
    var e, t;
    (e = this.heartbeat) == null || e.updateConfig(this.currentConfig), (t = this.scheduler) == null || t.updateThresholds(this.currentConfig.maxConcurrent);
  }
  reInitHeartbeat() {
    var e;
    if (!this.currentConfig.isNeedHeartbeat) {
      (e = this.heartbeat) == null || e.stop(), this.heartbeat = void 0;
      return;
    }
    this.heartbeat ? (this.heartbeat.stop(), this.heartbeat.start()) : this.initHeartbeat();
  }
  resetReconnectTimer() {
    this.reconnectTimer && (clearTimeout(this.reconnectTimer), this.scheduleReconnect());
  }
}
class d extends u {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const i = `${e}|${t.join(",")}`;
    if (this.clients.has(i))
      return this.clients.get(i);
    const s = new m(e, t, this.config);
    this.clients.set(i, s);
    const r = (o) => (a) => {
      this.emit(o, { url: e, protocols: t, data: a });
    };
    return s.on("open", r("open")), s.on("message", r("message")), s.on("close", r("close")), s.on("error", r("error")), s;
  }
  closeAll(e, t) {
    this.clients.forEach((i) => i.close(e, t)), this.clients.clear();
  }
  getClient(e, t) {
    const i = `${e}|${(t == null ? void 0 : t.join(",")) || ""}`;
    return this.clients.get(i);
  }
}
const p = (n = {}) => {
  const e = {
    ...h,
    ...n,
    serializer: {
      ...h.serializer,
      ...n.serializer
    }
  };
  return new d(e);
}, y = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, b = {
  serialize: (n) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  },
  deserialize: (n) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  }
};
export {
  u as EventEmitter,
  y as JsonSerializer,
  b as MsgPackSerializer,
  m as WebSocketClient,
  d as WebSocketManager,
  p as createWebSocketManager
};
