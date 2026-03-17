const _ = {
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
  ack: {
    enabled: !0,
    timeout: 5e3,
    maxRetries: 2,
    generateId: () => {
      window.__ws_pro_client_ack_id__ || (window.__ws_pro_client_ack_id__ = 1);
      const i = window.__ws_pro_client_ack_id__;
      return window.__ws_pro_client_ack_id__ = i + 1, i;
    },
    wrapOutbound: (i, e) => ({
      id: i,
      payload: e
    }),
    extractAckId: (i) => i && typeof i == "object" && "ackId" in i ? i.ackId : null
  },
  sequence: {
    enabled: !0,
    generateSeq: () => {
      window.__ws_pro_client_seq__ || (window.__ws_pro_client_seq__ = 1);
      const i = window.__ws_pro_client_seq__;
      return window.__ws_pro_client_seq__ = i + 1, i;
    },
    wrapOutbound: (i, e) => ({
      seq: i,
      payload: e
    }),
    extractInboundSeq: (i) => i && typeof i == "object" && "seq" in i ? i.seq : null
  },
  isNeedHeartbeat: !0,
  heartbeat: {
    interval: 25e3,
    timeout: 1e4,
    message: "PING"
  }
};
var k = /* @__PURE__ */ ((i) => (i.Ping = "PING", i.Pong = "PONG", i))(k || {}), p = /* @__PURE__ */ ((i) => (i.Timeout = "timeout", i.Pong = "PONG", i))(p || {});
class P {
  constructor(e = "[WebSocketPro]") {
    this.prefix = e;
  }
  debug(...e) {
  }
  info(...e) {
    console.info(this.prefix, ...e);
  }
  warn(...e) {
    console.warn(this.prefix, ...e);
  }
  error(...e) {
    console.error(this.prefix, ...e);
  }
}
let R = new P();
const w = () => R;
class A {
  constructor() {
    this.events = {};
  }
  on(e, t) {
    return this.events[e] || (this.events[e] = []), this.events[e].push(t), () => this.off(e, t);
  }
  off(e, t) {
    this.events[e] && (this.events[e] = this.events[e].filter((n) => n !== t));
  }
  emit(e, ...t) {
    this.events[e] && this.events[e].forEach((n) => {
      try {
        n(...t);
      } catch (s) {
        w().error(`Event "${e}" listener error:`, s);
      }
    });
  }
  once(e, t) {
    const n = (...s) => {
      this.off(e, n), t(...s);
    };
    this.on(e, n);
  }
  removeAllListeners(e) {
    e ? delete this.events[e] : this.events = {};
  }
}
class E extends A {
  constructor(e = {}, t) {
    super(), this.config = e, this.sendPing = t, this.lastPongTime = 0;
  }
  start() {
    this.config || w().warn("Heartbeat config is empty"), this.stop(), this.lastPongTime = Date.now(), this.intervalId = setInterval(() => {
      this.sendPing(), this.timeoutId = setTimeout(() => {
        this.handleDefaultTimeout(this.config.onTimeout);
      }, this.config.timeout);
    }, this.config.interval);
  }
  stop() {
    clearInterval(this.intervalId), clearTimeout(this.timeoutId);
  }
  handleDefaultTimeout(e) {
    this.stop(), e && e(), this.emit(p.Timeout);
  }
  recordPong() {
    this.lastPongTime = Date.now(), clearTimeout(this.timeoutId), this.emit(p.Pong, Date.now() - this.lastPongTime);
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
class O {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((n, s) => {
      const o = async () => {
        var r;
        try {
          await e(), n();
        } catch (a) {
          (r = this.onTaskError) == null || r.call(this, a), s(a);
        }
      };
      this.queue.push({ task: o, priority: t }), this.queue.sort((r, a) => a.priority - r.priority), this.run();
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
var f = /* @__PURE__ */ ((i) => (i.Open = "open", i.Message = "message", i.Close = "close", i.Error = "error", i.Reconnect = "reconnect", i.Heartbeat = "heartbeat", i.Latency = "latency", i.OverMaxReconnectAttempts = "overMaxReconnectAttempts", i))(f || {});
const S = [
  "open",
  "message",
  "close",
  "error"
  /* Error */
], y = (i, e) => {
  const t = { ...i };
  for (const n in e) {
    const s = e[n];
    s && typeof s == "object" && !Array.isArray(s) ? t[n] = y(i[n] || {}, s) : t[n] = s;
  }
  return t;
}, b = (i, e) => {
  if (i === e)
    return !0;
  if (i == null || e == null || typeof i != "object" || typeof e != "object")
    return i === e;
  if (Array.isArray(i) && Array.isArray(e)) {
    if (i.length !== e.length)
      return !1;
    for (let s = 0; s < i.length; s++)
      if (!b(i[s], e[s]))
        return !1;
    return !0;
  }
  if (Array.isArray(i) || Array.isArray(e))
    return !1;
  const t = Object.keys(i), n = Object.keys(e);
  if (t.length !== n.length)
    return !1;
  for (const s of t)
    if (!e.hasOwnProperty(s) || !b(i[s], e[s]))
      return !1;
  return !0;
};
var d = /* @__PURE__ */ ((i) => (i.MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED", i.AckTimeout = "ACK_TIMEOUT", i.AckMaxRetries = "ACK_MAX_RETRIES", i.ClosedBeforeAck = "CLOSED_BEFORE_ACK", i))(d || {});
const M = {
  MSG_PACK_NOT_INSTALLED: "MsgPack serializer requires @msgpack/msgpack installation",
  ACK_TIMEOUT: "ACK timeout",
  ACK_MAX_RETRIES: "ACK timeout, maximum retry attempts reached",
  CLOSED_BEFORE_ACK: "WebSocket connection closed before ACK was received"
};
class m extends Error {
  constructor(e) {
    super(M[e]), this.code = e, this.name = "WebSocketClientError";
  }
}
class N extends A {
  constructor(e, t, n) {
    super(), this.url = e, this.protocols = t, this.config = n, this.socket = null, this.reconnectAttempts = 0, this.messageQueue = [], this.pendingAcks = /* @__PURE__ */ new Map(), this.isUpdatingConfig = !1, this.configQueue = [], this.currentConfig = y(_, this.config), this.initHeartbeat(), this.scheduler = new O(
      this.currentConfig.maxConcurrent,
      (s) => this.emit(f.Error, s)
    ), this.connect();
  }
  // 初始化心跳
  initHeartbeat() {
    this.currentConfig.isNeedHeartbeat && (this.heartbeat = new E(this.currentConfig.heartbeat, () => {
      var e;
      this.send(((e = this.currentConfig.heartbeat) == null ? void 0 : e.message) || "PING");
    }), this.heartbeat.on(p.Timeout, () => {
      var e;
      w().warn("Heartbeat timeout, triggering reconnect..."), ((e = this.socket) == null ? void 0 : e.readyState) === WebSocket.OPEN && this.close(1e3, "heartbeat timeout"), this.scheduleReconnect();
    }));
  }
  connect() {
    this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      this.reconnectAttempts = 0, clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.start(), this.flushMessageQueue(), this.emit(f.Open, e);
    }, this.socket.onmessage = (e) => {
      if (e.data === k.Pong) {
        this.heartbeat && this.heartbeat.recordPong();
        return;
      }
      const t = e.data;
      let n = t;
      try {
        n = this.currentConfig.serializer.deserialize(t);
      } catch {
        n = t;
      }
      const s = this.currentConfig.ack;
      if (s != null && s.enabled && typeof s.extractAckId == "function") {
        const r = s.extractAckId(n);
        if (r != null) {
          const a = this.pendingAcks.get(r);
          if (a) {
            clearTimeout(a.timer), this.pendingAcks.delete(r), a.resolve();
            return;
          }
        }
      }
      const o = this.currentConfig.sequence;
      if (o != null && o.enabled && typeof o.extractInboundSeq == "function") {
        const r = o.extractInboundSeq(n);
        r != null && (this.lastInboundSeq = r);
      }
      this.emit(f.Message, n);
    }, this.socket.onclose = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit(f.Close, e);
    }, this.socket.onerror = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit(f.Error, e), this.scheduleReconnect();
    };
  }
  sendRaw(e) {
    var t;
    ((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN && this.socket.send(e);
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.emit(f.OverMaxReconnectAttempts);
      return;
    }
    const e = Math.min(
      this.currentConfig.reconnectDelay * Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
    ), n = e * 0.2 * (Math.random() * 2 - 1), s = Math.max(1e3, e + n);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++, this.connect();
    }, s);
  }
  flushMessageQueue() {
    for (; this.messageQueue.length > 0; ) {
      const { data: e, priority: t, needAck: n, resolve: s, reject: o } = this.messageQueue.shift();
      this.sendInternal(e, t, n).then(s).catch(o);
    }
  }
  sendInternal(e, t, n) {
    var s;
    return ((s = this.socket) == null ? void 0 : s.readyState) === WebSocket.OPEN ? this.scheduler.add(() => new Promise((o, r) => {
      var a, C;
      try {
        let l = e;
        const u = this.currentConfig.sequence;
        if (u != null && u.enabled && typeof u.wrapOutbound == "function") {
          const h = (a = u.generateSeq) == null ? void 0 : a.call(u);
          h !== void 0 && (l = u.wrapOutbound(h, l));
        }
        const c = this.currentConfig.ack;
        let g = null;
        if (n && (c != null && c.enabled)) {
          const h = (C = c.generateId) == null ? void 0 : C.call(c);
          h != null && typeof c.wrapOutbound == "function" && (g = h, l = c.wrapOutbound(h, l));
        }
        const T = this.currentConfig.serializer.serialize(l);
        if (this.sendRaw(T), !n || !(c != null && c.enabled) || g === null) {
          o();
          return;
        }
        const x = c.timeout ?? 5e3, q = c.maxRetries ?? 0, I = {
          resolve: o,
          reject: (h) => r(h),
          retries: 0,
          rawData: e,
          priority: t,
          timer: setTimeout(() => {
            this.handleAckTimeout(g);
          }, x)
        };
        this.pendingAcks.set(g, I);
      } catch (l) {
        r(l);
      }
    }), t) : new Promise((o, r) => {
      this.messageQueue.push({ data: e, priority: t, needAck: n, resolve: o, reject: r });
    });
  }
  handleAckTimeout(e) {
    const t = this.currentConfig.ack, n = this.pendingAcks.get(e);
    if (!n || !(t != null && t.enabled)) {
      n && (this.pendingAcks.delete(e), n.reject(new m(d.AckTimeout)));
      return;
    }
    const s = t.timeout ?? 5e3, o = t.maxRetries ?? 0;
    n.retries < o ? (n.retries += 1, this.sendInternal(n.rawData, n.priority, !1).catch(
      n.reject
    ), n.timer = setTimeout(() => {
      this.handleAckTimeout(e);
    }, s)) : (this.pendingAcks.delete(e), n.reject(new m(d.AckMaxRetries)));
  }
  send(e, t = this.currentConfig.defaultPriority) {
    return this.sendInternal(e, t, !1);
  }
  // 发送并等待 ACK
  sendWithAck(e, t = this.currentConfig.defaultPriority) {
    return this.sendInternal(e, t, !0);
  }
  close(e, t) {
    var n;
    clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.stop(), this.pendingAcks.forEach((s, o) => {
      clearTimeout(s.timer), s.reject(new m(d.ClosedBeforeAck)), this.pendingAcks.delete(o);
    }), (n = this.socket) == null || n.close(e, t), this.socket = null;
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
    this.currentConfig = y(this.currentConfig, e), this.handleConfigChange(t, this.currentConfig), this.applyConfig();
  }
  // 处理特定配置变更
  handleConfigChange(e, t) {
    b(e.heartbeat, t.heartbeat) || this.reInitHeartbeat(), (e.maxReconnectAttempts !== t.maxReconnectAttempts || e.reconnectDelay !== t.reconnectDelay || e.reconnectExponent !== t.reconnectExponent || e.maxReconnectDelay !== t.maxReconnectDelay) && this.resetReconnectTimer();
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
class D extends A {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const n = `${e}|${t.join(",")}`;
    if (this.clients.has(n))
      return this.clients.get(n);
    const s = new N(e, t, this.config);
    this.clients.set(n, s);
    const o = (r) => (a) => {
      this.emit(r, { url: e, protocols: t, data: a });
    };
    return S.forEach((r) => {
      s.on(r, o(r));
    }), s;
  }
  closeAll(e, t) {
    this.clients.forEach((n) => n.close(e, t)), this.clients.clear();
  }
  getClient(e, t) {
    const n = `${e}|${(t == null ? void 0 : t.join(",")) || ""}`;
    return this.clients.get(n);
  }
}
const z = (i = {}) => {
  const e = {
    ..._,
    ...i,
    serializer: {
      ..._.serializer,
      ...i.serializer
    }
  };
  return new D(e);
}, j = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, v = {
  serialize: (i) => {
    throw new m(d.MsgPackNotInstalled);
  },
  deserialize: (i) => {
    throw new m(d.MsgPackNotInstalled);
  }
};
export {
  A as EventEmitter,
  p as HeartbeatEvent,
  k as HeartbeatMessage,
  j as JsonSerializer,
  v as MsgPackSerializer,
  N as WebSocketClient,
  D as WebSocketManager,
  z as createWebSocketManager
};
