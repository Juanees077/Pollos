"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  Banknote,
  BarChart3,
  Bird,
  Boxes,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DollarSign,
  Download,
  Edit2,
  Key,
  LogOut,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Trash2,
  User as UserIcon,
  Users,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { formatCurrency, formatNumber, todayBogota } from "@/lib/format";
import type {
  Customer,
  InventoryMovement,
  PaymentMethod,
  PaymentStatus,
  Profile,
  Sale,
  SaleItem,
  SaleMode,
  Shed,
  ShedCost,
  ShedStatus,
  ShedSummary
} from "@/lib/types";

type TabId = "inicio" | "galpones" | "clientes" | "ventas" | "contabilidad" | "movimientos" | "perfil";

const tabs: Array<{ id: TabId; label: string; mobileLabel: string; icon: typeof BarChart3 }> = [
  { id: "inicio", label: "Inicio", mobileLabel: "Inicio", icon: BarChart3 },
  { id: "galpones", label: "Galpones", icon: Boxes, mobileLabel: "Galpones" },
  { id: "clientes", label: "Clientes", icon: Users, mobileLabel: "Clientes" },
  { id: "ventas", label: "Ventas", icon: ReceiptText, mobileLabel: "Ventas" },
  { id: "contabilidad", label: "Contabilidad", icon: DollarSign, mobileLabel: "Costos" },
  { id: "movimientos", label: "Movimientos", icon: ClipboardList, mobileLabel: "Ajustes" },
  { id: "perfil", label: "Perfil", icon: UserIcon, mobileLabel: "Perfil" }
];

const emptyShed = { name: "", code: "", entryDate: todayBogota(), initialQuantity: "100", notes: "" };
const emptyCustomer = { name: "", phone: "", document: "", notes: "" };
const emptySale = { shedId: "", customerId: "", customerMode: "existing" as "existing" | "new", newCustomerName: "", newCustomerPhone: "", saleDate: todayBogota(), paymentMethod: "transferencia" as PaymentMethod, paymentStatus: "pagado" as PaymentStatus, saleMode: "lote" as SaleMode, quantity: "1", unitPrice: "", notes: "" };
const emptyCost = { shedId: "", costDate: todayBogota(), concept: "", amount: "", notes: "" };
const emptyMovement = { shedId: "", movementType: "adjustment", quantity: "", reason: "" };

const PAGE_SIZE = 25;

