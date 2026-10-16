require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = process.env.SMSCODE_API_KEY;
const BASE_URL = 'https://api.smscode.gg/v2';
const DEPOSITS_FILE = path.join(__dirname, 'deposits.json');

if (!API_KEY) {
  console.warn('⚠️ SMSCODE_API_KEY belum di-set. Set env di Vercel / local .env');
}

// Init deposits storage (local only — Vercel FS ephemeral)
try {
  if (!fs.existsSync(DEPOSITS_FILE)) {
    fs.writeFileSync(DEPOSITS_FILE, '[]');
  }
} catch (e) {
  // ignore on serverless
}

app.use(cors());
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper untuk call SMSCode API
async function smscode(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json();
  return { status: res.status, data };
}

// ========== ROUTES ==========

// Balance
app.get('/api/balance', async (req, res) => {
  try {
    const { status, data } = await smscode('/balance');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Countries
app.get('/api/countries', async (req, res) => {
  try {
    const { status, data } = await smscode('/catalog/countries');
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Services
app.get('/api/services', async (req, res) => {
  try {
    const qs = req.query.country_id ? `?country_id=${req.query.country_id}` : '';
    const { status, data } = await smscode(`/catalog/services${qs}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.country_id) params.set('country_id', req.query.country_id);
    if (req.query.platform_id) params.set('platform_id', req.query.platform_id);
    if (req.query.limit) params.set('limit', req.query.limit || '50');
    if (req.query.page) params.set('page', req.query.page || '1');
    if (req.query.sort) params.set('sort', req.query.sort || 'price_asc');

    const { status, data } = await smscode(`/catalog/products?${params.toString()}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Create Order
app.post('/api/orders', async (req, res) => {
  try {
    const { catalog_product_id, max_price, quantity = 1 } = req.body;
    
    if (!catalog_product_id) {
      return res.status(400).json({ success: false, error: { message: 'catalog_product_id wajib diisi' } });
    }

    const body = {
      catalog_product_id: Number(catalog_product_id),
      quantity: Number(quantity) || 1
    };

    if (max_price) body.max_price = String(max_price);

    const idempotencyKey = uuidv4();

    const { status, data } = await smscode('/orders/create', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify(body)
    });

    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Get Order by ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// List Orders
app.get('/api/orders', async (req, res) => {
  try {
    const params = new URLSearchParams();
    if (req.query.limit) params.set('limit', req.query.limit);
    if (req.query.status) params.set('status', req.query.status);
    if (req.query.offset) params.set('offset', req.query.offset);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const { status, data } = await smscode(`/orders${qs}`);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Cancel Order
app.post('/api/orders/:id/cancel', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}/cancel`, {
      method: 'POST'
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Finish Order
app.post('/api/orders/:id/finish', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/${req.params.id}/finish`, {
      method: 'POST'
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Resend OTP
app.post('/api/orders/:id/resend', async (req, res) => {
  try {
    const { status, data } = await smscode(`/orders/resend`, {
      method: 'POST',
      body: JSON.stringify({ id: Number(req.params.id) })
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ========== DEPOSIT ==========
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
      proof: proof,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    let deposits = [];
    try {
      deposits = JSON.parse(fs.readFileSync(DEPOSITS_FILE, 'utf8'));
    } catch (e) {
      deposits = [];
    }
    deposits.unshift(deposit);
    try {
      fs.writeFileSync(DEPOSITS_FILE, JSON.stringify(deposits, null, 2));
      const proofsDir = path.join(__dirname, 'proofs');
      if (!fs.existsSync(proofsDir)) fs.mkdirSync(proofsDir);
      const base64Data = proof.replace(/^data:image\/\w+;base64,/, '');
      const ext = (proof.match(/data:image\/(\w+);/) || [])[1] || 'jpg';
      const proofPath = path.join(proofsDir, `${deposit.id}.${ext}`);
      fs.writeFileSync(proofPath, base64Data, 'base64');
    } catch (e) {
      console.warn('Could not persist deposit to disk (serverless):', e.message);
    }

    console.log(`💰 New deposit: Rp ${Number(amount).toLocaleString()} | WA: ${whatsapp} | ${bank}`);

    res.json({
      success: true,
      data: {
        id: deposit.id,
        message: 'Konfirmasi deposit berhasil dikirim. Tunggu verifikasi admin.'
      }
    });
  } catch (err) {
    console.error('Deposit error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// List deposits (for admin)
app.get('/api/deposits', (req, res) => {
  try {
    let deposits = [];
    try {
      deposits = JSON.parse(fs.readFileSync(DEPOSITS_FILE, 'utf8'));
    } catch (e) {}
    
    const list = deposits.map(d => ({
      id: d.id,
      amount: d.amount,
      whatsapp: d.whatsapp,
      email: d.email,
      bank: d.bank,
      note: d.note,
      proofName: d.proofName,
      status: d.status,
      createdAt: d.createdAt
    }));
    
    res.json({ success: true, data: list });
  } catch (err) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// Fallback ke frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Local only — di Vercel diekspor sebagai serverless
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 NOKOS SMSCode running at http://localhost:${PORT}`);
    if (API_KEY) console.log(`📦 API Key: ${API_KEY.slice(0, 8)}...`);
  });
}

module.exports = app;
