import './style.css';
import {
  authenticateAdmin,
  authenticateUser,
  buildings,
  getUsersByBuilding,
  getBuildingById,
  getVendorById,
  getUserById,
  fetchMeterData,
  type MeterData,
} from './data/mockDatabase';
import { setAuth, getAuth, clearAuth, navigate, getCurrentRoute, type AuthState } from './js/router';

// ============================================
// APP ENTRY POINT
// ============================================

const app = document.querySelector<HTMLDivElement>('#app')!;

// Admin drill-down state
let adminView: 'buildings' | 'services' | 'users' | 'user-data' = 'buildings';
let selectedBuildingId: string = '';
let selectedUserId: string = '';

function render() {
  const route = getCurrentRoute();
  const auth = getAuth();

  if (route === '/admin-dashboard' && auth?.type === 'admin') {
    renderAdminDashboard();
  } else if (route === '/user-login') {
    renderUserLogin();
  } else if (route === '/user-dashboard' && auth?.type === 'user') {
    renderUserDashboard(auth);
  } else {
    renderAdminLogin();
  }
}

// ============================================
// ADMIN LOGIN PAGE
// ============================================
function renderAdminLogin() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <span class="badge badge-admin">Admin Portal</span>
        <h1>Integration Engine</h1>
        <p class="subtitle">Sign in to manage vendor integrations and user data.</p>
        <div id="error" class="error-msg"></div>
        <form id="admin-login-form">
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" id="admin-email" placeholder="admin@integration.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="admin-password" placeholder="Enter password" required />
          </div>
          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <div class="login-footer">
          Are you a user? <a id="go-user-login">Login here</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('admin-login-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (document.getElementById('admin-email') as HTMLInputElement).value;
    const password = (document.getElementById('admin-password') as HTMLInputElement).value;

    if (authenticateAdmin(email, password)) {
      setAuth({ type: 'admin', email, name: 'Admin User' });
      adminView = 'buildings';
      navigate('/admin-dashboard');
    } else {
      const err = document.getElementById('error')!;
      err.textContent = 'Invalid credentials. Try admin@integration.com / admin123';
      err.classList.add('visible');
    }
  });

  document.getElementById('go-user-login')!.addEventListener('click', () => navigate('/user-login'));
}

// ============================================
// ADMIN DASHBOARD — Drill-down Navigation
// ============================================
function getBreadcrumb(): string {
  const crumbs: { label: string; view: string; id?: string }[] = [
    { label: '🏢 Buildings', view: 'buildings' },
  ];

  if (adminView !== 'buildings') {
    const bld = getBuildingById(selectedBuildingId);
    crumbs.push({ label: bld?.name || 'Building', view: 'services', id: selectedBuildingId });
  }

  if (adminView === 'users' || adminView === 'user-data') {
    crumbs.push({ label: '⚡ Electricity', view: 'users' });
  }

  if (adminView === 'user-data') {
    const usr = getUserById(selectedUserId);
    crumbs.push({ label: usr?.name || 'User', view: 'user-data' });
  }

  return crumbs.map((c, i) => {
    const isLast = i === crumbs.length - 1;
    return isLast
      ? `<span class="breadcrumb-current">${c.label}</span>`
      : `<a class="breadcrumb-link" data-view="${c.view}" data-id="${c.id || ''}">${c.label}</a>`;
  }).join('<span class="breadcrumb-sep">›</span>');
}

