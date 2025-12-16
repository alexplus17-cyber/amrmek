import React from 'react';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error | null;
}

class ErrorBoundary extends React.Component<Props, State> {
    public state: State = { hasError: false, error: null };
    private readonly propsRef: Props;

    constructor(props: Props) {
        super(props);
        this.propsRef = props;
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: any) {
        // Optionally log to an external service
        // console.error('ErrorBoundary caught error', error, info);
    }

    render() {
        if (this.state.hasError) {
            if (this.propsRef.fallback) return <>{this.propsRef.fallback}</>;
            return (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-md">
                    <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">An error occurred</h3>
                    <p className="text-sm text-red-600 dark:text-red-200">Something went wrong while rendering this section.</p>
                </div>
            );
        }
        return this.propsRef.children as React.ReactElement;
    }
}

export default ErrorBoundary;
