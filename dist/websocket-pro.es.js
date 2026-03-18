var y = /* @__PURE__ */ ((i) => (i.Ping = "PING", i.Pong = "PONG", i))(y || {}), b = /* @__PURE__ */ ((i) => (i.Timeout = "timeout", i.Pong = "pong", i))(b || {}), m = /* @__PURE__ */ ((i) => (i.Auto = "auto", i.Main = "main", i.Worker = "worker", i))(m || {});
const k = {
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
    extractAckId: (i) => i && typeof i == "object" ? i.id : null
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
    timeout: 45e3,
    pingMessage: y.Ping,
    pongMessage: y.Pong,
    timerMode: m.Auto
  }
};
class S {
  constructor(e = "[WebSocketPro]") {
    this.prefix = e;
  }
  debug(...e) {
    var s;
    // Vite / modern bundlers may inject {"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true,"SSR":false}
    (typeof import.meta < "u" && ((s = import.meta) == null ? void 0 : s.env) && !1 || // Node / other bundlers
    typeof process < "u" && (process == null ? void 0 : process.env) && process.env.NODE_ENV !== "production") && console.debug(this.prefix, ...e);
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
let N = new S();
const T = () => N;
class P {
  constructor() {
    this.events = {};
  }
  on(e, t) {
    return this.events[e] || (this.events[e] = []), this.events[e].push(t), () => this.off(e, t);
  }
  off(e, t) {
    this.events[e] && (this.events[e] = this.events[e].filter((s) => s !== t));
  }
  emit(e, ...t) {
    this.events[e] && this.events[e].forEach((s) => {
      try {
        s(...t);
      } catch (n) {
        T().error(`Event "${e}" listener error:`, n);
      }
    });
  }
  once(e, t) {
    const s = (...n) => {
      this.off(e, s), t(...n);
    };
    this.on(e, s);
  }
  removeAllListeners(e) {
    e ? delete this.events[e] : this.events = {};
  }
}
class w {
  setTimeout(e, t) {
    return globalThis.setTimeout(e, t);
  }
  clearTimeout(e) {
    e !== void 0 && globalThis.clearTimeout(e);
  }
}
class O {
  constructor() {
    this.callbackMap = /* @__PURE__ */ new Map(), this.nextId = 1, this.isAvailable = !1, this.worker = this.createWorker(), this.isAvailable = !!this.worker;
  }
  get available() {
    return this.isAvailable;
  }
  setTimeout(e, t) {
    if (!this.worker || !this.isAvailable)
      return globalThis.setTimeout(e, t);
    const s = this.nextId++;
    this.callbackMap.set(s, e);
    try {
      this.worker.postMessage({ type: "setTimeout", id: s, delay: t });
    } catch {
      return this.markUnavailable(), globalThis.setTimeout(e, t);
    }
    return s;
  }
  clearTimeout(e) {
    if (e !== void 0) {
      if (!this.worker || !this.isAvailable) {
        globalThis.clearTimeout(e);
        return;
      }
      this.callbackMap.delete(e);
      try {
        this.worker.postMessage({ type: "clearTimeout", id: e });
      } catch {
        this.markUnavailable();
      }
    }
  }
  destroy() {
    var e;
    this.callbackMap.clear();
    try {
      (e = this.worker) == null || e.terminate();
    } catch {
    }
    this.worker = void 0, this.isAvailable = !1;
  }
  createWorker() {
    if (typeof Worker > "u" || typeof URL > "u" || typeof Blob > "u")
      return;
    const e = `
      const timers = new Map()
      self.onmessage = (e) => {
        const msg = e.data || {}
        const { type, id, delay } = msg
        if (type === 'setTimeout') {
          const t = setTimeout(() => {
            self.postMessage({ type: 'fire', id })
            timers.delete(id)
          }, delay)
          timers.set(id, t)
          return
        }
        if (type === 'clearTimeout') {
          const t = timers.get(id)
          if (t) clearTimeout(t)
          timers.delete(id)
          return
        }
      }
    `;
    try {
      const t = new Blob([e], { type: "application/javascript" }), s = URL.createObjectURL(t), n = new Worker(s);
      return URL.revokeObjectURL(s), n.onmessage = (r) => {
        const o = r.data || {};
        if (o.type !== "fire")
          return;
        const a = this.callbackMap.get(o.id);
        a && (this.callbackMap.delete(o.id), a());
      }, n.onerror = () => {
        this.markUnavailable();
      }, n;
    } catch {
      return;
    }
  }
  markUnavailable() {
    this.isAvailable = !1;
    const e = this.worker;
    this.worker = void 0;
    try {
      e == null || e.terminate();
    } catch {
      T().error("Heartbeat worker error");
    }
  }
}
function R(i) {
  const e = i.timerMode ?? m.Auto;
  if (e === m.Main)
    return new w();
  const t = new O();
  return e === m.Worker && !t.available ? (T().warn("Heartbeat worker timer unavailable, fallback to main"), t.destroy(), new w()) : e === m.Auto && !t.available ? (t.destroy(), new w()) : t;
}
class I extends P {
  constructor(e = {}, t) {
    super(), this.config = e, this.sendPing = t, this.lastPongTime = 0, this.lastPingTime = 0, this.expectedNextPingAt = 0, this.isRunning = !1, this.timer = R(this.config);
  }
  start() {
    this.config || T().warn("Heartbeat config is empty"), this.stop(), this.isRunning = !0;
    const e = Date.now();
    this.lastPongTime = e, this.lastPingTime = 0, this.expectedNextPingAt = e + (this.config.interval ?? 0), this.schedulePongTimeoutCheck(), this.scheduleNextPing();
  }
  stop() {
    this.isRunning = !1, this.timer.clearTimeout(this.pingTimer), this.timer.clearTimeout(this.pongTimeoutTimer);
  }
  handleDefaultTimeout(e) {
    this.stop(), e && e(), this.emit(b.Timeout);
  }
  recordPong() {
    const e = Date.now(), t = this.lastPingTime ? e - this.lastPingTime : 0;
    this.lastPongTime = e, this.timer.clearTimeout(this.pongTimeoutTimer), this.emit(b.Pong, t), this.schedulePongTimeoutCheck();
  }
  getLastPongTime() {
    return this.lastPongTime;
  }
  /**
   * 基于真实时间差做一次超时校验（用于从后台切回前台等场景）
   * @returns true 表示已超时
   */
  checkTimeout() {
    if (!this.isRunning)
      return !1;
    const e = this.config.timeout ?? 0;
    return e ? Date.now() - this.lastPongTime > e : !1;
  }
  updateConfig(e) {
    var t, s, n, r;
    if (!(e != null && e.isNeedHeartbeat)) {
      this.stop(), (s = (t = this.timer).destroy) == null || s.call(t);
      return;
    }
    this.config = { ...this.config, ...e.heartbeat }, (r = (n = this.timer).destroy) == null || r.call(n), this.timer = R(this.config), this.stop(), this.start();
  }
  scheduleNextPing() {
    if (!this.isRunning)
      return;
    const e = this.config.interval ?? 0, t = Date.now();
    (this.expectedNextPingAt <= 0 || t - this.expectedNextPingAt > e) && (this.expectedNextPingAt = t + e);
    const s = Math.max(0, this.expectedNextPingAt - t);
    this.timer.clearTimeout(this.pingTimer), this.pingTimer = this.timer.setTimeout(() => {
      this.isRunning && (this.lastPingTime = Date.now(), this.sendPing(), this.expectedNextPingAt = this.expectedNextPingAt + e, this.scheduleNextPing());
    }, s);
  }
  /**
   * 超时检测应以 lastPongTime 为基准：
   * - interval 可能小于 timeout，不能在每次 ping 时重置 timeout，否则会导致永不超时
   * - 这里只在 start/recordPong 时重置检测定时器
   */
  schedulePongTimeoutCheck() {
    if (!this.isRunning)
      return;
    const e = this.config.timeout ?? 0;
    if (e <= 0)
      return;
    this.timer.clearTimeout(this.pongTimeoutTimer);
    const t = this.lastPongTime + e, s = Math.max(0, t - Date.now());
    this.pongTimeoutTimer = this.timer.setTimeout(() => {
      if (this.isRunning) {
        if (this.checkTimeout()) {
          this.handleDefaultTimeout(this.config.onTimeout);
          return;
        }
        this.schedulePongTimeoutCheck();
      }
    }, s);
  }
}
class D {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((s, n) => {
      const r = async () => {
        var o;
        try {
          await e(), s();
        } catch (a) {
          (o = this.onTaskError) == null || o.call(this, a), n(a);
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
var f = /* @__PURE__ */ ((i) => (i.Open = "open", i.Message = "message", i.Close = "close", i.Error = "error", i.Reconnect = "reconnect", i.Heartbeat = "heartbeat", i.Latency = "latency", i.OverMaxReconnectAttempts = "overMaxReconnectAttempts", i))(f || {});
const q = [
  "open",
  "message",
  "close",
  "error",
  "heartbeat"
  /* Heartbeat */
], _ = (i, e) => {
  const t = { ...i };
  for (const s in e) {
    const n = e[s];
    n && typeof n == "object" && !Array.isArray(n) ? t[s] = _(i[s] || {}, n) : t[s] = n;
  }
  return t;
}, A = (i, e) => {
  if (i === e)
    return !0;
  if (i == null || e == null || typeof i != "object" || typeof e != "object")
    return i === e;
  if (Array.isArray(i) && Array.isArray(e)) {
    if (i.length !== e.length)
      return !1;
    for (let n = 0; n < i.length; n++)
      if (!A(i[n], e[n]))
        return !1;
    return !0;
  }
  if (Array.isArray(i) || Array.isArray(e))
    return !1;
  const t = Object.keys(i), s = Object.keys(e);
  if (t.length !== s.length)
    return !1;
  for (const n of t)
    if (!e.hasOwnProperty(n) || !A(i[n], e[n]))
      return !1;
  return !0;
};
var g = /* @__PURE__ */ ((i) => (i.MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED", i.AckTimeout = "ACK_TIMEOUT", i.AckMaxRetries = "ACK_MAX_RETRIES", i.ClosedBeforeAck = "CLOSED_BEFORE_ACK", i))(g || {});
const z = {
  MSG_PACK_NOT_INSTALLED: "MsgPack serializer requires @msgpack/msgpack installation",
  ACK_TIMEOUT: "ACK timeout",
  ACK_MAX_RETRIES: "ACK timeout, maximum retry attempts reached",
  CLOSED_BEFORE_ACK: "WebSocket connection closed before ACK was received"
};
class p extends Error {
  constructor(e) {
    super(z[e]), this.code = e, this.name = "WebSocketClientError";
  }
}
class L extends P {
  constructor(e, t, s) {
    super(), this.url = e, this.protocols = t, this.config = s, this.socket = null, this.reconnectAttempts = 0, this.messageQueue = [], this.pendingAcks = /* @__PURE__ */ new Map(), this.isUpdatingConfig = !1, this.configQueue = [], this.currentConfig = _(k, this.config), this.initHeartbeat(), this.scheduler = new D(
      this.currentConfig.maxConcurrent,
      (n) => this.emit(f.Error, n)
    ), this.connect();
  }
  // 初始化心跳
  initHeartbeat() {
    this.currentConfig.isNeedHeartbeat && (this.heartbeat = new I(this.currentConfig.heartbeat, () => {
      const e = this.currentConfig.heartbeat, t = typeof (e == null ? void 0 : e.getPing) == "function" ? e.getPing() : (e == null ? void 0 : e.pingMessage) ?? y.Ping;
      this.sendHeartbeat(t);
    }), this.heartbeat.on(b.Timeout, () => {
      var e;
      T().warn("Heartbeat timeout, triggering reconnect..."), ((e = this.socket) == null ? void 0 : e.readyState) === WebSocket.OPEN && this.close(1e3, "heartbeat timeout"), this.scheduleReconnect();
    }), this.heartbeat.on(b.Pong, (e) => {
      this.emit(f.Heartbeat, e);
    }));
  }
  connect() {
    this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      this.reconnectAttempts = 0, clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.start(), this.flushMessageQueue(), this.emit(f.Open, e);
    }, this.socket.onmessage = (e) => {
      const t = e.data;
      let s = t;
      try {
        s = this.currentConfig.serializer.deserialize(t);
      } catch {
        s = t;
      }
      const n = this.currentConfig.heartbeat;
      if (typeof (n == null ? void 0 : n.isPong) == "function" ? n.isPong(t, s) : (n == null ? void 0 : n.pongMessage) !== void 0 && (t === n.pongMessage || s === n.pongMessage)) {
        this.heartbeat && this.heartbeat.recordPong();
        return;
      }
      const o = this.currentConfig.ack;
      if (o != null && o.enabled && typeof o.extractAckId == "function") {
        const c = o.extractAckId(s);
        if (c != null) {
          const d = this.pendingAcks.get(c);
          if (d) {
            clearTimeout(d.timer), this.pendingAcks.delete(c), d.resolve();
            return;
          }
        }
      }
      const a = this.currentConfig.sequence;
      if (a != null && a.enabled && typeof a.extractInboundSeq == "function") {
        const c = a.extractInboundSeq(s);
        c != null && (this.lastInboundSeq = c);
      }
      this.emit(f.Message, s);
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
  /**
   * 心跳专用发送通道：
   * - 绕过 TaskScheduler（不占用并发槽位）
   * - 不参与 ACK / 序列号包装（保持尽可能轻量）
   */
  sendHeartbeat(e) {
    var t;
    if (((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN)
      try {
        const s = this.currentConfig.serializer.serialize(e);
        this.sendRaw(s);
      } catch (s) {
        this.emit(f.Error, s);
      }
  }
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.emit(f.OverMaxReconnectAttempts);
      return;
    }
    const e = Math.min(
      this.currentConfig.reconnectDelay * Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
    ), s = e * 0.2 * (Math.random() * 2 - 1), n = Math.max(1e3, e + s);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++, this.connect();
    }, n);
  }
  flushMessageQueue() {
    for (; this.messageQueue.length > 0; ) {
      const { data: e, priority: t, needAck: s, resolve: n, reject: r } = this.messageQueue.shift();
      this.sendInternal(e, t, s).then(n).catch(r);
    }
  }
  sendInternal(e, t, s) {
    var n;
    if (((n = this.socket) == null ? void 0 : n.readyState) === WebSocket.OPEN) {
      const r = this.currentConfig.ack;
      let o = null, a, c;
      const d = s ? new Promise((u, h) => {
        a = u, c = h;
      }) : void 0, x = this.scheduler.add(async () => {
        var C, M;
        let u = e;
        const h = this.currentConfig.sequence;
        if (h != null && h.enabled && typeof h.wrapOutbound == "function") {
          const l = (C = h.generateSeq) == null ? void 0 : C.call(h);
          l !== void 0 && (u = h.wrapOutbound(l, u));
        }
        if (s && (r != null && r.enabled)) {
          const l = (M = r.generateId) == null ? void 0 : M.call(r);
          l != null && typeof r.wrapOutbound == "function" && (o = l, u = r.wrapOutbound(l, u));
        }
        const v = this.currentConfig.serializer.serialize(u);
        if (this.sendRaw(v), !s || !(r != null && r.enabled) || o === null)
          return;
        const E = r.timeout ?? 5e3;
        this.pendingAcks.set(o, {
          resolve: () => a == null ? void 0 : a(),
          reject: (l) => c == null ? void 0 : c(l),
          retries: 0,
          rawData: e,
          priority: t,
          timer: setTimeout(() => {
            this.handleAckTimeout(o);
          }, E)
        });
      }, t);
      return s ? x.catch((u) => {
        if (o !== null) {
          const h = this.pendingAcks.get(o);
          h && (clearTimeout(h.timer), this.pendingAcks.delete(o));
        }
        throw c == null || c(u), u;
      }).then(() => {
        if (!(!(r != null && r.enabled) || o === null || !d))
          return d;
      }) : x;
    }
    return new Promise((r, o) => {
      this.messageQueue.push({ data: e, priority: t, needAck: s, resolve: r, reject: o });
    });
  }
  handleAckTimeout(e) {
    const t = this.currentConfig.ack, s = this.pendingAcks.get(e);
    if (!s || !(t != null && t.enabled)) {
      s && (this.pendingAcks.delete(e), s.reject(new p(g.AckTimeout)));
      return;
    }
    const n = t.timeout ?? 5e3, r = t.maxRetries ?? 0;
    s.retries < r ? (s.retries += 1, this.sendInternal(s.rawData, s.priority, !1).catch(
      s.reject
    ), s.timer = setTimeout(() => {
      this.handleAckTimeout(e);
    }, n)) : (this.pendingAcks.delete(e), s.reject(new p(g.AckMaxRetries)));
  }
  send(e, t = this.currentConfig.defaultPriority) {
    return this.sendInternal(e, t, !1);
  }
  // 发送并等待 ACK
  sendWithAck(e, t = this.currentConfig.defaultPriority) {
    return this.sendInternal(e, t, !0);
  }
  getLastInboundSeq() {
    return this.lastInboundSeq;
  }
  updateLastInboundSeq(e) {
    this.lastInboundSeq = e;
  }
  close(e, t) {
    var s;
    clearTimeout(this.reconnectTimer), this.heartbeat && this.heartbeat.stop(), this.pendingAcks.forEach((n, r) => {
      clearTimeout(n.timer), n.reject(new p(g.ClosedBeforeAck)), this.pendingAcks.delete(r);
    }), (s = this.socket) == null || s.close(e, t), this.socket = null;
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
    this.currentConfig = _(this.currentConfig, e), this.handleConfigChange(t, this.currentConfig), this.applyConfig();
  }
  // 处理特定配置变更
  handleConfigChange(e, t) {
    A(e.heartbeat, t.heartbeat) || this.reInitHeartbeat(), (e.maxReconnectAttempts !== t.maxReconnectAttempts || e.reconnectDelay !== t.reconnectDelay || e.reconnectExponent !== t.reconnectExponent || e.maxReconnectDelay !== t.maxReconnectDelay) && this.resetReconnectTimer();
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
class j extends P {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const s = `${e}|${t.join(",")}`;
    if (this.clients.has(s))
      return this.clients.get(s);
    const n = new L(e, t, this.config);
    this.clients.set(s, n);
    const r = (o) => (a) => {
      this.emit(o, { url: e, protocols: t, data: a });
    };
    return q.forEach((o) => {
      n.on(o, r(o));
    }), n;
  }
  closeAll(e, t) {
    this.clients.forEach((s) => s.close(e, t)), this.clients.clear();
  }
  getClient(e, t) {
    const s = `${e}|${(t == null ? void 0 : t.join(",")) || ""}`;
    return this.clients.get(s);
  }
}
const U = (i = {}) => {
  const e = {
    ...k,
    ...i,
    serializer: {
      ...k.serializer,
      ...i.serializer
    }
  };
  return new j(e);
}, H = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, K = {
  serialize: (i) => {
    throw new p(g.MsgPackNotInstalled);
  },
  deserialize: (i) => {
    throw new p(g.MsgPackNotInstalled);
  }
};
export {
  P as EventEmitter,
  b as HeartbeatEvent,
  y as HeartbeatMessage,
  m as HeartbeatTimerMode,
  H as JsonSerializer,
  K as MsgPackSerializer,
  L as WebSocketClient,
  j as WebSocketManager,
  U as createWebSocketManager
};
