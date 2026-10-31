import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  DatabaseBackup,
  FileText,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { api } from "./lib/api";

import { THAI_PROVINCES } from "./lib/thai-provinces";

import type {
  CallBackResult,
  Customer,
  Policy,
  Product,
} from "../server/domain/types";

type Page<T> = { items: T[]; total: number; page: number; pageSize: number };

type PolicyRow = Policy & {
  daysUntilExpiry: number;
  customer?: Customer;
  product?: Product;
};

type SyncResult = { policyId: string; status: string; message: string };

type RenewalResult = {
  policyId: string;
  policyNumber: string;
  effectiveDate: string;
  expiryDate: string;
  renewalStatus: string;
  alreadyRenewed: boolean;
};

type Portal = "manage";

const base = "/api/admin";

const numberFormat = new Intl.NumberFormat("en-US");

const money = (value: number) => `฿${numberFormat.format(value)}`;

const dateText = (value?: string | null) =>
  value
    ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const dateTimeText = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const dateTimeInput = (value?: string) => {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
};

const channels = ["VOICE", "SMS", "EMAIL", "LINE", "DIGITAL"];

const statuses = [
  "NOT_STARTED",
  "CONTACT_PENDING",
  "CONTACTED",
  "INTERESTED",
  "CALLBACK_REQUESTED",
  "NOT_INTERESTED",
  "RENEWED",
  "EXPIRED",
  "CANCELLED",
];

const statusLabels: Record<string, string> = {
  NOT_STARTED: "Not started",
  CONTACT_PENDING: "Contact pending",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  CALLBACK_REQUESTED: "Callback requested",
  NOT_INTERESTED: "Not interested",
  RENEWED: "Renewed",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
  NOT_SYNCED: "Not synced",
  SYNCED: "Synced",
  OUTDATED: "Outdated",
  FAILED: "Failed",
  SKIPPED_DNC: "DNC",
  INVALID_PHONE: "Invalid phone",
  SCHEMA_MISMATCH: "Schema mismatch",
  NEW: "New",
  CLOSED: "Closed",
  CONVERTED: "Completed",
  SCHEDULED: "Scheduled",
  COMPLETED: "Completed",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
  RENEWAL_INTERESTED: "Renewal interested",
  PREMIUM_INQUIRY: "Premium inquiry",
  DISCOUNT_NEGOTIATION: "Discount negotiation",
  COVERAGE_INQUIRY: "Coverage inquiry",
  PLAN_COMPARISON: "Plan comparison",
  PAYMENT_INQUIRY: "Payment inquiry",
  POLICY_CHANGE: "Policy change",
  COMPLAINT: "Complaint",
  CALLBACK_REQUEST: "Callback request",
  OTHER: "Other",
};

const managementNav = [
  { key: "dashboard", label: "Overview", icon: LayoutDashboard },
  { key: "customers", label: "Customers", icon: Users },
  { key: "products", label: "Products", icon: ShieldCheck },
  { key: "policies", label: "Policies", icon: FileText },
  { key: "renewals", label: "Renewals", icon: RefreshCw },
  { key: "call-back-results", label: "Call Back Result", icon: ClipboardList },
  { key: "audit", label: "Audit log", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
];

const portalRoot = (portal: Portal) => "/manage";

const isPathFor = (path: string, root: string) =>
  path === root || path.startsWith(`${root}/`);

export function Root() {
  const portal: Portal = "manage";
  const root = portalRoot(portal);
  const path = window.location.pathname;
  const [session, setSession] = useState<{
    authenticated: boolean;
    username: string;
  } | null>(null);
  useEffect(() => {
    document.title = "MFEC Insurance Management";
    api<{ authenticated: boolean; username: string }>(
      `${base}/auth/session?portal=${portal}`,
    )
      .then(setSession)
      .catch(() => setSession({ authenticated: false, username: "" }));
  }, []);
  if (path === "/") {
    window.location.replace(root);
    return null;
  }
  if (!isPathFor(path, root))
    return <div className="empty-state">Page not found</div>;
  if (!session) return <div className="admin-loading">Loading...</div>;
  if (!session.authenticated)
    return (
      <Login
        portal={portal}
        returnPath={
          path === root + "/login"
            ? root
            : path + window.location.search + window.location.hash
        }
        onLogin={setSession}
      />
    );
  if (path === root + "/login") window.history.replaceState({}, "", root);
  return <AdminPortal username={session.username} portal={portal} />;
}

function Login({
  portal,
  returnPath,
  onLogin,
}: {
  portal: Portal;
  returnPath: string;
  onLogin: (value: { authenticated: boolean; username: string }) => void;
}) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const passwordChanged = new URLSearchParams(window.location.search).has(
    "passwordChanged",
  );
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api<{ authenticated: boolean; username: string }>(
        base + "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ username, password, portal }),
        },
      );
      window.history.replaceState({}, "", returnPath);
      onLogin(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-login ">
      <div className="login-brand">
        <span>
          <ShieldCheck size={27} />
        </span>
        <b>MFEC Insurance Management</b>
        <small>INSURANCE MANAGEMENT</small>
      </div>
      <form onSubmit={submit}>
        <h1>Sign in</h1>
        <p>Manage customers, policies, and renewals</p>
        {passwordChanged && (
          <div className="admin-success" role="status">
            Password updated. Sign in with your new password.
          </div>
        )}
        <label>
          Username
          <input
            autoComplete="username"
            required
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        <button className="admin-primary" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}

