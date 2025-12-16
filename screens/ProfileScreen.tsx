
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import { UserProfile } from '../types';

const ProfileScreen: React.FC = () => {
    const { user, refreshUserProfile } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [uploading, setUploading] = useState(false);

    const [activeTab, setActiveTab] = useState<'personal'|'company'|'documents'|'reputation'|'activity'>('personal');
    const [dashboardData, setDashboardData] = useState<any | null>(null);

    useEffect(() => {
        if (user) {
            apiService.getUserProfile()
                .then(setProfile)
                .catch(() => setError('Failed to load profile data.'))
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if ((activeTab === 'reputation' || activeTab === 'activity') && user) {
            apiService.getMemberDashboardData(user.id)
                .then(setDashboardData)
                .catch(() => setDashboardData(null));
        }
    }, [activeTab, user]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (!profile) return;
        const value = e.target.type === 'number' ? (e.target as HTMLInputElement).valueAsNumber || '' : e.target.value;
        setProfile({ ...profile, [e.target.name]: value } as UserProfile);
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!profile || !user) return;
        setIsSaving(true);
        setError('');
        setSuccess('');
        try {
            await apiService.updateUserProfile(user.id, profile);
            setSuccess('Profile updated successfully!');
        } catch (err) {
            setError('Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setSuccess(''), 3000);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!user || !e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        setUploading(true);
        try {
            const res = await apiService.uploadAvatar(user.id, file);
            if (profile) setProfile({ ...profile, avatar_url: res.avatar_url } as UserProfile);
            await refreshUserProfile();
            setSuccess('Avatar uploaded');
            setTimeout(() => setSuccess(''), 2000);
        } catch (err) {
            console.error(err);
            setError('Failed to upload avatar');
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <Spinner />;

    return (
        <div className="max-w-2xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-secondary-900 dark:text-white">Your Profile</h1>
            <Card>
                {profile ? (
                    <div>
                        <div className="mb-4">
                            <nav className="flex space-x-2" aria-label="Profile tabs">
                                <button type="button" className={`px-3 py-2 rounded ${activeTab==='personal' ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-secondary-700'}`} onClick={() => setActiveTab('personal')}>Personal Info</button>
                                <button type="button" className={`px-3 py-2 rounded ${activeTab==='company' ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-secondary-700'}`} onClick={() => setActiveTab('company')}>Company Info</button>
                                <button type="button" className={`px-3 py-2 rounded ${activeTab==='documents' ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-secondary-700'}`} onClick={() => setActiveTab('documents')}>Documents</button>
                                <button type="button" className={`px-3 py-2 rounded ${activeTab==='reputation' ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-secondary-700'}`} onClick={() => setActiveTab('reputation')}>Reputation</button>
                                <button type="button" className={`px-3 py-2 rounded ${activeTab==='activity' ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-secondary-700'}`} onClick={() => setActiveTab('activity')}>Activity</button>
                            </nav>
                        </div>

                        {activeTab === 'personal' && (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/50 p-3 rounded-md">{error}</p>}
                                {success && <p className="text-sm text-green-600 bg-green-100 dark:bg-green-900/50 p-3 rounded-md">{success}</p>}

                                <Input id="username" name="username" label="Username" type="text" required value={profile.username} onChange={handleInputChange} />
                                <Input id="email" name="email" label="Email Address" type="email" required value={profile.email} onChange={handleInputChange} />

                                <div className="grid grid-cols-2 gap-4">
                                    <Input id="first_name" name="first_name" label="First name" type="text" value={profile.first_name || ''} onChange={handleInputChange} />
                                    <Input id="last_name" name="last_name" label="Last name" type="text" value={profile.last_name || ''} onChange={handleInputChange} />
                                </div>

                                <Input id="display_name" name="display_name" label="Display name" type="text" value={profile.display_name || ''} onChange={handleInputChange} />

                                <div>
                                    <label htmlFor="bio" className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">Bio (Optional)</label>
                                    <div className="mt-1">
                                        <textarea id="bio" name="bio" rows={3} className="appearance-none block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm placeholder-secondary-400 dark:placeholder-secondary-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100" value={profile.bio || ''} onChange={handleInputChange} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input id="phone" name="phone" label="Phone" type="text" value={profile.phone || ''} onChange={handleInputChange} />
                                    <Input id="website" name="website" label="Website" type="text" value={profile.website || ''} onChange={handleInputChange} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input id="address_line1" name="address_line1" label="Address line 1" type="text" value={profile.address_line1 || ''} onChange={handleInputChange} />
                                    <Input id="address_line2" name="address_line2" label="Address line 2" type="text" value={profile.address_line2 || ''} onChange={handleInputChange} />
                                    <Input id="city" name="city" label="City" type="text" value={profile.city || ''} onChange={handleInputChange} />
                                    <Input id="state" name="state" label="State" type="text" value={profile.state || ''} onChange={handleInputChange} />
                                    <Input id="postal_code" name="postal_code" label="Postal Code" type="text" value={profile.postal_code || ''} onChange={handleInputChange} />
                                    <Input id="country" name="country" label="Country" type="text" value={profile.country || ''} onChange={handleInputChange} />
                                </div>

                                {profile.avatar_url ? (
                                    <div className="flex items-center space-x-4">
                                        <img src={profile.avatar_url} alt="Avatar" className="w-20 h-20 rounded-full object-cover" />
                                        <div>
                                            <p className="text-sm text-secondary-700 dark:text-secondary-300">Your current avatar</p>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">Upload Avatar</label>
                                    <input id="avatar" aria-label="Upload avatar" type="file" accept="image/*" onChange={handleAvatarChange} />
                                    {uploading ? <p className="text-sm">Uploading...</p> : null}
                                </div>

                                <div className="pt-2">
                                    <Button type="submit" isLoading={isSaving}>Save Changes</Button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'company' && (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <h3 className="text-lg font-medium">Company Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input id="company_name" name="company_name" label="Company" type="text" value={profile.company_name || ''} onChange={handleInputChange} />
                                    <Input id="industry" name="industry" label="Industry" type="text" value={profile.industry || ''} onChange={handleInputChange} />
                                    <Input id="role_title" name="role_title" label="Role / Title" type="text" value={profile.role_title || ''} onChange={handleInputChange} />
                                    <Input id="team_size" name="team_size" label="Team size" type="text" value={profile.team_size || ''} onChange={handleInputChange} />
                                    <Input id="annual_revenue" name="annual_revenue" label="Annual revenue" type="text" value={profile.annual_revenue || ''} onChange={handleInputChange} />
                                    <Input id="website_company" name="website" label="Company website" type="text" value={profile.website || ''} onChange={handleInputChange} />
                                </div>
                                <div className="pt-2">
                                    <Button type="submit" isLoading={isSaving}>Save Company Info</Button>
                                </div>
                            </form>
                        )}

                        {activeTab === 'documents' && (
                            <div>
                                <h3 className="text-lg font-medium">Documents</h3>
                                <p className="text-sm text-secondary-700 dark:text-secondary-300">Document management is available in the web profile. You can upload identity and business documents there. Avatar uploads are supported above.</p>
                                <div className="mt-4">
                                    <label className="block text-sm font-medium">Upload a document</label>
                                    <input type="file" accept="application/pdf,image/*" aria-label="Upload document" />
                                    <p className="text-xs text-secondary-500 mt-2">Supported: PDF, JPG, PNG, DOC. Use web profile for full document management.</p>
                                </div>
                            </div>
                        )}

                        {activeTab === 'reputation' && (
                            <div>
                                <h3 className="text-lg font-medium">Reputation</h3>
                                {dashboardData ? (
                                    <div className="mt-3 space-y-3">
                                        <div>
                                            <div className="text-sm text-secondary-700 dark:text-secondary-300">Overall Reputation Score</div>
                                            <div className="text-2xl font-semibold">{dashboardData.reputation?.overallScore ?? '—'}</div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <div className="text-sm text-secondary-700 dark:text-secondary-300">Reliability</div>
                                                <div className="text-lg">{dashboardData.reputation?.reliability ?? '—'}%</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-secondary-700 dark:text-secondary-300">Participation</div>
                                                <div className="text-lg">{dashboardData.reputation?.participation ?? '—'}%</div>
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="font-medium">Top Members</h4>
                                            {dashboardData.reputation?.topMembers && dashboardData.reputation.topMembers.length ? (
                                                <ul className="mt-2 space-y-2">
                                                    {dashboardData.reputation.topMembers.map((m: any) => (
                                                        <li key={m.id} className="flex justify-between p-2 border rounded bg-white dark:bg-secondary-800">
                                                            <div className="text-sm">{m.displayName}</div>
                                                            <div className="text-sm font-semibold">{m.totalInvested}</div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-secondary-700 dark:text-secondary-300">No top members data available.</p>
                                            )}
                                        </div>

                                        <div>
                                            <h4 className="font-medium">Group Stats</h4>
                                            <p className="text-sm">Total Members: {dashboardData.groupStats?.totalMembers ?? '—'}</p>
                                            <p className="text-sm">Total Invested: {dashboardData.groupStats?.totalInvested ?? '—'}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-secondary-700 dark:text-secondary-300">Reputation details are not available right now.</p>
                                )}
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div>
                                <h3 className="text-lg font-medium">Recent Activity</h3>
                                {dashboardData && Array.isArray(dashboardData.transactions) && dashboardData.transactions.length ? (
                                    <ul className="mt-3 space-y-2">
                                        {dashboardData.transactions.map((tx: any) => (
                                            <li key={tx.id} className="p-3 border rounded bg-white dark:bg-secondary-800">
                                                <div className="flex justify-between">
                                                    <div>
                                                        <div className="text-sm font-medium">{tx.status}</div>
                                                        <div className="text-xs text-secondary-600">{tx.date}</div>
                                                    </div>
                                                    <div className="text-sm font-semibold">{tx.amount}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-secondary-700 dark:text-secondary-300">No recent activity available.</p>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <p>Could not load your profile information.</p>
                )}
            </Card>
        </div>
    );
};

export default ProfileScreen;
