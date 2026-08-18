"use client";

import { useEffect } from "react";

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        console.error("Global error:", error);
    }, [error]);

    return (
        <html lang="en">
            <head>
                <title>Something went wrong – KD</title>
                <style>{`
                    @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');

                    * { margin: 0; padding: 0; box-sizing: border-box; }

                    body {
                        font-family: 'Instrument Sans', -apple-system, BlinkMacSystemFont, sans-serif;
                        background-color: #f6f4ef;
                        color: #1c1b17;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }

                    .error-container {
                        text-align: center;
                        max-width: 480px;
                        padding: 2rem;
                    }

                    .error-title {
                        font-family: 'Instrument Serif', Georgia, serif;
                        font-size: 1.75rem;
                        font-weight: 400;
                        letter-spacing: -0.01em;
                        color: #1c1b17;
                        margin-bottom: 0.75rem;
                    }

                    .error-message {
                        font-size: 0.9375rem;
                        color: #6f6a5e;
                        line-height: 1.6;
                        margin-bottom: 2rem;
                    }

                    .btn-back {
                        display: inline-flex;
                        align-items: center;
                        gap: 0.5rem;
                        padding: 0.625rem 1.25rem;
                        border-radius: 10px;
                        font-size: 0.875rem;
                        font-weight: 500;
                        font-family: 'Instrument Sans', sans-serif;
                        cursor: pointer;
                        transition: all 0.15s ease;
                        text-decoration: none;
                        border: none;
                        background-color: #1c1b17;
                        color: #f6f4ef;
                    }

                    .btn-back:hover {
                        opacity: 0.9;
                    }

                    .btn-back:active {
                        transform: scale(0.98);
                    }
                `}</style>
            </head>
            <body>
                <div className="error-container">
                    <h1 className="error-title">Something went wrong</h1>
                    <p className="error-message">
                        We encountered an unexpected error. This has been logged
                        and our team will look into it.
                    </p>
                    <button
                        className="btn-back"
                        onClick={() => window.history.back()}
                    >
                        Back
                    </button>
                </div>
            </body>
        </html>
    );
}
