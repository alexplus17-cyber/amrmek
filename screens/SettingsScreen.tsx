
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import ThemeToggle from '../components/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { UserSettings } from '../types';
import Input from '../components/Input';

const Toggle: React.FC<{ label: string; enabled: boolean; onChange: (enabled: boolean) => void }> = ({ label, enabled, onChange }) => (
    <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">{label}</span>
        <button
            type="button"
            className={`${enabled ? 'bg-primary-600' : 'bg-secondary-200 dark:bg-secondary-600'} relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:ring-offset-secondary-800`}
            role="switch"
            aria-checked={enabled ? 'true' : 'false'}
            aria-label={label}
            onClick={() => onChange(!enabled)}
        >
            <span
                aria-hidden="true"
                className={`${enabled ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
            />
        </button>
    </div>
);


const SettingsScreen: React.FC = () => {
    const { user, logout } = useAuth();
    const [settings, setSettings] = useState<UserSettings | null>(null);
    // Password change state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (user) {
            apiService.getUserSettings(user.id)
                .then(setSettings)
                .catch(() => setError('Failed to load settings.'))
                .finally(() => setLoading(false));
        }
    }, [user]);

    const handleSettingsChange = (key: keyof UserSettings, value: any) => {
        if (!settings) return;
        setSettings({ ...settings, [key]: value });
    };

    const handleTopicChange = (topic: keyof UserSettings['notificationTopics'], value: boolean) => {
        if (!settings) return;
        setSettings({
            ...settings,
            notificationTopics: {
                ...settings.notificationTopics,
                [topic]: value,
            },
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings || !user) return;

        setIsSaving(true);
        setError('');
        setSuccess('');
        try {
            await apiService.updateUserSettings(user.id, settings);
            setSuccess('Settings updated successfully!');
        } catch (err) {
            setError('Failed to update settings. Please try again.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccess(''), 3000);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-secondary-900 dark:text-white">Settings</h1>
            {settings ? (
                <form onSubmit={handleSubmit}>
                    <div className="space-y-8">
                        <Card title="Appearance">
                             <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300">Theme</span>
                                <ThemeToggle />
                            </div>
                        </Card>
                    
                        <Card title="Notifications">
                            <div className="space-y-4">
                                <Toggle 
                                    label="Email Notifications" 
                                    enabled={settings.enableEmailNotifications} 
                                    onChange={(val) => handleSettingsChange('enableEmailNotifications', val)} 
                                />
                                <Toggle 
                                    label="Push Notifications" 
                                    enabled={settings.enablePushNotifications} 
                                    onChange={(val) => handleSettingsChange('enablePushNotifications', val)} 
                                />
                                <div className="border-t border-secondary-200 dark:border-secondary-700 my-4"></div>
                                <h4 className="text-md font-medium text-secondary-800 dark:text-secondary-200">Notification Topics</h4>
                                <Toggle 
                                    label="New Investment Opportunities" 
                                    enabled={settings.notificationTopics.newInvestments} 
                                    onChange={(val) => handleTopicChange('newInvestments', val)} 
                                />
                                 <Toggle 
                                    label="Q&A Updates on Investments" 
                                    enabled={settings.notificationTopics.qnaUpdates} 
                                    onChange={(val) => handleTopicChange('qnaUpdates', val)} 
                                />
                                 <Toggle 
                                    label="Monthly Digest" 
                                    enabled={settings.notificationTopics.monthlyDigest} 
                                    onChange={(val) => handleTopicChange('monthlyDigest', val)} 
                                />
                            </div>
                        </Card>

                        <div className="flex justify-end">
                            <div className="w-full sm:w-auto">
                               {error && <p className="text-sm text-red-500 mb-2 text-right">{error}</p>}
                               {success && <p className="text-sm text-green-600 mb-2 text-right">{success}</p>}
                                <Button type="submit" isLoading={isSaving} className="!w-full sm:!w-auto sm:!px-8">
                                    Save Settings
                                </Button>
                            </div>
                        </div>
                        {/* Security / Change password section (render even if settings failed to load) */}
                        <Card title="Security">
                            {passwordError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-2 rounded-md">{passwordError}</p>}
                            {passwordSuccess && <p className="text-sm text-green-600 bg-green-100 dark:bg-green-900/50 p-2 rounded-md">{passwordSuccess}</p>}
                            <div className="space-y-4">
                                <Input id="current_password" name="current_password" label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                                <Input id="new_password" name="new_password" label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                <Input id="confirm_password" name="confirm_password" label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                <div className="flex justify-end">
                                    <Button type="button" isLoading={isChangingPassword} onClick={async () => {
                                        setPasswordError('');
                                        setPasswordSuccess('');
                                        if (!user) {
                                            setPasswordError('Not authenticated');
                                            return;
                                        }
                                        if (!currentPassword || !newPassword) {
                                            setPasswordError('Please fill both current and new password fields');
                                            return;
                                        }
                                        if (newPassword !== confirmPassword) {
                                            setPasswordError('New password and confirmation do not match');
                                            return;
                                        }
                                        setIsChangingPassword(true);
                                        try {
                                            await apiService.changePassword(user.id, currentPassword, newPassword);
                                            setPasswordSuccess('Password changed. You will be signed out.');
                                            // Log out so the user re-authenticates with new password
                                            try { logout(); } catch (e) { /* ignore */ }
                                        } catch (err: any) {
                                            console.error(err);
                                            const msg = (err && err.message) ? err.message : 'Failed to change password';
                                            setPasswordError(msg);
                                        } finally {
                                            setIsChangingPassword(false);
                                            setCurrentPassword('');
                                            setNewPassword('');
                                            setConfirmPassword('');
                                        }
                                    }}>
                                        Change Password
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                </form>
            ) : (
                <Card>
                    <p>Could not load your settings information.</p>
                </Card>
            )}
        </div>
    );
};

export default SettingsScreen;