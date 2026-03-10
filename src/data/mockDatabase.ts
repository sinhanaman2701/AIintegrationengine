// ============================================
// MOCK DATABASE + LIVE API LAYER
// ============================================


// --- ADMIN CREDENTIALS ---
export const adminCredentials = {
  email: "admin@integration.com",
  password: "admin123",
  name: "Admin User",
};

// --- VENDOR API CONFIG ---
export interface VendorApiConfig {
  apiKey: string;
  baseUrl: string;
  siteIds: { grid: string; dg: string };
}

// --- VENDORS TABLE ---
export interface Vendor {
  id: string;
  name: string;
  status: "active" | "pending";
  api_endpoint: string;
  logo_color: string;
  apiConfig: VendorApiConfig;
}

export const vendors: Vendor[] = [
  {
    id: "capital_meter",
    name: "Capital Meter",
    status: "active",
    api_endpoint: "https://smartprepaidmeters.com/integration_api/v1",
    logo_color: "#e17055",
    apiConfig: {
      apiKey: "YW5hcm9ja19hZG1pbjpjYXBpdGFsQDE5NzM=",
      baseUrl: "/api/meter",
      siteIds: { grid: "SpectrumMall002", dg: "SpectrumMallDG001" },
    },
  },
  {
    id: "neptune_ems",
    name: "Neptune Energia",
    status: "active",
    api_endpoint: "https://emsprepaidapi.neptuneenergia.com/service.asmx",
    logo_color: "#00b894",
    apiConfig: {
      apiKey: "",
      baseUrl: "/api/neptune",
      siteIds: { grid: "114", dg: "114" },
    },
  },
];

// --- BUILDINGS TABLE ---
export interface Building {
  id: string;
  name: string;
  address: string;
  type: string;
  total_units: number;
  services: string[];  // e.g., ["electricity", "water", "gas"]
}

export const buildings: Building[] = [
  {
    id: "spectrum_metro",
    name: "Spectrum Metro Mall",
    address: "Sector 75, Noida, UP",
    type: "Commercial Mall",
    total_units: 120,
    services: ["electricity"],
  },
  {
    id: "neptune_demo_site",
    name: "Neptune Demo Site",
    address: "Demo Location",
    type: "Demo Site",
    total_units: 10,
    services: ["electricity"],
  },
];

// --- USERS TABLE ---
export interface AppUser {
  id: string;
  building_id: string;
  vendor_id: string;
  name: string;
  email: string;
  phone: string;
  unit_no: string;
  consumer_id: string;
  site_id: string;
  sync_date: string;
  password: string;
}

export const users: AppUser[] = [
  {
    id: "u1",
    building_id: "spectrum_metro",
    vendor_id: "capital_meter",
    name: "Test User 01",
    email: "test01@example.com",
    phone: "+919876543210",
    unit_no: "C-09",
    consumer_id: "C-09",
    site_id: "SpectrumMall002",
    sync_date: "2026-03-04",
    password: "test123",
  },
  {
    id: "u2",
    building_id: "neptune_demo_site",
    vendor_id: "neptune_ems",
    name: "Demo User 01",
    email: "demo01@example.com",
    phone: "+919876543211",
    unit_no: "DEMO-1",
    consumer_id: "DEMO-1",
    site_id: "114",
    sync_date: "2026-03-04",
    password: "demo123",
  },
];

// --- ELECTRICITY METER SUPER SCHEMA ---
export interface MeterData {
  consumer_id: string;
  consumer_name: string;
  meter_no: string;
  unit_no: string;
  site_id: string;
  status: string | null;
  cut_status: string | null;
  balance: number;
  current_load: number | null;
  current_source: string | null;
  grid_reading_kwh: number;
  grid_reading_kvah: number | null;
  dg_reading_kwh: number;
  dg_reading_kvah: number | null;
  last_recharge_amount: number;
  last_recharge_timestamp: string | null;
  billing_type_grid: string | null;
  billing_type_dg: string | null;
  last_updated: string | null;
}

// --- TRANSFORMER: Raw API → Super Schema ---
export function transformToSuperSchema(raw: any): MeterData {
  const d = raw.data;
  return {
    consumer_id: d.consumer_id,
    consumer_name: d.consumer_name,
    meter_no: d.meter_no,
    unit_no: d.unit_no,
    site_id: d.site_id,
    status: d.status,
    cut_status: d.cut_status,
    balance: parseFloat(d.balance) || 0,
    current_load: parseFloat(d.current_load) || 0,
    current_source: d.current_source || "EB",
    grid_reading_kwh: parseFloat(d.grid_reading_kwh) || 0,
    grid_reading_kvah: parseFloat(d.grid_reading_kvah) || 0,
    dg_reading_kwh: parseFloat(d.dg_reading_kwh) || 0,
    dg_reading_kvah: parseFloat(d.dg_reading_kvah) || 0,
    last_recharge_amount: parseFloat(d.last_recharge_amount) || 0,
    last_recharge_timestamp: d.last_recharge_timestamp,
    billing_type_grid: d.current_bill_plan_grid_billing_type || "KWH",
    billing_type_dg: d.current_bill_plan_dg_billing_type || "KWH",
    last_updated: d.last_updated || "Unknown",
  };
}

