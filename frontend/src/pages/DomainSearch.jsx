import React, { useState } from 'react';

export default function DomainSearch() {
    const [domain, setDomain] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSearch = async (event) => {
        event.preventDefault();

        const value = domain.trim();

        if (!value) {
            setError('Please enter a domain name.');
            setResults([]);
            return;
        }

        setLoading(true);
        setError('');
        setResults([]);

        try {
            const token = localStorage.getItem('supreme_access_token');

            const response = await fetch('/api/domain/search', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token
                        ? { Authorization: `Bearer ${token}` }
                        : {})
                },
                body: JSON.stringify({
                    domain: value
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.error ||
                    data?.message ||
                    'Domain search failed.'
                );
            }

            setResults(data?.results || []);
        } catch (err) {
            setError(err?.message || 'Domain search failed.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="domain-search-page">
            <section className="domain-search-card">
                <div className="eyebrow">SUPREME DOMAIN ENGINE</div>

                <h1>Find Your Domain</h1>

                <p>
                    Search domain availability with real-time RDAP
                    availability data and SUPREME pricing.
                </p>

                <form onSubmit={handleSearch}>
                    <input
                        type="text"
                        value={domain}
                        onChange={(event) => setDomain(event.target.value)}
                        placeholder="example.com"
                        aria-label="Domain name"
                    />

                    <button type="submit" disabled={loading}>
                        {loading ? 'SEARCHING...' : 'SEARCH DOMAIN'}
                    </button>
                </form>

                {error && (
                    <div className="domain-error">
                        {error}
                    </div>
                )}

                {results.length > 0 && (
                    <section className="domain-results">
                        <h2>Search Results</h2>

                        {results.map((item) => (
                            <article
                                className="domain-result"
                                key={item.domain}
                            >
                                <div>
                                    <strong>{item.domain}</strong>

                                    <small>
                                        {item.availability ||
                                            (item.available
                                                ? 'available'
                                                : 'registered')}
                                    </small>
                                </div>

                                <div>
                                    {item.available === true ? (
                                        <>
                                            <strong>
                                                {item.price != null
                                                    ? `${item.currency || 'USD'} ${item.price}`
                                                    : 'Price unavailable'}
                                            </strong>

                                            <button type="button">
                                                Register
                                            </button>
                                        </>
                                    ) : (
                                        <span>
                                            {item.available === false
                                                ? 'Registered'
                                                : 'Availability unknown'}
                                        </span>
                                    )}
                                </div>
                            </article>
                        ))}
                    </section>
                )}
            </section>
        </main>
    );
}