function renderAdminDashboard() {
  app.innerHTML = `
    <div class="dashboard">
      <nav class="sidebar">
        <div class="sidebar-logo">
          <h2>⚡ IntegrationOS</h2>
          <p>Admin Panel</p>
        </div>
        <ul class="sidebar-nav">
          <li id="nav-buildings" class="${adminView === 'buildings' ? 'active' : ''}">
            🏢 Buildings
          </li>
        </ul>
        <div class="sidebar-footer">
          <button class="btn btn-secondary btn-sm" id="go-user-portal">
            🔗 Open User Portal
          </button>
          <button class="btn btn-secondary btn-sm" id="admin-logout" style="margin-top:8px;">
            ↩ Logout
          </button>
        </div>
      </nav>
      <main class="main-content" id="dashboard-content">
      </main>
    </div>
  `;

  document.getElementById('nav-buildings')!.addEventListener('click', () => {
    adminView = 'buildings';
    renderAdminDashboard();
  });
  document.getElementById('go-user-portal')!.addEventListener('click', () => navigate('/user-login'));
  document.getElementById('admin-logout')!.addEventListener('click', () => { clearAuth(); navigate('/'); });

  const content = document.getElementById('dashboard-content')!;

  switch (adminView) {
    case 'buildings': renderBuildingsView(content); break;
    case 'services': renderServicesView(content); break;
    case 'users': renderElectricityUsersView(content); break;
    case 'user-data': renderUserDataView(content); break;
  }

  // Wire up breadcrumb clicks
  content.querySelectorAll('.breadcrumb-link').forEach(link => {
    link.addEventListener('click', () => {
      const view = (link as HTMLElement).dataset.view as any;
      const id = (link as HTMLElement).dataset.id;
      adminView = view;
      if (view === 'services' && id) selectedBuildingId = id;
      renderAdminDashboard();
    });
  });
}

