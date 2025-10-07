const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// DB connection config (update password if you set one in Step 1)
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',  // Leave empty if no password, or put yours
  database: 'roi_simulator'
});

// Test connection
db.connect((err) => {
  if (err) {
    console.error('DB connection failed:', err);
    return;
  }
  console.log('Connected to MySQL DB');
});

// Helper to run simulation logic (extracted for reuse in save)
function runSimulation(inputs) {
  const {
    monthly_invoice_volume,
    num_ap_staff,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months = 36,
    one_time_implementation_cost = 50000
  } = inputs;

  if (!monthly_invoice_volume || monthly_invoice_volume <= 0) {
    throw new Error('Invalid invoice volume');
  }

  const AUTOMATED_COST_PER_INVOICE = 0.20;
  const ERROR_RATE_AUTO = 0.001;
  const MIN_ROI_BOOST_FACTOR = 1.1;

  const labor_cost_manual = num_ap_staff * hourly_wage * avg_hours_per_invoice * monthly_invoice_volume;
  const auto_cost = monthly_invoice_volume * AUTOMATED_COST_PER_INVOICE;
  const error_savings = (error_rate_manual / 100 - ERROR_RATE_AUTO) * monthly_invoice_volume * error_cost;
  let monthly_savings = (labor_cost_manual + error_savings) - auto_cost;
  monthly_savings = monthly_savings * MIN_ROI_BOOST_FACTOR;
  if (monthly_savings < 0) monthly_savings = 0;

  const cumulative_savings = monthly_savings * time_horizon_months;
  const net_savings = cumulative_savings - one_time_implementation_cost;
  const payback_months = one_time_implementation_cost / monthly_savings || 0;
  const roi_percentage = (net_savings / one_time_implementation_cost) * 100;

  return {
    monthly_savings: Math.round(monthly_savings),
    cumulative_savings: Math.round(cumulative_savings),
    net_savings: Math.round(net_savings),
    payback_months: Math.round(payback_months * 10) / 10,
    roi_percentage: Math.round(roi_percentage * 10) / 10
  };
}

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// POST /simulate - Run simulation and return JSON results
app.post('/simulate', (req, res) => {
  try {
    const results = runSimulation(req.body);
    res.json({ success: true, results });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /scenarios - Save scenario (runs sim and stores)
app.post('/scenarios', (req, res) => {
  const { scenario_name, ...inputs } = req.body;
  if (!scenario_name) {
    return res.status(400).json({ error: 'Scenario name required' });
  }
  try {
    const results = runSimulation(inputs);
    const query = 'INSERT INTO scenarios (scenario_name, monthly_invoice_volume, num_ap_staff, avg_hours_per_invoice, hourly_wage, error_rate_manual, error_cost, time_horizon_months, one_time_implementation_cost, monthly_savings, payback_months, roi_percentage) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    db.query(query, [scenario_name, inputs.monthly_invoice_volume, inputs.num_ap_staff, inputs.avg_hours_per_invoice, inputs.hourly_wage, inputs.error_rate_manual, inputs.error_cost, inputs.time_horizon_months, inputs.one_time_implementation_cost, results.monthly_savings, results.payback_months, results.roi_percentage], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Save failed' });
      }
      res.json({ success: true, id: result.insertId, scenario_name, results });
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /scenarios - List all
app.get('/scenarios', (req, res) => {
  db.query('SELECT id, scenario_name, monthly_savings, payback_months, roi_percentage FROM scenarios ORDER BY created_at DESC', (err, results) => {
    if (err) {
      return res.status(500).json({ error: 'List failed' });
    }
    res.json({ success: true, scenarios: results });
  });
});

// GET /scenarios/:id - Retrieve one
app.get('/scenarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('SELECT * FROM scenarios WHERE id = ?', [id], (err, result) => {
    if (err || result.length === 0) {
      return res.status(404).json({ error: 'Scenario not found' });
    }
    res.json({ success: true, scenario: result[0] });
  });
});

// DELETE /scenarios/:id - Delete one
app.delete('/scenarios/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM scenarios WHERE id = ?', [id], (err, result) => {
    if (err || result.affectedRows === 0) {
      return res.status(404).json({ error: 'Delete failed' });
    }
    res.json({ success: true });
  });
});

// POST /report/generate - Generate PDF report (email gated)
app.post('/report/generate', (req, res) => {
  const { email, scenario_name, results } = req.body;
  if (!email || !scenario_name || !results) {
    return res.status(400).json({ error: 'Missing email, name, or results' });
  }

  // Log email for lead capture (in real app, save to DB or send email)
  console.log(`Lead captured: ${email} for scenario ${scenario_name}`);

  // Generate PDF
  const doc = new PDFDocument();
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('end', () => {
    const pdfBuffer = Buffer.concat(chunks);
    const base64 = pdfBuffer.toString('base64');
    res.json({ success: true, pdfBase64: base64 });
  });

  // PDF content
  doc.fontSize(20).text('Invoicing ROI Simulator Report', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Scenario: ${scenario_name}`);
  doc.moveDown();
  doc.text(`Monthly Savings: $${results.monthly_savings}`);
  doc.text(`Cumulative Savings (36 months): $${results.cumulative_savings}`);
  doc.text(`Net Savings: $${results.net_savings}`);
  doc.text(`Payback Period: ${results.payback_months} months`);
  doc.text(`ROI: ${results.roi_percentage}%`);
  doc.moveDown();
  doc.text(`Generated for: ${email}`);
  doc.end();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});