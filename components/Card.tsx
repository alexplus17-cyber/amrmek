
import React from 'react';

// FIX: Extend React.HTMLAttributes<HTMLDivElement> to allow passing standard div props like onClick.
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    title?: string;
    children: React.ReactNode;
    className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '', ...props }) => {
    return (
        <div className={`bg-white dark:bg-secondary-900 rounded-lg shadow-md overflow-hidden ${className}`} {...props}>
            {title && (
                <div className="px-4 py-4 sm:px-6 border-b border-secondary-200 dark:border-secondary-700">
                    <h3 className="text-lg leading-6 font-medium text-secondary-900 dark:text-white">{title}</h3>
                </div>
            )}
            <div className="p-4 sm:p-6">
                {children}
            </div>
        </div>
    );
};

export default Card;
