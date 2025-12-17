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

        if (!agreed) return alert('ê°œì¸?•ë³´ ?˜ì§‘ ë°??´ìš©???™ì˜?´ì£¼?¸ìš”.')
        if (!username || !password) return alert('?„ì´?”ì? ë¹„ë?ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.')
        if (!birthDate) return alert('?ë…„?”ì¼???…ë ¥?´ì£¼?¸ìš”.')

        // Phone Validation (if provided)
        if (phone) {
            const cleanPhone = phone.replace(/-/g, '')
            if (cleanPhone.length < 10 || cleanPhone.length > 11) {
                return alert('?¬ë°”ë¥??´ë???ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”.')
            }
        }

        // Username Validation (Simple)
        if (!/^[a-zA-Z0-9_]{4,20}$/.test(username)) {
            return alert('?„ì´?”ëŠ” ?ë¬¸, ?«ì, ë°‘ì¤„(_) 4~20?ì—¬???©ë‹ˆ??')
        }

        try {
            const res = await fetch('${API_URL}/auth/signup', {
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
                alert('?Œì›ê°€?…ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??')
                navigate('/me')
                window.location.reload()
            } else {
                alert(data.error || '?Œì›ê°€???¤íŒ¨')
            }
        } catch (err) {
            console.error(err)
            alert('?¤ë¥˜ ë°œìƒ')
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-blue-500/30">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">?Œì›ê°€??/h1>
                    <p className="text-slate-500 mt-2">Wednesday FC ë©¤ë²„ê°€ ?˜ì–´ë³´ì„¸??</p>
                </div>

                <form onSubmit={handleSignup} className="space-y-4">
                    {/* Auth Info */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">?„ì´??(ID)</label>
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
                        <label className="block text-sm font-bold text-slate-700 mb-1">ë¹„ë?ë²ˆí˜¸</label>
                        <input
                            type="password"
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="?¢â€¢â€¢â€¢â€¢â€¢â€¢â€?
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">?´ë©”??<span className="text-slate-400 font-normal">(? íƒ)</span></label>
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
                    <p className="text-xs text-slate-400 font-bold uppercase mb-2">?„ë¡œ???•ë³´</p>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">?°ë½ì²?<span className="text-slate-400 font-normal">(? íƒ)</span></label>
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
                        <label className="block text-sm font-bold text-slate-700 mb-1">?ë…„?”ì¼</label>
                        <div className="flex gap-2">
                            <input
                                type="date"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                value={birthDate}
                                onChange={e => setBirthDate(e.target.value)}
                                required
                            />
                            <div className="min-w-[80px] flex items-center justify-center bg-slate-100 rounded-xl text-sm font-bold text-slate-600">
                                {age !== null ? `${age}?? : '-'}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">??(cm)</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="175"
                                value={height}
                                onChange={e => setHeight(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">ëª¸ë¬´ê²?(kg)</label>
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
                            * ?? ëª¸ë¬´ê²? ?˜ì´???¼ì?ì»??˜ì¹˜ ê°ê??”ë? ?„í•œ ì°¸ê³  ?•ë³´?…ë‹ˆ??
                        </p>
                        <label className="flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                checked={agreed}
                                onChange={e => setAgreed(e.target.checked)}
                            />
                            <span className="text-sm text-slate-700">
                                <span className="font-bold text-red-500">(?„ìˆ˜)</span> ?„ë¡œ???•ë³´ ë°??°ë½ì²?? íƒ ?…ë ¥) ?˜ì§‘/?´ìš©???™ì˜?©ë‹ˆ??
                            </span>
                        </label>
                    </div>

                    <button
                        type="submit"
                        disabled={!agreed}
                        className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        ê°€?…ì™„ë£?
                    </button>
                </form>

                <div className="mt-6 text-center text-sm font-medium text-slate-500">
                    ?´ë? ê³„ì •???ˆìœ¼? ê??? <Link to="/login" className="text-blue-600 hover:underline">ë¡œê·¸??/Link>
                </div>
            </div>
        </div>
    )
}


