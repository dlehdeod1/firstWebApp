import { Outlet, Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Menu, X, Rocket, Calendar, Trophy, User, Star, Moon, Sun } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

export default function MainLayout() {
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const location = useLocation()
    const { theme, actualTheme, setTheme } = useTheme()

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
        { name: '명예의 전당', path: '/hall-of-fame', icon: Star },
        { name: '내 정보', path: '/me', icon: User },
    ]

    const toggleTheme = () => {
        if (theme === 'light') setTheme('dark')
        else if (theme === 'dark') setTheme('system')
        else setTheme('light')
    }

    // Admin only items preserved for future logic if needed
    // const adminItems = [ ... ]

    return (
        <div className={cn("min-h-screen font-sans selection:bg-blue-100 selection:text-blue-900 transition-colors duration-300",
            actualTheme === 'dark' ? "bg-slate-900 text-slate-100" : "bg-slate-50 text-slate-900"
        )}>
            {/* Navbar */}
            <nav
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
                    actualTheme === 'dark' ? (
                        scrolled
                            ? "bg-slate-800/90 backdrop-blur-md border-slate-700 shadow-sm py-3"
                            : "bg-transparent border-transparent py-5"
                    ) : (
                        scrolled
                            ? "bg-white/80 backdrop-blur-md border-slate-200 shadow-sm py-3"
                            : "bg-transparent border-transparent py-5"
                    )
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
                        <div className={cn(
                            "hidden md:flex items-center gap-1 backdrop-blur-sm px-2 py-1.5 rounded-full border shadow-sm",
                            actualTheme === 'dark'
                                ? "bg-slate-800/50 border-slate-700/60"
                                : "bg-white/50 border-slate-200/60"
                        )}>
                            {navItems.map((item) => {
                                const Icon = item.icon
                                const isActive = location.pathname === item.path
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                            actualTheme === 'dark' ? (
                                                isActive
                                                    ? "bg-blue-600 text-white shadow-md"
                                                    : "text-slate-300 hover:bg-slate-700 hover:text-white"
                                            ) : (
                                                isActive
                                                    ? "bg-slate-900 text-white shadow-md"
                                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                            )
                                        )}
                                    >
                                        <Icon size={16} />
                                        {item.name}
                                    </Link>
                                )
                            })}

                            {/* Player List - visible to all logged-in non-GUEST users */}
                            {localStorage.getItem('auth_token') && localStorage.getItem('user_role') !== 'GUEST' && (
                                <>
                                    <Link
                                        to="/admin/players"
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                            location.pathname === '/admin/players'
                                                ? "bg-blue-600 text-white shadow-md"
                                                : "text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        <User size={16} />
                                        선수명단
                                    </Link>
                                    <Link
                                        to="/ratings"
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                                            location.pathname === '/ratings'
                                                ? "bg-amber-500 text-white shadow-md"
                                                : "text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        <Star size={16} />
                                        능력치평가
                                    </Link>
                                </>
                            )}

                            {/* Dark Mode Toggle */}
                            <button
                                onClick={toggleTheme}
                                className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                                title={theme === 'light' ? '다크모드' : theme === 'dark' ? '시스템' : '라이트모드'}
                            >
                                {actualTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                            </button>
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            className={cn(
                                "md:hidden p-2 transition-colors",
                                actualTheme === 'dark' ? "text-slate-300" : "text-slate-600"
                            )}
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        >
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu Overlay */}
                {mobileMenuOpen && (
                    <div className={cn(
                        "md:hidden absolute top-full left-0 right-0 border-b shadow-xl p-4 flex flex-col gap-2",
                        actualTheme === 'dark'
                            ? "bg-slate-800 border-slate-700"
                            : "bg-white border-slate-100"
                    )}>
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                onClick={() => setMobileMenuOpen(false)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-lg font-medium transition-colors",
                                    actualTheme === 'dark'
                                        ? "text-slate-200 hover:bg-slate-700"
                                        : "text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                <item.icon size={20} />
                                {item.name}
                            </Link>
                        ))}
                        <div className={cn(
                            "h-px my-2",
                            actualTheme === 'dark' ? "bg-slate-700" : "bg-slate-100"
                        )} />
                        <Link
                            to="/sessions/new"
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                                "p-3 text-sm block transition-colors",
                                actualTheme === 'dark'
                                    ? "text-slate-400 hover:text-blue-400"
                                    : "text-slate-500 hover:text-blue-600"
                            )}
                        >
                            세션 관리 (Admin)
                        </Link>
                        <Link
                            to="/admin/players"
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                                "p-3 text-sm block transition-colors",
                                actualTheme === 'dark'
                                    ? "text-slate-400 hover:text-blue-400"
                                    : "text-slate-500 hover:text-blue-600"
                            )}
                        >
                            선수명단
                        </Link>
                        <Link
                            to="/ratings"
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                                "p-3 text-sm block transition-colors",
                                actualTheme === 'dark'
                                    ? "text-amber-400 hover:text-amber-300"
                                    : "text-amber-500 hover:text-amber-600"
                            )}
                        >
                            ⭐ 능력치평가
                        </Link>
                    </div>
                )}
            </nav>

            {/* Main Content Info */}
            <main className="pt-24 pb-20 px-4 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
                <Outlet />
            </main>

            {/* Footer */}
            <footer className={cn(
                "border-t py-8 mt-auto transition-colors",
                actualTheme === 'dark'
                    ? "bg-slate-800 border-slate-700"
                    : "bg-white border-slate-100"
            )}>
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className={cn(
                        "text-sm mb-4",
                        actualTheme === 'dark' ? "text-slate-400" : "text-slate-400"
                    )}>© 2025 Corner Kicks ⚽</p>
                    {localStorage.getItem('auth_token') ? (
                        <button
                            onClick={() => {
                                localStorage.clear()
                                window.location.href = '/'
                            }}
                            className="text-xs text-red-500 underline font-medium hover:text-red-600"
                        >
                            로그아웃
                        </button>
                    ) : (
                        <Link
                            to="/login"
                            className={cn(
                                "text-xs underline",
                                actualTheme === 'dark'
                                    ? "text-slate-400 hover:text-slate-300"
                                    : "text-slate-300 hover:text-slate-500"
                            )}
                        >
                            로그인
                        </Link>
                    )}
                </div>
            </footer>
        </div>
    )
}
