'use client';

interface AdminErrorAlertProps {
    error: string | null;
    onDismiss?: () => void;
}

export function AdminErrorAlert({ error, onDismiss }: AdminErrorAlertProps) {
    if (!error) return null;

    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center justify-between" role="alert">
            <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
            </div>
            {onDismiss && (
                <button
                    onClick={onDismiss}
                    className="text-red-400 hover:text-red-600 p-1"
                    aria-label="오류 메시지 닫기"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
        </div>
    );
}