// --- VIEW 1: Building Listing ---
function renderBuildingsView(container: HTMLElement) {
  container.innerHTML = `
    <div class="main-header">
      <div>
        <h1>Buildings</h1>
        <p>${buildings.length} building${buildings.length !== 1 ? 's' : ''} managed</p>
      </div>
    </div>
    <div class="vendor-grid">
      ${buildings.map(b => `
        <div class="vendor-card building-card" data-id="${b.id}">
          <div class="vendor-card-header">
            <div class="vendor-icon" style="background: #6C5CE7">🏢</div>
            <div style="flex:1">
              <h3>${b.name}</h3>
              <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${b.address}</div>
            </div>
          </div>
          <div class="vendor-stats">
            <div class="vendor-stat">
              <div class="label">Type</div>
              <div class="value" style="font-size:14px">${b.type}</div>
            </div>
            <div class="vendor-stat">
              <div class="label">Total Units</div>
              <div class="value">${b.total_units}</div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${b.services.map(s => `<span class="service-tag">${s === 'electricity' ? '⚡' : '💧'} ${s}</span>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.building-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedBuildingId = (card as HTMLElement).dataset.id!;
      adminView = 'services';
      renderAdminDashboard();
    });
  });
}

// --- VIEW 2: Building Services (Electricity, etc.) ---
function renderServicesView(container: HTMLElement) {
  const building = getBuildingById(selectedBuildingId);
  if (!building) return;

  container.innerHTML = `
    <div class="breadcrumb">${getBreadcrumb()}</div>
    <div class="main-header">
      <div>
        <h1>${building.name}</h1>
        <p>${building.address} — ${building.type}</p>
      </div>
    </div>
    <div class="vendor-grid">
      ${building.services.map(s => `
        <div class="vendor-card service-card" data-service="${s}">
          <div class="vendor-card-header">
            <div class="vendor-icon" style="background: ${s === 'electricity' ? '#fdcb6e' : '#74b9ff'}">
              ${s === 'electricity' ? '⚡' : '💧'}
            </div>
            <div style="flex:1">
              <h3>${s.charAt(0).toUpperCase() + s.slice(1)}</h3>
            </div>
            <span class="status status-active">active</span>
          </div>
          <div class="vendor-stats">
            <div class="vendor-stat">
              <div class="label">Vendor</div>
              <div class="value" style="font-size:14px">Capital Meter</div>
            </div>
            <div class="vendor-stat">
              <div class="label">Meters</div>
              <div class="value">${getUsersByBuilding(building.id).length}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      adminView = 'users';
      renderAdminDashboard();
    });
  });
}

// --- VIEW 3: Electricity Users/Meters ---
function renderElectricityUsersView(container: HTMLElement) {
  const building = getBuildingById(selectedBuildingId);
  if (!building) return;

  const usrs = getUsersByBuilding(selectedBuildingId);

  container.innerHTML = `
    <div class="breadcrumb">${getBreadcrumb()}</div>
    <div class="main-header">
      <div>
        <h1>⚡ Electricity — ${building.name}</h1>
        <p>${usrs.length} meter${usrs.length !== 1 ? 's' : ''} connected</p>
      </div>
    </div>
    <table class="data-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Phone</th>
          <th>Unit / Meter</th>
          <th>Vendor</th>
          <th>Synced</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${usrs.map(u => {
    const vendor = getVendorById(u.vendor_id);
    return `
          <tr>
            <td class="user-name">${u.name}</td>
            <td>${u.email}</td>
            <td>${u.phone}</td>
            <td><code style="color:var(--accent-light)">${u.unit_no} (${u.consumer_id})</code></td>
            <td>${vendor?.name || '—'}</td>
            <td>${u.sync_date}</td>
            <td><button class="btn btn-secondary btn-sm view-user-btn" data-id="${u.id}">View Data →</button></td>
          </tr>`;
  }).join('')}
      </tbody>
    </table>
  `;

  container.querySelectorAll('.view-user-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      selectedUserId = (btn as HTMLElement).dataset.id!;
      adminView = 'user-data';
      renderAdminDashboard();
    });
  });
}

// --- VIEW 4: Individual User Electricity Data (Live) ---
function renderUserDataView(container: HTMLElement) {
  const user = getUserById(selectedUserId);
  if (!user) return;

  const vendor = getVendorById(user.vendor_id);

  container.innerHTML = `
    <div class="breadcrumb">${getBreadcrumb()}</div>
    <div class="main-header">
      <div>
        <h1>📊 ${user.name} — Meter ${user.consumer_id}</h1>
        <p>Live data from ${vendor?.name || 'Vendor'}</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="admin-refresh">🔄 Refresh</button>
    </div>
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Fetching live meter data...</p>
    </div>
  `;

  document.getElementById('admin-refresh')?.addEventListener('click', () => {
    adminView = 'user-data';
    renderAdminDashboard();
  });

  fetchMeterData(user)
    .then(meter => renderMeterCards(container, meter))
    .catch(err => {
      const loading = container.querySelector('.loading-state');
      if (loading) {
        loading.innerHTML = `
          <div style="font-size:40px">⚠️</div>
          <h3 style="color:var(--danger);margin-top:12px">Failed to fetch meter data</h3>
          <p style="color:var(--text-muted)">${err.message}</p>
        `;
      }
    });
}

// --- SHARED: Null-safe meter HTML builder ---
function buildMeterHTML(m: MeterData): string {
  const balanceClass = m.balance >= 0 ? 'positive' : 'negative';
  const rechargeDate = m.last_recharge_timestamp
    ? new Date(parseInt(m.last_recharge_timestamp)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return `
    <!-- Status Row -->
    <div class="status-row">
      ${m.status != null ? `
        <div class="status-chip status-chip-${m.status === 'UP' ? 'up' : 'down'}">
          <span class="status-dot"></span>
          Meter ${m.status}
        </div>
      ` : ''}
      ${m.cut_status != null ? `
        <div class="status-chip status-chip-${m.cut_status === 'NORMAL' ? 'normal' : 'cut'}">
          ${m.cut_status === 'NORMAL' ? '🟢' : '🔴'} ${m.cut_status}
        </div>
      ` : ''}
      ${m.current_source != null ? `
        <div class="status-chip status-chip-source">
          ⚡ Source: ${m.current_source}
        </div>
      ` : ''}
    </div>

    <!-- Balance + Load -->
    <div class="metric-grid">
      <div class="metric-card metric-balance ${balanceClass}">
        <div class="metric-label">Current Balance</div>
        <div class="metric-value">₹${m.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        <div class="metric-sub">${m.balance < 0 ? '⚠️ Account in debt — meter may be cut' : '✅ Account in good standing'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Current Load</div>
        <div class="metric-value">${m.current_load != null ? `${m.current_load} <span class="metric-unit">kW</span>` : '<span style="color:var(--text-muted)">N/A</span>'}</div>
        <div class="metric-sub">${m.current_load != null ? (m.current_load > 0 ? '🔌 Power is flowing' : '⏸️ No active consumption') : 'Load data not available from this vendor'}</div>
      </div>
    </div>

    <!-- Meter Info -->
    <div class="section-card">
      <h3>📋 Meter Information</h3>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Consumer Name</div>
          <div class="info-value">${m.consumer_name}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Meter Number</div>
          <div class="info-value">${m.meter_no}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Unit Number</div>
          <div class="info-value">${m.unit_no}</div>
        </div>
        <div class="info-item">
          <div class="info-label">Site</div>
          <div class="info-value">${m.site_id}</div>
        </div>
      </div>
    </div>

    <!-- Grid Readings -->
    <div class="section-card">
      <h3>🔋 Grid Readings${m.billing_type_grid ? ` (${m.billing_type_grid})` : ''}</h3>
      <div class="reading-grid">
        <div class="reading-item">
          <div class="reading-label">Total kWh</div>
          <div class="reading-value">${m.grid_reading_kwh.toLocaleString()}</div>
        </div>
        ${m.grid_reading_kvah != null ? `
          <div class="reading-item">
            <div class="reading-label">Total kVAh</div>
            <div class="reading-value">${m.grid_reading_kvah.toLocaleString()}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- DG Readings -->
    <div class="section-card">
      <h3>⚙️ DG Readings${m.billing_type_dg ? ` (${m.billing_type_dg})` : ''}</h3>
      <div class="reading-grid">
        <div class="reading-item">
          <div class="reading-label">Total kWh</div>
          <div class="reading-value">${m.dg_reading_kwh.toLocaleString()}</div>
        </div>
        ${m.dg_reading_kvah != null ? `
          <div class="reading-item">
            <div class="reading-label">Total kVAh</div>
            <div class="reading-value">${m.dg_reading_kvah.toLocaleString()}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Last Recharge -->
    <div class="section-card">
      <h3>💳 Last Recharge</h3>
      <div class="reading-grid">
        <div class="reading-item">
          <div class="reading-label">Amount</div>
          <div class="reading-value">₹${m.last_recharge_amount.toLocaleString('en-IN')}</div>
        </div>
        <div class="reading-item">
          <div class="reading-label">Date</div>
          <div class="reading-value">${rechargeDate}</div>
        </div>
      </div>
    </div>

    ${m.last_updated != null ? `<div class="last-updated">🕐 Last updated: ${m.last_updated}</div>` : ''}
  `;
}

function renderMeterCards(container: HTMLElement, m: MeterData) {
  const loading = container.querySelector('.loading-state');
  if (loading) loading.remove();

  const wrapper = document.createElement('div');
  wrapper.className = 'meter-data-section';
  wrapper.innerHTML = buildMeterHTML(m);
  container.appendChild(wrapper);
}

// ============================================
// USER LOGIN PAGE
// ============================================
function renderUserLogin() {
  app.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <span class="badge badge-user">User Portal</span>
        <h1>Welcome</h1>
        <p class="subtitle">Sign in to view your electricity meter data.</p>
        <div id="error" class="error-msg"></div>
        <form id="user-login-form">
          <div class="form-group">
            <label>Email Address</label>
            <input type="email" id="user-email" placeholder="test01@example.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="user-password" placeholder="Enter password" required />
          </div>
          <button type="submit" class="btn btn-primary">Sign In</button>
        </form>
        <div class="login-footer">
          Are you an admin? <a id="go-admin-login">Login here</a>
        </div>
      </div>
    </div>
  `;

  document.getElementById('user-login-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (document.getElementById('user-email') as HTMLInputElement).value;
    const password = (document.getElementById('user-password') as HTMLInputElement).value;

    const user = authenticateUser(email, password);
    if (user) {
      setAuth({
        type: 'user',
        email: user.email,
        name: user.name,
        vendor_id: user.vendor_id,
        account_id: user.consumer_id,
        account_label: `Meter ${user.consumer_id} — ${getBuildingById(user.building_id)?.name || 'Unknown'}`,
        consumer_id: user.consumer_id,
        site_id: user.site_id,
      });
      navigate('/user-dashboard');
    } else {
      const err = document.getElementById('error')!;
      err.textContent = 'No account found. Your vendor may not have been integrated yet.';
      err.classList.add('visible');
    }
  });

  document.getElementById('go-admin-login')!.addEventListener('click', () => navigate('/'));
}

// ============================================
// USER DASHBOARD — Live Meter Data
// ============================================
function renderUserDashboard(auth: AuthState) {
  const vendor = getVendorById(auth.vendor_id!);

  app.innerHTML = `
    <div class="user-dashboard">
      <div class="user-header">
        <div class="user-header-info">
          <h1>👋 Hello, ${auth.name}</h1>
          <div class="vendor-tag">Powered by ${vendor?.name || 'Unknown Vendor'}</div>
          <div class="project-tag">⚡ ${auth.account_label}</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" id="refresh-btn">🔄 Refresh</button>
          <button class="btn btn-secondary btn-sm" id="user-logout">Logout</button>
        </div>
      </div>
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p>Fetching live meter data...</p>
      </div>
    </div>
  `;

  document.getElementById('user-logout')!.addEventListener('click', () => { clearAuth(); navigate('/user-login'); });
  document.getElementById('refresh-btn')!.addEventListener('click', () => renderUserDashboard(auth));

  const fakeUser = {
    vendor_id: auth.vendor_id!,
    consumer_id: auth.consumer_id!,
    site_id: auth.site_id!,
  };

  fetchMeterData(fakeUser as any)
    .then(meter => renderUserMeterView(auth, vendor, meter))
    .catch(err => {
      const loading = document.querySelector('.loading-state');
      if (loading) {
        loading.innerHTML = `
          <div style="font-size:40px">⚠️</div>
          <h3 style="color:var(--danger);margin-top:12px">Failed to fetch meter data</h3>
          <p style="color:var(--text-muted)">${err.message}</p>
          <button class="btn btn-secondary btn-sm" id="retry-btn" style="margin-top:16px">Retry</button>
        `;
        document.getElementById('retry-btn')?.addEventListener('click', () => renderUserDashboard(auth));
      }
    });
}

function renderUserMeterView(auth: AuthState, vendor: any, m: MeterData) {
  app.innerHTML = `
    <div class="user-dashboard">
      <div class="user-header">
        <div class="user-header-info">
          <h1>👋 Hello, ${auth.name}</h1>
          <div class="vendor-tag">Powered by ${vendor?.name || 'Unknown Vendor'}</div>
          <div class="project-tag">⚡ ${auth.account_label}</div>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" id="refresh-btn">🔄 Refresh</button>
          <button class="btn btn-secondary btn-sm" id="user-logout">Logout</button>
        </div>
      </div>
      ${buildMeterHTML(m)}
    </div>
  `;

  document.getElementById('user-logout')!.addEventListener('click', () => { clearAuth(); navigate('/user-login'); });
  document.getElementById('refresh-btn')!.addEventListener('click', () => renderUserDashboard(auth));
}

// ============================================
// ROUTER LISTENER
// ============================================
window.addEventListener('hashchange', render);
render();
