
import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    isLoading?: boolean;
    variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ children, isLoading = false, variant = 'primary', className = '', ...props }) => {
    const baseClasses = "w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors";
    const variantClasses = variant === 'primary' 
        ? "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500"
        : "bg-secondary-600 hover:bg-secondary-700 focus:ring-secondary-500";
    
    return (
        <button
            className={`${baseClasses} ${variantClasses} ${className}`}
            disabled={isLoading}
            {...props}
        >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
                children
            )}
        </button>
    );
};

export default Button;