function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const bom = "﻿";
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<TabId>("inicio");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");

  // Data
  const [sheds, setSheds] = useState<Shed[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [costs, setCosts] = useState<ShedCost[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Create forms
  const [shedForm, setShedForm] = useState(emptyShed);
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [saleForm, setSaleForm] = useState(emptySale);
  const [costForm, setCostForm] = useState(emptyCost);
  const [movementForm, setMovementForm] = useState(emptyMovement);

  // Sales filters
  const [query, setQuery] = useState("");
  const [filterShed, setFilterShed] = useState("");
  const [filterPayment, setFilterPayment] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Cost filters
  const [filterCostShed, setFilterCostShed] = useState("");
  const [filterCostFrom, setFilterCostFrom] = useState("");
  const [filterCostTo, setFilterCostTo] = useState("");

  // Pagination
  const [salesPage, setSalesPage] = useState(1);
  const [costsPage, setCostsPage] = useState(1);
  const [movementsPage, setMovementsPage] = useState(1);
  const [customersPage, setCustomersPage] = useState(1);

  // Edit modals
  const [editShed, setEditShed] = useState<ShedSummary | null>(null);
  const [editShedForm, setEditShedForm] = useState({ name: "", code: "", entry_date: "", notes: "" });
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [editCustomerForm, setEditCustomerForm] = useState({ name: "", phone: "", document: "", notes: "" });
  const [editCost, setEditCost] = useState<ShedCost | null>(null);
  const [editCostForm, setEditCostForm] = useState({ shed_id: "", cost_date: "", concept: "", amount: "", notes: "" });

  // Sale detail modal
  const [viewSale, setViewSale] = useState<Sale | null>(null);
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [loadingSaleItems, setLoadingSaleItems] = useState(false);

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; label: string } | null>(null);

  // Profile form
  const [profileForm, setProfileForm] = useState({ full_name: "" });

  useEffect(() => {
    let mounted = true;
    try {
      const client = createClient();
      setSupabase(client);
      client.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        if (!data.session) { window.location.href = "/login"; return; }
        setUser(data.session.user);
        void loadData(client);
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo iniciar Supabase.");
      setLoading(false);
    }
    return () => { mounted = false; };
  }, []);

  async function loadData(client = supabase) {
    if (!client) return;
    setLoading(true);
    setMessage("");

    const [shedResult, customerResult, saleResult, movementResult, costResult, profileResult] = await Promise.all([
      client.from("sheds").select("*").order("created_at", { ascending: false }),
      client.from("customers").select("*").order("created_at", { ascending: false }),
      client.from("sales").select("*, customers(name, phone), sheds(name, code)").order("sale_date", { ascending: false }),
      client.from("inventory_movements").select("*").order("created_at", { ascending: false }),
      client.from("shed_costs").select("*").order("cost_date", { ascending: false }),
      client.from("profiles").select("*").maybeSingle()
    ]);

    const firstError = shedResult.error || customerResult.error || saleResult.error || movementResult.error || costResult.error;
    if (firstError) {
      setMessage(firstError.message);
    } else {
      setSheds((shedResult.data ?? []) as Shed[]);
      setCustomers((customerResult.data ?? []) as Customer[]);
      setSales((saleResult.data ?? []) as Sale[]);
      setMovements((movementResult.data ?? []) as InventoryMovement[]);
      setCosts((costResult.data ?? []) as ShedCost[]);
      if (profileResult.data) {
        setProfile(profileResult.data as Profile);
        setProfileForm({ full_name: (profileResult.data as Profile).full_name ?? "" });
      }
    }
    setLoading(false);
  }

  // ── Computed ──────────────────────────────────────────────────────────────

  const summaries = useMemo<ShedSummary[]>(() => {
    return sheds.map((shed) => {
      const sm = movements.filter((m) => m.shed_id === shed.id);
      const ss = sales.filter((s) => s.shed_id === shed.id);
      const sc = costs.filter((c) => c.shed_id === shed.id);
      const entries = sm.filter((m) => m.movement_type === "entry").reduce((n, m) => n + m.quantity, 0);
      const sold = sm.filter((m) => m.movement_type === "sale").reduce((n, m) => n + Math.abs(m.quantity), 0);
      const losses = sm.filter((m) => m.movement_type === "loss").reduce((n, m) => n + Math.abs(m.quantity), 0);
      const adjustments = sm.filter((m) => m.movement_type === "adjustment").reduce((n, m) => n + m.quantity, 0);
      const revenue = ss.reduce((n, s) => n + s.total, 0);
      const totalCosts = sc.reduce((n, c) => n + c.amount, 0);
      return { ...shed, available: entries - sold - losses + adjustments, sold, losses, adjustments, revenue, costs: totalCosts, profit: revenue - totalCosts };
    });
  }, [costs, movements, sales, sheds]);

  const totals = useMemo(() => {
    const revenue = sales.reduce((n, s) => n + s.total, 0);
    const totalCosts = costs.reduce((n, c) => n + c.amount, 0);
    const available = summaries.reduce((n, s) => n + s.available, 0);
    const sold = summaries.reduce((n, s) => n + s.sold, 0);
    const cash = sales.filter((s) => s.payment_method === "efectivo").reduce((n, s) => n + s.total, 0);
    const transfer = sales.filter((s) => s.payment_method === "transferencia").reduce((n, s) => n + s.total, 0);
    return { revenue, totalCosts, profit: revenue - totalCosts, available, sold, cash, transfer };
  }, [costs, sales, summaries]);

  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      const text = `${s.customers?.name ?? ""} ${s.sheds?.name ?? ""} ${s.sheds?.code ?? ""}`.toLowerCase();
      return (
        text.includes(query.toLowerCase()) &&
        (filterShed ? s.shed_id === filterShed : true) &&
        (filterPayment ? s.payment_method === filterPayment : true) &&
        (filterFrom ? s.sale_date >= filterFrom : true) &&
        (filterTo ? s.sale_date <= filterTo : true)
      );
    });
  }, [filterFrom, filterPayment, filterShed, filterTo, query, sales]);

  const filteredCosts = useMemo(() => {
    return costs.filter((c) =>
      (filterCostShed ? c.shed_id === filterCostShed : true) &&
      (filterCostFrom ? c.cost_date >= filterCostFrom : true) &&
      (filterCostTo ? c.cost_date <= filterCostTo : true)
    );
  }, [costs, filterCostFrom, filterCostShed, filterCostTo]);

  const chartData = useMemo(() => {
    const days: { date: string; label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      const label = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" }).format(d);
      const total = sales.filter((s) => s.sale_date === date).reduce((n, s) => n + s.total, 0);
      days.push({ date, label, total });
    }
    return days;
  }, [sales]);

  // ── Notifications ─────────────────────────────────────────────────────────

  function setNotice(text: string) {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 4000);
  }

  // ── Create handlers ───────────────────────────────────────────────────────

  async function createShed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving("shed");
    const { error } = await supabase.rpc("create_shed_with_entry", {
      p_name: shedForm.name.trim(),
      p_code: shedForm.code.trim(),
      p_entry_date: shedForm.entryDate,
      p_initial_quantity: Number(shedForm.initialQuantity),
      p_notes: shedForm.notes.trim() || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setShedForm({ ...emptyShed, entryDate: todayBogota() });
    setNotice("Galpón creado con inventario inicial.");
    await loadData();
  }

  async function createCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving("customer");
    const { error } = await supabase.from("customers").insert({
      user_id: user.id,
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim() || null,
      document: customerForm.document.trim() || null,
      notes: customerForm.notes.trim() || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setCustomerForm(emptyCustomer);
    setNotice("Cliente registrado.");
    await loadData();
  }

  async function createSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    const selected = summaries.find((s) => s.id === saleForm.shedId);
    const qty = Number(saleForm.quantity);
    if (selected && qty > selected.available) {
      setMessage(`No hay suficientes pollos en ${selected.name}. Disponibles: ${formatNumber(selected.available)}.`);
      return;
    }
    setSaving("sale");

    let customerId = saleForm.customerId;
    if (saleForm.customerMode === "new") {
      if (!saleForm.newCustomerName.trim()) {
        setMessage("Ingresa el nombre del cliente.");
        setSaving("");
        return;
      }
      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert({ user_id: user.id, name: saleForm.newCustomerName.trim(), phone: saleForm.newCustomerPhone.trim() || null })
        .select("id")
        .single();
      if (customerError) { setMessage(customerError.message); setSaving(""); return; }
      customerId = newCustomer.id;
    }

    const { error } = await supabase.rpc("register_sale", {
      p_shed_id: saleForm.shedId,
      p_customer_id: customerId,
      p_sale_date: saleForm.saleDate,
      p_payment_method: saleForm.paymentMethod,
      p_sale_mode: saleForm.saleMode,
      p_quantity: qty,
      p_unit_price: Number(saleForm.unitPrice),
      p_notes: saleForm.notes.trim() || null,
      p_payment_status: saleForm.paymentStatus
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setSaleForm({ ...emptySale, saleDate: todayBogota() });
    setNotice("Venta registrada e inventario actualizado.");
    await loadData();
  }

  async function createCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving("cost");
    const { error } = await supabase.from("shed_costs").insert({
      user_id: user.id,
      shed_id: costForm.shedId,
      cost_date: costForm.costDate,
      concept: costForm.concept.trim(),
      amount: Number(costForm.amount),
      notes: costForm.notes.trim() || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setCostForm({ ...emptyCost, costDate: todayBogota() });
    setNotice("Costo registrado.");
    await loadData();
  }

  async function createMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving("movement");
    const { error } = await supabase.rpc("add_inventory_movement", {
      p_shed_id: movementForm.shedId,
      p_movement_type: movementForm.movementType,
      p_quantity: Number(movementForm.quantity),
      p_reason: movementForm.reason.trim()
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setMovementForm(emptyMovement);
    setNotice("Movimiento registrado.");
    await loadData();
  }

  // ── Edit / Delete handlers ────────────────────────────────────────────────

  function openEditShed(shed: ShedSummary) {
    setEditShed(shed);
    setEditShedForm({ name: shed.name, code: shed.code, entry_date: shed.entry_date, notes: shed.notes ?? "" });
  }

  async function handleUpdateShed(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editShed) return;
    setSaving("editShed");
    const { error } = await supabase.rpc("update_shed", {
      p_shed_id: editShed.id,
      p_name: editShedForm.name,
      p_code: editShedForm.code,
      p_entry_date: editShedForm.entry_date,
      p_notes: editShedForm.notes || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setEditShed(null);
    setNotice("Galpón actualizado.");
    await loadData();
  }

  async function handleChangeShedStatus(shedId: string, status: ShedStatus) {
    if (!supabase) return;
    const { error } = await supabase.rpc("change_shed_status", { p_shed_id: shedId, p_status: status });
    if (error) { setMessage(error.message); return; }
    setNotice("Estado del galpón actualizado.");
    await loadData();
  }

  async function handleDeleteShed(id: string) {
    if (!supabase) return;
    setSaving("del");
    const { error } = await supabase.rpc("delete_shed", { p_shed_id: id });
    setSaving("");
    setConfirmDelete(null);
    if (error) { setMessage(error.message); return; }
    setNotice("Galpón eliminado.");
    await loadData();
  }

  function openEditCustomer(customer: Customer) {
    setEditCustomer(customer);
    setEditCustomerForm({ name: customer.name, phone: customer.phone ?? "", document: customer.document ?? "", notes: customer.notes ?? "" });
  }

  async function handleUpdateCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editCustomer) return;
    setSaving("editCustomer");
    const { error } = await supabase.rpc("update_customer", {
      p_customer_id: editCustomer.id,
      p_name: editCustomerForm.name,
      p_phone: editCustomerForm.phone || null,
      p_document: editCustomerForm.document || null,
      p_notes: editCustomerForm.notes || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setEditCustomer(null);
    setNotice("Cliente actualizado.");
    await loadData();
  }

  async function handleDeleteCustomer(id: string) {
    if (!supabase) return;
    setSaving("del");
    const { error } = await supabase.rpc("delete_customer", { p_customer_id: id });
    setSaving("");
    setConfirmDelete(null);
    if (error) { setMessage(error.message); return; }
    setNotice("Cliente eliminado.");
    await loadData();
  }

  function openViewSale(sale: Sale) {
    setViewSale(sale);
    setSaleItems([]);
    if (!supabase) return;
    setLoadingSaleItems(true);
    supabase.from("sale_items").select("*").eq("sale_id", sale.id).then(({ data }) => {
      setSaleItems((data ?? []) as SaleItem[]);
      setLoadingSaleItems(false);
    });
  }

  async function handleDeleteSale(id: string) {
    if (!supabase) return;
    setSaving("del");
    const { error } = await supabase.rpc("delete_sale", { p_sale_id: id });
    setSaving("");
    setConfirmDelete(null);
    setViewSale(null);
    if (error) { setMessage(error.message); return; }
    setNotice("Venta eliminada e inventario restaurado.");
    await loadData();
  }

  async function toggleSalePaymentStatus(sale: Sale) {
    if (!supabase) return;
    const next: PaymentStatus = sale.payment_status === "pagado" ? "pendiente" : "pagado";
    const { error } = await supabase.rpc("update_sale_payment_status", { p_sale_id: sale.id, p_payment_status: next });
    if (error) { setMessage(error.message); return; }
    setSales((prev) => prev.map((s) => s.id === sale.id ? { ...s, payment_status: next } : s));
  }

  function openEditCost(cost: ShedCost) {
    setEditCost(cost);
    setEditCostForm({ shed_id: cost.shed_id, cost_date: cost.cost_date, concept: cost.concept, amount: String(cost.amount), notes: cost.notes ?? "" });
  }

  async function handleUpdateCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !editCost) return;
    setSaving("editCost");
    const { error } = await supabase.rpc("update_shed_cost", {
      p_cost_id: editCost.id,
      p_shed_id: editCostForm.shed_id,
      p_cost_date: editCostForm.cost_date,
      p_concept: editCostForm.concept,
      p_amount: Number(editCostForm.amount),
      p_notes: editCostForm.notes || null
    });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setEditCost(null);
    setNotice("Costo actualizado.");
    await loadData();
  }

  async function handleDeleteCost(id: string) {
    if (!supabase) return;
    setSaving("del");
    const { error } = await supabase.rpc("delete_shed_cost", { p_cost_id: id });
    setSaving("");
    setConfirmDelete(null);
    if (error) { setMessage(error.message); return; }
    setNotice("Costo eliminado.");
    await loadData();
  }

  async function handleDeleteMovement(id: string) {
    if (!supabase) return;
    setSaving("del");
    const { error } = await supabase.rpc("delete_inventory_movement", { p_movement_id: id });
    setSaving("");
    setConfirmDelete(null);
    if (error) { setMessage(error.message); return; }
    setNotice("Movimiento eliminado.");
    await loadData();
  }

  async function handleUpdateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSaving("profile");
    const { error } = await supabase.rpc("update_profile", { p_full_name: profileForm.full_name });
    setSaving("");
    if (error) { setMessage(error.message); return; }
    setNotice("Perfil actualizado.");
    await loadData();
  }

  async function handlePasswordReset() {
    if (!supabase || !user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`
    });
    if (error) { setMessage(error.message); return; }
    setNotice("Enlace de cambio de contraseña enviado a tu correo.");
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    switch (confirmDelete.type) {
      case "shed": await handleDeleteShed(confirmDelete.id); break;
      case "customer": await handleDeleteCustomer(confirmDelete.id); break;
      case "sale": await handleDeleteSale(confirmDelete.id); break;
      case "cost": await handleDeleteCost(confirmDelete.id); break;
      case "movement": await handleDeleteMovement(confirmDelete.id); break;
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading && !user) return <Splash text="Cargando sistema de galpones..." />;

  const activeTab = tabs.find((t) => t.id === tab);

  return (
    <main className="min-h-dvh pb-20 lg:pb-0">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 hidden h-dvh w-64 flex-col border-r lg:flex" style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}>
        {/* Logo */}
        <div className="px-5 py-5">
          <Brand />
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" aria-label="Principal">
          {tabs.map((item) => (
            <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
          ))}
        </nav>

        {/* User + signout */}
        <div className="border-t px-3 py-4" style={{ borderColor: "var(--sidebar-border)" }}>
          <div className="flex items-center gap-3 px-3 mb-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-leaf-700 text-xs font-bold text-white">
              {(user?.email ?? "U").charAt(0).toUpperCase()}
            </div>
            <p className="truncate text-xs font-medium" style={{ color: "var(--sidebar-text)" }}>{user?.email}</p>
          </div>
          <button
            className="nav-item w-full"
            onClick={signOut}
            type="button"
            aria-label="Cerrar sesión"
          >
            <LogOut className="size-4 shrink-0" aria-hidden="true" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="lg:ml-64">
        {/* Top header */}
        <header className="sticky top-0 z-20 border-b border-soil-100/80 bg-[#f4f0e8]/90 px-4 py-3 backdrop-blur-xl sm:px-6 lg:px-7">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xs font-bold uppercase tracking-[0.18em] text-leaf-600">
                {activeTab?.label}
              </p>
              <h1 className="font-display text-2xl font-black leading-tight text-soil-900 sm:text-3xl">
                Sistema Pollos
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn-secondary text-sm px-3 gap-2"
                style={{ minHeight: "40px" }}
                onClick={() => loadData()}
                aria-label="Actualizar datos"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Actualizar</span>
              </button>
              <button
                type="button"
                className="grid size-10 place-items-center rounded-lg lg:hidden"
                style={{ background: "var(--sidebar-bg)", color: "white" }}
                onClick={signOut}
                aria-label="Cerrar sesión"
              >
                <LogOut className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Toast notification */}
          {message ? (
            <div
              className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium"
              style={{
                background: message.includes("error") || message.includes("Error") ? "#fef2f2" : "#f0f9f0",
                borderColor: message.includes("error") || message.includes("Error") ? "#fca5a5" : "#b8e0b2",
                color: message.includes("error") || message.includes("Error") ? "#b91c1c" : "#17371f"
              }}
              role="status"
              aria-live="polite"
            >
              {message}
            </div>
          ) : null}
        </header>

        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-7">
          {tab === "inicio" && <HomeView summaries={summaries} totals={totals} sales={sales} chartData={chartData} />}
          {tab === "galpones" && (
            <ShedsView
              form={shedForm} setForm={setShedForm} onSubmit={createShed} saving={saving === "shed"} summaries={summaries}
              onEdit={openEditShed}
              onDelete={(s) => setConfirmDelete({ type: "shed", id: s.id, label: s.name })}
              onChangeStatus={handleChangeShedStatus}
            />
          )}
          {tab === "clientes" && (
            <CustomersView
              form={customerForm} setForm={setCustomerForm} onSubmit={createCustomer} saving={saving === "customer"} customers={customers} sales={sales}
              onEdit={openEditCustomer}
              onDelete={(c) => setConfirmDelete({ type: "customer", id: c.id, label: c.name })}
              page={customersPage} setPage={setCustomersPage}
            />
          )}
          {tab === "ventas" && (
            <SalesView
              form={saleForm} setForm={setSaleForm} onSubmit={createSale} saving={saving === "sale"} summaries={summaries} customers={customers} sales={filteredSales}
              query={query} setQuery={setQuery}
              filterShed={filterShed} setFilterShed={setFilterShed}
              filterPayment={filterPayment} setFilterPayment={setFilterPayment}
              filterFrom={filterFrom} setFilterFrom={setFilterFrom}
              filterTo={filterTo} setFilterTo={setFilterTo}
              onView={openViewSale}
              onDelete={(s) => setConfirmDelete({ type: "sale", id: s.id, label: `${s.customers?.name ?? "Venta"} — ${s.sale_date}` })}
              onToggleStatus={toggleSalePaymentStatus}
              page={salesPage} setPage={setSalesPage}
              onExport={() => exportCSV(`ventas-${todayBogota()}.csv`,
                ["Fecha", "Cliente", "Galpón", "Cant.", "Unitario", "Método pago", "Estado", "Total", "Notas"],
                filteredSales.map((s) => [s.sale_date, s.customers?.name ?? "", s.sheds?.name ?? "", String(s.quantity), String(s.unit_price), s.payment_method, s.payment_status, String(s.total), s.notes ?? ""])
              )}
            />
          )}
          {tab === "contabilidad" && (
            <AccountingView
              form={costForm} setForm={setCostForm} onSubmit={createCost} saving={saving === "cost"} summaries={summaries} costs={filteredCosts}
              filterCostShed={filterCostShed} setFilterCostShed={setFilterCostShed}
              filterCostFrom={filterCostFrom} setFilterCostFrom={setFilterCostFrom}
              filterCostTo={filterCostTo} setFilterCostTo={setFilterCostTo}
              onEdit={openEditCost}
              onDelete={(c) => setConfirmDelete({ type: "cost", id: c.id, label: c.concept })}
              page={costsPage} setPage={setCostsPage}
              onExport={() => exportCSV(`costos-${todayBogota()}.csv`,
                ["Fecha", "Concepto", "Valor", "Notas"],
                filteredCosts.map((c) => [c.cost_date, c.concept, String(c.amount), c.notes ?? ""])
              )}
            />
          )}
          {tab === "movimientos" && (
            <MovementsView
              form={movementForm} setForm={setMovementForm} onSubmit={createMovement} saving={saving === "movement"} summaries={summaries} movements={movements}
              onDelete={(m) => setConfirmDelete({ type: "movement", id: m.id, label: m.reason })}
              page={movementsPage} setPage={setMovementsPage}
            />
          )}
          {tab === "perfil" && (
            <ProfileView
              user={user} profile={profile} form={profileForm} setForm={setProfileForm}
              onSubmit={handleUpdateProfile} saving={saving === "profile"}
              onPasswordReset={handlePasswordReset}
            />
          )}
        </div>
      </section>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex border-t lg:hidden"
        style={{ background: "var(--sidebar-bg)", borderColor: "var(--sidebar-border)" }}
        aria-label="Navegación principal"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          const isActive = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors"
              style={{
                minHeight: "56px",
                color: isActive ? "#fff" : "rgba(255,255,255,0.5)",
                background: isActive ? "rgba(67,139,74,0.2)" : "transparent"
              }}
              onClick={() => setTab(item.id)}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="size-[18px]" aria-hidden="true" />
              <span>{item.mobileLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {editShed && (
        <Modal title="Editar galpón" onClose={() => setEditShed(null)}>
          <form className="space-y-4" onSubmit={handleUpdateShed}>
            <TextField label="Nombre" value={editShedForm.name} onChange={(v) => setEditShedForm({ ...editShedForm, name: v })} required />
            <TextField label="Código" value={editShedForm.code} onChange={(v) => setEditShedForm({ ...editShedForm, code: v })} required />
            <TextField label="Fecha de ingreso" type="date" value={editShedForm.entry_date} onChange={(v) => setEditShedForm({ ...editShedForm, entry_date: v })} required />
            <TextArea label="Notas" value={editShedForm.notes} onChange={(v) => setEditShedForm({ ...editShedForm, notes: v })} />
            <ModalActions onClose={() => setEditShed(null)} saving={saving === "editShed"} label="Guardar cambios" />
          </form>
        </Modal>
      )}

      {editCustomer && (
        <Modal title="Editar cliente" onClose={() => setEditCustomer(null)}>
          <form className="space-y-4" onSubmit={handleUpdateCustomer}>
            <TextField label="Nombre" value={editCustomerForm.name} onChange={(v) => setEditCustomerForm({ ...editCustomerForm, name: v })} required />
            <TextField label="Teléfono" type="tel" value={editCustomerForm.phone} onChange={(v) => setEditCustomerForm({ ...editCustomerForm, phone: v })} />
            <TextField label="Documento" value={editCustomerForm.document} onChange={(v) => setEditCustomerForm({ ...editCustomerForm, document: v })} />
            <TextArea label="Notas" value={editCustomerForm.notes} onChange={(v) => setEditCustomerForm({ ...editCustomerForm, notes: v })} />
            <ModalActions onClose={() => setEditCustomer(null)} saving={saving === "editCustomer"} label="Guardar cambios" />
          </form>
        </Modal>
      )}

      {editCost && (
        <Modal title="Editar costo" onClose={() => setEditCost(null)}>
          <form className="space-y-4" onSubmit={handleUpdateCost}>
            <SelectField label="Galpón" value={editCostForm.shed_id} onChange={(v) => setEditCostForm({ ...editCostForm, shed_id: v })} required>
              <option value="">Selecciona un galpón</option>
              {summaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </SelectField>
            <TextField label="Fecha" type="date" value={editCostForm.cost_date} onChange={(v) => setEditCostForm({ ...editCostForm, cost_date: v })} required />
            <TextField label="Concepto" value={editCostForm.concept} onChange={(v) => setEditCostForm({ ...editCostForm, concept: v })} required />
            <TextField label="Valor" type="number" min="0" value={editCostForm.amount} onChange={(v) => setEditCostForm({ ...editCostForm, amount: v })} required />
            <TextArea label="Notas" value={editCostForm.notes} onChange={(v) => setEditCostForm({ ...editCostForm, notes: v })} />
            <ModalActions onClose={() => setEditCost(null)} saving={saving === "editCost"} label="Guardar cambios" />
          </form>
        </Modal>
      )}

      {viewSale && (
        <SaleDetailModal
          sale={viewSale}
          items={saleItems}
          loadingItems={loadingSaleItems}
          onClose={() => setViewSale(null)}
          onDelete={() => {
            const s = viewSale;
            setViewSale(null);
            setConfirmDelete({ type: "sale", id: s.id, label: `${s.customers?.name ?? "Venta"} — ${s.sale_date}` });
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          label={confirmDelete.label}
          saving={saving === "del"}
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </main>
  );
}

// ── View Components ────────────────────────────────────────────────────────

function HomeView({ summaries, totals, sales, chartData }: { summaries: ShedSummary[]; totals: Record<string, number>; sales: Sale[]; chartData: { date: string; label: string; total: number }[] }) {
  const recentSales = sales.slice(0, 5);
  const alerts = summaries.filter((s) => s.available <= Math.max(5, s.initial_quantity * 0.12));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Boxes} label="Pollos disponibles" value={formatNumber(totals.available)} tone="leaf" />
        <Kpi icon={ReceiptText} label="Pollos vendidos" value={formatNumber(totals.sold)} tone="soil" />
        <Kpi icon={Banknote} label="Ingresos" value={formatCurrency(totals.revenue)} tone="money" />
        <Kpi icon={DollarSign} label="Utilidad" value={formatCurrency(totals.profit)} tone="profit" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="panel rounded-xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-black text-soil-900">Mapa de galpones</h2>
              <p className="text-xs font-medium text-soil-500 mt-0.5">Altura = disponibilidad · Color = ingresos</p>
            </div>
            <span className="badge badge-green">{summaries.length} galpones</span>
          </div>
          <ShedMap summaries={summaries} />
        </section>

        <section className="panel rounded-xl p-5">
          <h2 className="font-display text-xl font-black text-soil-900 mb-5">Métodos de pago</h2>
          <div className="space-y-4">
            <PayRow icon={Banknote} label="Efectivo" value={totals.cash} total={totals.revenue} />
            <PayRow icon={CreditCard} label="Transferencia" value={totals.transfer} total={totals.revenue} />
          </div>
          <div className="mt-6">
            <h3 className="text-2xs font-bold uppercase tracking-[0.14em] text-soil-500 mb-3">Alertas de inventario</h3>
            <div className="space-y-2">
              {alerts.length ? (
                alerts.map((s) => (
                  <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-ember-400/25 bg-ember-100 px-3 py-2.5">
                    <span className="size-1.5 shrink-0 rounded-full bg-ember-500" aria-hidden="true" />
                    <p className="text-xs font-semibold text-ember-800">
                      {s.name}: quedan <span className="num font-black">{formatNumber(s.available)}</span> pollos
                    </p>
                  </div>
                ))
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg bg-leaf-50 px-3 py-2.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-leaf-500" aria-hidden="true" />
                  <p className="text-xs font-semibold text-leaf-700">Sin alertas de inventario bajo</p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <SalesChart data={chartData} />

      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900 mb-1">Ventas recientes</h2>
        <p className="text-xs text-soil-500 mb-4">Últimas 5 transacciones</p>
        <DataTable
          columns={["Fecha", "Cliente", "Galpón", "Cantidad", "Método", "Total"]}
          rows={recentSales.map((s) => [s.sale_date, s.customers?.name ?? "Cliente", s.sheds?.name ?? "Galpón", formatNumber(s.quantity), s.payment_method, formatCurrency(s.total)])}
          empty="Aún no hay ventas registradas."
        />
      </section>
    </div>
  );
}

function ShedsView({
  form, setForm, onSubmit, saving, summaries, onEdit, onDelete, onChangeStatus
}: {
  form: typeof emptyShed; setForm: (v: typeof emptyShed) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean; summaries: ShedSummary[];
  onEdit: (s: ShedSummary) => void; onDelete: (s: ShedSummary) => void;
  onChangeStatus: (id: string, status: ShedStatus) => void;
}) {
  const statusLabels: Record<ShedStatus, string> = { activo: "Activo", pausado: "Pausado", cerrado: "Cerrado" };
  const statusColors: Record<ShedStatus, string> = {
    activo: "badge-green",
    pausado: "badge-amber",
    cerrado: "badge-gray"
  };
  const nextStatus: Record<ShedStatus, { label: string; value: ShedStatus }[]> = {
    activo: [{ label: "Pausar", value: "pausado" }, { label: "Cerrar", value: "cerrado" }],
    pausado: [{ label: "Activar", value: "activo" }, { label: "Cerrar", value: "cerrado" }],
    cerrado: [{ label: "Reabrir", value: "activo" }]
  };

  return (
    <TwoColumn>
      <FormPanel title="Crear galpón" onSubmit={onSubmit} saving={saving} submitLabel="Crear galpón">
        <TextField label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="Galpón Norte" />
        <TextField label="Código" value={form.code} onChange={(v) => setForm({ ...form, code: v })} required placeholder="G-001" />
        <TextField label="Fecha de ingreso" type="date" value={form.entryDate} onChange={(v) => setForm({ ...form, entryDate: v })} required />
        <TextField label="Cantidad inicial" type="number" min="1" value={form.initialQuantity} onChange={(v) => setForm({ ...form, initialQuantity: v })} required />
        <TextArea label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      </FormPanel>
      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900 mb-4">Galpones</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {summaries.map((shed) => (
            <article key={shed.id} className="rounded-xl border border-soil-100 bg-white p-4 shadow-card transition hover:shadow-panel">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-2xs font-bold uppercase tracking-wider text-leaf-600">{shed.code}</p>
                  <h3 className="mt-0.5 text-base font-bold text-soil-900">{shed.name}</h3>
                </div>
                <span className={`badge ${statusColors[shed.status]}`}>{statusLabels[shed.status]}</span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2">
                <Stat label="Disponibles" value={formatNumber(shed.available)} />
                <Stat label="Vendidos" value={formatNumber(shed.sold)} />
                <Stat label="Ingresos" value={formatCurrency(shed.revenue)} />
                <Stat label="Utilidad" value={formatCurrency(shed.profit)} />
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-soil-50 pt-3">
                {nextStatus[shed.status].map((ns) => (
                  <button key={ns.value} type="button"
                    className="flex items-center gap-1.5 rounded-lg border border-soil-100 bg-soil-50 px-2.5 text-xs font-semibold text-soil-700 transition hover:bg-soil-100"
                    style={{ minHeight: "34px" }}
                    onClick={() => onChangeStatus(shed.id, ns.value)}
                  >
                    <CalendarDays className="size-3" aria-hidden="true" />{ns.label}
                  </button>
                ))}
                <button type="button"
                  className="flex items-center gap-1.5 rounded-lg border border-soil-100 bg-white px-2.5 text-xs font-semibold text-soil-700 transition hover:bg-leaf-50"
                  style={{ minHeight: "34px" }}
                  onClick={() => onEdit(shed)}
                  aria-label={`Editar ${shed.name}`}
                >
                  <Edit2 className="size-3" aria-hidden="true" />Editar
                </button>
                <button type="button"
                  className="grid place-items-center rounded-lg border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                  style={{ minHeight: "34px", minWidth: "34px" }}
                  onClick={() => onDelete(shed)}
                  aria-label={`Eliminar ${shed.name}`}
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
          {!summaries.length ? <Empty text="Crea el primer galpón para empezar el inventario." /> : null}
        </div>
      </section>
    </TwoColumn>
  );
}

function CustomersView({
  form, setForm, onSubmit, saving, customers, sales, onEdit, onDelete, page, setPage
}: {
  form: typeof emptyCustomer; setForm: (v: typeof emptyCustomer) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean;
  customers: Customer[]; sales: Sale[];
  onEdit: (c: Customer) => void; onDelete: (c: Customer) => void;
  page: number; setPage: (p: number) => void;
}) {
  return (
    <TwoColumn>
      <FormPanel title="Registrar cliente" onSubmit={onSubmit} saving={saving} submitLabel="Guardar cliente">
        <TextField label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required placeholder="Nombre del cliente" />
        <TextField label="Teléfono" type="tel" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="300 000 0000" />
        <TextField label="Documento" value={form.document} onChange={(v) => setForm({ ...form, document: v })} />
        <TextArea label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
      </FormPanel>
      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900">Clientes</h2>
        {customers.length === 0 ? (
          <Empty text="Aún no hay clientes." />
        ) : (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-soil-100 bg-white">
              <table className="data-table min-w-[600px]">
                <thead>
                  <tr>
                    {["Nombre", "Teléfono", "Documento", "Compras", "Total", ""].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginate(customers, page).map((customer) => {
                    const cs = sales.filter((s) => s.customer_id === customer.id);
                    return (
                      <tr key={customer.id}>
                        <td className="font-semibold">{customer.name}</td>
                        <td>{customer.phone ?? "—"}</td>
                        <td>{customer.document ?? "—"}</td>
                        <td className="num">{formatNumber(cs.length)}</td>
                        <td className="num font-bold">{formatCurrency(cs.reduce((n, s) => n + s.total, 0))}</td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <button type="button" className="grid size-8 place-items-center rounded-lg border border-soil-100 text-soil-700 transition hover:bg-leaf-50" onClick={() => onEdit(customer)} aria-label="Editar cliente">
                              <Edit2 className="size-3.5" aria-hidden="true" />
                            </button>
                            <button type="button" className="grid size-8 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700" onClick={() => onDelete(customer)} aria-label="Eliminar cliente">
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginator total={customers.length} page={page} setPage={setPage} />
          </>
        )}
      </section>
    </TwoColumn>
  );
}

function SalesView(props: {
  form: typeof emptySale; setForm: (v: typeof emptySale) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean;
  summaries: ShedSummary[]; customers: Customer[]; sales: Sale[];
  query: string; setQuery: (v: string) => void;
  filterShed: string; setFilterShed: (v: string) => void;
  filterPayment: string; setFilterPayment: (v: string) => void;
  filterFrom: string; setFilterFrom: (v: string) => void;
  filterTo: string; setFilterTo: (v: string) => void;
  onView: (s: Sale) => void; onDelete: (s: Sale) => void;
  onToggleStatus: (s: Sale) => void;
  page: number; setPage: (p: number) => void;
  onExport: () => void;
}) {
  const total = Number(props.form.quantity || 0) * Number(props.form.unitPrice || 0);
  const isNew = props.form.customerMode === "new";

  return (
    <div className="space-y-4">
      {/* ── Formulario full-width ── */}
      <section className="panel rounded-xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-black text-soil-900 mb-5">Registrar venta</h2>
        <form onSubmit={props.onSubmit} noValidate>
          {/* Fila 1: Galpón · Cliente · Fecha */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Galpón */}
            <div>
              <label htmlFor="sale-shed" className="field-label">Galpón</label>
              <select
                id="sale-shed"
                className="field-input"
                value={props.form.shedId}
                onChange={(e) => props.setForm({ ...props.form, shedId: e.target.value })}
                required
              >
                <option value="">Selecciona un galpón</option>
                {props.summaries.map((s) => (
                  <option key={s.id} value={s.id}>{s.code} · {s.name} ({s.available} disp.)</option>
                ))}
              </select>
            </div>

            {/* Cliente */}
            <div className="lg:col-span-1">
              <span className="field-label">Cliente</span>
              <div className="mb-2 grid grid-cols-2 rounded-lg border border-soil-100 bg-white/70 p-1">
                <button type="button"
                  className={`min-h-9 rounded-md text-sm font-semibold transition ${!isNew ? "bg-leaf-700 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"}`}
                  onClick={() => props.setForm({ ...props.form, customerMode: "existing", newCustomerName: "", newCustomerPhone: "" })}
                >Existente</button>
                <button type="button"
                  className={`min-h-9 rounded-md text-sm font-semibold transition ${isNew ? "bg-leaf-700 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"}`}
                  onClick={() => props.setForm({ ...props.form, customerMode: "new", customerId: "" })}
                >+ Nuevo</button>
              </div>
              {isNew ? (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="field-input"
                    placeholder="Nombre*"
                    required
                    value={props.form.newCustomerName}
                    onChange={(e) => props.setForm({ ...props.form, newCustomerName: e.target.value })}
                  />
                  <input
                    className="field-input"
                    placeholder="Teléfono"
                    value={props.form.newCustomerPhone}
                    onChange={(e) => props.setForm({ ...props.form, newCustomerPhone: e.target.value })}
                  />
                </div>
              ) : (
                <select
                  className="field-input"
                  value={props.form.customerId}
                  onChange={(e) => props.setForm({ ...props.form, customerId: e.target.value })}
                  required
                >
                  <option value="">Selecciona un cliente</option>
                  {props.customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Fecha */}
            <div>
              <label htmlFor="sale-date" className="field-label">Fecha</label>
              <input
                id="sale-date"
                type="date"
                className="field-input"
                value={props.form.saleDate}
                onChange={(e) => props.setForm({ ...props.form, saleDate: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Fila 2: Estado pago · Método · Modo · Cantidad · Valor */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Estado de pago */}
            <div>
              <span className="field-label">Estado de pago</span>
              <div className="grid grid-cols-2 rounded-lg border border-soil-100 bg-white/70 p-1">
                <button type="button"
                  className={`min-h-9 rounded-md text-sm font-semibold transition ${props.form.paymentStatus === "pagado" ? "bg-leaf-700 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"}`}
                  onClick={() => props.setForm({ ...props.form, paymentStatus: "pagado" })}
                >Pagado</button>
                <button type="button"
                  className={`min-h-9 rounded-md text-sm font-semibold transition ${props.form.paymentStatus === "pendiente" ? "bg-ember-500 text-white shadow-button" : "text-soil-700 hover:bg-leaf-50"}`}
                  onClick={() => props.setForm({ ...props.form, paymentStatus: "pendiente" })}
                >Pendiente</button>
              </div>
            </div>

            {/* Método de pago */}
            <div>
              <label htmlFor="sale-method" className="field-label">Método de pago</label>
              <select
                id="sale-method"
                className="field-input"
                value={props.form.paymentMethod}
                onChange={(e) => props.setForm({ ...props.form, paymentMethod: e.target.value as PaymentMethod })}
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>

            {/* Modo de venta */}
            <div>
              <label htmlFor="sale-mode" className="field-label">Modo de venta</label>
              <select
                id="sale-mode"
                className="field-input"
                value={props.form.saleMode}
                onChange={(e) => props.setForm({ ...props.form, saleMode: e.target.value as SaleMode })}
              >
                <option value="lote">Por lote</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            {/* Cantidad */}
            <div>
              <label htmlFor="sale-qty" className="field-label">Cantidad</label>
              <input
                id="sale-qty"
                type="number"
                min="1"
                className="field-input"
                value={props.form.quantity}
                onChange={(e) => props.setForm({ ...props.form, quantity: e.target.value })}
                required
              />
            </div>

            {/* Valor unitario */}
            <div>
              <label htmlFor="sale-price" className="field-label">Valor unitario</label>
              <input
                id="sale-price"
                type="number"
                min="0"
                className="field-input"
                value={props.form.unitPrice}
                onChange={(e) => props.setForm({ ...props.form, unitPrice: e.target.value })}
                required
              />
            </div>
          </div>

          {/* Fila 3: Notas + Total + Botón */}
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label htmlFor="sale-notes" className="field-label">Notas (opcional)</label>
              <input
                id="sale-notes"
                type="text"
                className="field-input"
                placeholder="Observaciones de la venta"
                value={props.form.notes}
                onChange={(e) => props.setForm({ ...props.form, notes: e.target.value })}
              />
            </div>
            <div className="shrink-0 rounded-lg bg-leaf-50 px-4 py-3 text-sm font-bold text-leaf-900 sm:text-base">
              Total: <span className="num">{formatCurrency(total)}</span>
            </div>
            <button
              type="submit"
              disabled={props.saving}
              className="btn-primary shrink-0 gap-2"
              style={{ minHeight: "46px", minWidth: "160px" }}
            >
              {props.saving
                ? <><RefreshCw className="size-4 spin" aria-hidden="true" /> Guardando…</>
                : <><Plus className="size-4" aria-hidden="true" /> Guardar venta</>
              }
            </button>
          </div>
        </form>
      </section>

      {/* ── Tabla de ventas full-width ── */}
      <section className="panel rounded-xl p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-black text-soil-900">Ventas registradas</h2>
          <button type="button" onClick={props.onExport} className="btn-secondary text-xs gap-1.5 px-3" style={{ minHeight: "36px" }}>
            <Download className="size-3.5 text-leaf-600" aria-hidden="true" />Exportar CSV
          </button>
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-soil-100 bg-white px-3" style={{ minHeight: "38px" }}>
            <Search className="size-3.5 text-leaf-600 shrink-0" aria-hidden="true" />
            <input className="w-28 bg-transparent outline-none text-sm" value={props.query} onChange={(e) => props.setQuery(e.target.value)} placeholder="Buscar…" aria-label="Buscar ventas" />
          </label>
          <select className="rounded-lg border border-soil-100 bg-white px-3 text-sm text-soil-700" style={{ minHeight: "38px" }} value={props.filterShed} onChange={(e) => props.setFilterShed(e.target.value)}>
            <option value="">Todos los galpones</option>
            {props.summaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select className="rounded-lg border border-soil-100 bg-white px-3 text-sm text-soil-700" style={{ minHeight: "38px" }} value={props.filterPayment} onChange={(e) => props.setFilterPayment(e.target.value)}>
            <option value="">Todos los métodos</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <label className="flex items-center gap-2 rounded-lg border border-soil-100 bg-white px-3" style={{ minHeight: "38px" }}>
            <CalendarDays className="size-3.5 text-leaf-600 shrink-0" aria-hidden="true" />
            <input type="date" className="bg-transparent outline-none text-xs" value={props.filterFrom} onChange={(e) => props.setFilterFrom(e.target.value)} title="Desde" aria-label="Desde" />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-soil-100 bg-white px-3" style={{ minHeight: "38px" }}>
            <CalendarDays className="size-3.5 text-leaf-600 shrink-0" aria-hidden="true" />
            <input type="date" className="bg-transparent outline-none text-xs" value={props.filterTo} onChange={(e) => props.setFilterTo(e.target.value)} title="Hasta" aria-label="Hasta" />
          </label>
        </div>

        {props.sales.length === 0 ? <Empty text="Aún no hay ventas registradas." /> : (
          <>
            <div className="overflow-x-auto rounded-lg border border-soil-100 bg-white">
              <table className="data-table min-w-[800px]">
                <thead>
                  <tr>
                    {["Fecha", "Cliente", "Galpón", "Cant.", "Unitario", "Método", "Estado", "Total", ""].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginate(props.sales, props.page).map((sale) => (
                    <tr key={sale.id}>
                      <td className="num">{sale.sale_date}</td>
                      <td className="font-semibold">{sale.customers?.name ?? "—"}</td>
                      <td className="text-soil-500">{sale.sheds?.name ?? "—"}</td>
                      <td className="num">{formatNumber(sale.quantity)}</td>
                      <td className="num">{formatCurrency(sale.unit_price)}</td>
                      <td className="capitalize text-soil-500">{sale.payment_method}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => props.onToggleStatus(sale)}
                          className={`badge transition cursor-pointer ${
                            sale.payment_status === "pagado" ? "badge-green hover:opacity-80" : "badge-amber hover:opacity-80"
                          }`}
                          title="Clic para cambiar estado"
                          aria-label={`Estado: ${sale.payment_status}. Clic para cambiar.`}
                        >
                          {sale.payment_status === "pagado" ? "Pagado" : "Pendiente"}
                        </button>
                      </td>
                      <td className="num font-bold">{formatCurrency(sale.total)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button type="button" className="rounded-lg border border-soil-100 bg-white px-2.5 text-xs font-semibold text-soil-700 transition hover:bg-leaf-50" style={{ minHeight: "32px" }} onClick={() => props.onView(sale)} aria-label="Ver detalle">Ver</button>
                          <button type="button" className="grid size-8 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700" onClick={() => props.onDelete(sale)} aria-label="Eliminar venta">
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={props.sales.length} page={props.page} setPage={props.setPage} />
          </>
        )}
      </section>
    </div>
  );
}

function AccountingView(props: {
  form: typeof emptyCost; setForm: (v: typeof emptyCost) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean;
  summaries: ShedSummary[]; costs: ShedCost[];
  filterCostShed: string; setFilterCostShed: (v: string) => void;
  filterCostFrom: string; setFilterCostFrom: (v: string) => void;
  filterCostTo: string; setFilterCostTo: (v: string) => void;
  onEdit: (c: ShedCost) => void; onDelete: (c: ShedCost) => void;
  page: number; setPage: (p: number) => void;
  onExport: () => void;
}) {
  return (
    <TwoColumn>
      <FormPanel title="Registrar costo" onSubmit={props.onSubmit} saving={props.saving} submitLabel="Guardar costo">
        <SelectField label="Galpón" value={props.form.shedId} onChange={(v) => props.setForm({ ...props.form, shedId: v })} required>
          <option value="">Selecciona un galpón</option>
          {props.summaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <TextField label="Fecha" type="date" value={props.form.costDate} onChange={(v) => props.setForm({ ...props.form, costDate: v })} required />
        <TextField label="Concepto" value={props.form.concept} onChange={(v) => props.setForm({ ...props.form, concept: v })} required placeholder="Alimento, transporte, vacunas" />
        <TextField label="Valor" type="number" min="0" value={props.form.amount} onChange={(v) => props.setForm({ ...props.form, amount: v })} required />
        <TextArea label="Notas" value={props.form.notes} onChange={(v) => props.setForm({ ...props.form, notes: v })} />
      </FormPanel>

      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900">Utilidad por galpón</h2>
        <DataTable
          columns={["Galpón", "Ingresos", "Costos", "Utilidad", "Disponibles"]}
          rows={props.summaries.map((s) => [s.name, formatCurrency(s.revenue), formatCurrency(s.costs), formatCurrency(s.profit), formatNumber(s.available)])}
          empty="Aún no hay información contable."
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-bold uppercase tracking-[0.14em] text-soil-700">Costos registrados</h3>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border border-soil-100 bg-white px-3 text-sm text-soil-700" style={{ minHeight: "38px" }} value={props.filterCostShed} onChange={(e) => props.setFilterCostShed(e.target.value)}>
              <option value="">Todos los galpones</option>
              {props.summaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label className="flex items-center gap-2 rounded-lg border border-soil-100 bg-white px-3 text-sm" style={{ minHeight: "38px" }}>
              <CalendarDays className="size-3.5 text-leaf-600 shrink-0" aria-hidden="true" />
              <input type="date" className="bg-transparent outline-none text-xs" value={props.filterCostFrom} onChange={(e) => props.setFilterCostFrom(e.target.value)} title="Desde" aria-label="Desde" />
            </label>
            <label className="flex items-center gap-2 rounded-lg border border-soil-100 bg-white px-3 text-sm" style={{ minHeight: "38px" }}>
              <CalendarDays className="size-3.5 text-leaf-600 shrink-0" aria-hidden="true" />
              <input type="date" className="bg-transparent outline-none text-xs" value={props.filterCostTo} onChange={(e) => props.setFilterCostTo(e.target.value)} title="Hasta" aria-label="Hasta" />
            </label>
            <button type="button" onClick={props.onExport} className="btn-secondary text-xs gap-1.5 px-3" style={{ minHeight: "38px" }}>
              <Download className="size-3.5 text-leaf-600" aria-hidden="true" />CSV
            </button>
          </div>
        </div>

        {props.costs.length === 0 ? <Empty text="Aún no hay costos." /> : (
          <>
            <div className="mt-3 overflow-x-auto rounded-lg border border-soil-100 bg-white">
              <table className="data-table min-w-[500px]">
                <thead>
                  <tr>
                    {["Fecha", "Concepto", "Valor", ""].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginate(props.costs, props.page).map((cost) => (
                    <tr key={cost.id}>
                      <td className="num">{cost.cost_date}</td>
                      <td>{cost.concept}</td>
                      <td className="num font-bold">{formatCurrency(cost.amount)}</td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <button type="button" className="grid size-8 place-items-center rounded-lg border border-soil-100 text-soil-700 transition hover:bg-leaf-50" onClick={() => props.onEdit(cost)} aria-label="Editar costo">
                            <Edit2 className="size-3.5" aria-hidden="true" />
                          </button>
                          <button type="button" className="grid size-8 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700" onClick={() => props.onDelete(cost)} aria-label="Eliminar costo">
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={props.costs.length} page={props.page} setPage={props.setPage} />
          </>
        )}
      </section>
    </TwoColumn>
  );
}

function MovementsView(props: {
  form: typeof emptyMovement; setForm: (v: typeof emptyMovement) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean;
  summaries: ShedSummary[]; movements: InventoryMovement[];
  onDelete: (m: InventoryMovement) => void;
  page: number; setPage: (p: number) => void;
}) {
  return (
    <TwoColumn>
      <FormPanel title="Ajustar inventario" onSubmit={props.onSubmit} saving={props.saving} submitLabel="Guardar movimiento">
        <SelectField label="Galpón" value={props.form.shedId} onChange={(v) => props.setForm({ ...props.form, shedId: v })} required>
          <option value="">Selecciona un galpón</option>
          {props.summaries.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>
        <SelectField label="Tipo" value={props.form.movementType} onChange={(v) => props.setForm({ ...props.form, movementType: v })}>
          <option value="adjustment">Ajuste</option>
          <option value="entry">Entrada adicional</option>
          <option value="loss">Pérdida / muerte</option>
        </SelectField>
        <TextField label="Cantidad" type="number" value={props.form.quantity} onChange={(v) => props.setForm({ ...props.form, quantity: v })} required />
        <TextArea label="Razón" value={props.form.reason} onChange={(v) => props.setForm({ ...props.form, reason: v })} required />
      </FormPanel>

      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900">Movimientos</h2>
        {props.movements.length === 0 ? <Empty text="Aún no hay movimientos." /> : (
          <>
            <div className="mt-4 overflow-x-auto rounded-lg border border-soil-100 bg-white">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    {["Fecha", "Tipo", "Cantidad", "Razón", ""].map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginate(props.movements, props.page).map((m) => (
                    <tr key={m.id}>
                      <td className="num">{new Date(m.created_at).toLocaleDateString("es-CO")}</td>
                      <td className="capitalize">{m.movement_type}</td>
                      <td className="num">{formatNumber(m.quantity)}</td>
                      <td>{m.reason}</td>
                      <td>
                        {m.sale_id === null ? (
                          <button type="button" className="grid size-8 place-items-center rounded-lg border border-red-100 bg-red-50 text-red-500 transition hover:bg-red-100 hover:text-red-700" onClick={() => props.onDelete(m)} aria-label="Eliminar movimiento">
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : (
                          <span className="badge badge-gray">Venta</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator total={props.movements.length} page={props.page} setPage={props.setPage} />
          </>
        )}
      </section>
    </TwoColumn>
  );
}

function ProfileView({
  user, profile, form, setForm, onSubmit, saving, onPasswordReset
}: {
  user: User | null; profile: Profile | null;
  form: { full_name: string }; setForm: (v: { full_name: string }) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean;
  onPasswordReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900">Perfil</h2>
        <form className="mt-4 space-y-4" onSubmit={onSubmit}>
          <div className="rounded-lg bg-soil-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Correo electrónico</p>
            <p className="mt-1 font-semibold text-soil-900">{user?.email}</p>
          </div>
          <TextField label="Nombre completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} placeholder="Tu nombre completo" />
          {profile?.created_at ? (
            <div className="rounded-lg bg-soil-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Cuenta creada</p>
              <p className="mt-1 text-sm text-soil-900">{new Date(profile.created_at).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
          ) : null}
          <button
            type="submit"
            disabled={saving}
            className="btn-primary w-full"
          >
            {saving ? <><RefreshCw className="size-3.5 spin" aria-hidden="true" /> Guardando…</> : "Guardar perfil"}
          </button>
        </form>
      </section>

      <section className="panel rounded-xl p-5">
        <h2 className="font-display text-xl font-black text-soil-900">Seguridad</h2>
        <p className="mt-2 text-sm text-soil-700">
          Te enviaremos un correo con un enlace para establecer una nueva contraseña.
        </p>
        <button
          type="button"
          className="mt-4 btn-secondary gap-2"
          onClick={onPasswordReset}
        >
          <Key className="size-4 text-leaf-700" aria-hidden="true" />
          Enviar enlace de cambio de contraseña
        </button>
      </section>
    </div>
  );
}

// ── Modal Components ───────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 grid place-items-center px-4 py-6"
      style={{ background: "rgba(15,35,24,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="modal-content panel w-full max-w-lg rounded-xl p-6 max-h-[90dvh] overflow-y-auto shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-black text-soil-900">{title}</h2>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-soil-100 text-soil-500 transition hover:bg-soil-50 hover:text-soil-900"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" className="btn-secondary flex-1 text-sm" style={{ minHeight: "44px" }} onClick={onClose}>
        Cancelar
      </button>
      <button type="submit" disabled={saving} className="btn-primary flex-1 text-sm" style={{ minHeight: "44px" }}>
        {saving ? <><RefreshCw className="size-3.5 spin" aria-hidden="true" /> Guardando…</> : label}
      </button>
    </div>
  );
}

function SaleDetailModal({
  sale, items, loadingItems, onClose, onDelete
}: {
  sale: Sale; items: SaleItem[]; loadingItems: boolean;
  onClose: () => void; onDelete: () => void;
}) {
  return (
    <Modal title="Detalle de venta" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Fecha" value={sale.sale_date} />
          <Stat label="Pago" value={sale.payment_method} />
          <Stat label="Modo" value={sale.sale_mode} />
          <Stat label="Cantidad" value={formatNumber(sale.quantity)} />
          <Stat label="Unitario" value={formatCurrency(sale.unit_price)} />
          <Stat label="Total" value={formatCurrency(sale.total)} />
        </div>
        {sale.customers?.name ? (
          <div className="rounded-lg bg-soil-50 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Cliente</p>
            <p className="mt-0.5 font-semibold text-soil-900">{sale.customers.name}</p>
            {sale.customers.phone ? <p className="text-sm text-soil-600">{sale.customers.phone}</p> : null}
          </div>
        ) : null}
        {sale.sheds?.name ? (
          <div className="rounded-lg bg-soil-50 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Galpón</p>
            <p className="mt-0.5 font-semibold text-soil-900">{sale.sheds.name} · {sale.sheds.code}</p>
          </div>
        ) : null}
        {sale.notes ? (
          <div className="rounded-lg bg-soil-50 px-3 py-2.5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Notas</p>
            <p className="mt-0.5 text-sm text-soil-900">{sale.notes}</p>
          </div>
        ) : null}

        {sale.sale_mode === "individual" && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-soil-700">Ítems individuales</p>
            {loadingItems ? (
              <p className="text-sm text-soil-600">Cargando ítems...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-soil-600">Sin ítems registrados.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-soil-100 bg-white">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["Etiqueta", "Cant.", "Unitario"].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id}>
                        <td>{item.bird_tag ?? "—"}</td>
                        <td className="num">{formatNumber(item.quantity)}</td>
                        <td className="num">{formatCurrency(item.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" className="btn-secondary flex-1 text-sm" onClick={onClose}>
            Cerrar
          </button>
          <button type="button" className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100" onClick={onDelete}>
            <Trash2 className="size-4" aria-hidden="true" />Eliminar venta
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ConfirmDeleteDialog({ label, saving, onConfirm, onCancel }: { label: string; saving: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 grid place-items-center px-4"
      style={{ background: "rgba(15,35,24,0.55)", backdropFilter: "blur(6px)" }}
      role="alertdialog"
      aria-modal="true"
    >
      <div className="modal-content panel w-full max-w-sm rounded-xl p-6 shadow-modal">
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-red-50">
          <Trash2 className="size-5 text-red-600" aria-hidden="true" />
        </div>
        <h2 className="font-display text-xl font-black text-soil-900">Confirmar eliminación</h2>
        <p className="mt-2 text-sm text-soil-600">
          ¿Eliminar <strong className="font-bold text-soil-900">{label}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="mt-6 flex gap-3">
          <button type="button" disabled={saving} className="btn-secondary flex-1 text-sm" style={{ minHeight: "44px" }} onClick={onCancel}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-55"
            style={{ minHeight: "44px" }}
            onClick={onConfirm}
          >
            {saving ? <><RefreshCw className="size-3.5 spin" aria-hidden="true" /> Eliminando…</> : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chart & Helper Components ──────────────────────────────────────────────

function SalesChart({ data }: { data: { date: string; label: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const totalPeriod = data.reduce((n, d) => n + d.total, 0);

  return (
    <section className="panel rounded-xl p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-black text-soil-900">Ventas · 30 días</h2>
          <p className="text-xs font-medium text-soil-500 mt-0.5">Últimos 30 días corridos</p>
        </div>
        <div className="rounded-lg bg-leaf-50 px-3 py-2 text-right">
          <p className="text-2xs font-bold uppercase tracking-wider text-leaf-600">Total</p>
          <p className="num font-black text-leaf-900">{formatCurrency(totalPeriod)}</p>
        </div>
      </div>
      <div className="flex items-end gap-px h-36">
        {data.map((day) => {
          const pct = day.total / max;
          const height = Math.max(3, Math.round(pct * 144));
          return (
            <div
              key={day.date}
              className="group relative flex-1 flex flex-col justify-end"
              title={`${day.label}: ${formatCurrency(day.total)}`}
              role="img"
              aria-label={`${day.label}: ${formatCurrency(day.total)}`}
            >
              <div
                className="rounded-t-sm transition-all duration-150"
                style={{
                  height: `${height}px`,
                  background: day.total > 0
                    ? `linear-gradient(to top, #2b6334, #438b4a)`
                    : "#ebe6da"
                }}
              />
              {day.total > 0 ? (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-forest-950 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg group-hover:block">
                  {day.label}: {formatCurrency(day.total)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-soil-400">
        <span>{data[0]?.label}</span>
        <span>{data[14]?.label}</span>
        <span>{data[29]?.label}</span>
      </div>
    </section>
  );
}

function Paginator({ total, page, setPage }: { total: number; page: number; setPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="num text-xs font-medium text-soil-500">{total} registros · pág. {page}/{totalPages}</span>
      <div className="flex gap-1.5">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}
          className="btn-secondary text-xs gap-1.5 px-3"
          style={{ minHeight: "36px" }}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-3.5" aria-hidden="true" />Anterior
        </button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}
          className="btn-secondary text-xs gap-1.5 px-3"
          style={{ minHeight: "36px" }}
          aria-label="Página siguiente"
        >
          Siguiente<ChevronRight className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// ── Shared Components ──────────────────────────────────────────────────────

function Splash({ text }: { text: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-4">
        <div className="grid size-16 place-items-center rounded-2xl bg-forest-950 text-white shadow-modal">
          <Bird className="size-8" aria-hidden="true" />
        </div>
        <div className="flex items-center gap-3">
          <RefreshCw className="size-4 spin text-leaf-600" aria-hidden="true" />
          <p className="font-semibold text-soil-700">{text}</p>
        </div>
      </div>
    </main>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-leaf-600 text-white shadow-sm">
        <Bird className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-display text-lg font-black leading-none text-white">Pollos</p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(255,255,255,0.5)" }}>Galpones</p>
      </div>
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: { id: TabId; label: string; icon: typeof BarChart3 }; active: boolean; onClick: () => void }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      className={`nav-item${active ? " active" : ""}`}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {item.label}
    </button>
  );
}

function ShedMap({ summaries }: { summaries: ShedSummary[] }) {
  /* ── Isometric projection ── */
  const S = 38;
  function iso(x: number, y: number, z: number): [number, number] {
    return [(x - y) * S * 0.866, (x + y) * S * 0.5 - z * S];
  }
  function poly(...v: [number, number][]): string {
    return v.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ");
  }

  if (!summaries.length) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-xl"
           style={{ background: "linear-gradient(160deg, #060e08, #0f2318)" }}>
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-white/5">
            <Bird className="size-6 text-white/30" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-white/30">Crea galpones para ver el mapa</p>
        </div>
      </div>
    );
  }

  /* Building dimensions — elongated chicken house along X axis */
  const BW = 3.8;  // length (X)
  const BD = 1.6;  // width  (Y)
  const WH = 1.05; // wall height
  const RH = 0.58; // roof peak above walls
  const GAP_X = 1.4;
  const GAP_Y = 3.2;
  const COLS = Math.min(3, summaries.length);

  const placements = summaries.slice(0, 9).map((shed, i) => ({
    shed,
    gx: (i % COLS) * (BW + GAP_X),
    gy: Math.floor(i / COLS) * (BD + GAP_Y),
  }));

  /* Compute SVG bounding box */
  const allPts: [number, number][] = [];
  placements.forEach(({ gx, gy }) => {
    [
      iso(gx, gy, 0), iso(gx + BW, gy, 0),
      iso(gx, gy + BD, 0), iso(gx + BW, gy + BD, 0),
      iso(gx, gy + BD / 2, WH + RH), iso(gx + BW, gy + BD / 2, WH + RH),
    ].forEach((pt) => allPts.push(pt));
  });
  const PAD = 60;
  const minX = Math.min(...allPts.map((p) => p[0])) - PAD;
  const maxX = Math.max(...allPts.map((p) => p[0])) + PAD;
  const minY = Math.min(...allPts.map((p) => p[1])) - PAD;
  const maxY = Math.max(...allPts.map((p) => p[1])) + PAD;
  const W_SVG = maxX - minX;
  const H_SVG = maxY - minY;
  const ox = -minX, oy = -minY;

  function P(x: number, y: number, z: number): [number, number] {
    const [sx, sy] = iso(x, y, z);
    return [sx + ox, sy + oy];
  }

  /* Status palette */
  const PAL: Record<ShedStatus, { wallF: string; wallR: string; roofN: string; roofF: string; ridge: string; accent: string; dot: string }> = {
    activo:  { wallF: "#1a3520", wallR: "#122518", roofN: "#3d8045", roofF: "#2b6334", ridge: "#17371f", accent: "#5aad62", dot: "#7dda87" },
    pausado: { wallF: "#3a2810", wallR: "#281a08", roofN: "#d99145", roofF: "#bd6f28", ridge: "#7a3e10", accent: "#f5b060", dot: "#ffd080" },
    cerrado: { wallF: "#282420", wallR: "#1c1816", roofN: "#6b5840", roofF: "#524027", ridge: "#3a3028", accent: "#8b7355", dot: "#a89070" },
  };

  return (
    <div className="overflow-hidden rounded-xl" style={{ background: "linear-gradient(160deg, #050c06 0%, #091408 45%, #0f2318 100%)" }}>
      <svg
        viewBox={`0 0 ${W_SVG} ${H_SVG}`}
        width="100%"
        style={{ display: "block", maxHeight: 340 }}
        role="img"
        aria-label="Vista isométrica de galpones avícolas"
      >
        <defs>
          <filter id="iso-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <linearGradient id="ground-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1a3520" stopOpacity="0.5" />
            <stop offset="1" stopColor="#0f2318" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Subtle ground grid */}
        {placements.map(({ shed, gx, gy }) => (
          <polygon
            key={`gnd-${shed.id}`}
            points={poly(P(gx - 0.3, gy - 0.3, 0), P(gx + BW + 0.3, gy - 0.3, 0), P(gx + BW + 0.3, gy + BD + 0.3, 0), P(gx - 0.3, gy + BD + 0.3, 0))}
            fill="url(#ground-grad)"
          />
        ))}

        {/* Buildings — sorted back-to-front (painter's algorithm) */}
        {[...placements]
          .sort((a, b) => (a.gx + a.gy) - (b.gx + b.gy))
          .map(({ shed, gx, gy }) => {
            const pal = PAL[shed.status] || PAL.activo;
            const fillPct = shed.initial_quantity > 0
              ? Math.min(0.9, Math.max(0, shed.available / shed.initial_quantity))
              : 0;
            const fH = WH * fillPct * 0.78;

            /* ── Key vertices ── */
            const BFL = P(gx,      gy,      0);
            const BFR = P(gx + BW, gy,      0);
            const BBR = P(gx + BW, gy + BD, 0);
            const BBL = P(gx,      gy + BD, 0);
            const TFL = P(gx,      gy,      WH);
            const TFR = P(gx + BW, gy,      WH);
            const TBR = P(gx + BW, gy + BD, WH);
            const TBL = P(gx,      gy + BD, WH);
            /* Ridge along X axis at y = gy + BD/2 */
            const RRL = P(gx,      gy + BD / 2, WH + RH);
            const RRR = P(gx + BW, gy + BD / 2, WH + RH);

            /* Fill level (bird capacity) */
            const FFL = P(gx,      gy,      fH);
            const FFR = P(gx + BW, gy,      fH);
            const FBR = P(gx + BW, gy + BD, fH);
            const FBL = P(gx,      gy + BD, fH);

            /* Door — front face, centered */
            const dw = BW * 0.13, dh = WH * 0.62;
            const dx = gx + BW / 2 - dw / 2;
            const DL  = P(dx,      gy, 0);
            const DR  = P(dx + dw, gy, 0);
            const DTR = P(dx + dw, gy, dh);
            const DTL = P(dx,      gy, dh);

            /* Windows — front face, evenly spaced */
            const wW = BW * 0.1, wH2 = WH * 0.3, wZ = WH * 0.52;
            const winXs = [gx + BW * 0.15, gx + BW * 0.35, gx + BW * 0.65, gx + BW * 0.85];

            /* Ventilation strips — right face */
            const vents = [0.2, 0.5, 0.8].map((t) => ({
              y0: gy + BD * t, y1: gy + BD * (t + 0.11),
              z0: WH * 0.45, z1: WH * 0.72,
            }));

            /* Label positions */
            const [lx, ly] = P(gx + BW / 2, gy - 0.2, WH + RH + 0.25);
            const [ax, ay] = P(gx + BW / 2, gy - 0.2, WH + RH - 0.1);
            const [rx, ry] = P(gx + BW / 2, gy - 0.2, WH + RH - 0.32);

            /* Ridge dot center */
            const rdx = (RRL[0] + RRR[0]) / 2;
            const rdy = (RRL[1] + RRR[1]) / 2;

            return (
              <g key={shed.id}>
                {/* ── Ground shadow ── */}
                <polygon points={poly(BFL, BFR, BBR, BBL)} fill="rgba(0,0,0,0.28)" />

                {/* ── WALLS ── */}
                {/* Right gable end (X+ face) */}
                <polygon points={poly(BFR, BBR, TBR, TFR)} fill={pal.wallR} />
                {/* Right gable triangle */}
                <polygon points={poly(TFR, TBR, RRR)} fill={pal.wallR} />
                {/* Front long wall (Y- face) */}
                <polygon points={poly(BFL, BFR, TFR, TFL)} fill={pal.wallF} />

                {/* ── BIRD FILL INDICATOR ── */}
                {fH > 0.06 && (
                  <>
                    <polygon points={poly(BFL, BFR, FFR, FFL)} fill={pal.roofF} opacity="0.55" />
                    <polygon points={poly(BFR, BBR, FBR, FFR)} fill={pal.roofF} opacity="0.4" />
                    {/* Horizontal fill line on front face */}
                    <line x1={FFL[0]} y1={FFL[1]} x2={FFR[0]} y2={FFR[1]}
                          stroke={pal.accent} strokeWidth="0.8" opacity="0.6" />
                  </>
                )}

                {/* ── DOOR ── */}
                <polygon points={poly(DL, DR, DTR, DTL)} fill="#030a04" />
                <line x1={DL[0]} y1={DL[1]} x2={DTL[0]} y2={DTL[1]}
                      stroke={pal.wallF} strokeWidth="0.6" opacity="0.5" />
                {/* Door arch hint */}
                <line x1={DTL[0]} y1={DTL[1]} x2={DTR[0]} y2={DTR[1]}
                      stroke={pal.accent} strokeWidth="0.5" opacity="0.3" />

                {/* ── WINDOWS on front face ── */}
                {winXs.map((wx, wi) => {
                  const WL  = P(wx,       gy, wZ);
                  const WR  = P(wx + wW,  gy, wZ);
                  const WTR = P(wx + wW,  gy, wZ + wH2);
                  const WTL = P(wx,       gy, wZ + wH2);
                  return (
                    <polygon key={wi} points={poly(WL, WR, WTR, WTL)}
                             fill="#071a0a" opacity="0.75" />
                  );
                })}

                {/* ── VENTILATION on right face ── */}
                {vents.map((v, vi) => {
                  const A = P(gx + BW, v.y0, v.z0);
                  const B = P(gx + BW, v.y1, v.z0);
                  const C = P(gx + BW, v.y1, v.z1);
                  const D = P(gx + BW, v.y0, v.z1);
                  return <polygon key={vi} points={poly(A, B, C, D)} fill="#040f07" opacity="0.6" />;
                })}

                {/* ── ROOF ── */}
                {/* Far slope (Y+ side, dark — facing away) */}
                <polygon points={poly(TBL, TBR, RRR, RRL)} fill={pal.roofF} />
                {/* Near slope (Y- side, bright — facing camera) */}
                <polygon points={poly(TFL, TFR, RRR, RRL)} fill={pal.roofN} />
                {/* Right gable end of roof */}
                <polygon points={poly(TFR, TBR, RRR)} fill={pal.wallR} />
                {/* Left gable end (mostly hidden, faint) */}
                <polygon points={poly(TFL, TBL, RRL)} fill={pal.wallR} opacity="0.5" />

                {/* Roof texture lines (corrugated metal effect) */}
                {[0.25, 0.5, 0.75].map((t) => {
                  const A = P(gx + BW * t, gy,      WH + RH * (1 - Math.abs(2*t-1)));
                  const B = P(gx + BW * t, gy + BD, WH + RH * (1 - Math.abs(2*t-1)));
                  return <line key={t} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]}
                               stroke={pal.ridge} strokeWidth="0.5" opacity="0.35" />;
                })}

                {/* ── RIDGE ── */}
                <line x1={RRL[0]} y1={RRL[1]} x2={RRR[0]} y2={RRR[1]}
                      stroke={pal.ridge} strokeWidth="2.5" strokeLinecap="round" />
                {/* Eave lines */}
                <line x1={TFL[0]} y1={TFL[1]} x2={TFR[0]} y2={TFR[1]}
                      stroke={pal.ridge} strokeWidth="1" opacity="0.5" />
                <line x1={TFR[0]} y1={TFR[1]} x2={TBR[0]} y2={TBR[1]}
                      stroke={pal.ridge} strokeWidth="1" opacity="0.45" />

                {/* ── STATUS GLOW DOT on ridge ── */}
                <circle cx={rdx} cy={rdy} r="5" fill={pal.dot} opacity="0.25" filter="url(#iso-glow)" />
                <circle cx={rdx} cy={rdy} r="3" fill={pal.dot} opacity="0.95" />

                {/* ── LABELS ── */}
                {/* Drop shadow text */}
                <text x={lx + 0.5} y={ly + 0.5} textAnchor="middle"
                      fill="rgba(0,0,0,0.6)" fontSize="11.5" fontWeight="700"
                      style={{ fontFamily: "var(--font-body)" }}>
                  {shed.name}
                </text>
                <text x={lx} y={ly} textAnchor="middle"
                      fill="white" fontSize="11.5" fontWeight="700"
                      style={{ fontFamily: "var(--font-body)" }}>
                  {shed.name}
                </text>
                <text x={ax} y={ay + 13} textAnchor="middle"
                      fill={pal.accent} fontSize="9.5" fontWeight="600" opacity="0.9"
                      style={{ fontFamily: "var(--font-body)" }}>
                  {formatNumber(shed.available)} disp.
                </text>
                <text x={rx} y={ry + 26} textAnchor="middle"
                      fill="rgba(255,255,255,0.35)" fontSize="8.5" fontWeight="500"
                      style={{ fontFamily: "var(--font-body)" }}>
                  {formatCurrency(shed.revenue)}
                </text>
              </g>
            );
          })}
      </svg>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof BarChart3; label: string; value: string; tone: string }) {
  const config: Record<string, { bg: string; iconBg: string; iconColor: string; border: string; valueColor: string }> = {
    leaf:   { bg: "bg-kpi-green",  iconBg: "bg-leaf-700",  iconColor: "text-white",     border: "border-l-leaf-500",   valueColor: "text-leaf-900"  },
    soil:   { bg: "bg-kpi-soil",   iconBg: "bg-soil-900",  iconColor: "text-white",     border: "border-l-soil-700",   valueColor: "text-soil-900"  },
    money:  { bg: "bg-kpi-amber",  iconBg: "bg-ember-500", iconColor: "text-white",     border: "border-l-ember-500",  valueColor: "text-soil-900"  },
    profit: { bg: "bg-kpi-profit", iconBg: "bg-leaf-500",  iconColor: "text-white",     border: "border-l-leaf-600",   valueColor: "text-leaf-900"  }
  };
  const c = config[tone] ?? config.soil;
  return (
    <article className={`panel rounded-xl p-5 border-l-4 ${c.bg} ${c.border}`}>
      <div className={`mb-4 grid size-10 place-items-center rounded-lg ${c.iconBg} ${c.iconColor} shadow-sm`}>
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-soil-500">{label}</p>
      <p className={`num mt-1.5 text-2xl font-black leading-none ${c.valueColor}`}>{value}</p>
    </article>
  );
}

