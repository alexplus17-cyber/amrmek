
import React, { useState, useEffect } from 'react';
import Card from '../components/Card';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { apiService } from '../services/apiService';
import { Application, ApplicationStatus } from '../types';

const AdminDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState('applications');

    const renderContent = () => {
        switch (activeTab) {
            case 'applications':
                return <ManageApplications />;
            case 'members':
                return <Card title="Manage Members"><p>Member management interface goes here.</p></Card>;
            case 'quizzes':
                return <Card title="Manage Quizzes"><p>Quiz creation and editing interface goes here.</p></Card>;
            case 'announcements':
                return <Card title="Post Announcement"><p>Announcement posting interface goes here.</p></Card>;
            default:
                return null;
        }
    };

    const TabButton: React.FC<{tabKey: string, children: React.ReactNode}> = ({tabKey, children}) => {
        const isActive = activeTab === tabKey;
        return (
            <button 
                onClick={() => setActiveTab(tabKey)}
                className={`px-4 py-2 text-sm font-medium rounded-md ${isActive ? 'bg-primary-600 text-white' : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-700'}`}
            >
                {children}
            </button>
        )
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white">Admin Dashboard</h1>
            <div className="flex space-x-2 border-b border-secondary-200 dark:border-secondary-700 pb-2">
                <TabButton tabKey="applications">Applications</TabButton>
                <TabButton tabKey="members">Members</TabButton>
                <TabButton tabKey="quizzes">Quizzes</TabButton>
                <TabButton tabKey="announcements">Announcements</TabButton>
            </div>
            <div>
                {renderContent()}
            </div>
        </div>
    );
};

const ManageApplications: React.FC = () => {
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiService.getAllApplications().then(data => {
            setApplications(data);
            setLoading(false);
        });
    }, []);
    
    const handleUpdateStatus = (id: number, status: ApplicationStatus) => {
        setApplications(apps => apps.map(app => app.id === id ? {...app, status: status} : app));
        apiService.updateApplicationStatus(id, status)
            .catch(() => alert("Failed to update status. Please try again."));
    }

    if (loading) return <Spinner />;

    return (
        <Card title="Manage Applications">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-secondary-200 dark:divide-secondary-700">
                    <thead className="bg-secondary-50 dark:bg-secondary-800">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Applicant</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-secondary-900 divide-y divide-secondary-200 dark:divide-secondary-700">
                        {applications.map(app => (
                            <tr key={app.id}>
                                <td className="px-6 py-4 whitespace-nowrap">{app.username}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{app.submittedDate}</td>
                                <td className="px-6 py-4 whitespace-nowrap">{app.status}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                                    {app.status === ApplicationStatus.PENDING && (
                                        <>
                                            <button onClick={() => handleUpdateStatus(app.id, ApplicationStatus.APPROVED)} className="text-green-600 hover:text-green-900">Approve</button>
                                            <button onClick={() => handleUpdateStatus(app.id, ApplicationStatus.REJECTED)} className="text-red-600 hover:text-red-900">Reject</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
};

export default AdminDashboard;
