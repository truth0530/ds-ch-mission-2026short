import React from 'react';

export default function Footer() {
    return (
        <footer className="w-full bg-white border-t border-slate-200 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="text-center md:text-left">
                    <p className="text-sm text-slate-500">
                        &copy; 2026 Short-Term Mission Team. All rights reserved.
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                        Designed for easy feedback and growth.
                    </p>
                </div>
                <div className="flex gap-6 text-sm text-slate-400">
                    <a href="#" className="hover:text-indigo-600 transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-indigo-600 transition-colors">Terms of Service</a>
                </div>
            </div>
        </footer>
    );
}
