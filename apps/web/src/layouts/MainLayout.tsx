import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Menu, X, Rocket, Calendar, Trophy, User } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function MainLayout() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const location = useLocation()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 10)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const navItems = [
        { name: '대시보드', path: '/', icon: Rocket },
        { name: '일정/참석', path: '/sessions', icon: Calendar },
        { name: '랭킹', path: '/rankings', icon: Trophy },
        { name: '내 정보', path: '/me', icon: User },
    ]

    // Admin only items preserved for future logic if needed
    // const adminItems = [ ... ]

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
            {/* Navbar */}
            <nav
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                    scrolled
                        ? "bg-white/80 backdrop-blur-md border-slate-200 shadow-sm py-3"
                        : "bg-transparent border-transparent py-5"
                )}
            >
                <div className="max-w-7xl mx-auto px-4 md:px-6">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <Link to="/" className="flex items-center gap-1.5 group">
                            <span className="text-xl font-black tracking-tight">
                                <span className="text-emerald-600">Corner</span>
                                <span className="text-amber-500">K</span>
                                <span className="text-blue-500">i</span>
                                <span className="text-emerald-600">cks</span>
                            </span>
                            <span className="text-lg">⚽</span>
                        </Link>

                        {/* Desktop Menu */}
                        <div className="hidden md:flex items-center gap-1 bg-white/50 backdrop-blur-sm px-2 py-1.5 rounded-full border border-slate-200/60 shadow-sm">
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = location.pathname === item.path
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-slate-900 text-white shadow-md"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                        )}
                                    >
                                        <Icon size={16} />
                                        {item.name}
                                    </Link>
                                )
                            })}

                            {/* Admin Links */}
                            {['ADMIN', 'OWNER', 'admin', 'owner'].includes(localStorage.getItem('user_role') || '') && (
                                <Link
                                    to="/admin/players"
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                        location.pathname === '/admin/players'
                                            ? "bg-blue-600 text-white shadow-md"
                                            : "text-blue-600 hover:bg-blue-50"
                                    )}
                                >
                                    <User size={16} />
                                    선수관리
                                </Link>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-slate-600"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                {mobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 right-0 bg-white border-b border-slate-100 shadow-xl p-4 flex flex-col gap-2">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 text-slate-700 font-medium"
                            >
                                <item.icon size={20} />
                                {item.name}
                            </Link>
                        ))}
                        <div className="h-px bg-slate-100 my-2" />
                        <Link
                            to="/sessions/new"
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-3 text-sm text-slate-500 hover:text-blue-600 block"
                        >
                            세션 관리 (Admin)
                        </Link>
                        <Link
                            to="/admin/players"
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-3 text-sm text-slate-500 hover:text-blue-600 block"
                        >
                            선수 관리 (Admin)
                        </Link>
                    </div>
                )}
            </nav>

            {/* Main Content Info */}
            <main className="pt-24 pb-20 px-4 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-100 py-8 mt-auto">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-slate-400 text-sm mb-4">© 2025 Corner Kicks ⚽</p>
                    {localStorage.getItem('auth_token') ? (
                        <button
                            onClick={() => {
                                localStorage.clear()
                                window.location.href = '/'
                            }}
                            className="text-xs text-red-500 underline font-medium"
                        >
                            관리자 로그아웃
                        </button>
                    ) : (
                        <Link to="/login" className="text-xs text-slate-300 hover:text-slate-500 underline">
                            관리자 로그인
                        </Link>
                    )}
                </div>
            </footer>
        </div>
    )
}
