var u = /* @__PURE__ */ ((s) => (s.Open = "open", s.Message = "message", s.Close = "close", s.Error = "error", s.Reconnect = "reconnect", s.Heartbeat = "heartbeat", s.Latency = "latency", s.OverMaxReconnectAttempts = "overMaxReconnectAttempts", s))(u || {});
const I = [
  "open",
  "message",
  "close",
  "error",
  "reconnect",
  "heartbeat",
  "latency",
  "overMaxReconnectAttempts"
  /* OverMaxReconnectAttempts */
];
var y = /* @__PURE__ */ ((s) => (s.DropOldest = "dropOldest", s.DropNewest = "dropNewest", s.Reject = "reject", s))(y || {}), p = /* @__PURE__ */ ((s) => (s.Connecting = "connecting", s.Open = "open", s.Reconnecting = "reconnecting", s.Closed = "closed", s.OverMaxReconnectAttempts = "overMaxReconnectAttempts", s))(p || {}), A = /* @__PURE__ */ ((s) => (s.Ping = "PING", s.Pong = "PONG", s))(A || {}), w = /* @__PURE__ */ ((s) => (s.Timeout = "timeout", s.Pong = "pong", s))(w || {}), b = /* @__PURE__ */ ((s) => (s.Auto = "auto", s.Main = "main", s.Worker = "worker", s))(b || {});
const O = {
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
      const s = window.__ws_pro_client_ack_id__;
      return window.__ws_pro_client_ack_id__ = s + 1, s;
    },
    wrapOutbound: (s, e) => ({
      id: s,
      payload: e
    }),
    extractAckId: (s) => s && typeof s == "object" && "ackId" in s ? s.ackId : null
  },
  sequence: {
    enabled: !0,
    generateSeq: () => {
      window.__ws_pro_client_seq__ || (window.__ws_pro_client_seq__ = 1);
      const s = window.__ws_pro_client_seq__;
      return window.__ws_pro_client_seq__ = s + 1, s;
    },
    wrapOutbound: (s, e) => ({
      seq: s,
      payload: e
    }),
    extractInboundSeq: (s) => s && typeof s == "object" && "seq" in s ? s.seq : null
  },
  subscription: {
    extractTopic: (s) => s && typeof s == "object" && "topic" in s && typeof s.topic == "string" ? s.topic : null,
    autoResubscribe: !0
  },
  offlineQueue: {
    enabled: !0,
    maxQueueSize: 1e3,
    dropStrategy: y.DropOldest,
    messageTTL: void 0
  },
  isNeedHeartbeat: !0,
  heartbeat: {
    interval: 25e3,
    timeout: 45e3,
    pingMessage: A.Ping,
    pongMessage: A.Pong,
    timerMode: b.Auto
  }
};
class N {
  constructor(e = "[WebSocketPro]") {
    this.prefix = e;
  }
  debug(...e) {
    var i;
    // Vite / modern bundlers may inject {"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true,"SSR":false}
    (typeof import.meta < "u" && ((i = import.meta) == null ? void 0 : i.env) && !1 || // Node / other bundlers
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
let D = new N();
const C = () => D;
class R {
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
      } catch (n) {
        C().error(`Event "${e}" listener error:`, n);
      }
    });
  }
  once(e, t) {
    const i = (...n) => {
      this.off(e, i), t(...n);
    };
    this.on(e, i);
  }
  removeAllListeners(e) {
    e ? delete this.events[e] : this.events = {};
  }
}
class _ {
  setTimeout(e, t) {
    return globalThis.setTimeout(e, t);
  }
  clearTimeout(e) {
    e !== void 0 && globalThis.clearTimeout(e);
  }
}
class Q {
  constructor() {
    this.callbackMap = /* @__PURE__ */ new Map(), this.nextId = 1, this.isAvailable = !1, this.worker = this.createWorker(), this.isAvailable = !!this.worker;
  }
  get available() {
    return this.isAvailable;
  }
  setTimeout(e, t) {
    if (!this.worker || !this.isAvailable)
      return globalThis.setTimeout(e, t);
    const i = this.nextId++;
    this.callbackMap.set(i, e);
    try {
      this.worker.postMessage({ type: "setTimeout", id: i, delay: t });
    } catch {
      return this.markUnavailable(), globalThis.setTimeout(e, t);
    }
    return i;
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
      const t = new Blob([e], { type: "application/javascript" }), i = URL.createObjectURL(t), n = new Worker(i);
      return URL.revokeObjectURL(i), n.onmessage = (r) => {
        const o = r.data || {};
        if (o.type !== "fire")
          return;
        const c = this.callbackMap.get(o.id);
        c && (this.callbackMap.delete(o.id), c());
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
      C().error("Heartbeat worker error");
    }
  }
}
function M(s) {
  const e = s.timerMode ?? b.Auto;
  if (e === b.Main)
    return new _();
  const t = new Q();
  return e === b.Worker && !t.available ? (C().warn("Heartbeat worker timer unavailable, fallback to main"), t.destroy(), new _()) : e === b.Auto && !t.available ? (t.destroy(), new _()) : t;
}
class q extends R {
  constructor(e = {}, t) {
    super(), this.config = e, this.sendPing = t, this.lastPongTime = 0, this.lastPingTime = 0, this.expectedNextPingAt = 0, this.isRunning = !1, this.timer = M(this.config);
  }
  start() {
    this.config || C().warn("Heartbeat config is empty"), this.stop(), this.isRunning = !0;
    const e = Date.now();
    this.lastPongTime = e, this.lastPingTime = 0, this.expectedNextPingAt = e + (this.config.interval ?? 0), this.schedulePongTimeoutCheck(), this.scheduleNextPing();
  }
  stop() {
    this.isRunning = !1, this.timer.clearTimeout(this.pingTimer), this.timer.clearTimeout(this.pongTimeoutTimer);
  }
  handleDefaultTimeout(e) {
    this.stop(), e && e(), this.emit(w.Timeout);
  }
  recordPong() {
    const e = Date.now(), t = this.lastPingTime ? e - this.lastPingTime : 0;
    this.lastPongTime = e, this.timer.clearTimeout(this.pongTimeoutTimer), this.emit(w.Pong, t), this.schedulePongTimeoutCheck();
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
    var t, i, n, r;
    if (!(e != null && e.isNeedHeartbeat)) {
      this.stop(), (i = (t = this.timer).destroy) == null || i.call(t);
      return;
    }
    this.config = { ...this.config, ...e.heartbeat }, (r = (n = this.timer).destroy) == null || r.call(n), this.timer = M(this.config), this.stop(), this.start();
  }
  scheduleNextPing() {
    if (!this.isRunning)
      return;
    const e = this.config.interval ?? 0, t = Date.now();
    (this.expectedNextPingAt <= 0 || t - this.expectedNextPingAt > e) && (this.expectedNextPingAt = t + e);
    const i = Math.max(0, this.expectedNextPingAt - t);
    this.timer.clearTimeout(this.pingTimer), this.pingTimer = this.timer.setTimeout(() => {
      this.isRunning && (this.lastPingTime = Date.now(), this.sendPing(), this.expectedNextPingAt = this.expectedNextPingAt + e, this.scheduleNextPing());
    }, i);
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
    const t = this.lastPongTime + e, i = Math.max(0, t - Date.now());
    this.pongTimeoutTimer = this.timer.setTimeout(() => {
      if (this.isRunning) {
        if (this.checkTimeout()) {
          this.handleDefaultTimeout(this.config.onTimeout);
          return;
        }
        this.schedulePongTimeoutCheck();
      }
    }, i);
  }
}
class j {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((i, n) => {
      const r = async () => {
        var o;
        try {
          await e(), i();
        } catch (c) {
          (o = this.onTaskError) == null || o.call(this, c), n(c);
        }
      };
      this.queue.push({ task: r, priority: t }), this.queue.sort((o, c) => c.priority - o.priority), this.run();
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
const P = /* @__PURE__ */ new Map();
function z(s, e) {
  if (s === e)
    return !0;
  if (!(s.includes("*") || s.includes("?") || s.includes("{")))
    return !1;
  const i = P.get(s);
  if (i)
    return i.test(e);
  const n = U(s), r = new RegExp(n);
  return P.set(s, r), r.test(e);
}
function U(s) {
  const e = (i) => "\\^$+?.()|[\\]{}".includes(i) ? `\\${i}` : i, t = (i) => {
    let n = "";
    for (let r = 0; r < i.length; r += 1) {
      const o = i[r];
      if (o === "*") {
        n += ".*";
        continue;
      }
      if (o === "?") {
        n += ".";
        continue;
      }
      if (o === "{") {
        const { content: c, endIndex: a } = F(i, r), T = H(c).map((l) => t(l)).join("|");
        n += `(?:${T})`, r = a;
        continue;
      }
      n += e(o);
    }
    return n;
  };
  return `^${t(s)}$`;
}
function F(s, e) {
  let t = 0;
  for (let i = e; i < s.length; i += 1) {
    const n = s[i];
    if (n === "{" && (t += 1), n === "}" && (t -= 1), t === 0) {
      const r = i;
      return { content: s.slice(e + 1, r), endIndex: r };
    }
  }
  return { content: s.slice(e + 1), endIndex: s.length - 1 };
}
function H(s) {
  const e = [];
  let t = 0, i = "";
  for (let n = 0; n < s.length; n += 1) {
    const r = s[n];
    if (r === "{" && (t += 1), r === "}" && (t -= 1), r === "," && t === 0) {
      e.push(i), i = "";
      continue;
    }
    i += r;
  }
  return e.push(i), e;
}
const k = (s, e) => {
  const t = { ...s };
  for (const i in e) {
    const n = e[i];
    n && typeof n == "object" && !Array.isArray(n) ? t[i] = k(s[i] || {}, n) : t[i] = n;
  }
  return t;
}, x = (s, e) => {
  if (s === e)
    return !0;
  if (s == null || e == null || typeof s != "object" || typeof e != "object")
    return s === e;
  if (Array.isArray(s) && Array.isArray(e)) {
    if (s.length !== e.length)
      return !1;
    for (let n = 0; n < s.length; n++)
      if (!x(s[n], e[n]))
        return !1;
    return !0;
  }
  if (Array.isArray(s) || Array.isArray(e))
    return !1;
  const t = Object.keys(s), i = Object.keys(e);
  if (t.length !== i.length)
    return !1;
  for (const n of t)
    if (!e.hasOwnProperty(n) || !x(s[n], e[n]))
      return !1;
  return !0;
};
var f = /* @__PURE__ */ ((s) => (s.MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED", s.AckTimeout = "ACK_TIMEOUT", s.AckMaxRetries = "ACK_MAX_RETRIES", s.ClosedBeforeAck = "CLOSED_BEFORE_ACK", s.OfflineQueueOverflow = "OFFLINE_QUEUE_OVERFLOW", s.OfflineQueueTTLExpired = "OFFLINE_QUEUE_TTL_EXPIRED", s.ClosedBeforeSend = "CLOSED_BEFORE_SEND", s))(f || {});
const B = {
  MSG_PACK_NOT_INSTALLED: "MsgPack serializer requires @msgpack/msgpack installation",
  ACK_TIMEOUT: "ACK timeout",
  ACK_MAX_RETRIES: "ACK timeout, maximum retry attempts reached",
  CLOSED_BEFORE_ACK: "WebSocket connection closed before ACK was received",
  OFFLINE_QUEUE_OVERFLOW: "Offline message queue overflow",
  OFFLINE_QUEUE_TTL_EXPIRED: "Offline message queue message TTL expired",
  CLOSED_BEFORE_SEND: "WebSocket connection closed before offline queued send"
};
class d extends Error {
  constructor(e) {
    super(B[e]), this.code = e, this.name = "WebSocketClientError";
  }
}
class K extends R {
  constructor(e, t, i) {
    super(), this.url = e, this.protocols = t, this.config = i, this.socket = null, this.reconnectAttempts = 0, this.isManualClose = !1, this.isOverMaxReconnectAttempts = !1, this.isClosingForReconnect = !1, this.messageQueue = [], this.topicListeners = /* @__PURE__ */ new Map(), this.sentCount = 0, this.receivedCount = 0, this.errorCount = 0, this.reconnectScheduledCount = 0, this.ackTimeoutCount = 0, this.pendingAcks = /* @__PURE__ */ new Map(), this.isUpdatingConfig = !1, this.configQueue = [], this.currentConfig = k(O, this.config), this.initHeartbeat(), this.scheduler = new j(
      this.currentConfig.maxConcurrent,
      (n) => this.emit(u.Error, n)
    ), this.connect();
  }
  // 初始化心跳
  initHeartbeat() {
    this.currentConfig.isNeedHeartbeat && (this.heartbeat = new q(this.currentConfig.heartbeat, () => {
      const e = this.currentConfig.heartbeat, t = typeof (e == null ? void 0 : e.getPing) == "function" ? e.getPing() : (e == null ? void 0 : e.pingMessage) ?? A.Ping;
      this.sendHeartbeat(t);
    }), this.heartbeat.on(w.Timeout, () => {
      var e;
      C().warn("Heartbeat timeout, triggering reconnect..."), ((e = this.socket) == null ? void 0 : e.readyState) === WebSocket.OPEN && this.close(1e3, "heartbeat timeout"), this.scheduleReconnect();
    }), this.heartbeat.on(w.Pong, (e) => {
      this.emit(u.Heartbeat, e), this.emit(u.Latency, e), this.lastHeartbeatLatency = e;
    }));
  }
  connect() {
    this.isManualClose = !1, this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      const t = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0, this.isOverMaxReconnectAttempts = !1, clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.heartbeat && this.heartbeat.start(), this.flushMessageQueue(), t && (this.reSyncSubscriptions(), this.emit(u.Reconnect)), this.emit(u.Open, e);
    }, this.socket.onmessage = (e) => {
      this.receivedCount += 1;
      const t = e.data;
      let i = t;
      try {
        i = this.currentConfig.serializer.deserialize(t);
      } catch {
        i = t;
      }
      const n = this.currentConfig.heartbeat;
      if (typeof (n == null ? void 0 : n.isPong) == "function" ? n.isPong(t, i) : (n == null ? void 0 : n.pongMessage) !== void 0 && (t === n.pongMessage || i === n.pongMessage)) {
        this.heartbeat && this.heartbeat.recordPong();
        return;
      }
      const o = this.currentConfig.ack;
      if (o != null && o.enabled && typeof o.extractAckId == "function") {
        const a = o.extractAckId(i);
        if (a != null) {
          const g = this.pendingAcks.get(a);
          if (g) {
            clearTimeout(g.timer), this.pendingAcks.delete(a), g.resolve();
            return;
          }
        }
      }
      const c = this.currentConfig.sequence;
      if (c != null && c.enabled && typeof c.extractInboundSeq == "function") {
        const a = c.extractInboundSeq(i);
        a != null && (this.lastInboundSeq = a);
      }
      this.emit(u.Message, i), this.dispatchSubscribedMessage(i);
    }, this.socket.onclose = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.lastCloseCode = e.code, this.lastCloseReason = e.reason, this.lastCloseAt = Date.now(), this.emit(u.Close, e), this.isManualClose || this.scheduleReconnect();
    }, this.socket.onerror = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit(u.Error, e), this.errorCount += 1, this.lastErrorAt = Date.now(), this.scheduleReconnect();
    };
  }
  sendRaw(e) {
    var t;
    ((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN && (this.socket.send(e), this.sentCount += 1);
  }
  dispatchSubscribedMessage(e) {
    const t = this.currentConfig.subscription, i = typeof (t == null ? void 0 : t.extractTopic) == "function" ? t.extractTopic(e) : null;
    i && this.topicListeners.size !== 0 && this.topicListeners.forEach((n, r) => {
      z(r, i) && n.forEach((o) => {
        try {
          o(e);
        } catch (c) {
          this.emit(u.Error, c);
        }
      });
    });
  }
  reSyncSubscriptions() {
    const e = this.currentConfig.subscription;
    e != null && e.autoResubscribe && typeof e.buildSubscribeMessage == "function" && this.topicListeners.forEach((t, i) => {
      var r;
      const n = (r = e.buildSubscribeMessage) == null ? void 0 : r.call(e, i);
      if (n !== void 0)
        try {
          const o = this.currentConfig.serializer.serialize(n);
          this.sendRaw(o);
        } catch (o) {
          this.emit(u.Error, o);
        }
    });
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
        const i = this.currentConfig.serializer.serialize(e);
        this.sendRaw(i);
      } catch (i) {
        this.emit(u.Error, i);
      }
  }
  scheduleReconnect() {
    if (this.reconnectTimer)
      return;
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.isOverMaxReconnectAttempts = !0, this.emit(u.OverMaxReconnectAttempts);
      return;
    }
    const e = Math.min(
      this.currentConfig.reconnectDelay * Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
    ), i = e * 0.2 * (Math.random() * 2 - 1), n = Math.max(1e3, e + i);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = void 0, this.reconnectAttempts++, this.emit(u.Reconnect, {
        attempt: this.reconnectAttempts,
        delay: n
      }), this.connect();
    }, n), this.reconnectScheduledCount += 1;
  }
  flushMessageQueue() {
    var t;
    const e = (t = this.currentConfig.offlineQueue) == null ? void 0 : t.messageTTL;
    for (; this.messageQueue.length > 0; ) {
      if (e !== void 0 && e > 0) {
        const a = Date.now(), g = this.messageQueue[0];
        if (a - g.createdAt > e) {
          this.messageQueue.shift().reject(new d(f.OfflineQueueTTLExpired));
          continue;
        }
      }
      const { data: i, priority: n, needAck: r, resolve: o, reject: c } = this.messageQueue.shift();
      this.sendInternal(i, n, r).then(o).catch(c);
    }
  }
  enqueueOfflineMessage(e) {
    const t = this.currentConfig.offlineQueue;
    if (!(t != null && t.enabled)) {
      this.messageQueue.push(e);
      return;
    }
    const i = Date.now(), n = t.messageTTL;
    if (n !== void 0 && n > 0)
      for (; this.messageQueue.length > 0; ) {
        const c = this.messageQueue[0];
        if (i - c.createdAt <= n)
          break;
        this.messageQueue.shift().reject(
          new d(f.OfflineQueueTTLExpired)
        );
      }
    const r = t.maxQueueSize ?? Number.POSITIVE_INFINITY;
    if (r <= 0) {
      e.reject(new d(f.OfflineQueueOverflow));
      return;
    }
    if (this.messageQueue.length < r) {
      this.messageQueue.push(e);
      return;
    }
    const o = t.dropStrategy ?? y.Reject;
    if (o === y.Reject || o === y.DropNewest) {
      e.reject(new d(f.OfflineQueueOverflow));
      return;
    }
    for (; this.messageQueue.length >= r; )
      this.messageQueue.shift().reject(
        new d(f.OfflineQueueOverflow)
      );
    this.messageQueue.push(e);
  }
  sendInternal(e, t, i) {
    var n;
    if (((n = this.socket) == null ? void 0 : n.readyState) === WebSocket.OPEN) {
      const r = this.currentConfig.ack;
      let o = null, c, a;
      const g = i ? new Promise((l, h) => {
        c = l, a = h;
      }) : void 0, T = this.scheduler.add(async () => {
        var v, E;
        let l = e;
        const h = this.currentConfig.sequence;
        if (h != null && h.enabled && typeof h.wrapOutbound == "function") {
          const m = (v = h.generateSeq) == null ? void 0 : v.call(h);
          m !== void 0 && (l = h.wrapOutbound(m, l));
        }
        if (i && (r != null && r.enabled)) {
          const m = (E = r.generateId) == null ? void 0 : E.call(r);
          m != null && typeof r.wrapOutbound == "function" && (o = m, l = r.wrapOutbound(m, l));
        }
        const S = this.currentConfig.serializer.serialize(l);
        if (this.sendRaw(S), !i || !(r != null && r.enabled) || o === null)
          return;
        const L = r.timeout ?? 5e3;
        this.pendingAcks.set(o, {
          resolve: () => c == null ? void 0 : c(),
          reject: (m) => a == null ? void 0 : a(m),
          retries: 0,
          rawData: e,
          priority: t,
          timer: setTimeout(() => {
            this.handleAckTimeout(o);
          }, L)
        });
      }, t);
      return i ? T.catch((l) => {
        if (o !== null) {
          const h = this.pendingAcks.get(o);
          h && (clearTimeout(h.timer), this.pendingAcks.delete(o));
        }
        throw a == null || a(l), l;
      }).then(() => {
        if (!(!(r != null && r.enabled) || o === null || !g))
          return g;
      }) : T;
    }
    return new Promise((r, o) => {
      const c = Date.now();
      this.enqueueOfflineMessage({
        data: e,
        priority: t,
        needAck: i,
        resolve: r,
        reject: o,
        createdAt: c
      });
    });
  }
  handleAckTimeout(e) {
    const t = this.currentConfig.ack, i = this.pendingAcks.get(e);
    if (!i || !(t != null && t.enabled)) {
      i && (this.pendingAcks.delete(e), i.reject(new d(f.AckTimeout)));
      return;
    }
    const n = t.timeout ?? 5e3, r = t.maxRetries ?? 0;
    i.retries < r ? (i.retries += 1, this.sendInternal(i.rawData, i.priority, !1).catch(
      i.reject
    ), i.timer = setTimeout(() => {
      this.handleAckTimeout(e);
    }, n)) : (this.pendingAcks.delete(e), this.ackTimeoutCount += 1, i.reject(new d(f.AckMaxRetries)));
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
  getState() {
    var t;
    const e = ((t = this.socket) == null ? void 0 : t.readyState) ?? null;
    return this.isOverMaxReconnectAttempts ? p.OverMaxReconnectAttempts : this.reconnectTimer ? p.Reconnecting : e === WebSocket.OPEN ? p.Open : e === WebSocket.CONNECTING ? p.Connecting : p.Closed;
  }
  getStats() {
    var t;
    let e = 0;
    return this.topicListeners.forEach((i) => {
      e += i.size;
    }), {
      sentCount: this.sentCount,
      receivedCount: this.receivedCount,
      errorCount: this.errorCount,
      reconnectScheduledCount: this.reconnectScheduledCount,
      ackTimeoutCount: this.ackTimeoutCount,
      reconnectAttempts: this.reconnectAttempts,
      pendingAcksCount: this.pendingAcks.size,
      messageQueueLength: this.messageQueue.length,
      subscribedTopicCount: this.topicListeners.size,
      subscriptionListenerCount: e,
      lastInboundSeq: this.lastInboundSeq,
      socketReadyState: ((t = this.socket) == null ? void 0 : t.readyState) ?? null,
      lastHeartbeatLatency: this.lastHeartbeatLatency,
      lastErrorAt: this.lastErrorAt,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason,
      lastCloseAt: this.lastCloseAt
    };
  }
  resetStats(e = {}) {
    const { resetCounters: t = !0, resetLastEvents: i = !0 } = e;
    t && (this.sentCount = 0, this.receivedCount = 0, this.errorCount = 0, this.reconnectScheduledCount = 0, this.ackTimeoutCount = 0), i && (this.lastHeartbeatLatency = void 0, this.lastErrorAt = void 0, this.lastCloseCode = void 0, this.lastCloseReason = void 0, this.lastCloseAt = void 0);
  }
  subscribe(e, t) {
    var n, r;
    if (Array.isArray(e)) {
      const o = e.filter(Boolean).map((c) => this.subscribe(c, t));
      return () => o.forEach((c) => c());
    }
    const i = e;
    if (!i)
      return () => {
      };
    if (!this.topicListeners.has(i)) {
      this.topicListeners.set(i, /* @__PURE__ */ new Set());
      const o = (r = (n = this.currentConfig.subscription) == null ? void 0 : n.buildSubscribeMessage) == null ? void 0 : r.call(n, i);
      o !== void 0 && this.send(o).catch((c) => {
        this.emit(u.Error, c);
      });
    }
    return this.topicListeners.get(i).add(t), () => this.unsubscribe(i, t);
  }
  subscribeOnce(e, t) {
    let i = !1;
    const n = (r) => {
      if (!i) {
        i = !0;
        try {
          t(r);
        } finally {
          this.unsubscribe(e, n);
        }
      }
    };
    return this.subscribe(e, n), () => {
      i || (i = !0, this.unsubscribe(e, n));
    };
  }
  unsubscribe(e, t) {
    var o, c;
    if (Array.isArray(e)) {
      e.filter(Boolean).forEach((a) => {
        this.unsubscribe(a, t);
      });
      return;
    }
    const i = e, n = this.topicListeners.get(i);
    if (!n || (t ? n.delete(t) : n.clear(), n.size > 0))
      return;
    this.topicListeners.delete(i);
    const r = (c = (o = this.currentConfig.subscription) == null ? void 0 : o.buildUnsubscribeMessage) == null ? void 0 : c.call(o, i);
    r !== void 0 && this.send(r).catch((a) => {
      this.emit(u.Error, a);
    });
  }
  close(e, t) {
    var i;
    if (this.isManualClose = !0, clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.heartbeat && this.heartbeat.stop(), this.pendingAcks.forEach((n, r) => {
      clearTimeout(n.timer), n.reject(new d(f.ClosedBeforeAck)), this.pendingAcks.delete(r);
    }), !this.isClosingForReconnect)
      for (; this.messageQueue.length > 0; )
        this.messageQueue.shift().reject(new d(f.ClosedBeforeSend));
    (i = this.socket) == null || i.close(e, t), this.socket = null;
  }
  reconnect() {
    clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.reconnectAttempts = 0, this.isOverMaxReconnectAttempts = !1, this.isClosingForReconnect = !0, this.close(), this.isManualClose = !1, this.isClosingForReconnect = !1, this.connect();
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
    this.currentConfig = k(this.currentConfig, e), this.handleConfigChange(t, this.currentConfig), this.applyConfig();
  }
  // 处理特定配置变更
  handleConfigChange(e, t) {
    x(e.heartbeat, t.heartbeat) || this.reInitHeartbeat(), (e.maxReconnectAttempts !== t.maxReconnectAttempts || e.reconnectDelay !== t.reconnectDelay || e.reconnectExponent !== t.reconnectExponent || e.maxReconnectDelay !== t.maxReconnectDelay) && this.resetReconnectTimer();
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
class W extends R {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const i = `${e}|${t.join(",")}`;
    if (this.clients.has(i))
      return this.clients.get(i);
    const n = new K(e, t, this.config);
    this.clients.set(i, n);
    const r = (o) => (c) => {
      this.emit(o, { url: e, protocols: t, data: c });
    };
    return I.forEach((o) => {
      n.on(o, r(o));
    }), n;
  }
  closeAll(e, t) {
    this.clients.forEach((i) => i.close(e, t)), this.clients.clear();
  }
  getClient(e, t) {
    const i = `${e}|${(t == null ? void 0 : t.join(",")) || ""}`;
    return this.clients.get(i);
  }
}
const $ = (s = {}) => {
  const e = k(O, s);
  return new W(e);
}, G = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, J = {
  serialize: (s) => {
    throw new d(f.MsgPackNotInstalled);
  },
  deserialize: (s) => {
    throw new d(f.MsgPackNotInstalled);
  }
};
export {
  R as EventEmitter,
  w as HeartbeatEvent,
  A as HeartbeatMessage,
  b as HeartbeatTimerMode,
  G as JsonSerializer,
  J as MsgPackSerializer,
  y as OfflineQueueDropStrategy,
  K as WebSocketClient,
  p as WebSocketClientState,
  W as WebSocketManager,
  $ as createWebSocketManager
};