function AdminPortal({
  username,
  portal,
}: {
  username: string;
  portal: Portal;
}) {
  const section = window.location.pathname.split("/")[2] || "dashboard";
  const [menuOpen, setMenuOpen] = useState(false);
  const root = portalRoot(portal);
  const navigation = managementNav;
  async function logout() {
    await api(base + "/auth/logout", {
      method: "POST",
      body: JSON.stringify({ portal }),
    });
    window.location.href = root + "/login";
  }
  return (
    <div className="admin-shell ">
      <aside className={menuOpen ? "admin-sidebar open" : "admin-sidebar"}>
        <div className="admin-sidebar-brand">
          <span>
            <ShieldCheck size={21} />
          </span>
          <b>MFEC Insurance</b>
          <small>INSURANCE MANAGEMENT</small>
        </div>
        <nav>
          {navigation.map(({ key, label, icon: Icon }) => (
            <a
              key={key}
              className={section === key ? "active" : ""}
              href={
                root +
                (["dashboard", "integration"].includes(key) ? "" : "/" + key)
              }
            >
              <Icon size={18} />
              {label}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={logout}>
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <button
            className="admin-menu-button"
            aria-label="Menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <Menu size={20} />
          </button>
          <div className="admin-breadcrumb">
            MFEC Insurance Management <ChevronRight size={14} />
            <b>
              {navigation.find((item) => item.key === section)?.label ||
                "Page not found"}
            </b>
          </div>
          <GlobalSearch />
          <div className="admin-user">
            <span>{username.slice(0, 1).toUpperCase()}</span>
            {username}
          </div>
        </header>
        <main className="admin-content">
          {section === "dashboard" ? (
            <Dashboard />
          ) : section === "customers" ? (
            <Customers />
          ) : section === "products" ? (
            <Products />
          ) : section === "policies" ? (
            <Policies />
          ) : section === "settings" ? (
            <SystemSettings />
          ) : section === "renewals" ? (
            <Policies renewal />
          ) : section === "call-back-results" ? (
            <CallBackResults />
          ) : section === "audit" ? (
            <Audit />
          ) : (
            <div className="empty-state">Page not found</div>
          )}
        </main>
      </div>
    </div>
  );
}

function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-page-head">
      <div>
        {eyebrow && <span>{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="admin-page-action">{action}</div>}
    </div>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span
      className={`admin-badge ${value.toLowerCase().replace(/[^a-z]/g, "-")}`}
    >
      {statusLabels[value] || value}
    </span>
  );
}

function Empty({ text = "No records found" }: { text?: string }) {
  return <div className="admin-empty">{text}</div>;
}

function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <div className="admin-error" role="alert">
      {error}
    </div>
  ) : null;
}

