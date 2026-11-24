"use client";

import { useEffect, useState } from "react";
import {
  ShieldCheck, LayoutDashboard, ChartNoAxesCombined,
  BrainCircuit, ScanLine, SlidersHorizontal,
  FileText, Activity, CreditCard, AlertTriangle,
  ArrowUpRight, Database, Upload, Download,
  CheckCircle2, RefreshCw
} from "lucide-react";

import {
  ResponsiveContainer, BarChart, Bar, XAxis,
  YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area
} from "recharts";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

type Row = Record<string, any>;

const navigation = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Transaction Analytics", icon: ChartNoAxesCombined },
  { name: "Model Performance", icon: BrainCircuit },
  { name: "Fraud Detection", icon: ScanLine },
  { name: "Risk Simulator", icon: SlidersHorizontal },
  { name: "Insights", icon: FileText },
];

const colors = ["#38bdf8", "#34d399", "#a78bfa", "#f87171"];

const number = (v: number) =>
  Number(v).toLocaleString("en-US", {
    maximumFractionDigits: 2
  });

const percent = (v: number) =>
  `${(Number(v) * 100).toFixed(2)}%`;

const tooltipStyle = {
  backgroundColor: "#111c30",
  border: "1px solid #26354d",
  borderRadius: "12px",
  color: "#e2e8f0"
};

function Panel({ title, subtitle, children }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      <h3>{title}</h3>
      {subtitle && <p className="muted">{subtitle}</p>}
      <div className="panel-content">{children}</div>
    </section>
  );
}

function KPI({ label, value, icon: Icon, detail }: {
  label: string;
  value: string;
  icon: any;
  detail?: string;
}) {
  return (
    <div className="kpi">
      <div className="kpi-top">
        <span>{label}</span>
        <Icon size={19} />
      </div>
      <strong>{value}</strong>
      <small>{detail || "Historical dataset"}</small>
    </div>
  );
}

function Matrix({ data }: { data: Row }) {
  return (
    <div className="matrix">
      <div className="matrix-cell green">
        <small>True Negative</small>
        <strong>{number(data.TN ?? data.tn)}</strong>
      </div>
      <div className="matrix-cell amber">
        <small>False Positive</small>
        <strong>{number(data.FP ?? data.fp)}</strong>
      </div>
      <div className="matrix-cell red">
        <small>False Negative</small>
        <strong>{number(data.FN ?? data.fn)}</strong>
      </div>
      <div className="matrix-cell green">
        <small>True Positive</small>
        <strong>{number(data.TP ?? data.tp)}</strong>
      </div>
    </div>
  );
}

