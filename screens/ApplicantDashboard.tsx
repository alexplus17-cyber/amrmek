
import React, { useState, useEffect } from 'react';
import { Application, ApplicationStatus } from '../types';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/apiService';
import Card from '../components/Card';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import ApplicationForm from './ApplicationForm';

const StatusBadge: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
    const colorClasses = {
        [ApplicationStatus.PENDING]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        [ApplicationStatus.APPROVED]: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        [ApplicationStatus.REJECTED]: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        [ApplicationStatus.IN_PROGRESS]: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    };
    return (
        <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full ${colorClasses[status]}`}>
            {status}
        </span>
    );
};


const ApplicantDashboard: React.FC = () => {
    const { user } = useAuth();
    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [isApplying, setIsApplying] = useState(false);

    useEffect(() => {
        if (user) {
            apiService.getApplicationStatus(user.id).then(data => {
                setApplication(data);
                if(data.status !== ApplicationStatus.IN_PROGRESS) {
                     setIsApplying(false)
                } else {
                     setIsApplying(true)
                }
            }).finally(() => setLoading(false));
        }
    }, [user]);

    if (loading) return <Spinner />;
    if (!application) return <p>Could not load application data.</p>;
    
    if (isApplying || application.status === ApplicationStatus.IN_PROGRESS) {
        return <ApplicationForm onComplete={() => setIsApplying(false)} />;
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6 text-secondary-900 dark:text-white">Your Application</h1>
            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                    <div>
                        <h2 className="text-xl font-bold">Application Status</h2>
                        <p className="text-secondary-500 dark:text-secondary-400 mt-1">Submitted on: {application.submittedDate}</p>
                    </div>
                    <div className="mt-4 sm:mt-0">
                       <StatusBadge status={application.status} />
                    </div>
                </div>
                <div className="mt-6 border-t border-secondary-200 dark:border-secondary-700 pt-6">
                   {application.status === ApplicationStatus.PENDING && (
                     <p>Your application is under review. We will notify you once a decision has been made. Thank you for your patience.</p>
                   )}
                   {application.status === ApplicationStatus.APPROVED && (
                     <p className="text-green-600 dark:text-green-400">Congratulations! Your application has been approved. Please log out and log back in to access the member dashboard.</p>
                   )}
                   {application.status === ApplicationStatus.REJECTED && (
                     <p className="text-red-600 dark:text-red-400">We regret to inform you that your application was not successful at this time. You may be eligible to re-apply in the future.</p>
                   )}
                   {(application.status !== ApplicationStatus.PENDING && application.status !== ApplicationStatus.APPROVED) && (
                     <div className="text-center">
                        <p className="mb-4">Welcome! Start your application to join the Investor Network.</p>
                        <Button onClick={() => setIsApplying(true)} className="max-w-xs mx-auto">Start Application</Button>
                    </div>
                   )}
                </div>
            </Card>
        </div>
    );
};

export default ApplicantDashboard;