// --- TRANSFORMER: Neptune/EMS → Super Schema ---
function transformNeptune(raw: any, siteId: string): MeterData {
  const d = Array.isArray(raw.data) ? raw.data[0] : raw.data;
  return {
    consumer_id: d.CA_ADDRESS,
    consumer_name: d.CA_NAME,
    meter_no: d.DEVICE_SLNO?.toString() || "Unknown",
    unit_no: d.CA_ADDRESS,
    site_id: siteId,
    status: d.STATUS === "Active" ? "UP" : "DOWN",
    cut_status: null,
    balance: typeof d.PV_BAL === "number" ? d.PV_BAL : parseFloat(d.PV_BAL) || 0,
    current_load: d.EB_LOAD != null && d.DG_LOAD != null
      ? (parseFloat(d.EB_LOAD) || 0) + (parseFloat(d.DG_LOAD) || 0)
      : d.EB_LOAD != null ? parseFloat(d.EB_LOAD) || 0
        : null,
    current_source: null,
    grid_reading_kwh: typeof d.EB_PV_READING === "number" ? d.EB_PV_READING : parseFloat(d.EB_PV_READING) || 0,
    grid_reading_kvah: null,
    dg_reading_kwh: typeof d.DG_PV_READING === "number" ? d.DG_PV_READING : parseFloat(d.DG_PV_READING) || 0,
    dg_reading_kvah: null,
    last_recharge_amount: typeof d.last_recharge === "number" ? d.last_recharge : parseFloat(d.last_recharge) || 0,
    last_recharge_timestamp: null,
    billing_type_grid: d.PV_BILLING_MODE || null,
    billing_type_dg: null,
    last_updated: null,
  };
}

// --- LIVE API FETCH ---
export async function fetchMeterData(user: AppUser): Promise<MeterData> {
  const vendor = getVendorById(user.vendor_id);
  if (!vendor) throw new Error("Vendor not found");

  // --- INTEGRATION ENGINE POC ROUTE ---
  // --- END ENGINE POC ROUTE ---

  if (vendor.id === "capital_meter") {
    return fetchCapitalMeter(vendor, user);
  } else if (vendor.id === "neptune_ems") {
    return fetchNeptune(vendor, user);
  }

  throw new Error(`Unknown vendor: ${vendor.id}`);
}

async function fetchCapitalMeter(vendor: Vendor, user: AppUser): Promise<MeterData> {
  const url = `${vendor.apiConfig.baseUrl}/meter?site_id=${user.site_id}&consumer_id=${user.consumer_id}`;

  const res = await fetch(url, {
    headers: { apikey: vendor.apiConfig.apiKey },
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);

  const raw = await res.json();
  if (raw.status !== "T") throw new Error(raw.message || "API returned failure");

  return transformToSuperSchema(raw);
}

async function fetchNeptune(vendor: Vendor, user: AppUser): Promise<MeterData> {
  const body = new URLSearchParams();
  body.append("TXN_NAME", "LIVEDATAFORSINGLE");
  body.append("DATA", `{Reference_No:"${user.consumer_id}"}`);
  body.append("SITECODE", "114");
  body.append("username", "Admin");
  body.append("password", "EMS@123DEMO");

  const res = await fetch(`${vendor.apiConfig.baseUrl}/liveEmsTransaction`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const raw = await res.json();
  if (raw.Status !== "Success") throw new Error(raw.Msg || "API returned failure");

  return transformNeptune(raw, user.site_id);
}

// --- QUERY HELPERS ---
export function authenticateAdmin(email: string, password: string): boolean {
  return email === adminCredentials.email && password === adminCredentials.password;
}

export function authenticateUser(email: string, password: string): AppUser | null {
  return users.find(u => u.email === email && u.password === password) || null;
}

export function getUsersByBuilding(buildingId: string): AppUser[] {
  return users.filter(u => u.building_id === buildingId);
}

export function getBuildingById(buildingId: string): Building | undefined {
  return buildings.find(b => b.id === buildingId);
}

export function getVendorById(vendorId: string): Vendor | undefined {
  return vendors.find(v => v.id === vendorId);
}

export function getUserById(userId: string): AppUser | undefined {
  return users.find(u => u.id === userId);
}
