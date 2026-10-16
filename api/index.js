const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const API_KEY = process.env.SMSCODE_API_KEY;
const BASE_URL = 'https://api.smscode.gg/v2';
const DEPOSITS_FILE = path.join('/tmp', 'deposits.json');

app.use(cors());
app.use(express.json({ limit: '6mb' }));

async function smscode(endpoint, options = {}) {
  if (!API_KEY) {
    const err = new Error('SMSCODE_API_KEY belum di-set di Environment Variables Vercel');
    throw err;
  }
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  return { status: res.status, data };
}

app.get('/api/balance', async (req, res) => {
  try {
    const { status, data } = await smscode('/balance');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/countries', async (req, res) => {
  try {
    const { status, data } = await smscode('/catalog/countries');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const qs = req.query.country_id ? `?country_id=${req.query.country_id}` : '';
    const { status, data } = await smscode(`/catalog/services${qs}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.country_id) params.set('country_id', req.query.country_id);
    if (req.query.platform_id) params.set('platform_id', req.query.platform_id);
    params.set('limit', req.query.limit || '50');
    params.set('page', req.query.page || '1');
    params.set('sort', req.query.sort || 'price_asc');
    const { status, data } = await smscode(`/catalog/products?${params}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { catalog_product_id, max_price, quantity = 1 } = req.body;
    if (!catalog_product_id) {
      return res.status(400).json({ success: false, error: { message: 'catalog_product_id wajib diisi' } });
    }
    const body = { catalog_product_id: Number(catalog_product_id), quantity: Number(quantity) || 1 };
    if (max_price) body.max_price = String(max_price);
    const { status, data } = await smscode('/orders/create', {
      method: 'POST',
      headers: { 'Idempotency-Key': uuidv4() },
      body: JSON.stringify(body)
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limit) params.set('limit', req.query.limit);
    if (req.query.status) params.set('status', req.query.status);
    if (req.query.offset) params.set('offset', req.query.offset);
    const qs = params.toString() ? `?${params}` : '';
    const { status, data } = await smscode(`/orders${qs}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}/cancel`, { method: 'POST' });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/orders/:id/finish', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}/finish`, { method: 'POST' });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/orders/:id/resend', async (req, res) => {
  try {
    const { status, data } = await smscode('/orders/resend', {
      method: 'POST',
      body: JSON.stringify({ id: Number(req.params.id) })
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/deposit', (req, res) => {
  try {
    const { amount, whatsapp, email, bank, note, proof, proofName } = req.body;
    if (!amount || amount < 10000) {
      return res.status(400).json({ success: false, error: { message: 'Minimal deposit Rp 10.000' } });
    }
    if (!whatsapp || !email || !bank || !proof) {
      return res.status(400).json({ success: false, error: { message: 'Data tidak lengkap' } });
    }
    const deposit = {
      id: uuidv4(),
      amount: Number(amount),
      whatsapp: String(whatsapp).trim(),
      email: String(email).trim().toLowerCase(),
      bank: String(bank),
      note: note ? String(note).trim() : '',
      proofName: proofName || 'bukti.jpg',
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    let deposits = [];
    try { deposits = JSON.parse(fs.readFileSync(DEPOSITS_FILE, 'utf8')); } catch (e) {}
    deposits.unshift({ ...deposit, hasProof: true });
    try { fs.writeFileSync(DEPOSITS_FILE, JSON.stringify(deposits, null, 2)); } catch (e) {}
    console.log(`Deposit Rp ${Number(amount).toLocaleString()} | WA: ${whatsapp} | ${bank}`);
    res.json({ success: true, data: { id: deposit.id, message: 'Konfirmasi deposit berhasil dikirim. Tunggu verifikasi admin.' } });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/deposits', (req, res) => {
  try {
    let deposits = [];
    try { deposits = JSON.parse(fs.readFileSync(DEPOSITS_FILE, 'utf8')); } catch (e) {}
    res.json({ success: true, data: deposits });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { ok: true, hasKey: Boolean(API_KEY) } });
});

module.exports = app;
