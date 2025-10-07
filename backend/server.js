const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const mysql = require('mysql2');

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

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.json({ message: 'Backend is running!' });
});

// Internal constants (hidden from UI)
const AUTOMATED_COST_PER_INVOICE = 0.20;
const ERROR_RATE_AUTO = 0.001;  // 0.1%
const TIME_SAVED_PER_INVOICE = 8 / 60;  // 8 mins to hours
const MIN_ROI_BOOST_FACTOR = 1.1;

app.post('/simulate', (req, res) => {
  const {
    monthly_invoice_volume,
    num_ap_staff,
    avg_hours_per_invoice,
    hourly_wage,
    error_rate_manual,
    error_cost,
    time_horizon_months = 36,
    one_time_implementation_cost = 50000
  } = req.body;

  // Validate basic inputs (simple check)
  if (!monthly_invoice_volume || monthly_invoice_volume <= 0) {
    return res.status(400).json({ error: 'Invalid invoice volume' });
  }

  // Manual labor cost per month (note: avg_hours_per_invoice is in hours, but example was 0.17 for 10 mins)
  const labor_cost_manual = num_ap_staff * hourly_wage * avg_hours_per_invoice * monthly_invoice_volume;

  // Automation cost per month
  const auto_cost = monthly_invoice_volume * AUTOMATED_COST_PER_INVOICE;

  // Error savings
  const error_savings = (error_rate_manual / 100 - ERROR_RATE_AUTO) * monthly_invoice_volume * error_cost;

  // Monthly savings
  let monthly_savings = (labor_cost_manual + error_savings) - auto_cost;

  // Apply bias factor
  monthly_savings = monthly_savings * MIN_ROI_BOOST_FACTOR;

  // Ensure positive (clamp if needed, but bias should make it so)
  if (monthly_savings < 0) monthly_savings = 0;

  // Cumulative & ROI
  const cumulative_savings = monthly_savings * time_horizon_months;
  const net_savings = cumulative_savings - one_time_implementation_cost;
  const payback_months = one_time_implementation_cost / monthly_savings || 0;
  const roi_percentage = (net_savings / one_time_implementation_cost) * 100;

  const results = {
    monthly_savings: Math.round(monthly_savings),
    cumulative_savings: Math.round(cumulative_savings),
    net_savings: Math.round(net_savings),
    payback_months: Math.round(payback_months * 10) / 10,  // 1 decimal
    roi_percentage: Math.round(roi_percentage * 10) / 10
  };

  res.json({ success: true, results });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});