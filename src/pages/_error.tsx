import React from 'react';
import type { NextPage } from 'next';

interface ErrorProps {
    statusCode?: number;
}

// Simple error page that doesn't rely on any problematic components
const ErrorPage: NextPage<ErrorProps> = ({ statusCode }) => {
    return (
        <div style={{
            padding: '2rem',
            maxWidth: '600px',
            margin: '0 auto',
            fontFamily: 'system-ui, sans-serif',
            color: 'white',
            background: 'black',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
        }}>
            <h1 style={{ marginBottom: '1rem' }}>
                {statusCode ? `Error ${statusCode}` : 'Client-side error'}
            </h1>
            <p>Sorry, something went wrong.</p>
            <button
                onClick={() => window.location.href = '/'}
                style={{
                    marginTop: '2rem',
                    padding: '0.5rem 1rem',
                    background: '#333',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    cursor: 'pointer'
                }}
            >
                Return Home
            </button>
        </div>
    );
};

ErrorPage.getInitialProps = ({ res, err }) => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
    return { statusCode };
};

export default ErrorPage; 