export const ROLE_LABEL = {
  Mesero: 'Waiter',
  Cajero: 'Cashier',
  Administrador: 'Administrator',
};

export const STATUS_LABEL = {
  Activo: 'Active',
  Inactivo: 'Inactive',
  Bloqueado: 'Blocked',
};

export const TABLE_STATUS_LABEL = {
  Libre: 'Free',
  Ocupada: 'Occupied',
  Reservada: 'Reserved',
};

export const PRODUCT_TYPE_LABEL = {
  'Cóctel': 'Cocktail',
  'Cóctel de autor': 'Signature cocktail',
  Cerveza: 'Beer',
  Licor: 'Liquor',
  Comida: 'Food',
  'Bebida sin alcohol': 'Non-alcoholic drink',
  'No alcohólico': 'Non-alcoholic',
};

export const PAYMENT_METHOD_LABEL = {
  Efectivo: 'Cash',
  'Tarjeta Débito': 'Debit Card',
  'Tarjeta Crédito': 'Credit Card',
};

export const CUSTOMER_LABEL = {
  'Consumidor Final': 'Final Consumer',
};

export const t = (map, value) => map[value] ?? value;