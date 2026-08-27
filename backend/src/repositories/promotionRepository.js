const BASE_SELECT = `
  SELECT
    p.id,
    p.name,
    p.target_type,
    p.product_id,
    p.category_id,
    COALESCE(prod.name, cat.name)              AS target_name,
    COALESCE(prod_cat.name, cat.name)          AS target_category,
    p.discount_type,
    p.discount_value,
    p.start_date,
    p.end_date,
    p.status,
    p.created_at,
    p.updated_at
  FROM promotions p
  LEFT JOIN products   prod     ON prod.id = p.product_id
  LEFT JOIN categories prod_cat ON prod_cat.id = prod.category_id
  LEFT JOIN categories cat      ON cat.id = p.category_id
`;

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    targetType: row.target_type,
    productId: row.product_id,
    categoryId: row.category_id,
    targetName: row.target_name,
    targetCategory: row.target_category,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createPromotionRepository(pool) {
  return {
    async list() {
      const { rows } = await pool.query(
        `${BASE_SELECT} ORDER BY p.start_date DESC, p.id DESC`,
      );
      return rows.map(mapRow);
    },

    async findById(id) {
      const { rows } = await pool.query(`${BASE_SELECT} WHERE p.id = $1`, [id]);
      return mapRow(rows[0]);
    },

    async create(data) {
      const { rows } = await pool.query(
        `INSERT INTO promotions
           (name, target_type, product_id, category_id,
            discount_type, discount_value, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          data.name,
          data.targetType,
          data.productId,
          data.categoryId,
          data.discountType,
          data.discountValue,
          data.startDate,
          data.endDate,
        ],
      );
      return this.findById(rows[0].id);
    },

    async update(id, data) {
      await pool.query(
        `UPDATE promotions SET
           name = $2,
           target_type = $3,
           product_id = $4,
           category_id = $5,
           discount_type = $6,
           discount_value = $7,
           start_date = $8,
           end_date = $9,
           updated_at = now()
         WHERE id = $1`,
        [
          id,
          data.name,
          data.targetType,
          data.productId,
          data.categoryId,
          data.discountType,
          data.discountValue,
          data.startDate,
          data.endDate,
        ],
      );
      return this.findById(id);
    },

    async updateStatus(id, status) {
      await pool.query(
        'UPDATE promotions SET status = $2, updated_at = now() WHERE id = $1',
        [id, status],
      );
      return this.findById(id);
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async targetExists(targetType, id) {
      const table = targetType === 'producto' ? 'products' : 'categories';
      const { rowCount } = await pool.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
      return rowCount > 0;
    },
  };
}

export function createCatalogRepository(pool) {
  return {
    async categories() {
      const { rows } = await pool.query('SELECT id, name FROM categories ORDER BY name');
      return rows;
    },

    async products() {
      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.sku, p.category_id, c.name AS category_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         ORDER BY p.name`,
      );
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        sku: row.sku,
        categoryId: row.category_id,
        categoryName: row.category_name,
      }));
    },
  };
}
