// ╔══════════════════════════════════════════════════════════╗
// ║  1. 配置                                                 ║
// ╚══════════════════════════════════════════════════════════╝
const API_BASE = "http://localhost:9000";

const TIME_SLOTS = [
  { label: "08:00 – 10:00", start: "08:00:00", end: "10:00:00" },
  { label: "10:00 – 12:00", start: "10:00:00", end: "12:00:00" },
  { label: "14:00 – 16:00", start: "14:00:00", end: "16:00:00" },
  { label: "16:00 – 18:00", start: "16:00:00", end: "18:00:00" },
];

const VENUE_ICONS = ["⚽", "🏟️", "🏕️", "🥅", "🏃"];
const VENUE_BGS = ["#eff6ff", "#ecfdf5", "#fffbeb", "#fdf2f8", "#f0f9ff"];

const PAGE_TITLES = {
  dashboard: "首页概览",
  booking: "场地预约",
  myreservations: "我的预约",
  venues: "场地信息",
  venueadmin: "场地管理",
  reservadmin: "预约审核",
  stats: "数据统计",
};

// ╔══════════════════════════════════════════════════════════╗
// ║  2. API 服务层                                            ║
// ╚══════════════════════════════════════════════════════════╝
const api = {
  _token: localStorage.getItem("token") || null,

  _headers() {
    const h = { "Content-Type": "application/json" };
    if (this._token) h["Authorization"] = `Bearer ${this._token}`;
    return h;
  },

  async _request(method, path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: this._headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401) {
      logout();
      throw new Error("登录已过期，请重新登录");
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `请求失败 (${res.status})`);
    }
    if (res.status === 204) return null;
    return res.json();
  },

  // ---- 认证 ----
  login(username, password) {
    return this._request("POST", "/auth/login", { username, password });
  },
  register(username, password) {
    return this._request("POST", "/auth/register", { username, password });
  },

  // ---- 场地 ----
  getVenues() {
    return this._request("GET", "/venues/");
  },
  createVenue(data) {
    return this._request("POST", "/venues/", data);
  },
  updateVenue(id, data) {
    return this._request("PUT", `/venues/${id}`, data);
  },
  deleteVenue(id) {
    return this._request("DELETE", `/venues/${id}`);
  },

  // ---- 预约 ----
  getMyReservations() {
    return this._request("GET", "/reservations/mine");
  },
  getReservationsInfo(params = {}) {
    const qs = new URLSearchParams();
    if (params.venue_id) qs.set("venue_id", params.venue_id);
    if (params.reserve_date) qs.set("reserve_date", params.reserve_date);
    const s = qs.toString();
    return this._request("GET", `/reservations/info/${s ? "?" + s : ""}`);
  },
  createReservation(data) {
    return this._request("POST", "/reservations/", data);
  },
  cancelReservation(id) {
    return this._request("DELETE", `/reservations/${id}`);
  },
  approveReservation(id) {
    return this._request("PUT", `/reservations/${id}/approve`);
  },
  rejectReservation(id) {
    return this._request("PUT", `/reservations/${id}/reject`);
  },
};

// ╔══════════════════════════════════════════════════════════╗
// ║  3. 全局状态                                              ║
// ╚══════════════════════════════════════════════════════════╝
let currentRole = "admin";
let currentUser = "admin";
let currentUserId = null;
let bookingVenue = null; // { id, name, location }

// ╔══════════════════════════════════════════════════════════╗
// ║  4. UI 工具函数                                           ║
// ╚══════════════════════════════════════════════════════════╝
function showToast(msg, error) {
  const t = document.getElementById("toast");
  document.getElementById("toastMsg").textContent = msg;
  document
    .getElementById("toastIcon")
    .setAttribute("stroke", error ? "#EF4444" : "#10B981");
  t.style.display = "flex";
  clearTimeout(t._timeout);
  t._timeout = setTimeout(() => {
    t.style.display = "none";
  }, 2800);
}

function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

