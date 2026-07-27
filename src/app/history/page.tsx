'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

interface TrendItem {
  period: string;
  order_count: number;
  quantity: number;
  sales: number;
  profit: number;
  commission: number;
  cost: number;
}

interface HistoryData {
  trends: TrendItem[];
  summary: {
    total_orders: number;
    total_quantity: number;
    total_sales: number;
    total_profit: number;
  };
}

function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function HistoryPage() {
  const [data, setData] = useState<HistoryData | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dimension, setDimension] = useState('day');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ dimension });
      if (startDate) params.set('start', startDate);
      if (endDate) params.set('end', endDate);
      const res = await fetch(`/api/history?${params}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, dimension]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const chartData = data?.trends.map((t) => ({
    period: t.period,
    Sales: +t.sales.toFixed(2),
    Profit: +t.profit.toFixed(2),
    Cost: +t.cost.toFixed(2),
    Orders: t.order_count,
  })) || [];

  return (
    <div>
      <div className="page-header">
        <h2>Historical Analysis</h2>
        <p>Analyze sales trends over time with customizable date ranges</p>
      </div>

      <div className="toolbar">
        <label style={{ fontSize: 13, color: '#64748b' }}>From:</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <label style={{ fontSize: 13, color: '#64748b' }}>To:</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        >
          <option value="day">Daily</option>
          <option value="week">Weekly</option>
          <option value="month">Monthly</option>
        </select>
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
        >
          <option value="line">Line Chart</option>
          <option value="bar">Bar Chart</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={fetchData}>
          Apply
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          Loading...
        </div>
      ) : data ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Total Orders</div>
              <div className="stat-value">
                {data.summary.total_orders.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Quantity Sold</div>
              <div className="stat-value">
                {data.summary.total_quantity.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Sales</div>
              <div className="stat-value">{formatZAR(data.summary.total_sales)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Profit</div>
              <div
                className={`stat-value ${data.summary.total_profit >= 0 ? 'profit' : 'loss'}`}
              >
                {formatZAR(data.summary.total_profit)}
              </div>
            </div>
          </div>

          <div className="chart-container">
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                marginBottom: 16,
                color: '#0f172a',
              }}
            >
              Sales & Profit Trend
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              {chartType === 'line' ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: number) => formatZAR(value)}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Sales"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Profit"
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="Cost"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="5 5"
                  />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="period"
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip
                    formatter={(value: number) => formatZAR(value)}
                    contentStyle={{
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Bar dataKey="Sales" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Profit" fill="#16a34a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Cost" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Period Details</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Orders</th>
                    <th>Quantity</th>
                    <th>Sales (ZAR)</th>
                    <th>Cost (ZAR)</th>
                    <th>Commission (ZAR)</th>
                    <th>Profit (ZAR)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.trends.map((t, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{t.period}</td>
                      <td>{t.order_count}</td>
                      <td>{t.quantity}</td>
                      <td>{formatZAR(t.sales)}</td>
                      <td>{formatZAR(t.cost)}</td>
                      <td>{formatZAR(t.commission)}</td>
                      <td className={t.profit >= 0 ? 'text-profit' : 'text-loss'}>
                        {formatZAR(t.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