function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="admin-pager">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`
          : "0"}{" "}
        of {total} records
      </span>
      <div>
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>
        <span>
          {page} / {pages}
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-modal-backdrop" onMouseDown={onClose}>
      <div
        className="admin-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <h2>{title}</h2>
          <button aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useList<T>(url: string) {
  const [data, setData] = useState<Page<T>>({
    items: [],
    total: 0,
    page: 1,
    pageSize: 20,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, refresh] = useState(0);
  useEffect(() => {
    setLoading(true);
    api<Page<T>>(url)
      .then(setData)
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [url, version]);
  return { data, error, loading, refresh: () => refresh((v) => v + 1) };
}

function usePolicyRenewalEvents(onRenewal: () => void) {
  const callback = useRef(onRenewal);
  callback.current = onRenewal;
  useEffect(() => {
    const events = new EventSource(`${base}/policies/renewal-events`);
    const onEvent = () => callback.current();
    events.addEventListener("policy-renewed", onEvent);
    return () => events.close();
  }, []);
}

function Dashboard() {
  const [data, setData] = useState<{
    kpis: Record<string, number>;
    charts: Record<string, { label: string; value: number }[]>;
  } | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    api<typeof data>(`${base}/dashboard`)
      .then(setData)
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    void load();
  }, []);
  usePolicyRenewalEvents(() => {
    void load();
  });
  const kpis = data?.kpis;
  return (
    <>
      <PageHead
        eyebrow="Dashboard"
        title="Business overview"
        description="Customers, policies, and renewal activity"
      />
      <ErrorNotice error={error} />
      {!data ? (
        <div className="admin-loading">Loading...</div>
      ) : (
        <>
          <div className="kpi-grid">
            {[
              ["Total customers", kpis?.totalCustomers, "customers"],
              ["Active policies", kpis?.activePolicies, "policies"],
              ["Total premium", money(kpis?.totalPremium || 0), "policies"],
              ["Expiring in 30 days", kpis?.expiring30, "renewals"],
              ["Contact pending", kpis?.contactPending, "renewals"],
              ["Renewed", kpis?.renewed, "renewals"],
            ].map(([label, value, link]) => (
              <a
                className="kpi-tile"
                key={String(label)}
                href={`/manage/${link}`}
              >
                <span>{label}</span>
                <strong>
                  {typeof value === "number"
                    ? numberFormat.format(value)
                    : value}
                </strong>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
          <div className="dashboard-row">
            <div className="admin-panel">
              <div className="panel-head">
                <h2>Policies nearing expiry</h2>
                <a href="/manage/renewals">
                  View records <ArrowRight size={15} />
                </a>
              </div>
              <div className="expiry-bars">
                {[
                  ["7 days", kpis?.expiring7],
                  ["30 days", kpis?.expiring30],
                  ["60 days", kpis?.expiring60],
                  ["90 days", kpis?.expiring90],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <span>{label}</span>
                    <div>
                      <i
                        style={{
                          width: `${Math.max(3, (Number(value) / Math.max(1, kpis?.expiring90 || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <b>{value}</b>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-panel">
              <div className="panel-head">
                <h2>Renewal status</h2>
              </div>
              <div className="dashboard-status-list">
                {data.charts.byRenewal.map((item) => (
                  <div key={item.label}>
                    <Badge value={item.label} />
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="dashboard-row">
            <div className="admin-panel">
              <div className="panel-head">
                <h2>Policies by product</h2>
              </div>
              <div className="mini-bars">
                {data.charts.byProduct.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <div>
                      <i
                        style={{
                          width: `${(item.value / Math.max(...data.charts.byProduct.map((v) => v.value), 1)) * 100}%`,
                        }}
                      />
                    </div>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

const blankCustomer = (): Customer => ({
  customerId: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  preferredChannel: "VOICE",
  province: "",
  dnc: false,
  createdAt: "",
  updatedAt: "",
});

function Customers() {
  const id = window.location.pathname.split("/")[3];
  if (id) return <Customer360 id={id} />;
  return <CustomerList />;
}

function CustomerList() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState("");
  const [dnc, setDnc] = useState("");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState("");
  const url = `${base}/customers?search=${encodeURIComponent(search)}&channel=${channel}&dnc=${dnc}&page=${page}`;
  const { data, loading, refresh } = useList<Customer>(url);
  async function remove(item: Customer) {
    if (!window.confirm(`Delete customer ${item.firstName} ${item.lastName}?`))
      return;
    try {
      await api(`${base}/customers/${item.customerId}`, { method: "DELETE" });
      refresh();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="Records"
        title="Customers"
        description="Search and manage policyholders"
        action={
          <button
            className="admin-primary"
            onClick={() => setEditing(blankCustomer())}
          >
            <Plus size={17} /> Add customer
          </button>
        }
      />
      <ErrorNotice error={error} />
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17} />
          <input
            placeholder="Name, phone, or customer ID"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={channel}
          onChange={(event) => {
            setChannel(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All channels</option>
          {channels.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select
          value={dnc}
          onChange={(event) => {
            setDnc(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All</option>
          <option value="true">DNC</option>
          <option value="false">Contactable</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Full name</th>
              <th>Phone</th>
              <th>Province</th>
              <th>Channel</th>
              <th>DNC</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.customerId}>
                <td>
                  <a
                    href={`/manage/customers/${item.customerId}`}
                    className="table-link"
                  >
                    {item.customerId}
                  </a>
                </td>
                <td>
                  <b>
                    {item.firstName} {item.lastName}
                  </b>
                </td>
                <td>{item.phone}</td>
                <td>{item.province || "—"}</td>
                <td>{item.preferredChannel}</td>
                <td>{item.dnc ? <Badge value="SKIPPED_DNC" /> : "—"}</td>
                <td className="row-actions">
                  <button aria-label="Edit" onClick={() => setEditing(item)}>
                    Edit
                  </button>
                  <button
                    className="danger-link"
                    aria-label="Delete"
                    onClick={() => remove(item)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && !loading && <Empty />}
        <Pager
          page={page}
          pageSize={20}
          total={data.total}
          onChange={setPage}
        />
      </div>
      {editing && (
        <CustomerForm
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function CustomerForm({
  item,
  onClose,
  onSaved,
}: {
  item: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(item);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `${base}/customers${item.customerId ? `/${item.customerId}` : ""}`,
        {
          method: item.customerId ? "PUT" : "POST",
          body: JSON.stringify(form),
        },
      );
      onSaved();
      onClose();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={item.customerId ? `Edit ${item.customerId}` : "Add customer"}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-grid">
          <label>
            First name
            <input
              required
              value={form.firstName}
              onChange={(event) =>
                setForm({ ...form, firstName: event.target.value })
              }
            />
          </label>
          <label>
            Last name
            <input
              required
              value={form.lastName}
              onChange={(event) =>
                setForm({ ...form, lastName: event.target.value })
              }
            />
          </label>
          <label>
            Phone
            <input
              required
              type="tel"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm({ ...form, email: event.target.value })
              }
            />
          </label>
          <label>
            Province
            <select
              required={!item.customerId}
              value={form.province}
              onChange={(event) =>
                setForm({ ...form, province: event.target.value })
              }
            >
              <option value="">Select province</option>
              {form.province &&
                !THAI_PROVINCES.some(
                  (province) => province === form.province,
                ) && <option value={form.province}>{form.province}</option>}
              {THAI_PROVINCES.map((province) => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred channel
            <select
              value={form.preferredChannel}
              onChange={(event) =>
                setForm({
                  ...form,
                  preferredChannel: event.target
                    .value as Customer["preferredChannel"],
                })
              }
            >
              {channels.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={form.dnc}
            onChange={(event) =>
              setForm({ ...form, dnc: event.target.checked })
            }
          />{" "}
          Do not contact (DNC)
        </label>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-primary" disabled={busy}>
            <Save size={16} /> Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Customer360({ id }: { id: string }) {
  const [data, setData] = useState<{
    customer: Customer;
    policies: PolicyRow[];
  } | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const load = () =>
    api<typeof data>(`${base}/customers/${id}/360`)
      .then(setData)
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    void load();
  }, [id]);
  return (
    <>
      <a className="admin-back" href="/manage/customers">
        <ArrowLeft size={16} /> Back to customers
      </a>
      <PageHead
        eyebrow="Customer 360"
        title={
          data ? `${data.customer.firstName} ${data.customer.lastName}` : id
        }
        description={id}
        action={
          data && (
            <button
              className="admin-secondary"
              onClick={() => setEditing(true)}
            >
              Edit customer
            </button>
          )
        }
      />
      <ErrorNotice error={error} />
      {data && (
        <>
          <div className="admin-panel customer-profile">
            <div>
              <small>Phone</small>
              <b>{data.customer.phone}</b>
            </div>
            <div>
              <small>Email</small>
              <b>{data.customer.email || "—"}</b>
            </div>
            <div>
              <small>Province</small>
              <b>{data.customer.province || "—"}</b>
            </div>
            <div>
              <small>Channel</small>
              <b>{data.customer.preferredChannel}</b>
            </div>
            <div>
              <small>Contact preference</small>
              <b>
                {data.customer.dnc ? (
                  <Badge value="SKIPPED_DNC" />
                ) : (
                  "Contactable"
                )}
              </b>
            </div>
          </div>
          <div className="admin-panel">
            <div className="panel-head">
              <h2>Policies ({data.policies.length})</h2>
              <a href="/manage/policies">View all</a>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Policy number</th>
                    <th>Products</th>
                    <th>Registration</th>
                    <th>Expiry date</th>
                    <th>Premium</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.policies.map((item) => (
                    <tr key={item.policyId}>
                      <td>
                        <a
                          className="table-link"
                          href={`/manage/policies/${item.policyId}`}
                        >
                          {item.policyNumber}
                        </a>
                      </td>
                      <td>{item.product?.productName}</td>
                      <td>{item.vehicle.licensePlate}</td>
                      <td>{dateText(item.expiryDate)}</td>
                      <td>{money(item.premium)}</td>
                      <td>
                        <Badge value={item.renewalStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.policies.length && <Empty />}
            </div>
          </div>
          {editing && (
            <CustomerForm
              item={data.customer}
              onClose={() => setEditing(false)}
              onSaved={load}
            />
          )}
        </>
      )}
    </>
  );
}

const blankCoverage = () => ({
  thirdPartyProperty: true,
  thirdPartyInjury: true,
  ownVehicleCollision: true,
  vehicleTheft: true,
  fire: true,
  flood: false,
  personalAccident: true,
  medicalExpense: true,
  driverBail: true,
});

const coverageLabels: Record<string, string> = {
  thirdPartyProperty: "Third-party property",
  thirdPartyInjury: "Third-party injury",
  ownVehicleCollision: "Vehicle collision",
  vehicleTheft: "Vehicle theft",
  fire: "Fire",
  flood: "Flood",
  personalAccident: "Personal accident",
  medicalExpense: "Medical expenses",
  driverBail: "Driver bail",
};

function blankProduct(): Product {
  return {
    productId: "",
    productCode: "",
    slug: "",
    productName: "",
    productType: "MOTOR",
    vehicleType: "CAR",
    insuranceClass: "1",
    shortDescription: "",
    description: "",
    insurerName: "MFEC Demo Insurance",
    startingPremium: 0,
    coverage: blankCoverage(),
    coverageLimits: {},
    features: [],
    terms: [],
    eligibleVehicleTypes: ["Private passenger car"],
    minVehicleAge: 0,
    maxVehicleAge: 20,
    active: true,
    featured: false,
    displayOrder: 99,
    createdAt: "",
    updatedAt: "",
  };
}

function Products() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [active, setActive] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [error, setError] = useState("");
  const { data, refresh } = useList<Product>(
    `${base}/products?search=${encodeURIComponent(search)}&active=${active}&page=${page}`,
  );
  async function remove(item: Product) {
    if (!window.confirm(`Delete product ${item.productName}?`)) return;
    try {
      await api(`${base}/products/${item.productId}`, { method: "DELETE" });
      refresh();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="Records"
        title="Products and plans"
        description="Manage plans shown on the website and used in policies"
        action={
          <button
            className="admin-primary"
            onClick={() => setEditing(blankProduct())}
          >
            <Plus size={17} /> Add product
          </button>
        }
      />
      <ErrorNotice error={error} />
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17} />
          <input
            placeholder="Product name or ID"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={active}
          onChange={(event) => {
            setActive(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product ID</th>
              <th>Plan name</th>
              <th>Vehicle type</th>
              <th>Class</th>
              <th>Starting premium</th>
              <th>Published</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.productId}>
                <td className="mono">{item.productCode}</td>
                <td>
                  <b>{item.productName}</b>
                  <small>{item.shortDescription}</small>
                </td>
                <td>{item.vehicleType}</td>
                <td>{item.insuranceClass}</td>
                <td>{money(item.startingPremium)}</td>
                <td>
                  {item.active ? (
                    <span className="dot-live">Active</span>
                  ) : (
                    "Inactive"
                  )}
                </td>
                <td className="row-actions">
                  <button onClick={() => setEditing(item)}>Edit</button>
                  <button className="danger-link" onClick={() => remove(item)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && <Empty />}
        <Pager
          page={page}
          pageSize={20}
          total={data.total}
          onChange={setPage}
        />
      </div>
      {editing && (
        <ProductForm
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function ProductForm({
  item,
  onClose,
  onSaved,
}: {
  item: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(item);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `${base}/products${item.productId ? `/${item.productId}` : ""}`,
        { method: item.productId ? "PUT" : "POST", body: JSON.stringify(form) },
      );
      onSaved();
      onClose();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={item.productId ? `Edit ${item.productName}` : "Add product"}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={save}>
        <div className="admin-form-grid">
          <label>
            Product ID
            <input
              required
              value={form.productCode}
              onChange={(event) =>
                setForm({ ...form, productCode: event.target.value })
              }
            />
          </label>
          <label>
            Slug (URL)
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Plan name
            <input
              required
              value={form.productName}
              onChange={(event) =>
                setForm({ ...form, productName: event.target.value })
              }
            />
          </label>
          <label>
            Product category
            <input
              required
              value={form.productType}
              onChange={(event) =>
                setForm({ ...form, productType: event.target.value })
              }
            />
          </label>
          <label>
            Vehicle type
            <select
              value={form.vehicleType}
              onChange={(event) =>
                setForm({
                  ...form,
                  vehicleType: event.target.value as Product["vehicleType"],
                })
              }
            >
              <option value="CAR">Car</option>
              <option value="MOTORCYCLE">Motorcycle</option>
              <option value="ADDON">Add-on coverage</option>
            </select>
          </label>
          <label>
            Insurance class
            <input
              required
              value={form.insuranceClass}
              onChange={(event) =>
                setForm({ ...form, insuranceClass: event.target.value })
              }
            />
          </label>
          <label>
            Insurer
            <input
              required
              value={form.insurerName}
              onChange={(event) =>
                setForm({ ...form, insurerName: event.target.value })
              }
            />
          </label>
          <label>
            Starting premium
            <input
              required
              type="number"
              min="0"
              value={form.startingPremium}
              onChange={(event) =>
                setForm({
                  ...form,
                  startingPremium: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            Display order
            <input
              type="number"
              value={form.displayOrder}
              onChange={(event) =>
                setForm({ ...form, displayOrder: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Minimum vehicle age
            <input
              type="number"
              min="0"
              value={form.minVehicleAge}
              onChange={(event) =>
                setForm({ ...form, minVehicleAge: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Maximum vehicle age
            <input
              type="number"
              min="0"
              value={form.maxVehicleAge}
              onChange={(event) =>
                setForm({ ...form, maxVehicleAge: Number(event.target.value) })
              }
            />
          </label>
          <label className="wide">
            Short description
            <input
              required
              value={form.shortDescription}
              onChange={(event) =>
                setForm({ ...form, shortDescription: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Details
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <label className="wide">
            Highlights (one per line)
            <textarea
              rows={3}
              value={form.features.join("\n")}
              onChange={(event) =>
                setForm({
                  ...form,
                  features: event.target.value.split("\n").filter(Boolean),
                })
              }
            />
          </label>
          <label className="wide">
            Conditions (one per line)
            <textarea
              rows={3}
              value={form.terms.join("\n")}
              onChange={(event) =>
                setForm({
                  ...form,
                  terms: event.target.value.split("\n").filter(Boolean),
                })
              }
            />
          </label>
          <label className="wide">
            Eligible vehicle types (one per line)
            <textarea
              rows={2}
              value={form.eligibleVehicleTypes.join("\n")}
              onChange={(event) =>
                setForm({
                  ...form,
                  eligibleVehicleTypes: event.target.value
                    .split("\n")
                    .filter(Boolean),
                })
              }
            />
          </label>
        </div>
        <div className="form-section-label">Coverage</div>
        <div className="checkbox-grid">
          {Object.entries(coverageLabels).map(([key, label]) => (
            <label key={key} className="admin-check">
              <input
                type="checkbox"
                checked={form.coverage[key as keyof Product["coverage"]]}
                onChange={(event) =>
                  setForm({
                    ...form,
                    coverage: { ...form.coverage, [key]: event.target.checked },
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="form-section-label">Coverage limits</div>
        <div className="admin-form-grid">
          {Object.entries(coverageLabels)
            .filter(([key]) => form.coverage[key as keyof Product["coverage"]])
            .map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={form.coverageLimits[key] || ""}
                  placeholder="e.g. up to THB 1,000,000"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      coverageLimits: {
                        ...form.coverageLimits,
                        [key]: event.target.value,
                      },
                    })
                  }
                />
              </label>
            ))}
        </div>
        <div className="checkbox-grid">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) =>
                setForm({ ...form, active: event.target.checked })
              }
            />
            Publish on website
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) =>
                setForm({ ...form, featured: event.target.checked })
              }
            />
            Featured plan
          </label>
        </div>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-primary" disabled={busy}>
            <Save size={16} /> Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function blankPolicy(): Policy {
  return {
    policyId: "",
    policyNumber: "",
    customerId: "",
    productId: "",
    purchaseDate: new Date().toISOString().slice(0, 10),
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 86400000)
      .toISOString()
      .slice(0, 10),
    premium: 0,
    sumInsured: 0,
    insurerName: "MFEC Demo Insurance",
    vehicle: {
      vehicleType: "CAR",
      brand: "",
      model: "",
      year: new Date().getFullYear(),
      licensePlate: "",
      province: "",
    },
    coverageSnapshot: blankCoverage(),
    renewalStatus: "NOT_STARTED",
    preferredChannel: "VOICE",
    digitalSent: false,
    voiceCalled: false,
    customerIntent: "UNKNOWN",
    callbackDateTime: null,
    genesys: {
      contactListId: "",
      contactId: "",
      syncStatus: "NOT_SYNCED",
      lastSyncAt: "",
      lastSyncError: null,
      lastPayloadHash: "",
      lastSyncedBy: "",
    },
    createdAt: "",
    updatedAt: "",
  };
}

function Policies({ renewal = false }: { renewal?: boolean }) {
  const id = window.location.pathname.split("/")[3];
  if (id && !renewal) return <PolicyDetail id={id} />;
  return <PolicyList renewal={renewal} />;
}

function PolicyList({ renewal }: { renewal: boolean }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [days, setDays] = useState(renewal ? "90" : "");
  const [channel, setChannel] = useState("");

  const [excludeDnc, setExcludeDnc] = useState(renewal);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [error, setError] = useState("");

  const [renewingId, setRenewingId] = useState("");
  const [result, setResult] = useState("");

  const { data, refresh } = useList<PolicyRow>(
    `${base}/${renewal ? "renewals" : "policies"}?search=${encodeURIComponent(search)}&renewalStatus=${status}&channel=${channel}&excludeDnc=${excludeDnc}&${days ? `daysTo=${days}&` : ""}page=${page}`,
  );
  usePolicyRenewalEvents(refresh);
  async function renew(item: PolicyRow) {
    if (
      !window.confirm(
        `Renew ${item.policyNumber} for one year from its current expiry date?`,
      )
    )
      return;
    setRenewingId(item.policyId);
    setError("");
    setResult("");
    try {
      const updated = await api<RenewalResult>(
        `${base}/policies/${item.policyId}/renew`,
        { method: "POST" },
      );
      setResult(
        updated.alreadyRenewed
          ? `${updated.policyNumber} was already renewed. Expiry: ${dateText(updated.expiryDate)}.`
          : `${updated.policyNumber} renewed through ${dateText(updated.expiryDate)}.`,
      );
      refresh();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setRenewingId("");
    }
  }
  async function remove(item: Policy) {
    if (!window.confirm(`Delete policy ${item.policyNumber}?`)) return;
    try {
      await api(`${base}/policies/${item.policyId}`, { method: "DELETE" });
      refresh();
    } catch (reason) {
      setError((reason as Error).message);
    }
  }

  return (
    <>
      <PageHead
        eyebrow={renewal ? "Renewal work" : "Records"}
        title={renewal ? "Renewal tracking" : "Policies"}
        description={
          renewal
            ? "Track upcoming expiries and customer contact status"
            : "Manage policies and insured vehicles"
        }
        action={
          !renewal && (
            <button
              className="admin-primary"
              onClick={() => setEditing(blankPolicy())}
            >
              <Plus size={17} /> Add policy
            </button>
          )
        }
      />
      <ErrorNotice error={error} />
      {result && <div className="admin-success">{result}</div>}

      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17} />
          <input
            placeholder="Policy number, name, phone, or registration"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses.map((item) => (
            <option key={item} value={item}>
              {statusLabels[item]}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(event) => {
            setDays(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Any expiry date</option>
          <option value="7">Within 7 days</option>
          <option value="30">Within 30 days</option>
          <option value="60">Within 60 days</option>
          <option value="90">Within 90 days</option>
        </select>
        {renewal && (
          <>
            <select
              aria-label="Channel"
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All channels</option>
              {channels.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>

            <label className="admin-check">
              <input
                type="checkbox"
                checked={excludeDnc}
                onChange={(event) => {
                  setExcludeDnc(event.target.checked);
                  setPage(1);
                }}
              />{" "}
              Exclude DNC
            </label>
          </>
        )}
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Policy number</th>
              {!renewal && (
                <>
                  <th>Policy ID</th>
                  <th>Customer ID</th>
                </>
              )}
              <th>Customers</th>
              <th>Products / Vehicle</th>
              <th>Expired</th>
              <th>Days left</th>
              <th>Status</th>
              {renewal && (
                <>
                  <th>Channel</th>
                  <th>DNC</th>
                </>
              )}

              <th></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.policyId}>
                <td>
                  <a
                    className="table-link"
                    href={`/manage/policies/${item.policyId}`}
                  >
                    {item.policyNumber}
                  </a>
                </td>
                {!renewal && (
                  <>
                    <td className="mono">{item.policyId}</td>
                    <td className="mono">{item.customerId}</td>
                  </>
                )}
                <td>
                  {item.customer ? (
                    <a
                      href={`/manage/customers/${item.customerId}`}
                      className="table-link"
                    >
                      {item.customer.firstName} {item.customer.lastName}
                    </a>
                  ) : (
                    item.customerId
                  )}
                  <small>{item.customer?.phone}</small>
                </td>
                <td>
                  {item.product?.productName || item.productId}
                  <small>
                    {item.vehicle.brand} {item.vehicle.model} ·{" "}
                    {item.vehicle.licensePlate}
                  </small>
                </td>
                <td>{dateText(item.expiryDate)}</td>
                <td className={item.daysUntilExpiry <= 7 ? "urgent" : ""}>
                  {item.daysUntilExpiry < 0
                    ? `${-item.daysUntilExpiry} days overdue`
                    : `${item.daysUntilExpiry} days`}
                </td>
                <td>
                  <Badge value={item.renewalStatus} />
                </td>
                {renewal && (
                  <>
                    <td>{item.preferredChannel}</td>
                    <td>
                      {item.customer?.dnc ? <Badge value="SKIPPED_DNC" /> : "—"}
                    </td>
                  </>
                )}

                <td className="row-actions">
                  <button onClick={() => setEditing(item)}>Edit</button>
                  <button
                    disabled={
                      Boolean(renewingId) || item.renewalStatus === "CANCELLED"
                    }
                    title={
                      item.renewalStatus === "CANCELLED"
                        ? "Cancelled policies cannot be renewed"
                        : "Renew policy for one year"
                    }
                    onClick={() => renew(item)}
                  >
                    <RefreshCw size={14} /> Renew
                  </button>

                  {!renewal && (
                    <button
                      className="danger-link"
                      onClick={() => remove(item)}
                    >
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.items.length && <Empty />}
        <Pager
          page={page}
          pageSize={20}
          total={data.total}
          onChange={setPage}
        />
      </div>
      {editing && (
        <PolicyForm
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function PolicyForm({
  item,
  onClose,
  onSaved,
}: {
  item: Policy;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(item);
  const [meta, setMeta] = useState<{
    customers: Customer[];
    products: Product[];
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ customers: Customer[]; products: Product[] }>(`${base}/meta`)
      .then(setMeta)
      .catch((reason) => setError(reason.message));
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(`${base}/policies${item.policyId ? `/${item.policyId}` : ""}`, {
        method: item.policyId ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      onSaved();
      onClose();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const vehicle = (field: keyof Policy["vehicle"], value: string | number) =>
    setForm({ ...form, vehicle: { ...form.vehicle, [field]: value } });
  return (
    <Modal
      title={item.policyId ? `Edit ${item.policyNumber}` : "Add policy"}
      onClose={onClose}
    >
      <form className="admin-form" onSubmit={save}>
        <div className="form-section-label">Policy information</div>
        <div className="admin-form-grid">
          <label>
            Customers
            <select
              required
              value={form.customerId}
              onChange={(event) =>
                setForm({ ...form, customerId: event.target.value })
              }
            >
              <option value="">Select customer</option>
              {meta?.customers.map((value) => (
                <option key={value.customerId} value={value.customerId}>
                  {value.customerId} · {value.firstName} {value.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Products
            <select
              required
              value={form.productId}
              onChange={(event) =>
                setForm({ ...form, productId: event.target.value })
              }
            >
              <option value="">Select product</option>
              {meta?.products.map((value) => (
                <option key={value.productId} value={value.productId}>
                  {value.productName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Purchase date
            <input
              required
              type="date"
              value={form.purchaseDate}
              onChange={(event) =>
                setForm({ ...form, purchaseDate: event.target.value })
              }
            />
          </label>
          <label>
            Coverage start date
            <input
              required
              type="date"
              value={form.effectiveDate}
              onChange={(event) =>
                setForm({ ...form, effectiveDate: event.target.value })
              }
            />
          </label>
          <label>
            Expiry date
            <input
              required
              type="date"
              value={form.expiryDate}
              onChange={(event) =>
                setForm({ ...form, expiryDate: event.target.value })
              }
            />
          </label>
          <label>
            Insurer
            <input
              required
              value={form.insurerName}
              onChange={(event) =>
                setForm({ ...form, insurerName: event.target.value })
              }
            />
          </label>
          <label>
            Premium
            <input
              required
              type="number"
              min="0"
              value={form.premium}
              onChange={(event) =>
                setForm({ ...form, premium: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Sum insured
            <input
              required
              type="number"
              min="0"
              value={form.sumInsured}
              onChange={(event) =>
                setForm({ ...form, sumInsured: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <div className="form-section-label">Vehicle information</div>
        <div className="admin-form-grid">
          <label>
            Vehicle type
            <select
              value={form.vehicle.vehicleType}
              onChange={(event) => vehicle("vehicleType", event.target.value)}
            >
              <option value="CAR">Car</option>
              <option value="MOTORCYCLE">Motorcycle</option>
              <option value="ADDON">Other</option>
            </select>
          </label>
          <label>
            Brand
            <input
              required
              value={form.vehicle.brand}
              onChange={(event) => vehicle("brand", event.target.value)}
            />
          </label>
          <label>
            Model
            <input
              required
              value={form.vehicle.model}
              onChange={(event) => vehicle("model", event.target.value)}
            />
          </label>
          <label>
            Vehicle year
            <input
              required
              type="number"
              min="1950"
              max="2100"
              value={form.vehicle.year}
              onChange={(event) => vehicle("year", Number(event.target.value))}
            />
          </label>
          <label>
            Registration
            <input
              required
              value={form.vehicle.licensePlate}
              onChange={(event) => vehicle("licensePlate", event.target.value)}
            />
          </label>
          <label>
            Province
            <input
              required
              value={form.vehicle.province}
              onChange={(event) => vehicle("province", event.target.value)}
            />
          </label>
        </div>
        <div className="form-section-label">Renewal follow-up</div>
        <div className="admin-form-grid">
          <label>
            Status
            <select
              value={form.renewalStatus}
              onChange={(event) =>
                setForm({
                  ...form,
                  renewalStatus: event.target.value as Policy["renewalStatus"],
                })
              }
            >
              {statuses.map((value) => (
                <option key={value} value={value}>
                  {statusLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Preferred channel
            <select
              value={form.preferredChannel}
              onChange={(event) =>
                setForm({
                  ...form,
                  preferredChannel: event.target
                    .value as Policy["preferredChannel"],
                })
              }
            >
              {channels.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Customer interest
            <select
              value={form.customerIntent}
              onChange={(event) =>
                setForm({ ...form, customerIntent: event.target.value })
              }
            >
              {[
                "UNKNOWN",
                "INTERESTED",
                "NOT_INTERESTED",
                "CALLBACK",
                "RENEWED",
                "WRONG_NUMBER",
                "NO_ANSWER",
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            Callback date and time
            <input
              type="datetime-local"
              value={form.callbackDateTime?.slice(0, 16) || ""}
              onChange={(event) =>
                setForm({
                  ...form,
                  callbackDateTime: event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null,
                })
              }
            />
          </label>
        </div>
        <div className="checkbox-grid">
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.digitalSent}
              onChange={(event) =>
                setForm({ ...form, digitalSent: event.target.checked })
              }
            />{" "}
            Digital sent
          </label>
          <label className="admin-check">
            <input
              type="checkbox"
              checked={form.voiceCalled}
              onChange={(event) =>
                setForm({ ...form, voiceCalled: event.target.checked })
              }
            />{" "}
            Called
          </label>
        </div>
        <ErrorNotice error={error} />
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="admin-primary" disabled={busy}>
            <Save size={16} /> Save
          </button>
        </div>
      </form>
    </Modal>
  );
}

function PolicyDetail({ id }: { id: string }) {
  const [policy, setPolicy] = useState<PolicyRow | null>(null);

  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    api<PolicyRow>(`${base}/policies/${id}`)
      .then(setPolicy)
      .catch((reason) => setError(reason.message));
  useEffect(() => {
    void load();
  }, [id]);
  usePolicyRenewalEvents(() => {
    void load();
  });
  async function renew() {
    if (
      !policy ||
      !window.confirm(
        `Renew ${policy.policyNumber} for one year from its current expiry date?`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await api<RenewalResult>(`${base}/policies/${id}/renew`, {
        method: "POST",
      });
      setMessage(
        updated.alreadyRenewed
          ? `Already renewed. Expiry: ${dateText(updated.expiryDate)}.`
          : `Renewed through ${dateText(updated.expiryDate)}.`,
      );
      await load();
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a className="admin-back" href="/manage/policies">
        <ArrowLeft size={16} /> Back to policies
      </a>
      <PageHead
        eyebrow="Policy details"
        title={policy?.policyNumber || id}
        description={
          policy
            ? `${policy.customer?.firstName || ""} ${policy.customer?.lastName || ""} · ${policy.vehicle.licensePlate}`
            : ""
        }
        action={
          policy && (
            <>
              <button
                className="admin-secondary"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>

              <button
                className="admin-secondary"
                disabled={busy || policy.renewalStatus === "CANCELLED"}
                title={
                  policy.renewalStatus === "CANCELLED"
                    ? "Cancelled policies cannot be renewed"
                    : "Renew policy for one year"
                }
                onClick={renew}
              >
                <RefreshCw size={16} /> Renew policy
              </button>
            </>
          )
        }
      />
      <ErrorNotice error={error} />
      {message && <div className="admin-success">{message}</div>}

      {policy && (
        <div className="detail-admin-grid">
          <div className="admin-panel">
            <h2>Policy information</h2>
            <div className="info-grid">
              {[
                [
                  "Customers",
                  policy.customer
                    ? `${policy.customer.firstName} ${policy.customer.lastName}`
                    : policy.customerId,
                ],
                ["Products", policy.product?.productName || policy.productId],
                ["Vehicle", `${policy.vehicle.brand} ${policy.vehicle.model}`],
                ["Registration", policy.vehicle.licensePlate],
                ["Start date", dateText(policy.effectiveDate)],
                ["Expiry date", dateText(policy.expiryDate)],
                ["Days remaining", `${policy.daysUntilExpiry} days`],
                ["Premium", money(policy.premium)],
                ["Sum insured", money(policy.sumInsured)],
                ["Channel", policy.preferredChannel],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <b>{value}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="admin-panel">
            <h2>Status</h2>
            <div className="status-stack">
              <div>
                Renewal <Badge value={policy.renewalStatus} />
              </div>

              <div>
                Called <b>{policy.voiceCalled ? "Yes" : "No"}</b>
              </div>
              <div>
                Digital sent <b>{policy.digitalSent ? "Yes" : "No"}</b>
              </div>
            </div>
          </div>
        </div>
      )}
      {editing && policy && (
        <PolicyForm
          item={policy}
          onClose={() => setEditing(false)}
          onSaved={load}
        />
      )}
    </>
  );
}

function CallBackResults() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading } = useList<CallBackResult>(
    `${base}/call-back-results?search=${encodeURIComponent(search)}&page=${page}`,
  );
  return (
    <>
      <PageHead
        eyebrow="Customer contact history"
        title="Call Back Result"
        description="Results submitted through the authenticated callback API"
      />
      <ErrorNotice error={error} />
      <div className="admin-toolbar">
        <div className="admin-search">
          <Search size={17} />
          <input
            placeholder="Customer, policy, agent or intent"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Customer ID</th>
              <th>Customer name</th>
              <th>Policy ID</th>
              <th>Policy number</th>
              <th>Expire date</th>
              <th>Products / vehicle</th>
              <th>Customer intent</th>
              <th>Contacted by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.callBackResultId}>
                <td>{item.customerId}</td>
                <td>
                  <b>{item.customerName}</b>
                </td>
                <td>{item.policyId}</td>
                <td>{item.policyNumber}</td>
                <td>{dateText(item.expireDate)}</td>
                <td>{item.productVehicleInformation}</td>
                <td>{item.customerIntent}</td>
                <td>{item.contactedBy}</td>
                <td>
                  <Badge value={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading ? (
          <Empty text="Loading call back results..." />
        ) : (
          !data.items.length && <Empty />
        )}
        <Pager
          page={page}
          pageSize={data.pageSize}
          total={data.total}
          onChange={setPage}
        />
      </div>
    </>
  );
}

function Audit() {
  const [records, setRecords] = useState<{
    business: {
      id: string;
      action: string;
      actor: string;
      target: string;
      timestamp: string;
    }[];
    genesys: unknown[];
  } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<typeof records>(`${base}/audit`)
      .then(setRecords)
      .catch((reason) => setError(reason.message));
  }, []);
  return (
    <>
      <PageHead
        eyebrow="System"
        title="Audit log"
        description="History of data and configuration changes"
      />
      <ErrorNotice error={error} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Date and time</th>
              <th>Activity</th>
              <th>Actor</th>
              <th>Records</th>
            </tr>
          </thead>
          <tbody>
            {records?.business.map((item) => (
              <tr key={item.id}>
                <td>{new Date(item.timestamp).toLocaleString("en-US")}</td>
                <td>{item.action}</td>
                <td>{item.actor}</td>
                <td>{item.target || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!records?.business.length && <Empty />}
      </div>
    </>
  );
}

function SystemSettings() {
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [backup, setBackup] = useState<{
    directory: string;
    files: string[];
    downloadUrl: string;
  } | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  async function makeBackup() {
    setBusy(true);
    setError("");
    try {
      const result = await api<typeof backup>(`${base}/settings/backup`, {
        method: "POST",
      });
      setBackup(result);
      setMessage("Backup created");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (
      confirm !== "RESET" ||
      !window.confirm("Reset demo data? A backup will be created first.")
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`${base}/settings/reset-demo`, {
        method: "POST",
        body: JSON.stringify({ confirmation: "RESET" }),
      });
      setMessage("Demo data reset");
      setConfirm("");
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="System"
        title="System settings"
        description="Manage the administrator account and demo data"
      />
      <ErrorNotice error={error} />
      {message && <div className="admin-success">{message}</div>}
      <div className="settings-grid">
        <PasswordSettings />
        <section className="admin-panel">
          <DatabaseBackup size={28} />
          <h2>Backup data</h2>
          <p>
            Create a JSON backup of customers, policies, campaigns, and
            configuration.
          </p>
          <button
            className="admin-primary"
            disabled={busy}
            onClick={makeBackup}
          >
            <DatabaseBackup size={16} /> Create backup
          </button>
          {backup && (
            <div className="backup-result">
              <b>{backup.directory}</b>
              <small>{backup.files.length} files</small>
              <a href={backup.downloadUrl}>
                <ArrowDownToLine size={16} /> Download JSON
              </a>
            </div>
          )}
        </section>
        <section className="admin-panel">
          <RefreshCw size={28} />
          <h2>Reset demo data</h2>
          <p>
            The system backs up current data before restoring the original demo
            records. Your administrator account will be preserved
          </p>
          <label>
            Type RESET to confirm
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </label>
          <button
            className="admin-danger"
            disabled={confirm !== "RESET" || busy}
            onClick={reset}
          >
            <Trash2 size={16} /> Reset data
          </button>
        </section>
      </div>
    </>
  );
}

function PasswordSettings() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      await api(`${base}/auth/change-password`, {
        method: "POST",
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      window.location.href = "/manage/login?passwordChanged=1";
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not change password",
      );
      setCurrentPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel credential-panel">
      <KeyRound size={28} />
      <h2>Change administrator password</h2>
      <form className="credential-form" onSubmit={changePassword}>
        <div className="credential-fields">
          <label>
            Current password
            <input
              autoComplete="current-password"
              required
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
          </label>
          <label>
            New password
            <input
              autoComplete="new-password"
              required
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </label>
          <label>
            Confirm new password
            <input
              autoComplete="new-password"
              required
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
        </div>
        {error && (
          <div className="admin-error" role="alert">
            {error}
          </div>
        )}
        <button className="admin-primary" disabled={busy} type="submit">
          <KeyRound size={16} /> {busy ? "Saving..." : "Save new password"}
        </button>
      </form>
    </section>
  );
}

function GlobalSearch() {
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<{
    customers: Customer[];
    policies: Policy[];
  } | null>(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (search.trim().length >= 2)
        api<{ customers: Customer[]; policies: Policy[] }>(
          base + "/search?q=" + encodeURIComponent(search),
        )
          .then((value) => {
            if (active) setResult(value);
          })
          .catch(() => {
            if (active) setResult(null);
          });
      else setResult(null);
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);
  return (
    <div className="admin-global-search">
      <Search size={17} />
      <input
        aria-label="Search"
        placeholder="Search customers, policies, registration plates"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {result && (
        <div className="search-popover">
          <b>Customers</b>
          {result.customers.map((item) => (
            <a
              key={item.customerId}
              href={"/manage/customers/" + item.customerId}
            >
              {item.firstName} {item.lastName}
              <small>{item.customerId}</small>
            </a>
          ))}
          <b>Policies</b>
          {result.policies.map((item) => (
            <a key={item.policyId} href={"/manage/policies/" + item.policyId}>
              {item.policyNumber}
              <small>{item.vehicle.licensePlate}</small>
            </a>
          ))}
          {!result.customers.length && !result.policies.length && (
            <span>No records found</span>
          )}
        </div>
      )}
    </div>
  );
}
