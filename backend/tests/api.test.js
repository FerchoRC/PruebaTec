import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';

import { createApp } from '../src/app.js';

function createFakeRepositories(seed = []) {
  let nextId = seed.length + 1;
  const promotions = seed.map((p) => ({ ...p }));

  return {
    promotions: {
      async list() {
        return promotions.map((p) => ({ ...p }));
      },
      async findById(id) {
        const found = promotions.find((p) => p.id === id);
        return found ? { ...found } : null;
      },
      async create(data) {
        const created = { id: nextId++, status: 'Programada', ...data };
        promotions.push(created);
        return { ...created };
      },
      async update(id, data) {
        const index = promotions.findIndex((p) => p.id === id);
        promotions[index] = { ...promotions[index], ...data };
        return { ...promotions[index] };
      },
      async updateStatus(id, status) {
        const index = promotions.findIndex((p) => p.id === id);
        promotions[index] = { ...promotions[index], status };
        return { ...promotions[index] };
      },
      async remove(id) {
        const index = promotions.findIndex((p) => p.id === id);
        if (index === -1) return false;
        promotions.splice(index, 1);
        return true;
      },
      async targetExists(_targetType, id) {
        return id === 1 || id === 2;
      },
    },
    catalog: {
      async categories() {
        return [{ id: 1, name: 'Bebidas' }];
      },
      async products() {
        return [{ id: 1, name: 'Cafe molido 500g', sku: 'BEB-001', categoryId: 1 }];
      },
    },
  };
}

const payload = {
  name: 'Promo de prueba',
  targetType: 'producto',
  productId: 1,
  discountType: 'porcentaje',
  discountValue: 15,
  startDate: '2026-04-01',
  endDate: '2026-04-30',
};

let app;
let repositories;

beforeEach(() => {
  repositories = createFakeRepositories();
  app = createApp({ repositories });
});

describe('/health', () => {
  it('responde 200 cuando la base de datos contesta', async () => {
    const pool = { query: async () => ({ rows: [{ ok: 1 }] }) };
    const response = await request(createApp({ pool, repositories })).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.database).toBe('up');
  });

  it('responde 503 cuando la base de datos no contesta', async () => {
    const pool = {
      query: async () => {
        throw new Error('conexion rechazada');
      },
    };
    const response = await request(createApp({ pool, repositories })).get('/health');

    expect(response.status).toBe(503);
    expect(response.body.database).toBe('down');
  });
});

describe('POST /api/promotions', () => {
  it('crea una promocion en estado Programada', async () => {
    const response = await request(app).post('/api/promotions').send(payload);

    expect(response.status).toBe(201);
    expect(response.body.status).toBe('Programada');
    expect(response.body.name).toBe('Promo de prueba');
  });

  it('devuelve 422 con el detalle de cada campo invalido', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...payload, name: '', discountValue: 150 });

    expect(response.status).toBe(422);
    expect(response.body.details.map((d) => d.field)).toEqual(
      expect.arrayContaining(['name', 'discountValue']),
    );
  });

  it('devuelve 422 si el producto asociado no existe', async () => {
    const response = await request(app)
      .post('/api/promotions')
      .send({ ...payload, productId: 999 });

    expect(response.status).toBe(422);
  });
});

describe('ciclo de vida de una promocion', () => {
  it('recorre Programada -> Activa -> Finalizada', async () => {
    const { body: created } = await request(app).post('/api/promotions').send(payload);

    const activa = await request(app)
      .patch(`/api/promotions/${created.id}/status`)
      .send({ status: 'Activa' });
    expect(activa.status).toBe(200);
    expect(activa.body.status).toBe('Activa');

    const finalizada = await request(app)
      .patch(`/api/promotions/${created.id}/status`)
      .send({ status: 'Finalizada' });
    expect(finalizada.status).toBe(200);
    expect(finalizada.body.status).toBe('Finalizada');
  });

  it('rechaza saltar de Programada a Finalizada', async () => {
    const { body: created } = await request(app).post('/api/promotions').send(payload);

    const response = await request(app)
      .patch(`/api/promotions/${created.id}/status`)
      .send({ status: 'Finalizada' });

    expect(response.status).toBe(409);
  });

  it('no deja editar una promocion finalizada', async () => {
    const { body: created } = await request(app).post('/api/promotions').send(payload);
    await request(app).patch(`/api/promotions/${created.id}/status`).send({ status: 'Activa' });
    await request(app).patch(`/api/promotions/${created.id}/status`).send({ status: 'Finalizada' });

    const response = await request(app)
      .put(`/api/promotions/${created.id}`)
      .send({ ...payload, name: 'Otro nombre' });

    expect(response.status).toBe(409);
  });
});

describe('DELETE /api/promotions/:id', () => {
  it('elimina una promocion programada', async () => {
    const { body: created } = await request(app).post('/api/promotions').send(payload);

    expect((await request(app).delete(`/api/promotions/${created.id}`)).status).toBe(204);
    expect((await request(app).get(`/api/promotions/${created.id}`)).status).toBe(404);
  });

  it('rechaza eliminar una promocion activa', async () => {
    const { body: created } = await request(app).post('/api/promotions').send(payload);
    await request(app).patch(`/api/promotions/${created.id}/status`).send({ status: 'Activa' });

    expect((await request(app).delete(`/api/promotions/${created.id}`)).status).toBe(409);
  });

  it('devuelve 404 si la promocion no existe', async () => {
    expect((await request(app).delete('/api/promotions/4242')).status).toBe(404);
  });

  it('devuelve 400 si el identificador no es numerico', async () => {
    expect((await request(app).delete('/api/promotions/abc')).status).toBe(400);
  });
});

describe('GET /api/promotions/summary', () => {
  it('cuenta por estado y las vigentes hoy', async () => {
    const today = new Date();
    const iso = (offsetDays) => {
      const date = new Date(today);
      date.setDate(date.getDate() + offsetDays);
      return date.toISOString().slice(0, 10);
    };

    await request(app)
      .post('/api/promotions')
      .send({ ...payload, startDate: iso(-5), endDate: iso(5) });
    await request(app)
      .post('/api/promotions')
      .send({ ...payload, name: 'Futura', startDate: iso(30), endDate: iso(60) });

    const response = await request(app).get('/api/promotions/summary');

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(2);
    expect(response.body.byStatus.Programada).toBe(2);
    expect(response.body.validToday).toBe(1);
  });
});

describe('rutas desconocidas', () => {
  it('devuelve 404 en JSON', async () => {
    const response = await request(app).get('/api/no-existe');
    expect(response.status).toBe(404);
    expect(response.body.error).toMatch(/no encontrada/i);
  });
});
