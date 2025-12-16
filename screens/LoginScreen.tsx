
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { API_BASE_URL } from '../constants';

const LoginScreen: React.FC = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        try {
            await login(username, password);
        } catch (err: any) {
            // Prefer server-provided message when available
            const msg = err?.message || (err && typeof err === 'object' ? JSON.stringify(err) : String(err));
            setError(msg || 'Failed to login. Please check your credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary-100 dark:bg-secondary-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <div className="flex justify-center">
                       <svg className="h-12 w-auto text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                       </svg>
                    </div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-secondary-900 dark:text-white">
                        Sign in to Investor Network
                    </h2>
                </div>
                <Card className="!p-8">
                    <form className="space-y-6" onSubmit={handleLogin}>
                        {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                        <Input
                            id="username"
                            label="Username"
                            type="text"
                            autoComplete="username"
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                        />
                        <Input
                            id="password"
                            label="Password"
                            type="password"
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <div>
                            <Button type="submit" isLoading={isLoading}>
                                Sign in
                            </Button>
                        </div>
                        <div className="mt-4 text-center">
                            <span className="text-sm text-secondary-600">Don't have an account? </span>
                            {(() => {
                                // If the app is running from the dev server (common: localhost:3000),
                                // link the Sign up to the WP-hosted subscribe page so mobile/webviews
                                // open the WordPress form instead of the dev server hash route.
                                let signupHref = '#subscribe';
                                try {
                                    if (typeof window !== 'undefined') {
                                        const host = window.location.hostname || '';
                                        const port = window.location.port || '';
                                        if (host.indexOf('localhost') !== -1 || host.indexOf('127.0.0.1') !== -1 || port === '3000') {
                                            signupHref = API_BASE_URL.replace(/\/$/, '') + '/member-subscribe-form/';
                                        }
                                    }
                                } catch (e) {
                                    signupHref = '#subscribe';
                                }
                                return (
                                    <a href={signupHref} className="text-sm font-medium text-primary-600 hover:underline">Sign up</a>
                                );
                            })()}
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default LoginScreen;