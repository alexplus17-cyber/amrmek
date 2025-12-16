
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Announcement } from '../types';
import Card from '../components/Card';
import Spinner from '../components/Spinner';

const AnnouncementsScreen: React.FC = () => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        apiService.getAnnouncements().then(data => {
            setAnnouncements(data);
            setLoading(false);
        });
    }, []);

    if (loading) return <Spinner />;

    return (
        <Card title="Announcements">
            <ul className="divide-y divide-secondary-200 dark:divide-secondary-700">
                {announcements.map(item => (
                    <li key={item.id} className="py-4">
                        <h4 className="font-semibold">{item.title}</h4>
                        <p className="text-sm text-secondary-500 dark:text-secondary-400 mb-1">{item.date}</p>
                        <p className="text-sm">{item.content}</p>
                    </li>
                ))}
            </ul>
        </Card>
    );
};

export default AnnouncementsScreen;