function formatDate(d) {
  if (!d) return "";
  const s = typeof d === "string" ? d : d.toISOString().split("T")[0];
  const parts = s.split("-");
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const wd = weekdays[new Date(s).getDay()];
  return `${parts[0]}年${parseInt(parts[1])}月${parseInt(parts[2])}日 ${wd}`;
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

// ╔══════════════════════════════════════════════════════════╗
// ║  5. 认证模块                                              ║
// ╚══════════════════════════════════════════════════════════╝
function setRole(role, el) {
  currentRole = role;
  document
    .querySelectorAll("#loginPage .chip")
    .forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  if (role === "admin") {
    document.getElementById("loginUser").value = "admin";
    document.getElementById("loginPass").value = "admin123";
  } else {
    document.getElementById("loginUser").value = "alice";
    document.getElementById("loginPass").value = "alice123";
  }
}

async function doLogin() {
  const u = document.getElementById("loginUser").value.trim();
  const p = document.getElementById("loginPass").value;
  const errEl = document.getElementById("loginError");

  if (!u || !p) {
    errEl.textContent = "请输入用户名和密码";
    errEl.style.display = "block";
    return;
  }
  errEl.style.display = "none";

  try {
    const data = await api.login(u, p);
    api._token = data.access_token;
    localStorage.setItem("token", data.access_token);

    currentRole = data.role;
    currentUser = u;
    currentUserId = data.user_id;

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appPage").style.display = "block";
    updateSidebarUser();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  }
}

function updateSidebarUser() {
  document.getElementById("sideUser").textContent = currentUser;
  document.getElementById("sideRole").textContent =
    currentRole === "admin" ? "管理员" : "普通用户";
  document.getElementById("sideAvatar").textContent =
    currentUser[0].toUpperCase();
  document.getElementById("topAvatar").textContent =
    currentUser[0].toUpperCase();

  const adminSection = document.getElementById("adminSection");
  const adminNavs = ["navVenueAdmin", "navReservAdmin", "navStats"];
  if (currentRole === "admin") {
    adminSection.style.display = "block";
    adminNavs.forEach((id) => {
      document.getElementById(id).style.display = "flex";
    });
  } else {
    adminSection.style.display = "none";
    adminNavs.forEach((id) => {
      document.getElementById(id).style.display = "none";
    });
  }
}

async function doRegister() {
  const u = document.getElementById("regUser").value.trim();
  const p = document.getElementById("regPass").value;
  const p2 = document.getElementById("regPass2").value;
  const errEl = document.getElementById("regError");

  if (!u || !p) {
    errEl.textContent = "请输入用户名和密码";
    errEl.style.display = "block";
    return;
  }
  if (p !== p2) {
    errEl.textContent = "两次输入的密码不一致";
    errEl.style.display = "block";
    return;
  }
  errEl.style.display = "none";

  try {
    const data = await api.register(u, p);
    api._token = data.access_token;
    localStorage.setItem("token", data.access_token);

    currentRole = data.role;
    currentUser = u;
    currentUserId = data.user_id;

    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appPage").style.display = "block";
    updateSidebarUser();
    showToast("注册成功，欢迎使用！");
  } catch (e) {
    errEl.textContent = e.message;
    errEl.style.display = "block";
  }
}

function showRegisterForm() {
  document.getElementById("loginForm").style.display = "none";
  document.getElementById("registerForm").style.display = "block";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("regError").style.display = "none";
  document.getElementById("toggleToRegister").style.display = "none";
  document.getElementById("toggleToLogin").style.display = "inline";
}

function showLoginForm() {
  document.getElementById("loginForm").style.display = "block";
  document.getElementById("registerForm").style.display = "none";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("regError").style.display = "none";
  document.getElementById("toggleToRegister").style.display = "inline";
  document.getElementById("toggleToLogin").style.display = "none";
}

function logout() {
  api._token = null;
  localStorage.removeItem("token");
  document.getElementById("appPage").style.display = "none";
  document.getElementById("loginPage").style.display = "flex";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("regError").style.display = "none";
  showLoginForm();
}

// ╔══════════════════════════════════════════════════════════╗
// ║  6. 导航                                                  ║
// ╚══════════════════════════════════════════════════════════╝
async function nav(pageId, el) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  const target = document.getElementById("page-" + pageId);
  if (target) target.classList.add("active");

  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  if (el) el.classList.add("active");

  document.getElementById("topbarTitle").textContent =
    PAGE_TITLES[pageId] || "";

  try {
    switch (pageId) {
      case "dashboard":
        await renderDashboard();
        break;
      case "booking":
        await renderBooking();
        break;
      case "myreservations":
        await renderMyReservations();
        break;
      case "venues":
        await renderVenues();
        break;
      case "venueadmin":
        await renderVenueAdmin();
        break;
      case "reservadmin":
        await renderReservAdmin();
        break;
      case "stats":
        await renderStats();
        break;
    }
  } catch (e) {
    showToast("加载失败: " + e.message, true);
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║  7. 页面渲染函数                                          ║
// ╚══════════════════════════════════════════════════════════╝

// ---- 7a. 首页概览 ----
async function renderDashboard() {
  const today = todayStr();
  document.getElementById("dashboardDate").textContent = formatDate(today);

  const [venues, todayReservs, allReservs] = await Promise.all([
    api.getVenues(),
    api.getReservationsInfo({ reserve_date: today }),
    api.getReservationsInfo(),
  ]);

  const openVenues = venues.filter((v) => v.status === 1);
  document.getElementById("statOpenVenues").textContent = openVenues.length;
  document.getElementById("statTodayBookings").textContent =
    todayReservs.filter((r) => r.status === "approved").length;
  document.getElementById("statTotalBookings").textContent =
    allReservs.filter((r) => r.status === "approved").length;

  const approvedToday = todayReservs.filter((r) => r.status === "approved");
  const availSlots = Math.max(0, openVenues.length * 4 - approvedToday.length);
  document.getElementById("statAvailSlots").textContent = availSlots;

  // 最近预约记录
  const tbody = document.getElementById("dashboardRecentTable");
  const recent = allReservs.slice(0, 5);
  if (recent.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📋</div>暂无预约记录</div></td></tr>`;
  } else {
    tbody.innerHTML = recent
      .map((r) => {
        const isToday = r.reserve_date === today;
        const statusBadge = isToday
          ? `<span class="badge badge-blue">已预约</span>`
          : `<span class="badge badge-green">已完成</span>`;
        return `<tr>
        <td><strong>${escHtml(r.venue_name)}</strong></td>
        <td>${escHtml(r.username)}</td>
        <td>${r.reserve_date}</td>
        <td>${r.start_time?.substring(0, 5)} – ${r.end_time?.substring(0, 5)}</td>
        <td>${statusBadge}</td>
      </tr>`;
      })
      .join("");
  }

  buildChart(allReservs);
  buildHotVenues(allReservs);
}

function buildChart(allReservs) {
  const days = [],
    counts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    days.push(weekdays[d.getDay()]);
    counts.push(allReservs.filter((r) => r.reserve_date === ds).length);
  }

  const maxVal = Math.max(...counts, 1);
  const barsEl = document.getElementById("chartBars");
  const labelsEl = document.getElementById("chartLabels");
  barsEl.innerHTML = "";
  labelsEl.innerHTML = "";

  counts.forEach((v, i) => {
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = Math.round((v / maxVal) * 100) + "%";
    bar.title = days[i] + ": " + v + " 次";
    barsEl.appendChild(bar);

    const lbl = document.createElement("div");
    lbl.className = "chart-label";
    lbl.textContent = days[i];
    labelsEl.appendChild(lbl);
  });
}

function buildHotVenues(allReservs) {
  const venueCounts = {};
  allReservs.forEach((r) => {
    venueCounts[r.venue_name] = (venueCounts[r.venue_name] || 0) + 1;
  });
  const sorted = Object.entries(venueCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

  const container = document.getElementById("dashboardHotVenues");
  if (sorted.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div>暂无数据</div>`;
    return;
  }

  container.innerHTML =
    `<div style="display:flex;flex-direction:column;gap:14px">` +
    sorted
      .map(
        ([name, count]) => `
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;font-weight:500">${escHtml(name)}</span>
          <span style="font-size:12px;color:var(--text3)">${count} 次</span>
        </div>
        <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round((count / maxCount) * 100)}%"></div></div>
      </div>
    `,
      )
      .join("") +
    `</div>`;
}

// ---- 7b. 场地预约 ----
async function renderBooking() {
  const today = todayStr();
  const filterDate = document.getElementById("filterDate");
  if (!filterDate.value) filterDate.value = today;

  let venues;
  try {
    venues = await api.getVenues();
  } catch (e) {
    document.getElementById("bookingVenueGrid").innerHTML =
      `<div class="error-text">⚠️ 加载场地失败：${escHtml(e.message)}</div>`;
    return;
  }

  if (venues.length === 0) {
    document.getElementById("bookingVenueGrid").innerHTML =
      `<div class="empty-state"><div class="empty-icon">🏟️</div>暂无可预约场地</div>`;
    return;
  }

  document.getElementById("bookingVenueGrid").innerHTML = venues
    .map((v, i) => {
      const isOpen = v.status === 1;
      return `
    <div class="venue-card" ${isOpen ? `onclick="openBookModal(${v.id}, '${escAttr(v.venue_name)}', '${escAttr(v.location || "")}')"` : ""}>
      <div class="venue-img" style="background:${VENUE_BGS[i % VENUE_BGS.length]}">${VENUE_ICONS[i % VENUE_ICONS.length]}</div>
      <div class="venue-body">
        <div class="venue-name">${escHtml(v.venue_name)}</div>
        <div class="venue-loc">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(v.location || "未指定位置")}
        </div>
        <div class="venue-footer">
          ${
            isOpen
              ? `<span class="badge badge-green"><span class="mini-dot dot-green"></span>可预约</span>
               <button class="btn btn-primary" style="height:30px;padding:0 12px;font-size:12px">立即预约</button>`
              : `<span class="badge badge-gray"><span class="mini-dot dot-gray"></span>暂停使用</span>
               <button class="btn" style="height:30px;padding:0 12px;font-size:12px" disabled>暂不可约</button>`
          }
        </div>
      </div>
    </div>`;
    })
    .join("");
}

// ---- 7c. 我的预约 ----
async function renderMyReservations() {
  const tbody = document.getElementById("myReservTable");
  tbody.innerHTML = `<tr><td colspan="5"><div class="loading-text">加载中...</div></td></tr>`;

  let data;
  try {
    // 使用 /reservations/mine 接口，后端从 Token 获取 user_id，不会串号
    data = await api.getMyReservations();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="error-text">⚠️ ${escHtml(e.message)}</div></td></tr>`;
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📋</div>暂无预约记录</div></td></tr>`;
    return;
  }

  const statusMap = {
    pending: `<span class="badge" style="background:#fef3c7;color:#d97706">待审核</span>`,
    approved: `<span class="badge badge-green">已通过</span>`,
    rejected: `<span class="badge" style="background:#fee2e2;color:#dc2626">已驳回</span>`,
  };

  tbody.innerHTML = data
    .map(
      (r) => `
    <tr>
      <td><strong>${escHtml(r.venue_name)}</strong></td>
      <td>${r.reserve_date}</td>
      <td>${r.start_time?.substring(0, 5)} – ${r.end_time?.substring(0, 5)}</td>
      <td>${statusMap[r.status] || r.status}</td>
      <td>${r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "—"}</td>
      <td>
        <button class="btn btn-danger" style="height:28px;font-size:12px;padding:0 10px" onclick="cancelReservation(${r.id})">取消</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// ---- 7d. 场地信息 ----
async function renderVenues() {
  let venues;
  try {
    venues = await api.getVenues();
  } catch (e) {
    document.getElementById("venueInfoGrid").innerHTML =
      `<div class="error-text">⚠️ ${escHtml(e.message)}</div>`;
    return;
  }

  document.getElementById("venueInfoGrid").innerHTML = venues
    .map(
      (v, i) => `
    <div class="venue-card">
      <div class="venue-img" style="background:${VENUE_BGS[i % VENUE_BGS.length]}">${VENUE_ICONS[i % VENUE_ICONS.length]}</div>
      <div class="venue-body">
        <div class="venue-name">${escHtml(v.venue_name)}</div>
        <div class="venue-loc">
          <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(v.location || "未指定位置")}
        </div>
        <div class="divider"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;color:var(--text3)">
          <div>开放时段<br/><span style="color:var(--text2);font-weight:500">08:00–20:00</span></div>
          <div>场地状态<br/>${
            v.status === 1
              ? '<span class="badge badge-green" style="margin-top:3px">正常开放</span>'
              : '<span class="badge badge-gray" style="margin-top:3px">暂停使用</span>'
          }
          </div>
        </div>
      </div>
    </div>
  `,
    )
    .join("");
}

// ---- 7e. 场地管理（管理员） ----
async function renderVenueAdmin() {
  const tbody = document.getElementById("venueAdminTable");
  tbody.innerHTML = `<tr><td colspan="6"><div class="loading-text">加载中...</div></td></tr>`;

  let venues;
  try {
    venues = await api.getVenues();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="error-text">⚠️ ${escHtml(e.message)}</div></td></tr>`;
    return;
  }

  if (venues.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🏟️</div>暂无场地</div></td></tr>`;
    return;
  }

  tbody.innerHTML = venues
    .map(
      (v) => `
    <tr>
      <td style="color:var(--text3)">#${v.id}</td>
      <td><strong>${escHtml(v.venue_name)}</strong></td>
      <td>${escHtml(v.location || "—")}</td>
      <td>${
        v.status === 1
          ? '<span class="badge badge-green">开放</span>'
          : '<span class="badge badge-gray">关闭</span>'
      }</td>
      <td style="color:var(--text3)">v${v.version}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn" style="height:28px;font-size:12px;padding:0 10px"
          onclick="editVenue(${v.id},'${escAttr(v.venue_name)}','${escAttr(v.location || "")}',${v.status},${v.version})">编辑</button>
        <button class="btn btn-danger" style="height:28px;font-size:12px;padding:0 10px"
          onclick="deleteVenue(${v.id})">删除</button>
      </td>
    </tr>
  `,
    )
    .join("");
}

// ---- 7f. 预约审核（管理员） ----
async function renderReservAdmin() {
  const tbody = document.getElementById("reservAdminTable");
  tbody.innerHTML = `<tr><td colspan="8"><div class="loading-text">加载中...</div></td></tr>`;

  const params = {};
  const filterDate = document.getElementById("adminFilterDate").value;
  if (filterDate) params.reserve_date = filterDate;

  let data;
  try {
    data = await api.getReservationsInfo(params);
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="error-text">⚠️ ${escHtml(e.message)}</div></td></tr>`;
    return;
  }

  const search = document
    .getElementById("adminFilterSearch")
    .value.toLowerCase();
  let filtered = search
    ? data.filter(
        (r) =>
          r.username.toLowerCase().includes(search) ||
          r.venue_name.toLowerCase().includes(search),
      )
    : data;

  // 按状态筛选
  const statusFilter = document.getElementById("adminFilterStatus").value;
  if (statusFilter) {
    filtered = filtered.filter((r) => r.status === statusFilter);
  }

  // 排序：pending 排最前，然后按日期
  filtered.sort((a, b) => {
    const order = { pending: 0, approved: 1, rejected: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (b.reserve_date || "").localeCompare(a.reserve_date || "");
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">📋</div>暂无匹配的预约记录</div></td></tr>`;
    return;
  }

  const statusMap = {
    pending: `<span class="badge" style="background:#fef3c7;color:#d97706">待审核</span>`,
    approved: `<span class="badge badge-green">已通过</span>`,
    rejected: `<span class="badge" style="background:#fee2e2;color:#dc2626">已驳回</span>`,
  };

  tbody.innerHTML = filtered
    .map(
      (r) => `
    <tr>
      <td style="color:var(--text3)">#${r.id}</td>
      <td>${escHtml(r.username)}</td>
      <td>${escHtml(r.venue_name)}</td>
      <td>${r.reserve_date}</td>
      <td>${r.start_time?.substring(0, 5)} – ${r.end_time?.substring(0, 5)}</td>
      <td>${statusMap[r.status] || r.status}</td>
      <td>${r.create_time ? new Date(r.create_time).toLocaleString("zh-CN") : "—"}</td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        ${r.status === "pending" ? `
          <button class="btn" style="height:28px;font-size:12px;padding:0 10px;background:#10b981;color:#fff;border-color:#10b981"
            onclick="approveReservation(${r.id})">✅ 通过</button>
          <button class="btn btn-danger" style="height:28px;font-size:12px;padding:0 10px"
            onclick="rejectReservation(${r.id})">❌ 驳回</button>
        ` : `
          <button class="btn btn-danger" style="height:28px;font-size:12px;padding:0 10px"
            onclick="cancelReservation(${r.id})">删除</button>
        `}
      </td>
    </tr>
  `,
    )
    .join("");
}

// ---- 7g. 数据统计（管理员） ----
async function renderStats() {
  const [venues, reservs, todayReservs] = await Promise.all([
    api.getVenues(),
    api.getReservationsInfo(),
    api.getReservationsInfo({ reserve_date: todayStr() }),
  ]);

  const openVenues = venues.filter((v) => v.status === 1);
  document.getElementById("statTotal").textContent = reservs.length;
  document.getElementById("statVenueCount").textContent = openVenues.length;
  document.getElementById("statToday").textContent = todayReservs.length;

  const rate =
    openVenues.length > 0
      ? Math.round((todayReservs.length / (openVenues.length * 4)) * 100)
      : 0;
  document.getElementById("statUsageRate").textContent = rate + "%";

  const detail = document.getElementById("statsDetail");
  if (openVenues.length === 0) {
    detail.innerHTML = `<div class="empty-state">暂无场地数据</div>`;
    return;
  }

  const venueStats = {};
  openVenues.forEach((v) => {
    venueStats[v.id] = { name: v.venue_name, total: 0, slots: {} };
  });
  reservs.forEach((r) => {
    if (venueStats[r.venue_id]) venueStats[r.venue_id].total++;
  });

  TIME_SLOTS.forEach((slot) => {
    openVenues.forEach((v) => {
      if (!venueStats[v.id]) return;
      venueStats[v.id].slots[slot.label] = reservs.filter(
        (r) =>
          r.venue_id === v.id &&
          r.start_time === slot.start &&
          r.end_time === slot.end,
      ).length;
    });
  });

  const maxTotal = Math.max(
    ...Object.values(venueStats).map((s) => s.total),
    1,
  );

  detail.innerHTML =
    `<div style="display:flex;gap:24px;flex-wrap:wrap">` +
    Object.values(venueStats)
      .map(
        (vs) => `
      <div style="flex:1;min-width:180px">
        <div style="font-size:13px;font-weight:500;margin-bottom:14px">
          ${escHtml(vs.name)}
          <span style="color:var(--text3);font-weight:400">— ${vs.total} 次</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${TIME_SLOTS.map(
            (slot) => `
            <div>
              <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text3);margin-bottom:4px">
                <span>${slot.label}</span><span>${vs.slots[slot.label] || 0}次</span>
              </div>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.round(((vs.slots[slot.label] || 0) / maxTotal) * 100)}%"></div></div>
            </div>
          `,
          ).join("")}
        </div>
      </div>
    `,
      )
      .join("") +
    `</div>`;
}

// ╔══════════════════════════════════════════════════════════╗
// ║  8. 事件处理函数                                          ║
// ╚══════════════════════════════════════════════════════════╝

// ---- 预约 ----
function openBookModal(venueId, name, loc) {
  bookingVenue = { id: venueId, name, location: loc };
  document.getElementById("bookVenue").value = name;
  document.getElementById("bookLoc").value = loc || "未指定位置";
  const dateInput = document.getElementById("bookDate");
  dateInput.value = todayStr();
  dateInput.setAttribute("min", todayStr()); // 禁止选择过去的日期
  document.getElementById("bookTime").value = "0";
  openModal("bookModal");
}

async function submitBooking() {
  if (!bookingVenue) return;
  const slotIdx = parseInt(document.getElementById("bookTime").value);
  const slot = TIME_SLOTS[slotIdx];
  const date = document.getElementById("bookDate").value;

  // 前端校验：禁止预约过去的日期/时间
  if (!date || date < todayStr()) {
    showToast("不能预约过去的日期", true);
    return;
  }
  if (date === todayStr()) {
    const now = new Date();
    const [h, m] = slot.start.split(":").map(Number);
    const slotTime = h * 60 + m;
    const nowTime = now.getHours() * 60 + now.getMinutes();
    if (slotTime <= nowTime) {
      showToast("不能预约已经过去的时间段", true);
      return;
    }
  }

  try {
    await api.createReservation({
      venue_id: bookingVenue.id,
      reserve_date: date,
      start_time: slot.start,
      end_time: slot.end,
    });
    closeModal("bookModal");
    showToast(`预约已提交，等待管理员审核！${bookingVenue.name} ${date} ${slot.label}`);
    bookingVenue = null;
    if (
      document
        .getElementById("page-myreservations")
        .classList.contains("active")
    ) {
      renderMyReservations();
    }
  } catch (e) {
    showToast(e.message, true);
  }
}

async function approveReservation(id) {
  if (!confirm("确定审核通过此预约吗？")) return;
  try {
    await api.approveReservation(id);
    showToast("预约已审核通过");
    renderReservAdmin();
    if (document.getElementById("page-dashboard").classList.contains("active")) {
      renderDashboard();
    }
  } catch (e) {
    showToast(e.message, true);
  }
}

async function rejectReservation(id) {
  if (!confirm("确定驳回此预约吗？")) return;
  try {
    await api.rejectReservation(id);
    showToast("预约已驳回");
    renderReservAdmin();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function cancelReservation(id) {
  if (!confirm("确定要取消此预约吗？")) return;
  try {
    await api.cancelReservation(id);
    showToast("预约已取消");
    if (
      document
        .getElementById("page-myreservations")
        .classList.contains("active")
    ) {
      renderMyReservations();
    } else if (
      document.getElementById("page-reservadmin").classList.contains("active")
    ) {
      renderReservAdmin();
    } else if (
      document.getElementById("page-dashboard").classList.contains("active")
    ) {
      renderDashboard();
    }
  } catch (e) {
    showToast(e.message, true);
  }
}

// ---- 场地管理 ----
function openVenueModal() {
  document.getElementById("venueModalTitle").textContent = "添加场地";
  document.getElementById("venueSubmitBtn").textContent = "添加场地";
  document.getElementById("editingVenueId").value = "";
  document.getElementById("editingVenueVersion").value = "";
  document.getElementById("newVenueName").value = "";
  document.getElementById("newVenueLoc").value = "";
  document.getElementById("newVenueStatus").value = "1";
  openModal("venueModal");
}

function editVenue(id, name, loc, status, version) {
  document.getElementById("venueModalTitle").textContent = "编辑场地";
  document.getElementById("venueSubmitBtn").textContent = "更新场地";
  document.getElementById("editingVenueId").value = id;
  document.getElementById("editingVenueVersion").value = version;
  document.getElementById("newVenueName").value = name;
  document.getElementById("newVenueLoc").value = loc;
  document.getElementById("newVenueStatus").value = String(status);
  openModal("venueModal");
}

async function submitVenue() {
  const id = document.getElementById("editingVenueId").value;
  const name = document.getElementById("newVenueName").value.trim();
  const loc = document.getElementById("newVenueLoc").value.trim();
  const status = parseInt(document.getElementById("newVenueStatus").value);

  if (!name) {
    showToast("请输入场地名称", true);
    return;
  }

  try {
    if (id) {
      await api.updateVenue(parseInt(id), {
        venue_name: name,
        location: loc || null,
        status,
      });
      showToast("场地更新成功");
    } else {
      await api.createVenue({ venue_name: name, location: loc || null });
      showToast(`场地 "${name}" 添加成功`);
    }
    closeModal("venueModal");
    renderVenueAdmin();
  } catch (e) {
    showToast(e.message, true);
  }
}

async function deleteVenue(id) {
  if (!confirm("确定要删除此场地吗？相关的预约记录也会受影响。")) return;
  try {
    await api.deleteVenue(id);
    showToast("场地已删除");
    renderVenueAdmin();
  } catch (e) {
    showToast(e.message, true);
  }
}

// ╔══════════════════════════════════════════════════════════╗
// ║  9. HTML 转义工具                                         ║
// ╚══════════════════════════════════════════════════════════╝
function escHtml(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escAttr(s) {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ╔══════════════════════════════════════════════════════════╗
// ║ 10. 初始化                                               ║
// ╚══════════════════════════════════════════════════════════╝
function init() {
  // 点击遮罩关闭弹窗
  document.getElementById("bookModal").addEventListener("click", function (e) {
    if (e.target === this) closeModal("bookModal");
  });
  document.getElementById("venueModal").addEventListener("click", function (e) {
    if (e.target === this) closeModal("venueModal");
  });

  // 时钟
  function updateTime() {
    const now = new Date();
    document.getElementById("topbarTime").textContent = now.toLocaleString(
      "zh-CN",
      { hour: "2-digit", minute: "2-digit", second: "2-digit" },
    );
  }
  updateTime();
  setInterval(updateTime, 10000);

  // 默认日期
  const today = todayStr();
  document.getElementById("filterDate").value = today;
  document.getElementById("bookDate").value = today;

  // 自动登录（token 存在时）
  if (api._token) {
    document.getElementById("loginPage").style.display = "none";
    document.getElementById("appPage").style.display = "block";
    try {
      const payload = JSON.parse(atob(api._token.split(".")[1]));
      currentRole = payload.role || "user";
      currentUserId = parseInt(payload.sub);
      currentUser = currentRole === "admin" ? "admin" : "user";
    } catch (_) {
      currentRole = "user";
    }
    updateSidebarUser();
  }
}
init();
