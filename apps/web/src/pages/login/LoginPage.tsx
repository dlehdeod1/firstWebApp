import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'

export default function LoginPage() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        // Admin Demo backdoor (Optional: keep or remove. I'll remove to test real flow, 
        // or keep for 'demo_admin_token' specifically?
        // User asked to "switch auth". Assuming full switch.
        // But for Admin access, I might still need the demo?
        // Actually I can just create an admin user with username 'admin'.
        // Let's implement real API call.

        try {
            const res = await fetch('http://localhost:8787/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            })

            const data = await res.json()

            if (res.ok) {
                localStorage.setItem('auth_token', data.token)
                localStorage.setItem('user_role', data.user.role)
                localStorage.setItem('user_username', data.user.username)

                // Keep email just in case specific logic uses it, but set it optional
                if (data.user.email) localStorage.setItem('user_email', data.user.email)

                navigate('/')
                window.location.reload()
            } else {
                setError(data.error || '로그인 실패')
            }
        } catch (err) {
            console.error(err)
            setError('서버 연결 오류')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/30">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">로그인</h1>
                    <p className="text-slate-500 mt-2">아이디로 로그인하세요.</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">아이디 (ID)</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="user_id"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">비밀번호</label>
                        <input
                            type="password"
                            className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        로그인
                    </button>

                    <div className="text-center mt-4">
                        <span className="text-slate-500 text-sm">계정이 없으신가요? </span>
                        <a href="/signup" className="text-blue-600 font-bold text-sm hover:underline">회원가입</a>
                    </div>
                </form>

                <div className="mt-6 text-center text-sm text-slate-400">
                    * 데모 계정: admin@wedfc.com / admin123
                </div>
            </div>
        </div>
    )
}
