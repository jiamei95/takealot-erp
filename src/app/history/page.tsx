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
    '\u9500\u552e\u989d': +t.sales.toFixed(2),
    '\u5229\u6da6': +t.profit.toFixed(2),
    '\u6210\u672c': +t.cost.toFixed(2),
    '\u8ba2\u5355\u6570': t.order_count,
  })) || [];

  return (
    <div>
      <div className="page-header">
        <h2>{'\u5386\u53f2\u5206\u6790'}</h2>
        <p>{'\u6309\u65e5\u671f\u6bb5\u7edf\u8ba1\u9500\u552e\u8d8b\u52bf\uff0c\u652f\u6301\u81ea\u5b9a\u4e49\u65f6\u95f4\u8303\u56f4'}</p>
      </div>

      <div className="toolbar">
        <label style={{ fontSize: 13, color: '#64748b' }}>{'\u5f00\u59cb:'}</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <label style={{ fontSize: 13, color: '#64748b' }}>{'\u7ed3\u675f:'}</label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
        >
          <option value="day">{'\u6309\u65e5'}</option>
          <option value="week">{'\u6309\u5468'}</option>
          <option value="month">{'\u6309\u6708'}</option>
        </select>
        <select
          value={chartType}
          onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
        >
          <option value="line">{'\u6298\u7ebf\u56fe'}</option>
          <option value="bar">{'\u67f1\u72b6\u56fe'}</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={fetchData}>
          {'\u5e94\u7528'}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8' }}>
          {'\u52a0\u8f7d\u4e2d...'}
        </div>
      ) : data ? (
        <>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">{'\u603b\u8ba2\u5355\u6570'}</div>
              <div className="stat-value">
                {data.summary.total_orders.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{'\u603b\u9500\u91cf'}</div>
              <div className="stat-value">
                {data.summary.total_quantity.toLocaleString()}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{'\u603b\u9500\u552e\u989d'}</div>
              <div className="stat-value">{formatZAR(data.summary.total_sales)}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">{'\u603b\u5229\u6da6'}</div>
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
              {'\u9500\u552e\u4e0e\u5229\u6da6\u8d8b\u52bf'}
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
                    dataKey={'\u9500\u552e\u989d'}
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={'\u5229\u6da6'}
                    stroke="#16a34a"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey={'\u6210\u672c'}
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
                  <Bar dataKey={'\u9500\u552e\u989d'} fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={'\u5229\u6da6'} fill="#16a34a" radius={[2, 2, 0, 0]} />
                  <Bar dataKey={'\u6210\u672c'} fill="#f59e0b" radius={[2, 2, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>{'\u5468\u671f\u660e\u7ec6'}</h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{'\u65f6\u95f4'}</th>
                    <th>{'\u8ba2\u5355\u6570'}</th>
                    <th>{'\u6570\u91cf'}</th>
                    <th>{'\u9500\u552e\u989d (ZAR)'}</th>
                    <th>{'\u6210\u672c (ZAR)'}</th>
                    <th>{'\u4f63\u91d1 (ZAR)'}</th>
                    <th>{'\u5229\u6da6 (ZAR)'}</th>
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
