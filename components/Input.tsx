
import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    id: string;
}

const Input: React.FC<InputProps> = ({ label, id, ...props }) => {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-secondary-700 dark:text-secondary-300">
                {label}
            </label>
            <div className="mt-1">
                <input
                    id={id}
                    className="appearance-none block w-full px-3 py-2 border border-secondary-300 dark:border-secondary-600 rounded-md shadow-sm placeholder-secondary-400 dark:placeholder-secondary-500 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm bg-white dark:bg-secondary-800 text-secondary-900 dark:text-secondary-100"
                    {...props}
                />
            </div>
        </div>
    );
};

export default Input;
