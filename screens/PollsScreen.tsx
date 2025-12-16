
import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiService } from '../services/apiService';
import { Poll } from '../types';
import Button from '../components/Button';
import Card from '../components/Card';
import Spinner from '../components/Spinner';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const PollsScreen: React.FC = () => {
    const [polls, setPolls] = useState<Poll[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);

    useEffect(() => {
        apiService.getPolls().then(data => {
            setPolls(data);
            setLoading(false);
        });
    }, []);

    const handleVote = (pollId: number) => {
        if (selectedOption === null) return;
        
        apiService.submitVote(pollId, selectedOption).then(updatedPoll => {
            setPolls(prevPolls => prevPolls.map(p => p.id === updatedPoll.id ? updatedPoll : p));
        });
    };

    if (loading) return <Spinner />;
    if (polls.length === 0) return <Card title="Polls"><p>No active polls.</p></Card>;

    const poll = polls[0]; // Assuming one poll for simplicity
    const chartData = poll.options.map(opt => ({ name: opt.text, value: opt.votes }));

    return (
        <Card title="Community Polls">
            <h4 className="font-semibold mb-4">{poll.question}</h4>
            
            <div className="md:flex md:space-x-4">
                <div className="md:w-1/2">
                    <div className="space-y-2">
                        {poll.options.map(option => (
                            <label key={option.id} className="flex items-center p-2 rounded-md hover:bg-secondary-100 dark:hover:bg-secondary-800">
                                <input 
                                    type="radio" 
                                    name={`poll-${poll.id}`} 
                                    value={option.id} 
                                    onChange={() => setSelectedOption(option.id)}
                                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-secondary-300"
                                />
                                <span className="ml-3 text-sm">{option.text}</span>
                            </label>
                        ))}
                    </div>
                    <Button onClick={() => handleVote(poll.id)} disabled={selectedOption === null} className="mt-4">
                        Vote
                    </Button>
                </div>
                
                <div className="md:w-1/2 mt-6 md:mt-0">
                    <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                                    {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </Card>
    );
};

export default PollsScreen;
