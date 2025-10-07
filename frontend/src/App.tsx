import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import './App.css';

interface FormData {
  scenario_name: string;
  monthly_invoice_volume: number;
  num_ap_staff: number;
  avg_hours_per_invoice: number;
  hourly_wage: number;
  error_rate_manual: number;
  error_cost: number;
  time_horizon_months: number;
  one_time_implementation_cost: number;
}

interface SimulationResults {
  monthly_savings: number;
  cumulative_savings: number;
  net_savings: number;
  payback_months: number;
  roi_percentage: number;
}

interface Scenario {
  id: number;
  scenario_name: string;
  monthly_savings: number;
  payback_months: number;
  roi_percentage: number;
  monthly_invoice_volume: number;
  num_ap_staff: number;
  avg_hours_per_invoice: number;
  hourly_wage: number;
  error_rate_manual: number;
  error_cost: number;
  time_horizon_months: number;
  one_time_implementation_cost: number;
}

function App() {
  const [formData, setFormData] = useState<FormData>({
    scenario_name: '',
    monthly_invoice_volume: 2000,
    num_ap_staff: 3,
    avg_hours_per_invoice: 0.17,
    hourly_wage: 30,
    error_rate_manual: 0.5,
    error_cost: 100,
    time_horizon_months: 36,
    one_time_implementation_cost: 50000
  });
  const [results, setResults] = useState<SimulationResults | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(false);

  // Load scenarios on mount
  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      const response = await axios.get('http://localhost:5000/scenarios');
      setScenarios(response.data.scenarios);
    } catch (error) {
      console.error('Failed to fetch scenarios:', error);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/simulate', formData);
      setResults(response.data.results);
    } catch (error) {
      console.error('Simulation failed:', error);
      alert('Error running simulation');
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.scenario_name) {
      alert('Please enter a scenario name');
      return;
    }
    try {
      await axios.post('http://localhost:5000/scenarios', formData);
      alert('Scenario saved!');
      fetchScenarios();  // Refresh list
      setFormData({ ...formData, scenario_name: '' });  // Clear name
    } catch (error) {
      console.error('Save failed:', error);
      alert('Error saving scenario');
    }
  };

  const handleLoad = async (id: number) => {
    try {
      const response = await axios.get(`http://localhost:5000/scenarios/${id}`);
      const scenario = response.data.scenario;
      setFormData({
        scenario_name: scenario.scenario_name,
        monthly_invoice_volume: scenario.monthly_invoice_volume,
        num_ap_staff: scenario.num_ap_staff,
        avg_hours_per_invoice: scenario.avg_hours_per_invoice,
        hourly_wage: scenario.hourly_wage,
        error_rate_manual: scenario.error_rate_manual,
        error_cost: scenario.error_cost,
        time_horizon_months: scenario.time_horizon_months,
        one_time_implementation_cost: scenario.one_time_implementation_cost
      });
      // Re-run sim on load
      const simResponse = await axios.post('http://localhost:5000/simulate', {
        ...formData,
        scenario_name: scenario.scenario_name  // Include name but ignore in sim
      });
      setResults(simResponse.data.results);
    } catch (error) {
      console.error('Load failed:', error);
      alert('Error loading scenario');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this scenario?')) return;
    try {
      await axios.delete(`http://localhost:5000/scenarios/${id}`);
      alert('Scenario deleted!');
      fetchScenarios();  // Refresh list
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Error deleting scenario');
    }
  };

  return (
    <div className="App">
      <h1>Invoicing ROI Simulator</h1>
      <form onSubmit={handleSubmit}>
        {/* All previous form fields stay the same */}
        <label>
          Scenario Name:
          <input
            type="text"
            name="scenario_name"
            value={formData.scenario_name}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Monthly Invoice Volume:
          <input
            type="number"
            name="monthly_invoice_volume"
            value={formData.monthly_invoice_volume}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Number of AP Staff:
          <input
            type="number"
            name="num_ap_staff"
            value={formData.num_ap_staff}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Avg Hours per Invoice:
          <input
            type="number"
            step="0.01"
            name="avg_hours_per_invoice"
            value={formData.avg_hours_per_invoice}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Hourly Wage:
          <input
            type="number"
            name="hourly_wage"
            value={formData.hourly_wage}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Manual Error Rate (%):
          <input
            type="number"
            step="0.01"
            name="error_rate_manual"
            value={formData.error_rate_manual}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Error Cost:
          <input
            type="number"
            name="error_cost"
            value={formData.error_cost}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          Time Horizon (Months):
          <input
            type="number"
            name="time_horizon_months"
            value={formData.time_horizon_months}
            onChange={handleChange}
          />
        </label>
        <br />
        <label>
          One-Time Implementation Cost:
          <input
            type="number"
            name="one_time_implementation_cost"
            value={formData.one_time_implementation_cost}
            onChange={handleChange}
          />
        </label>
        <br />
        <button type="submit" disabled={loading}>
          {loading ? 'Calculating...' : 'Run Simulation'}
        </button>
        <button type="button" onClick={handleSave} style={{ marginLeft: '10px' }}>
          Save Scenario
        </button>
      </form>

      {results && (
        <div>
          <h2>Results:</h2>
          <p>Monthly Savings: ${results.monthly_savings}</p>
          <p>Cumulative Savings (36 months): ${results.cumulative_savings}</p>
          <p>Net Savings: ${results.net_savings}</p>
          <p>Payback Period: {results.payback_months} months</p>
          <p>ROI: {results.roi_percentage}%</p>
        </div>
      )}

      <div>
        <h2>Saved Scenarios</h2>
        {scenarios.length === 0 ? (
          <p>No scenarios saved yet.</p>
        ) : (
          <ul>
            {scenarios.map((scenario) => (
              <li key={scenario.id}>
                {scenario.scenario_name} - Savings: ${scenario.monthly_savings}/mo, Payback: {scenario.payback_months} mo, ROI: {scenario.roi_percentage}%
                <button onClick={() => handleLoad(scenario.id)} style={{ marginLeft: '10px' }}>
                  Load
                </button>
                <button onClick={() => handleDelete(scenario.id)} style={{ marginLeft: '5px' }}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;