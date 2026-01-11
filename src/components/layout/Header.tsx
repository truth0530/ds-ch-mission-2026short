import React from 'react';

export default function Header() {
    return (
        <header className="sticky top-0 z-30 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                <div className="flex items-center">
                    <img src="/images/logo_green.png" alt="Mission Survey" className="h-10 w-auto" />
                </div>
                <nav className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
                    <a href="#" className="hover:text-indigo-600 transition-colors">Home</a>
                    <a href="#" className="hover:text-indigo-600 transition-colors">About</a>
                    <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
                </nav>
            </div>
        </header>
    );
}
