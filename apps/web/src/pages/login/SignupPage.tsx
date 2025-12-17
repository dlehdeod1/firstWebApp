import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

export default function SignupPage() {
    const navigate = useNavigate()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [email, setEmail] = useState('') // Optional

    // Profile Fields
    const [phone, setPhone] = useState('')
    const [birthDate, setBirthDate] = useState('')
    const [height, setHeight] = useState('')
    const [weight, setWeight] = useState('')
    const [agreed, setAgreed] = useState(false)

    // Calculated Age
    const [age, setAge] = useState<number | null>(null)

    useEffect(() => {
        if (birthDate) {
            const birthYear = new Date(birthDate).getFullYear()
            const currentYear = new Date().getFullYear()
            if (!isNaN(birthYear)) {
                setAge(currentYear - birthYear) // International Age by Year
            } else {
                setAge(null)
            }
        } else {
            setAge(null)
        }
    }, [birthDate])

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!agreed) return alert('개인정보 수집 및 이용에 동의해주세요.')
        if (!username || !password) return alert('아이디와 비밀번호를 입력해주세요.')
        if (!birthDate) return alert('생년월일을 입력해주세요.')

        // Phone Validation (if provided)
        if (phone) {
            const cleanPhone = phone.replace(/-/g, '')
            if (cleanPhone.length < 10 || cleanPhone.length > 11) {
                return alert('올바른 휴대폰 번호를 입력해주세요.')
            }
        }

        // Username Validation (Simple)
        if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
            return alert('아이디는 영문, 숫자, 밑줄(_) 4~20자여야 합니다.')
        }

        try {
            const res = await fetch('http://localhost:8787/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email: email || null,
                    password,
                    phone: phone.replace(/-/g, '') || null, // Clean phone or null
                    birth_date: birthDate,
                    height_cm: height ? Number(height) : null,
                    weight_kg: weight ? Number(weight) : null
                })
            })

            const data = await res.json()
            if (res.ok) {
                // Auto Login
                localStorage.setItem('auth_token', data.token)
                localStorage.setItem('user_username', data.user.username)
                localStorage.setItem('user_role', data.user.role)
                alert('회원가입이 완료되었습니다.')
                navigate('/me')
                window.location.reload()
            } else {
                alert(data.error || '회원가입 실패')
            }
        } catch (err) {
            console.error(err)
            alert('오류 발생')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/30">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">회원가입</h1>
                    <p className="text-slate-500 mt-2">Wednesday FC 멤버가 되어보세요.</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    {/* Auth Info */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">아이디 (ID)</label>
                        <input
                            type="text"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="user_id"
                            value={username}
                            onChange={e => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">비밀번호</label>
                        <input
                            type="password"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">이메일 <span className="text-slate-400 font-normal">(선택)</span></label>
                        <input
                            type="email"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="example@wedfc.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="h-px bg-slate-100 my-4" />

                    {/* Profile Info */}
                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">프로필 정보</p>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">연락처 <span className="text-slate-400 font-normal">(선택)</span></label>
                        <input
                            type="tel"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="010-1234-5678"
                            value={phone}
                            onChange={e => {
                                // Auto-format hyphen could be added here
                                setPhone(e.target.value)
                            }}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">생년월일</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={birthDate}
                                onChange={e => setBirthDate(e.target.value)}
                                required
                            />
                            <div className="min-w-[80px] flex items-center justify-center bg-slate-100 rounded-xl text-sm font-bold text-slate-600">
                                {age !== null ? `${age}세` : '-'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">키 (cm)</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="175"
                                value={height}
                                onChange={e => setHeight(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">몸무게 (kg)</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="70"
                                value={weight}
                                onChange={e => setWeight(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl">
                        <p className="text-xs text-blue-800 mb-2 font-medium">
                            * 키, 몸무게, 나이는 피지컬 수치 객관화를 위한 참고 정보입니다.
                        </p>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                checked={agreed}
                                onChange={e => setAgreed(e.target.checked)}
                            />
                            <span className="text-sm text-slate-700">
                                <span className="font-bold text-red-500">(필수)</span> 프로필 정보 및 연락처(선택 입력) 수집/이용에 동의합니다.
                            </span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={!agreed}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        가입완료
                    </button>
                </form>

                <div className="mt-6 text-center text-sm font-medium text-slate-500">
                    이미 계정이 있으신가요? <Link to="/login" className="text-blue-600 hover:underline">로그인</Link>
                </div>
            </div>
        </div>
    )
}