export default function Home() {
  const [page, setPage] = useState("Overview");
  const [data, setData] = useState<Row | null>(null);
  const [samples, setSamples] = useState<Row[]>([]);
  const [model, setModel] = useState("Random Forest");
  const [sample, setSample] = useState(0);
  const [threshold, setThreshold] = useState(0.49);
  const [prediction, setPrediction] = useState<Row | null>(null);
  const [batch, setBatch] = useState<Row | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

useEffect(() => {
  window.scrollTo(0, 0);
}, [page]);

  useEffect(() => {
    Promise.all([
      fetch(`${API}/api/analytics`).then(r => {
        if (!r.ok) throw new Error("Analytics unavailable");
        return r.json();
      }),
      fetch(`${API}/api/samples`).then(r => {
        if (!r.ok) throw new Error("Samples unavailable");
        return r.json();
      })
    ])
      .then(([analytics, transactions]) => {
        setData(analytics);
        setSamples(transactions);
        setModel(analytics.best_model.model);
        setThreshold(analytics.best_model.threshold);
      })
      .catch(e => setError(e.message));
  }, []);

  async function predict() {
    setBusy(true);
    setError("");
    setPrediction(null);

    try {
      const response = await fetch(`${API}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          features: samples[sample].features,
          model,
          threshold
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(result.detail));
      }

      setPrediction({
        ...result,
        actual_class: samples[sample].actual_class
      });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function predictBatch() {
    if (!file) return;

    setBusy(true);
    setError("");
    setBatch(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch(
        `${API}/api/predict-batch?model=${encodeURIComponent(model)}`,
        { method: "POST", body: form }
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(result.detail));
      }

      setBatch(result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  function downloadBatch() {
    if (!batch?.results?.length) return;

    const keys = Object.keys(batch.results[0]);

    const csv = [
      keys.join(","),
      ...batch.results.map((r: Row) =>
        keys.map(k => r[k]).join(",")
      )
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv" })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "fraudlens_predictions.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!data) {
    return (
      <div className="loading-screen">
        <ShieldCheck size={48} color="#38bdf8" />
        <h1>FraudLens</h1>
        <p>{error || "Connecting to analytics engine..."}</p>
        {error && (
          <button onClick={() => window.location.reload()}>
            Retry connection
          </button>
        )}
      </div>
    );
  }

  const o = data.overview;
  const best = data.best_model;
  const selectedModel = data.models.find(
    (m: Row) => m.Model === model
  ) || data.models[0];

  const thresholdRow = data.threshold_analysis.reduce(
    (a: Row, b: Row) =>
      Math.abs(b.threshold - threshold) <
      Math.abs(a.threshold - threshold) ? b : a
  );

  const classData = [
    { name: "Legitimate", value: o.legitimate_transactions },
    { name: "Fraudulent", value: o.fraudulent_transactions }
  ];

  const selectedImpact = data.financial_impact.find(
    (r: Row) => r.model === best.model
  );

  const gallery = [
    ["class_distribution.png", "Class Distribution"],
    ["amount_distribution.png", "Transaction Amount Distribution"],
    ["boxplot.png", "Outlier Analysis"],
    ["correlation_heatmap.png", "Correlation Heatmap"],
    ["hourly_fraud.png", "Temporal Fraud Analysis"],
    ["scatter_plot.png", "Fraud Pattern Analysis"]
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={27} />
          </div>
          <div>
            <h2>FraudLens<span>.</span></h2>
            <small>RISK INTELLIGENCE</small>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {navigation.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={`nav-item ${page === name ? "active" : ""}`}
              onClick={() => {
                setPage(name);
                setError("");
              }}
            >
              <Icon size={19} />
              {name}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="status">
            <span className="status-dot" />
            Analytics API connected
          </div>
          <p>Data Analytics Project</p>
          <small>ML-powered financial intelligence</small>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <span>Workspace / {page}</span>
          <div className="status">
            <span className="status-dot" />
            Model ready
          </div>
        </header>

        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                FRAUDLENS / ANALYTICS PLATFORM
              </div>
              <h1>{page}</h1>
              <p className="muted">
                Financial transaction analytics and
                machine learning intelligence.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {page === "Overview" && (
            <>
              <div className="hero">
                <div>
                  <div className="eyebrow">FINANCIAL RISK INTELLIGENCE</div>
                  <h2>Turning transaction data<br />into actionable insights.</h2>
                  <p>
                    Explore historical financial patterns,
                    detect anomalies and evaluate predictive models.
                  </p>
                  <button onClick={() => setPage("Model Performance")}>
                    Explore ML performance <ArrowUpRight size={16} />
                  </button>
                </div>
                <ShieldCheck className="hero-icon" size={150} />
              </div>

              <div className="kpi-grid">
                <KPI label="Transactions analysed"
                  value={number(o.total_transactions)}
                  icon={Database} />
                <KPI label="Fraud cases"
                  value={number(o.fraudulent_transactions)}
                  icon={AlertTriangle} />
                <KPI label="Fraud rate"
                  value={`${o.fraud_rate.toFixed(3)}%`}
                  icon={Activity} />
                <KPI label="Best model accuracy"
                  value={percent(best.accuracy)}
                  icon={ShieldCheck}
                  detail={best.model + " · Test set"} />
              </div>

              <div className="two-grid">
                <Panel title="Transaction composition"
                  subtitle="Historical class distribution">
                  <ResponsiveContainer width="100%" height={270}>
                    <PieChart>
                      <Pie data={classData}
                        dataKey="value" nameKey="name"
                        innerRadius={70} outerRadius={105}>
                        <Cell fill="#38bdf8" />
                        <Cell fill="#f87171" />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="three-grid">
  <KPI
    label="Legitimate"
    value={number(o.legitimate_transactions)}
    icon={ShieldCheck}
  />
  <KPI
    label="Fraudulent"
    value={number(o.fraudulent_transactions)}
    icon={AlertTriangle}
  />
  <KPI
    label="Fraud rate"
    value={`${o.fraud_rate.toFixed(3)}%`}
    icon={Activity}
  />
</div>
                </Panel>

                <Panel title="Fraud rate over time"
                  subtitle="Hours since first recorded transaction">
                  <ResponsiveContainer width="100%" height={270}>
                    <AreaChart data={data.hourly_analysis}>
                      <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
                      <XAxis dataKey="Hour" stroke="#8291a9" />
                      <YAxis stroke="#8291a9" unit="%" />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Area type="monotone"
                        dataKey="fraud_rate"
                        stroke="#38bdf8"
                        fill="#38bdf8"
                        fillOpacity={0.15} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>
              </div>

              <Panel title="Recommended classification model"
                subtitle="Selected using validation Average Precision">
                <div className="recommendation">
                  <ShieldCheck size={42} color="#34d399" />
                  <div>
                    <h2>{best.model}</h2>
                    <p className="muted">
                      {percent(best.precision)} precision ·{" "}
                      {percent(best.recall)} recall ·{" "}
                      {percent(best.f1)} F1-score
                    </p>
                  </div>
                </div>
              </Panel>
            </>
          )}

          {page === "Transaction Analytics" && (
            <>
              <div className="kpi-grid">
                <KPI label="Total transaction value"
                  value={number(o.total_transaction_value)}
                  icon={CreditCard} />
                <KPI label="Fraud transaction value"
                  value={number(o.fraud_transaction_value)}
                  icon={AlertTriangle} />
                <KPI label="Average transaction amount"
                  value={number(o.average_transaction_amount)}
                  icon={Activity} />
                <KPI label="Duplicates removed"
                  value={number(o.duplicates_removed)}
                  icon={Database} />
              </div>

              <Panel title="Transaction activity"
                subtitle="Hourly transaction volume">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.hourly_analysis}>
                    <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
                    <XAxis dataKey="Hour" stroke="#8291a9" />
                    <YAxis stroke="#8291a9" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="transactions"
                      fill="#38bdf8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <div className="two-grid">
                {gallery.map(([filename, title]) => (
                  <Panel key={filename} title={title}>
                    <a href={`${API}/visualizations/${filename}`}
                      target="_blank" rel="noreferrer">
                      <img className="chart-image"
                        src={`${API}/visualizations/${filename}`}
                        alt={title} />
                    </a>
                  </Panel>
                ))}
              </div>
            </>
          )}

          {page === "Model Performance" && (
            <>
              <Panel title="Classification performance comparison"
                subtitle="Held-out test set · Default decision threshold">
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={data.models}>
                    <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
                    <XAxis dataKey="Model" stroke="#8291a9" />
                    <YAxis domain={[0, 1]} stroke="#8291a9" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    {["Precision", "Recall", "F1 Score"].map((k, i) => (
                      <Bar key={k} dataKey={k}
                        fill={colors[i]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Evaluation metrics">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {["Model", "Accuracy", "Precision", "Recall",
                          "F1 Score", "ROC AUC", "TP", "TN", "FP", "FN"]
                          .map(k => <th key={k}>{k}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {data.models.map((m: Row) => (
                        <tr key={m.Model}>
                          <td>{m.Model}</td>
                          {["Accuracy", "Precision", "Recall",
                            "F1 Score", "ROC AUC"].map(k => (
                            <td key={k}>{percent(m[k])}</td>
                          ))}
                          {["TP", "TN", "FP", "FN"].map(k => (
                            <td key={k}>{number(m[k])}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Confusion matrix"
                subtitle="Rows: actual class · Columns: predicted class">
                <select value={model}
                  onChange={e => {
                    setModel(e.target.value);
                    setPrediction(null);
                    setBatch(null);
                  }}>
                  {data.models.map((m: Row) => (
                    <option key={m.Model}>{m.Model}</option>
                  ))}
                </select>
                <Matrix data={selectedModel} />
              </Panel>

              <div className="two-grid">
                <Panel title="ROC curve">
                  <img className="chart-image"
                    src={`${API}/visualizations/roc_curve.png`}
                    alt="ROC curve" />
                </Panel>
                <Panel title="Precision-recall curve">
                  <img className="chart-image"
                    src={`${API}/visualizations/precision_recall.png`}
                    alt="Precision recall curve" />
                </Panel>
              </div>
            </>
          )}

          {page === "Fraud Detection" && (
            <>
              <div className="two-grid">
                <Panel title="Transaction screening"
                  subtitle="Run inference using trained ML models">
                  <label>Classification model</label>
                  <select value={model}
                    onChange={e => {
                      setModel(e.target.value);
                      setPrediction(null);
                      setBatch(null);
                      setThreshold(e.target.value === best.model
                        ? best.threshold : 0.5);
                    }}>
                    {data.models.map((m: Row) => (
                      <option key={m.Model}>{m.Model}</option>
                    ))}
                  </select>

                  <label>Sample transaction</label>
                  <select value={sample}
                    onChange={e => {
                      setSample(Number(e.target.value));
                      setPrediction(null);
                    }}>
                    {samples.map((s, i) => (
                      <option key={i} value={i}>
                        TXN-{String(i + 1).padStart(3, "0")}
                        {" · Amount: "}{number(s.amount)}
                      </option>
                    ))}
                  </select>

                  <label>Decision threshold: {threshold.toFixed(2)}</label>
                  <input type="range" min="0.01" max="0.99"
                    step="0.01" value={threshold}
                    onChange={e => {
                      setThreshold(Number(e.target.value));
                      setPrediction(null);
                    }} />

                  <button disabled={busy || !samples.length}
                    onClick={predict}>
                    <ScanLine size={18} />
                    {busy ? "Analysing..." : "Analyse transaction"}
                  </button>
                </Panel>

                <Panel title="Prediction result">
                  {prediction ? (
                    <div className={
                      prediction.prediction ? "result fraud" : "result safe"
                    }>
                      {prediction.prediction
                        ? <AlertTriangle size={42} />
                        : <CheckCircle2 size={42} />}
                      <h2>{prediction.classification}</h2>
                      <strong>{percent(prediction.fraud_score)}</strong>
                      <p>Model fraud score</p>
                      <div className="result-details">
                        <p>Model: {prediction.model}</p>
                        <p>Threshold: {prediction.threshold}</p>
                        <p>Actual label: {prediction.actual_class
                          ? "Fraudulent" : "Legitimate"}</p>
                        <p>Evaluation: {
                          prediction.prediction === prediction.actual_class
                            ? "Correct prediction"
                            : "Incorrect prediction"
                        }</p>
                      </div>
                    </div>
                  ) : (
                    <div className="empty">
                      <ScanLine size={45} />
                      <p>Select a transaction to begin analysis.</p>
                    </div>
                  )}
                </Panel>
              </div>

              <Panel title="Batch transaction analysis"
                subtitle="Upload CSV containing Time, V1–V28 and Amount">
                <div className="upload-zone">
                  <Upload size={32} />
                  <input type="file" accept=".csv"
                    onChange={e => {
                      setFile(e.target.files?.[0] || null);
                      setBatch(null);
                    }} />
                  <p className="muted">Maximum 10 MB / 10,000 rows</p>
                </div>

                <button disabled={!file || busy}
                  onClick={predictBatch}>
                  {busy ? "Processing..." : "Analyse CSV"}
                </button>

                {batch && (
                  <>
                    <div className="three-grid">
                      <KPI label="Total analysed"
                        value={number(batch.total_transactions)}
                        icon={Database} />
                      <KPI label="Flagged"
                        value={number(batch.flagged_transactions)}
                        icon={AlertTriangle} />
                      <KPI label="Legitimate"
                        value={number(batch.legitimate_transactions)}
                        icon={ShieldCheck} />
                    </div>
                    <p className="muted">
                      Batch decision threshold: {batch.threshold}
                    </p>
                    <button onClick={downloadBatch}>
                      <Download size={17} /> Download results
                    </button>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>ID</th><th>Amount</th>
                            <th>Fraud score</th><th>Classification</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.results.slice(0, 100).map((r: Row) => (
                            <tr key={r.transaction_id}>
                              <td>{r.transaction_id}</td>
                              <td>{number(r.amount)}</td>
                              <td>{percent(r.fraud_score)}</td>
                              <td>{r.classification}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </Panel>
            </>
          )}

          {page === "Risk Simulator" && (
            <>
              <Panel title="Decision threshold laboratory"
                subtitle={`${best.model} · Validation dataset`}>
                <div className="threshold-heading">
                  <div>
                    <p className="muted">Classification threshold</p>
                    <h2>{threshold.toFixed(2)}</h2>
                  </div>
                  <button onClick={() => setThreshold(best.threshold)}>
                    Reset to optimal
                  </button>
                </div>
                <input type="range" min="0.01" max="0.99"
                  step="0.01" value={threshold}
                  onChange={e => {
                    setThreshold(Number(e.target.value));
                    setPrediction(null);
                  }} />
                <div className="range-labels">
                  <span>Higher sensitivity</span>
                  <span>Stricter detection</span>
                </div>
              </Panel>

              <div className="three-grid">
                <KPI label="Precision"
                  value={percent(thresholdRow.precision)}
                  icon={ShieldCheck} detail="Validation set" />
                <KPI label="Recall"
                  value={percent(thresholdRow.recall)}
                  icon={Activity} detail="Validation set" />
                <KPI label="F1-score"
                  value={percent(thresholdRow.f1)}
                  icon={BrainCircuit} detail="Validation set" />
              </div>

              <Panel title="Threshold performance curves">
                <ResponsiveContainer width="100%" height={330}>
                  <LineChart data={data.threshold_analysis}>
                    <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
                    <XAxis dataKey="threshold" stroke="#8291a9" />
                    <YAxis domain={[0, 1]} stroke="#8291a9" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    {["precision", "recall", "f1"].map((k, i) => (
                      <Line key={k} dataKey={k}
                        stroke={colors[i]} strokeWidth={2} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Simulated confusion matrix">
                <Matrix data={thresholdRow} />
              </Panel>
            </>
          )}

          {page === "Insights" && (
            <>
              <Panel title="Financial impact analysis"
                subtitle="Historical test transaction values at threshold 0.50">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={data.financial_impact}>
                    <CartesianGrid stroke="#243047" strokeDasharray="3 3" />
                    <XAxis dataKey="model" stroke="#8291a9" />
                    <YAxis stroke="#8291a9" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Bar dataKey="detected_fraud_value"
                      name="Detected fraud value" fill="#34d399" />
                    <Bar dataKey="missed_fraud_value"
                      name="Missed fraud value" fill="#f87171" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="False alarm exposure"
                subtitle="Legitimate transaction value incorrectly flagged">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data.financial_impact}>
                    <XAxis dataKey="model" stroke="#8291a9" />
                    <YAxis stroke="#8291a9" />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="false_alarm_value" fill="#fbbf24" />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Feature importance"
                subtitle="Random Forest · Global impurity-based importance">
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart layout="vertical"
                    data={data.feature_importance.slice(0, 12)}>
                    <XAxis type="number" stroke="#8291a9" />
                    <YAxis type="category" dataKey="feature"
                      stroke="#8291a9" width={65} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="importance" fill="#a78bfa"
                      radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Panel>

              <Panel title="Analytical findings">
                <div className="insight">
                  <h4>01 / Extreme class imbalance</h4>
                  <p>Only {o.fraud_rate.toFixed(3)}% of transactions
                    are fraudulent. Accuracy alone is insufficient.</p>
                </div>
                <div className="insight">
                  <h4>02 / Recommended model</h4>
                  <p>{best.model} achieves {percent(best.precision)}
                    {" "}precision and {percent(best.recall)} recall
                    on the held-out test set at the selected threshold.</p>
                </div>
                {selectedImpact && (
                  <div className="insight">
                    <h4>03 / Financial exposure</h4>
                    <p>The recommended model identified fraudulent
                      transaction value of{" "}
                      {number(selectedImpact.detected_fraud_value)}
                      {" "}at the default threshold. This represents{" "}
                      {percent(selectedImpact.detected_fraud_value /
                        selectedImpact.total_fraud_value)}
                      {" "}of historical test fraud value.</p>
                  </div>
                )}
                <div className="insight">
                  <h4>04 / Limitations</h4>
                  <p>V1–V28 are anonymised PCA features.
                    Model scores are not calibrated probabilities.
                    Historical detected value is not guaranteed savings.
                    This platform is an academic prototype.</p>
                </div>
              </Panel>
            </>
          )}

          <footer>
            FraudLens · Financial Risk Intelligence ·
            Academic Data Analytics Project
          </footer>
        </div>
      </main>
    </div>
  );
}