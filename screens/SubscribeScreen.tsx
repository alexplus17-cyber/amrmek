import React, { useState } from 'react';
import Button from '../components/Button';
import Input from '../components/Input';
import Card from '../components/Card';
import { API_BASE_URL } from '../constants';

const SubscribeScreen: React.FC = () => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/wp-json/investor-network/v1/spa-apply`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: firstName, last_name: lastName, username, email, password })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setMessage('Application received. Check your email for next steps.');
            } else {
                setMessage(data.message || 'Submission failed.');
            }
        } catch (err) {
            setMessage('Network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary-50 dark:bg-secondary-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-secondary-900 dark:text-white">Join Investor Network</h2>
                </div>
                <Card className="!p-8">
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {message && <p className="text-sm text-secondary-700">{message}</p>}
                        <Input id="first_name" label="First name" required value={firstName} onChange={(e) => setFirstName((e.target as HTMLInputElement).value)} />
                        <Input id="last_name" label="Last name" required value={lastName} onChange={(e) => setLastName((e.target as HTMLInputElement).value)} />
                        <Input id="username" label="Username" required value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} />
                        <Input id="email" label="Email" type="email" required value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} />
                        <Input id="password" label="Password" type="password" required value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} />
                        <div>
                            <Button type="submit" isLoading={loading}>Submit Application</Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
};

export default SubscribeScreen;
