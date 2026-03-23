var y = /* @__PURE__ */ ((s) => (s.Ping = "PING", s.Pong = "PONG", s))(y || {}), b = /* @__PURE__ */ ((s) => (s.Timeout = "timeout", s.Pong = "pong", s))(b || {}), m = /* @__PURE__ */ ((s) => (s.Auto = "auto", s.Main = "main", s.Worker = "worker", s))(m || {});
const R = {
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
  isNeedHeartbeat: !0,
  heartbeat: {
    interval: 25e3,
    timeout: 45e3,
    pingMessage: y.Ping,
    pongMessage: y.Pong,
    timerMode: m.Auto
  }
};
class E {
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
let I = new E();
const T = () => I;
class A {
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
        T().error(`Event "${e}" listener error:`, n);
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
class k {
  setTimeout(e, t) {
    return globalThis.setTimeout(e, t);
  }
  clearTimeout(e) {
    e !== void 0 && globalThis.clearTimeout(e);
  }
}
class N {
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
function C(s) {
  const e = s.timerMode ?? m.Auto;
  if (e === m.Main)
    return new k();
  const t = new N();
  return e === m.Worker && !t.available ? (T().warn("Heartbeat worker timer unavailable, fallback to main"), t.destroy(), new k()) : e === m.Auto && !t.available ? (t.destroy(), new k()) : t;
}
class O extends A {
  constructor(e = {}, t) {
    super(), this.config = e, this.sendPing = t, this.lastPongTime = 0, this.lastPingTime = 0, this.expectedNextPingAt = 0, this.isRunning = !1, this.timer = C(this.config);
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
    var t, i, n, r;
    if (!(e != null && e.isNeedHeartbeat)) {
      this.stop(), (i = (t = this.timer).destroy) == null || i.call(t);
      return;
    }
    this.config = { ...this.config, ...e.heartbeat }, (r = (n = this.timer).destroy) == null || r.call(n), this.timer = C(this.config), this.stop(), this.start();
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
class L {
  constructor(e, t) {
    this.maxConcurrent = e, this.onTaskError = t, this.queue = [], this.runningCount = 0;
  }
  add(e, t) {
    return new Promise((i, n) => {
      const r = async () => {
        var o;
        try {
          await e(), i();
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
var h = /* @__PURE__ */ ((s) => (s.Open = "open", s.Message = "message", s.Close = "close", s.Error = "error", s.Reconnect = "reconnect", s.Heartbeat = "heartbeat", s.Latency = "latency", s.OverMaxReconnectAttempts = "overMaxReconnectAttempts", s))(h || {});
const D = [
  "open",
  "message",
  "close",
  "error",
  "reconnect",
  "heartbeat",
  "latency",
  "overMaxReconnectAttempts"
  /* OverMaxReconnectAttempts */
], w = (s, e) => {
  const t = { ...s };
  for (const i in e) {
    const n = e[i];
    n && typeof n == "object" && !Array.isArray(n) ? t[i] = w(s[i] || {}, n) : t[i] = n;
  }
  return t;
}, _ = (s, e) => {
  if (s === e)
    return !0;
  if (s == null || e == null || typeof s != "object" || typeof e != "object")
    return s === e;
  if (Array.isArray(s) && Array.isArray(e)) {
    if (s.length !== e.length)
      return !1;
    for (let n = 0; n < s.length; n++)
      if (!_(s[n], e[n]))
        return !1;
    return !0;
  }
  if (Array.isArray(s) || Array.isArray(e))
    return !1;
  const t = Object.keys(s), i = Object.keys(e);
  if (t.length !== i.length)
    return !1;
  for (const n of t)
    if (!e.hasOwnProperty(n) || !_(s[n], e[n]))
      return !1;
  return !0;
};
var g = /* @__PURE__ */ ((s) => (s.MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED", s.AckTimeout = "ACK_TIMEOUT", s.AckMaxRetries = "ACK_MAX_RETRIES", s.ClosedBeforeAck = "CLOSED_BEFORE_ACK", s))(g || {});
const q = {
  MSG_PACK_NOT_INSTALLED: "MsgPack serializer requires @msgpack/msgpack installation",
  ACK_TIMEOUT: "ACK timeout",
  ACK_MAX_RETRIES: "ACK timeout, maximum retry attempts reached",
  CLOSED_BEFORE_ACK: "WebSocket connection closed before ACK was received"
};
class p extends Error {
  constructor(e) {
    super(q[e]), this.code = e, this.name = "WebSocketClientError";
  }
}
class z extends A {
  constructor(e, t, i) {
    super(), this.url = e, this.protocols = t, this.config = i, this.socket = null, this.reconnectAttempts = 0, this.isManualClose = !1, this.messageQueue = [], this.topicListeners = /* @__PURE__ */ new Map(), this.pendingAcks = /* @__PURE__ */ new Map(), this.isUpdatingConfig = !1, this.configQueue = [], this.currentConfig = w(R, this.config), this.initHeartbeat(), this.scheduler = new L(
      this.currentConfig.maxConcurrent,
      (n) => this.emit(h.Error, n)
    ), this.connect();
  }
  // 初始化心跳
  initHeartbeat() {
    this.currentConfig.isNeedHeartbeat && (this.heartbeat = new O(this.currentConfig.heartbeat, () => {
      const e = this.currentConfig.heartbeat, t = typeof (e == null ? void 0 : e.getPing) == "function" ? e.getPing() : (e == null ? void 0 : e.pingMessage) ?? y.Ping;
      this.sendHeartbeat(t);
    }), this.heartbeat.on(b.Timeout, () => {
      var e;
      T().warn("Heartbeat timeout, triggering reconnect..."), ((e = this.socket) == null ? void 0 : e.readyState) === WebSocket.OPEN && this.close(1e3, "heartbeat timeout"), this.scheduleReconnect();
    }), this.heartbeat.on(b.Pong, (e) => {
      this.emit(h.Heartbeat, e), this.emit(h.Latency, e);
    }));
  }
  connect() {
    this.isManualClose = !1, this.socket = new WebSocket(this.url, this.protocols), this.socket.binaryType = "arraybuffer", this.socket.onopen = (e) => {
      const t = this.reconnectAttempts > 0;
      this.reconnectAttempts = 0, clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.heartbeat && this.heartbeat.start(), this.flushMessageQueue(), t && (this.reSyncSubscriptions(), this.emit(h.Reconnect)), this.emit(h.Open, e);
    }, this.socket.onmessage = (e) => {
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
        const c = o.extractAckId(i);
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
        const c = a.extractInboundSeq(i);
        c != null && (this.lastInboundSeq = c);
      }
      this.emit(h.Message, i), this.dispatchSubscribedMessage(i);
    }, this.socket.onclose = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit(h.Close, e), this.isManualClose || this.scheduleReconnect();
    }, this.socket.onerror = (e) => {
      this.heartbeat && this.heartbeat.stop(), this.emit(h.Error, e), this.scheduleReconnect();
    };
  }
  sendRaw(e) {
    var t;
    ((t = this.socket) == null ? void 0 : t.readyState) === WebSocket.OPEN && this.socket.send(e);
  }
  dispatchSubscribedMessage(e) {
    const t = this.currentConfig.subscription, i = typeof (t == null ? void 0 : t.extractTopic) == "function" ? t.extractTopic(e) : null;
    i && this.topicListeners.size !== 0 && this.topicListeners.forEach((n, r) => {
      this.isTopicMatch(r, i) && n.forEach((o) => {
        try {
          o(e);
        } catch (a) {
          this.emit(h.Error, a);
        }
      });
    });
  }
  isTopicMatch(e, t) {
    if (e === t)
      return !0;
    if (!e.includes("*"))
      return !1;
    const n = "^" + e.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$";
    return new RegExp(n).test(t);
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
          this.emit(h.Error, o);
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
        this.emit(h.Error, i);
      }
  }
  scheduleReconnect() {
    if (this.reconnectTimer)
      return;
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.emit(h.OverMaxReconnectAttempts);
      return;
    }
    const e = Math.min(
      this.currentConfig.reconnectDelay * Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
    ), i = e * 0.2 * (Math.random() * 2 - 1), n = Math.max(1e3, e + i);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = void 0, this.reconnectAttempts++, this.emit(h.Reconnect, {
        attempt: this.reconnectAttempts,
        delay: n
      }), this.connect();
    }, n);
  }
  flushMessageQueue() {
    for (; this.messageQueue.length > 0; ) {
      const { data: e, priority: t, needAck: i, resolve: n, reject: r } = this.messageQueue.shift();
      this.sendInternal(e, t, i).then(n).catch(r);
    }
  }
  sendInternal(e, t, i) {
    var n;
    if (((n = this.socket) == null ? void 0 : n.readyState) === WebSocket.OPEN) {
      const r = this.currentConfig.ack;
      let o = null, a, c;
      const d = i ? new Promise((l, u) => {
        a = l, c = u;
      }) : void 0, x = this.scheduler.add(async () => {
        var M, P;
        let l = e;
        const u = this.currentConfig.sequence;
        if (u != null && u.enabled && typeof u.wrapOutbound == "function") {
          const f = (M = u.generateSeq) == null ? void 0 : M.call(u);
          f !== void 0 && (l = u.wrapOutbound(f, l));
        }
        if (i && (r != null && r.enabled)) {
          const f = (P = r.generateId) == null ? void 0 : P.call(r);
          f != null && typeof r.wrapOutbound == "function" && (o = f, l = r.wrapOutbound(f, l));
        }
        const v = this.currentConfig.serializer.serialize(l);
        if (this.sendRaw(v), !i || !(r != null && r.enabled) || o === null)
          return;
        const S = r.timeout ?? 5e3;
        this.pendingAcks.set(o, {
          resolve: () => a == null ? void 0 : a(),
          reject: (f) => c == null ? void 0 : c(f),
          retries: 0,
          rawData: e,
          priority: t,
          timer: setTimeout(() => {
            this.handleAckTimeout(o);
          }, S)
        });
      }, t);
      return i ? x.catch((l) => {
        if (o !== null) {
          const u = this.pendingAcks.get(o);
          u && (clearTimeout(u.timer), this.pendingAcks.delete(o));
        }
        throw c == null || c(l), l;
      }).then(() => {
        if (!(!(r != null && r.enabled) || o === null || !d))
          return d;
      }) : x;
    }
    return new Promise((r, o) => {
      this.messageQueue.push({ data: e, priority: t, needAck: i, resolve: r, reject: o });
    });
  }
  handleAckTimeout(e) {
    const t = this.currentConfig.ack, i = this.pendingAcks.get(e);
    if (!i || !(t != null && t.enabled)) {
      i && (this.pendingAcks.delete(e), i.reject(new p(g.AckTimeout)));
      return;
    }
    const n = t.timeout ?? 5e3, r = t.maxRetries ?? 0;
    i.retries < r ? (i.retries += 1, this.sendInternal(i.rawData, i.priority, !1).catch(
      i.reject
    ), i.timer = setTimeout(() => {
      this.handleAckTimeout(e);
    }, n)) : (this.pendingAcks.delete(e), i.reject(new p(g.AckMaxRetries)));
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
  subscribe(e, t) {
    var i, n;
    if (!e)
      return () => {
      };
    if (!this.topicListeners.has(e)) {
      this.topicListeners.set(e, /* @__PURE__ */ new Set());
      const r = (n = (i = this.currentConfig.subscription) == null ? void 0 : i.buildSubscribeMessage) == null ? void 0 : n.call(i, e);
      r !== void 0 && this.send(r).catch((o) => {
        this.emit(h.Error, o);
      });
    }
    return this.topicListeners.get(e).add(t), () => this.unsubscribe(e, t);
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
    var r, o;
    const i = this.topicListeners.get(e);
    if (!i || (t ? i.delete(t) : i.clear(), i.size > 0))
      return;
    this.topicListeners.delete(e);
    const n = (o = (r = this.currentConfig.subscription) == null ? void 0 : r.buildUnsubscribeMessage) == null ? void 0 : o.call(r, e);
    n !== void 0 && this.send(n).catch((a) => {
      this.emit(h.Error, a);
    });
  }
  close(e, t) {
    var i;
    this.isManualClose = !0, clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.heartbeat && this.heartbeat.stop(), this.pendingAcks.forEach((n, r) => {
      clearTimeout(n.timer), n.reject(new p(g.ClosedBeforeAck)), this.pendingAcks.delete(r);
    }), (i = this.socket) == null || i.close(e, t), this.socket = null;
  }
  reconnect() {
    clearTimeout(this.reconnectTimer), this.reconnectTimer = void 0, this.reconnectAttempts = 0, this.close(), this.isManualClose = !1, this.connect();
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
    this.currentConfig = w(this.currentConfig, e), this.handleConfigChange(t, this.currentConfig), this.applyConfig();
  }
  // 处理特定配置变更
  handleConfigChange(e, t) {
    _(e.heartbeat, t.heartbeat) || this.reInitHeartbeat(), (e.maxReconnectAttempts !== t.maxReconnectAttempts || e.reconnectDelay !== t.reconnectDelay || e.reconnectExponent !== t.reconnectExponent || e.maxReconnectDelay !== t.maxReconnectDelay) && this.resetReconnectTimer();
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
class j extends A {
  constructor(e) {
    super(), this.config = e, this.clients = /* @__PURE__ */ new Map();
  }
  connect(e, t = []) {
    const i = `${e}|${t.join(",")}`;
    if (this.clients.has(i))
      return this.clients.get(i);
    const n = new z(e, t, this.config);
    this.clients.set(i, n);
    const r = (o) => (a) => {
      this.emit(o, { url: e, protocols: t, data: a });
    };
    return D.forEach((o) => {
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
const U = (s = {}) => {
  const e = w(R, s);
  return new j(e);
}, H = {
  serialize: JSON.stringify,
  deserialize: JSON.parse
}, K = {
  serialize: (s) => {
    throw new p(g.MsgPackNotInstalled);
  },
  deserialize: (s) => {
    throw new p(g.MsgPackNotInstalled);
  }
};
export {
  A as EventEmitter,
  b as HeartbeatEvent,
  y as HeartbeatMessage,
  m as HeartbeatTimerMode,
  H as JsonSerializer,
  K as MsgPackSerializer,
  z as WebSocketClient,
  j as WebSocketManager,
  U as createWebSocketManager
};
