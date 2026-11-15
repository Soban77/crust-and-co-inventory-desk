import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Boxes, ChartNoAxesCombined,
  Check, ChevronDown, CircleHelp, ClipboardList, Clock3, LayoutDashboard, LogOut, Menu,
  PackagePlus, Plus, Printer, Search, Settings2, ShieldCheck, SlidersHorizontal, X
} from "lucide-react";
import { Link, NavLink, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, formatDate, formatQuantity } from "./api";

const navItems = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/low-stock", label: "Low stock", icon: AlertTriangle },
  { to: "/reports", label: "Reports", icon: ChartNoAxesCombined }
];

function useNotice() {
  const [notice, setNotice] = useState(null);
  const timer = useRef(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback((message, kind = "success") => {
    window.clearTimeout(timer.current);
    setNotice({ message, kind });
    timer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);
  return [notice, show];
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [notice, showNotice] = useNotice();
  const navigate = useNavigate();

  useEffect(() => {
    api("/auth/me").then(({ user: current }) => setUser(current)).catch(() => setUser(null)).finally(() => setChecking(false));
    const expired = () => {
      setUser(null);
      navigate("/login");
      showNotice("Your session expired. Please sign in again.", "error");
    };
    window.addEventListener("auth-expired", expired);
    return () => window.removeEventListener("auth-expired", expired);
  }, [navigate, showNotice]);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      navigate("/login");
    } catch (error) {
      showNotice(error.message, "error");
    }
  }

  if (checking) return <div className="loading-screen"><span className="brand-mark">C</span><span className="loader" /></div>;

  return (
    <>
      {notice && <div className={`toast ${notice.kind}`} role="status"><span>{notice.kind === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}</span>{notice.message}<button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={15} /></button></div>}
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage onLogin={setUser} showNotice={showNotice} />} />
        <Route path="*" element={user ? <AppShell user={user} onLogout={logout} showNotice={showNotice} /> : <Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}

function LoginPage({ onLogin, showNotice }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const { user } = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      onLogin(user);
      navigate("/");
    } catch (error) {
      showNotice(error.message, "error");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <main className="login-page">
      <div className="login-art">
        <div className="login-art-top"><span className="brand-mark">C</span><span>CRUST & CO.</span></div>
        <div className="art-copy">
          <span className="eyebrow light">BUILT FOR THE BACK OF HOUSE</span>
          <h1>Good food starts with knowing what you have.</h1>
          <p>One clear view of your ingredients, supplies, and every stock movement.</p>
        </div>
        <div className="art-caption"><span className="caption-dot" /> YOUR KITCHEN, IN SYNC <span>EST. 2018</span></div>
        <div className="pizza-illustration" aria-hidden="true"><div className="pizza-ring"><i /><i /><i /><i /><i /><i /></div></div>
      </div>
      <section className="login-content">
        <div className="mobile-brand"><span className="brand-mark">C</span><span>CRUST & CO.</span></div>
        <form className="login-card" onSubmit={submit}>
          <span className="eyebrow">STAFF PORTAL</span>
          <h2>Welcome back</h2>
          <p className="muted">Sign in to manage your restaurant inventory.</p>
          <label>Email address<input type="email" autoComplete="username" placeholder="you@restaurant.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label>Password<input type="password" autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <button className="button primary wide" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}<ArrowRight size={17} /></button>
          <div className="secure-note"><ShieldCheck size={15} /> Secure access for authorized staff</div>
        </form>
        <div className="login-footer">INTERNAL USE ONLY <span>·</span> CRUST & CO. INVENTORY</div>
      </section>
    </main>
  );
}