function PayRow({ icon: Icon, label, value, total }: { icon: typeof Banknote; label: string; value: number; total: number }) {
  const percent = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-semibold text-soil-800">
          <span className="grid size-7 place-items-center rounded-lg bg-leaf-50">
            <Icon className="size-3.5 text-leaf-700" aria-hidden="true" />
          </span>
          {label}
        </span>
        <span className="num text-sm font-black text-soil-900">{formatCurrency(value)}</span>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-soil-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-leaf-600 to-leaf-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${percent}%`}
        />
      </div>
      <p className="num mt-1 text-right text-[11px] font-medium text-soil-400">{percent}%</p>
    </div>
  );
}

function TwoColumn({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-[0.40fr_0.60fr]">{children}</div>;
}

function FormPanel({ title, children, onSubmit, saving, submitLabel }: {
  title: string; children: React.ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void; saving: boolean; submitLabel: string;
}) {
  return (
    <section className="panel rounded-xl p-5">
      <h2 className="font-display text-xl font-black text-soil-900">{title}</h2>
      <form className="mt-4 space-y-4" onSubmit={onSubmit} noValidate>
        {children}
        <button type="submit" disabled={saving} className="btn-primary w-full text-sm font-bold" style={{ minHeight: "46px" }}>
          {saving
            ? <><RefreshCw className="size-4 spin" aria-hidden="true" /> Guardando…</>
            : <><Plus className="size-4" aria-hidden="true" /> {submitLabel}</>
          }
        </button>
      </form>
    </section>
  );
}

function TextField(props: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; placeholder?: string; min?: string }) {
  return (
    <label className="block">
      <span className="field-label">{props.label}</span>
      <input
        className="field-input"
        type={props.type ?? "text"} min={props.min} value={props.value}
        onChange={(e) => props.onChange(e.target.value)} required={props.required} placeholder={props.placeholder}
        autoComplete={props.type === "email" ? "email" : props.type === "tel" ? "tel" : undefined}
      />
    </label>
  );
}

function TextArea(props: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="field-label">{props.label}</span>
      <textarea
        className="field-input min-h-[88px] resize-y py-3"
        value={props.value} onChange={(e) => props.onChange(e.target.value)} required={props.required}
      />
    </label>
  );
}

function SelectField(props: { label: string; value: string; onChange: (v: string) => void; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      {props.label ? <span className="field-label">{props.label}</span> : null}
      <select
        className="field-input cursor-pointer"
        value={props.value} onChange={(e) => props.onChange(e.target.value)} required={props.required}
      >
        {props.children}
      </select>
    </label>
  );
}

function DataTable({ columns, rows, empty }: { columns: string[]; rows: string[][]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-soil-100 bg-white">
      <table className="data-table min-w-[620px]">
        <thead>
          <tr>{columns.map((col) => <th key={col}>{col}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={`row-${i}`}>
              {row.map((cell, j) => <td key={`cell-${j}`} className="num">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-soil-200 bg-white/60 px-4 py-8 text-center">
      <p className="text-sm font-medium text-soil-500">{text}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-soil-50 px-3 py-2.5">
      <dt className="text-2xs font-bold uppercase tracking-wider text-soil-500">{label}</dt>
      <dd className="num mt-1 font-black text-soil-900">{value}</dd>
    </div>
  );
}
