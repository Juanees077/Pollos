export type PaymentMethod = "efectivo" | "transferencia";
export type PaymentStatus = "pagado" | "pendiente";
export type SaleMode = "lote" | "individual";
export type ShedStatus = "activo" | "cerrado" | "pausado";
export type MovementType = "entry" | "sale" | "adjustment" | "loss";

export type Shed = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  status: ShedStatus;
  entry_date: string;
  initial_quantity: number;
  notes: string | null;
  created_at: string;
};

export type Customer = {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  document: string | null;
  notes: string | null;
  created_at: string;
};

export type Sale = {
  id: string;
  user_id: string;
  shed_id: string;
  customer_id: string;
  sale_date: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  sale_mode: SaleMode;
  quantity: number;
  unit_price: number;
  total: number;
  notes: string | null;
  created_at: string;
  customers?: Pick<Customer, "name" | "phone"> | null;
  sheds?: Pick<Shed, "name" | "code"> | null;
};

export type InventoryMovement = {
  id: string;
  user_id: string;
  shed_id: string;
  sale_id: string | null;
  movement_type: MovementType;
  quantity: number;
  reason: string;
  created_at: string;
};

export type ShedCost = {
  id: string;
  user_id: string;
  shed_id: string;
  cost_date: string;
  concept: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

export type ShedSummary = Shed & {
  available: number;
  sold: number;
  losses: number;
  adjustments: number;
  revenue: number;
  costs: number;
  profit: number;
};

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  shed_id: string;
  user_id: string;
  bird_tag: string | null;
  quantity: number;
  unit_price: number;
  created_at: string;
};