function AppShell({ user, onLogout, showNotice }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <Link className="brand" to="/"><span className="brand-mark">C</span><span>CRUST <b>&</b> CO.<small>INVENTORY DESK</small></span></Link>
        <div className="nav-section">WORKSPACE</div>
        <nav className="nav-links">{navItems.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setMobileNav(false)}><Icon size={21} strokeWidth={1.8} /><span>{label}</span>{label === "Low stock" && <span className="nav-alert" />}</NavLink>)}</nav>
        <div className="sidebar-bottom">
          <div className="side-help"><div className="help-icon"><CircleHelp size={17} /></div><div><strong>Need a hand?</strong><small>Ask your manager for help.</small></div></div>
          <div className="user-card"><div className="avatar">{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</div><div className="user-meta"><strong>{user.name}</strong><small>{user.role}</small></div><button title="Sign out" aria-label="Sign out" className="icon-button" onClick={onLogout}><LogOut size={17} /></button></div>
        </div>
      </aside>
      {mobileNav && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNav((open) => !open)}><Menu size={20} /></button><div className="crumb">Crust & Co. <span>/</span> <b>Inventory desk</b></div><div className="topbar-right"><span className="live-indicator"><i /> LIVE STOCK</span><div className="topbar-avatar">{user.name[0].toUpperCase()}</div></div></header>
        <div className="page-wrap">
          <Routes>
            <Route path="/" element={<Dashboard showNotice={showNotice} />} />
            <Route path="/inventory" element={<InventoryPage showNotice={showNotice} />} />
            <Route path="/items/:id" element={<ItemDetails showNotice={showNotice} />} />
            <Route path="/low-stock" element={<InventoryPage showNotice={showNotice} lowOnly />} />
            <Route path="/reports" element={<ReportsPage showNotice={showNotice} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="page-footer"><span>CRUST & CO. INVENTORY DESK</span><span>INTERNAL OPERATIONS <i>·</i> {new Date().getFullYear()}</span></footer>
        </div>
      </main>
    </div>
  );
}

