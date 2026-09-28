import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import NEOMCanvas from '../../neom/NEOMCanvas.jsx';
import DomainSearch from './pages/DomainSearch.jsx';
import '../../neom/NEOMCanvas.css';

function EnterpriseHome() {
    return (
        <div className="app">
            <header className="topbar">
                <div>
                    <div className="eyebrow">SUPREME ENTERPRISE PLATFORM</div>
                    <h1>Enterprise Operations</h1>
                </div>

                <div className="system-status">
                    <span className="status-dot"></span>
                    SYSTEM ONLINE
                </div>
            </header>

            <main className="dashboard">
                <section className="hero">
                    <div>
                        <span className="eyebrow">GLOBAL OPERATIONS</span>

                        <h2>
                            One command layer for
                            enterprise infrastructure.
                        </h2>

                        <p>
                            Monitor infrastructure, AI operations,
                            energy systems, security and real-time
                            operational intelligence from one platform.
                        </p>

                        <Link to="/neom">
                            <button>ENTER NEOM COMMAND CENTER</button>
                        </Link>

                        <Link to="/domains">
                            <button>DOMAIN SEARCH</button>
                        </Link>
                    </div>

                    <div className="core">
                        <div className="ring ring-1"></div>
                        <div className="ring ring-2"></div>
                        <div className="ring ring-3"></div>

                        <div className="core-center">
                            <strong>SUPREME</strong>
                            <small>LIVE CORE</small>
                        </div>
                    </div>
                </section>

                <section className="metrics">
                    <article>
                        <span>INFRASTRUCTURE</span>
                        <strong>ONLINE</strong>
                        <small>Global systems</small>
                    </article>

                    <article>
                        <span>AI AGENTS</span>
                        <strong>24</strong>
                        <small>Active operations</small>
                    </article>

                    <article>
                        <span>ENERGY</span>
                        <strong>4.0 GW</strong>
                        <small>Monitored capacity</small>
                    </article>

                    <article>
                        <span>ALERTS</span>
                        <strong>0</strong>
                        <small>Critical incidents</small>
                    </article>
                </section>

                <section className="panels">
                    <div className="panel">
                        <div className="eyebrow">SYSTEM OPERATIONS</div>

                        <h3>Operational Control</h3>

                        <div className="row">
                            <span>SUPREME CORE</span>
                            <b>ONLINE</b>
                        </div>

                        <div className="row">
                            <span>AI RUNTIME</span>
                            <b>ACTIVE</b>
                        </div>

                        <div className="row">
                            <span>SECURITY LAYER</span>
                            <b>ACTIVE</b>
                        </div>

                        <div className="row">
                            <span>TELEMETRY ENGINE</span>
                            <b>LIVE</b>
                        </div>

                        <div className="row">
                            <span>EVENT BUS</span>
                            <b>READY</b>
                        </div>
                    </div>

                    <div className="panel intelligence">
                        <div className="eyebrow">SUPREME INTELLIGENCE</div>

                        <div className="orb"></div>

                        <h3>Planetary Intelligence</h3>

                        <p>
                            Unified intelligence layer for infrastructure,
                            agents, security, telemetry and enterprise
                            operations.
                        </p>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<EnterpriseHome />} />
            <Route path="/neom" element={<NEOMCanvas />} />
            <Route path="/domains" element={<DomainSearch />} />
        </Routes>
    );
}
