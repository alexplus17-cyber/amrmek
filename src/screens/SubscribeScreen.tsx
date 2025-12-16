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

    const [errors, setErrors] = useState<Record<string,string>>({});
    const [files, setFiles] = useState<FileList | null>(null);

    const validate = () => {
        const e: Record<string,string> = {};
        if (!firstName.trim()) e.first_name = 'First name is required';
        if (!lastName.trim()) e.last_name = 'Last name is required';
        if (!username.trim()) e.username = 'Username is required';
        if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) e.email = 'Valid email is required';
        if (!password || password.length < 8) e.password = 'Password must be at least 8 characters';
        return e;
    };

    const handleSubmit = async (eEvt: React.FormEvent) => {
        eEvt.preventDefault();
        setMessage(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length > 0) return;
        setLoading(true);
        try {
            const form = new FormData();
            form.append('first_name', firstName);
            form.append('last_name', lastName);
            form.append('username', username);
            form.append('email', email);
            form.append('password', password);
            if (files && files.length) {
                for (let i = 0; i < files.length; i++) {
                    form.append('file_' + i, files[i]);
                }
            }

            const res = await fetch(`${API_BASE_URL}/wp-json/investor-network/v1/spa-apply`, {
                method: 'POST',
                body: form,
                credentials: 'include'
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // redirect to WP thank-you page if available
                try { window.location.href = `${API_BASE_URL}/thank-you`; return; } catch (err) {}
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
                        {errors.first_name && <p className="text-sm text-red-600">{errors.first_name}</p>}
                        <Input id="last_name" label="Last name" required value={lastName} onChange={(e) => setLastName((e.target as HTMLInputElement).value)} />
                        {errors.last_name && <p className="text-sm text-red-600">{errors.last_name}</p>}
                        <Input id="username" label="Username" required value={username} onChange={(e) => setUsername((e.target as HTMLInputElement).value)} />
                        {errors.username && <p className="text-sm text-red-600">{errors.username}</p>}
                        <Input id="email" label="Email" type="email" required value={email} onChange={(e) => setEmail((e.target as HTMLInputElement).value)} />
                        {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                        <Input id="password" label="Password" type="password" required value={password} onChange={(e) => setPassword((e.target as HTMLInputElement).value)} />
                        {errors.password && <p className="text-sm text-red-600">{errors.password}</p>}
                        <div>
                            <label className="block text-sm font-medium text-secondary-700">Upload documents (optional)</label>
                            <input type="file" multiple onChange={(ev) => setFiles(ev.target.files)} />
                        </div>
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