function PageHeading({ kicker, title, description, actions }) {
  return <div className="page-heading"><div><div className="eyebrow">{kicker}</div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function Dashboard({ showNotice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const refresh = useCallback(() => api("/dashboard").then(setData).catch((err) => setError(err.message)), []);
  useEffect(() => { refresh(); }, [refresh]);
  return (
    <>
      <PageHeading kicker="DAILY SERVICE OVERVIEW" title="Good evening, team." description="Here's how your stock is looking today." actions={<Link className="button primary" to="/inventory"><PackagePlus size={17} /> Manage inventory</Link>} />
      {error && <ErrorBanner message={error} />}
      {!data ? <Loading /> : <>
        <section className="stats-grid">
          <StatCard label="Active inventory items" value={data.summary.totalItems} sub="Across all categories" icon={Boxes} tone="green" />
          <StatCard label="Need attention" value={data.summary.lowStockItems} sub={data.summary.lowStockItems ? "At or below minimum stock" : "All stock levels look good"} icon={AlertTriangle} tone={data.summary.lowStockItems ? "amber" : "green"} />
          <StatCard label="Latest movement" value={data.recentActivity.length} sub="Recent stock transactions" icon={ClipboardList} tone="blue" />
        </section>
        <div className="dashboard-grid">
          <section className="panel low-panel">
            <div className="panel-heading"><div><div className="section-title"><span className="title-icon warning"><AlertTriangle size={17} /></span><h2>Needs replenishing</h2></div><p>Items at or below their minimum level</p></div><Link className="text-link" to="/low-stock">View all <ArrowRight size={15} /></Link></div>
            {data.lowStock.length ? <div className="compact-list">{data.lowStock.slice(0, 5).map((item) => <Link to={`/items/${item.id}`} className="compact-row" key={item.id}><ItemGlyph category={item.category} /><span className="item-cell"><strong>{item.name}</strong><small>{item.category}</small></span><span className="stock-readout"><b>{formatQuantity(item.quantity_available)} {item.unit}</b><small>min {formatQuantity(item.minimum_stock_level)}</small></span><StatusBadge lowStock /></Link>)}</div> : <EmptyState title="You're well stocked" message="No items are at or below their minimum level." />}
          </section>
          <section className="panel activity-panel">
            <div className="panel-heading"><div><div className="section-title"><span className="title-icon neutral"><Clock3 size={17} /></span><h2>Recent activity</h2></div><p>Latest movement across your stock</p></div><Link className="text-link" to="/reports">All activity <ArrowRight size={15} /></Link></div>
            <ActivityList entries={data.recentActivity} />
          </section>
        </div>
        <section className="quick-strip"><div className="quick-icon"><SlidersHorizontal size={19} /></div><div><strong>Stock changes are always recorded</strong><span>Every receive, use, or adjustment has a timestamp and staff name.</span></div><Link className="button secondary" to="/reports">View stock report <ArrowRight size={16} /></Link></section>
      </>}
    </>
  );
}

function StatCard({ label, value, sub, icon: Icon, tone }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div><div className={`stat-spark ${tone}`}><span /><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></article>;
}

function InventoryPage({ showNotice, lowOnly = false }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("name");
  const [status, setStatus] = useState("active");
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [itemModal, setItemModal] = useState(null);
  const [stockItem, setStockItem] = useState(null);
  const effectiveStatus = lowOnly ? "low" : status;
  const refresh = useCallback(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    api(`/items?search=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&sort=${sort}&status=${effectiveStatus}`)
      .then(({ items: found, categories: values }) => {
        if (currentRequest !== requestId.current) return;
        setItems(found);
        setCategories(values);
      })
      .catch((err) => {
        if (currentRequest === requestId.current) setError(err.message);
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  }, [search, category, sort, effectiveStatus]);
  useEffect(() => {
    const timer = window.setTimeout(refresh, search ? 180 : 0);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [refresh, search]);
  async function changeStatus(item, active) {
    try {
      await api(`/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      showNotice(active ? `${item.name} reactivated.` : `${item.name} deactivated.`);
      refresh();
    } catch (err) { showNotice(err.message, "error"); }
  }
  const title = lowOnly ? "Low stock" : "Inventory";
  return (
    <>
      <PageHeading kicker={lowOnly ? "REPLENISHMENT" : "STOCKROOM"} title={title} description={lowOnly ? "Keep service moving. These items need replenishing." : "Every ingredient and supply, all in one place."} actions={!lowOnly && <button className="button primary" onClick={() => setItemModal({})}><Plus size={17} /> Add inventory item</button>} />
      <section className="panel inventory-panel">
        <div className="inventory-toolbar"><div className="searchbox"><Search size={17} /><input aria-label="Search inventory items" placeholder="Search items, categories, suppliers..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="filters"><label className="select-wrap"><span>Category</span><select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={14} /></label>{!lowOnly && <label className="select-wrap"><span>Status</span><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Active items</option><option value="all">All items</option></select><ChevronDown size={14} /></label>}<label className="select-wrap sort-select"><span>Sort by</span><select aria-label="Sort inventory" value={sort} onChange={(event) => setSort(event.target.value)}><option value="name">Name</option><option value="category">Category</option><option value="stock">Stock status</option></select><ChevronDown size={14} /></label></div></div>
        {error && <ErrorBanner message={error} />}
        <div className="table-scroll"><table className="inventory-table"><thead><tr><th>ITEM</th><th>CATEGORY</th><th>IN STOCK</th><th>MIN. LEVEL</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {loading ? <tr><td colSpan="6"><Loading /></td></tr> : items.length ? items.map((item) => <tr key={item.id}><td><Link className="item-name-link" to={`/items/${item.id}`}><ItemGlyph category={item.category} /><span><b>{item.name}</b><small>{item.supplier || "No supplier listed"}</small></span></Link></td><td><span className="category-chip">{item.category}</span></td><td><span className={`quantity ${item.lowStock ? "low" : ""}`}>{formatQuantity(item.quantity_available)} <small>{item.unit}</small></span></td><td className="min-level">{formatQuantity(item.minimum_stock_level)} <small>{item.unit}</small></td><td><StatusBadge item={item} /></td><td><div className="row-actions"><button className="row-action-button action-stock" title="Record stock movement" onClick={() => setStockItem(item)}><ArrowUpRight size={20} /><span>Adjust stock</span></button><button className="row-action-button" title="Edit item" onClick={() => setItemModal(item)}><Settings2 size={20} /><span>Edit</span></button>{item.active ? <button className="row-action-button danger-hover" title="Deactivate item" onClick={() => changeStatus(item, false)}><X size={20} /><span>Deactivate</span></button> : <button className="row-action-button" title="Reactivate item" onClick={() => changeStatus(item, true)}><Check size={20} /><span>Reactivate</span></button>}</div></td></tr>) : <tr><td colSpan="6"><EmptyState title="No items found" message={lowOnly ? "There are no low-stock items right now." : "Try changing the search or add your first inventory item."} /></td></tr>}
        </tbody></table></div>
        <div className="table-footer"><span>Showing <b>{items.length}</b> {items.length === 1 ? "item" : "items"}</span><span>Stock levels update as movements are recorded</span></div>
      </section>
      {itemModal && <ItemModal item={itemModal.id ? itemModal : null} onClose={() => setItemModal(null)} onSaved={(message) => { setItemModal(null); showNotice(message); refresh(); }} showNotice={showNotice} />}
      {stockItem && <StockModal item={stockItem} onClose={() => setStockItem(null)} onSaved={(message) => { setStockItem(null); showNotice(message); refresh(); }} onError={(message) => showNotice(message, "error")} />}
    </>
  );
}

function ItemModal({ item, onClose, onSaved, showNotice }) {
  const [form, setForm] = useState({ name: item?.name || "", category: item?.category || "Toppings", unit: item?.unit || "kg", currentQuantity: "", minimumStockLevel: item?.minimum_stock_level ?? "", supplier: item?.supplier || "", notes: item?.notes || "" });
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name, category: form.category, unit: form.unit,
      minimumStockLevel: Number(form.minimumStockLevel),
      supplier: form.supplier || null, notes: form.notes || null
    };
    if (!item) payload.currentQuantity = Number(form.currentQuantity || 0);
    try {
      await api(item ? `/items/${item.id}` : "/items", { method: item ? "PATCH" : "POST", body: JSON.stringify(payload) });
      onSaved(item ? "Inventory item updated." : "Inventory item added.");
    } catch (err) { showNotice(err.message, "error"); }
    finally { setBusy(false); }
  }
  return <Modal title={item ? "Edit item details" : "Add inventory item"} subtitle={item ? "Update the item information below." : "Add a new ingredient or supply to your stockroom."} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <label>Item name<input required minLength="2" maxLength="120" placeholder="e.g. Mozzarella cheese" value={form.name} onChange={set("name")} /></label>
      <div className="form-row"><label>Category<select value={form.category} onChange={set("category")}>{["Dough", "Cheese", "Toppings", "Sauces", "Beverages", "Packaging", "Other"].map((value) => <option key={value}>{value}</option>)}</select></label><label>Unit of measurement<input required maxLength="24" placeholder="kg, liters, pcs..." value={form.unit} onChange={set("unit")} /></label></div>
      <div className="form-row">{item ? <label>Minimum stock level<input type="number" min="0" step="0.01" required value={form.minimumStockLevel} onChange={set("minimumStockLevel")} /></label> : <><label>Current quantity<input type="number" min="0" step="0.01" value={form.currentQuantity} onChange={set("currentQuantity")} placeholder="0" /></label><label>Minimum stock level<input type="number" min="0" step="0.01" required value={form.minimumStockLevel} onChange={set("minimumStockLevel")} /></label></>}</div>
      <label>Supplier <span className="optional">(optional)</span><input maxLength="120" placeholder="Supplier name" value={form.supplier} onChange={set("supplier")} /></label>
      <label>Notes <span className="optional">(optional)</span><textarea rows="3" maxLength="1000" placeholder="Storage notes, specifications..." value={form.notes} onChange={set("notes")} /></label>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Saving..." : item ? "Save changes" : "Add item"}</button></div>
    </form>
  </Modal>;
}

function StockModal({ item, onClose, onSaved, onError }) {
  const [type, setType] = useState("STOCK_IN");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api(`/items/${item.id}/transactions`, { method: "POST", body: JSON.stringify({ type, quantity: Number(quantity), remarks: remarks || null }) });
      onSaved("Stock movement recorded.");
    } catch (error) { onError(error.message); }
    finally { setBusy(false); }
  }
  return <Modal title="Record stock movement" subtitle={<>{item.name} <span className="modal-unit">· {formatQuantity(item.quantity_available)} {item.unit} currently in stock</span></>} onClose={onClose}>
    <form className="modal-form" onSubmit={submit}>
      <div className="movement-options">
        {[["STOCK_IN", "Stock received", ArrowDownLeft], ["STOCK_OUT", "Stock used", ArrowUpRight], ["ADJUSTMENT", "Adjustment", SlidersHorizontal]].map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setType(value)} className={`movement-option ${type === value ? "selected" : ""}`}><Icon size={17} /><span>{label}</span></button>)}
      </div>
      <label>{type === "ADJUSTMENT" ? "Quantity change" : "Quantity"}<input type="number" required min={type === "ADJUSTMENT" ? undefined : "0.001"} max="1000000" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={type === "ADJUSTMENT" ? "Use a minus sign to reduce stock" : `Quantity in ${item.unit}`} />{type === "ADJUSTMENT" && <span className="field-hint">Enter a positive number to add, or a negative number to remove.</span>}</label>
      <label>Staff note <span className="optional">(optional)</span><textarea rows="3" maxLength="500" placeholder="e.g. Received from supplier, prep for evening service..." value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
      <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}>{busy ? "Recording..." : "Record movement"}</button></div>
    </form>
  </Modal>;
}

function ItemDetails({ showNotice }) {
  const { id } = useParams();
  const [record, setRecord] = useState(null);
  const [stockOpen, setStockOpen] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(() => api(`/items/${id}`).then(setRecord).catch((err) => setError(err.message)), [id]);
  useEffect(() => { refresh(); }, [refresh]);
  if (error) return <><Link className="back-link" to="/inventory"><ArrowLeft size={16} /> Back to inventory</Link><ErrorBanner message={error} /></>;
  if (!record) return <Loading />;
  const { item, transactions } = record;
  return <>
    <Link className="back-link" to="/inventory"><ArrowLeft size={16} /> Back to inventory</Link>
    <PageHeading kicker={`${item.category.toUpperCase()} · ITEM #${String(item.id).padStart(3, "0")}`} title={item.name} description={item.notes || "Inventory item details and stock movement history."} actions={<><button className="button secondary" onClick={() => setStockOpen(true)}><ArrowUpRight size={16} /> Record movement</button><Link className="button primary" to="/reports"><ChartNoAxesCombined size={16} /> Stock report</Link></>} />
    <section className="detail-stats">
      <div className="detail-card"><span>Current quantity</span><b className={item.lowStock ? "text-warning" : ""}>{formatQuantity(item.quantity_available)} <small>{item.unit}</small></b><small>{item.lowStock ? "Below minimum level" : "Available in stock"}</small></div>
      <div className="detail-card"><span>Minimum stock level</span><b>{formatQuantity(item.minimum_stock_level)} <small>{item.unit}</small></b><small>Replenish when stock reaches this level</small></div>
      <div className="detail-card"><span>Supplier</span><b className="detail-supplier">{item.supplier || "Not specified"}</b><small>{item.active ? "Active inventory item" : "Inactive inventory item"}</small></div>
    </section>
    <section className="panel history-panel">
      <div className="panel-heading"><div><div className="section-title"><span className="title-icon neutral"><Clock3 size={17} /></span><h2>Movement history</h2></div><p>A complete audit trail for this item</p></div><span className="history-count">{transactions.length} {transactions.length === 1 ? "entry" : "entries"}</span></div>
      {transactions.length ? <div className="history-list">{transactions.map((entry) => <div className="history-row" key={entry.id}><div className={`history-symbol ${entry.quantityChanged > 0 ? "in" : "out"}`}>{entry.quantityChanged > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div><div className="history-copy"><b>{entry.type === "STOCK_IN" ? "Stock received" : entry.type === "STOCK_OUT" ? "Stock used" : "Stock adjusted"}</b><span>{entry.remarks || "No staff note"} · by {entry.recordedBy}</span></div><div className={`history-amount ${entry.quantityChanged > 0 ? "positive" : "negative"}`}>{entry.quantityChanged > 0 ? "+" : ""}{formatQuantity(entry.quantityChanged)} {item.unit}</div><time>{formatDate(entry.createdAt)}</time></div>)}</div> : <EmptyState title="No movements yet" message="Stock transactions will appear here as your team records them." />}
    </section>
    {stockOpen && <StockModal item={item} onClose={() => setStockOpen(false)} onSaved={(message) => { setStockOpen(false); showNotice(message); refresh(); }} onError={(message) => showNotice(message, "error")} />}
  </>;
}

function ReportsPage({ showNotice }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([api("/items?status=active&sort=category"), api("/dashboard")])
      .then(([inventory, dashboard]) => setData({ ...inventory, dashboard }))
      .catch((err) => setError(err.message));
  }, []);
  const exportCsv = () => {
    if (!data) return;
    const rows = [["Item", "Category", "Quantity", "Unit", "Minimum", "Status", "Supplier"], ...data.items.map((item) => [item.name, item.category, item.quantity_available, item.unit, item.minimum_stock_level, item.lowStock ? "Low stock" : "In stock", item.supplier || ""])];
    const csv = rows.map((row) => row.map((field) => {
      const value = String(field ?? "");
      const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
      return `"${safeValue.replaceAll('"', '""')}"`;
    }).join(",")).join("\r\n");
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.href = objectUrl;
    link.download = `crust-co-stock-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    showNotice("Stock report exported.");
  };
  return <>
    <PageHeading kicker="REPORTING" title="Stock report" description="A clear snapshot of what you have on hand, ready to print or export." actions={<><button className="button secondary print-button" onClick={() => window.print()}><Printer size={16} /> Print report</button><button className="button primary" onClick={exportCsv} disabled={!data}><ClipboardList size={16} /> Export CSV</button></>} />
    {error && <ErrorBanner message={error} />}
    {!data ? <Loading /> : <>
      <section className="report-banner"><div className="report-mark"><ChartNoAxesCombined size={21} /></div><div><span className="eyebrow light">CURRENT STOCK SUMMARY</span><h2>Inventory at a glance</h2><p>Generated {new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date())}</p></div><div className="report-kpis"><div><b>{data.items.length}</b><span>ACTIVE ITEMS</span></div><i /><div><b className={data.dashboard.summary.lowStockItems ? "report-warning" : ""}>{data.dashboard.summary.lowStockItems}</b><span>LOW STOCK</span></div></div></section>
      <section className="panel report-table-panel"><div className="panel-heading"><div><div className="section-title"><span className="title-icon neutral"><Boxes size={17} /></span><h2>Stock on hand</h2></div><p>Quantities and minimum levels across active items</p></div><span className="history-count">Updated just now</span></div><div className="table-scroll"><table className="inventory-table report-table"><thead><tr><th>ITEM</th><th>CATEGORY</th><th>IN STOCK</th><th>MIN. LEVEL</th><th>STATUS</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td><Link className="item-name-link" to={`/items/${item.id}`}><ItemGlyph category={item.category} /><span><b>{item.name}</b><small>{item.supplier || "No supplier listed"}</small></span></Link></td><td><span className="category-chip">{item.category}</span></td><td><span className={`quantity ${item.lowStock ? "low" : ""}`}>{formatQuantity(item.quantity_available)} <small>{item.unit}</small></span></td><td className="min-level">{formatQuantity(item.minimum_stock_level)} <small>{item.unit}</small></td><td><StatusBadge item={item} /></td></tr>)}</tbody></table></div></section>
      <section className="panel activity-panel report-activity"><div className="panel-heading"><div><div className="section-title"><span className="title-icon neutral"><Clock3 size={17} /></span><h2>Recent stock activity</h2></div><p>Latest recorded transactions</p></div></div><ActivityList entries={data.dashboard.recentActivity} /></section>
    </>}
  </>;
}

function ActivityList({ entries }) {
  if (!entries.length) return <EmptyState title="No activity yet" message="Stock movements will appear here." />;
  return <div className="activity-list">{entries.map((entry) => <div className="activity-row" key={entry.id}><div className={`activity-icon ${entry.quantityChanged > 0 ? "in" : "out"}`}>{entry.quantityChanged > 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div><div className="activity-info"><Link to={`/items/${entry.itemId}`}><b>{entry.itemName}</b></Link><small>{entry.type === "STOCK_IN" ? "Stock received" : entry.type === "STOCK_OUT" ? "Stock used" : "Adjustment"}{entry.remarks ? ` · ${entry.remarks}` : ""}</small></div><div className={`activity-qty ${entry.quantityChanged > 0 ? "positive" : "negative"}`}>{entry.quantityChanged > 0 ? "+" : ""}{formatQuantity(entry.quantityChanged)}<small> {entry.unit}</small></div><time>{formatDate(entry.createdAt)}</time></div>)}</div>;
}

function ItemGlyph({ category }) {
  const initial = category === "Packaging" ? "P" : category === "Beverages" ? "B" : category?.[0] || "I";
  return <span className={`item-glyph glyph-${(category || "other").toLowerCase().replace(/[^a-z]/g, "")}`}>{initial}</span>;
}

function StatusBadge({ item, lowStock }) {
  if (item && !item.active) return <span className="status-badge inactive"><i /> Inactive</span>;
  if (item && Number(item.quantity_available) === 0) return <span className="status-badge low"><AlertTriangle size={16} /> Out of stock</span>;
  if (item && Number(item.quantity_available) === Number(item.minimum_stock_level)) return <span className="status-badge recommended"><AlertTriangle size={16} /> Reorder recommended</span>;
  if (lowStock || item?.lowStock) return <span className="status-badge low"><AlertTriangle size={16} /> Low stock</span>;
  return <span className="status-badge good"><Check size={16} /> Healthy stock</span>;
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const keydown = (event) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header className="modal-header"><div><h2 id="modal-title">{title}</h2><p>{subtitle}</p></div><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button></header>{children}</section></div>;
}

function ErrorBanner({ message }) { return <div className="error-banner"><AlertTriangle size={16} /> {message}</div>; }
function Loading() { return <div className="loading-inline"><span className="loader" /> Loading inventory...</div>; }
function EmptyState({ title, message }) { return <div className="empty-state"><div className="empty-icon"><Boxes size={20} /></div><b>{title}</b><span>{message}</span></div>; }
