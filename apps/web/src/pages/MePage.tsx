import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Users, Save, LogOut, Trophy, Award, Heart, Info } from 'lucide-react'
import { Tooltip } from '@/components/ui/Tooltip'

import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface Badge {
    code: string
    name: string
    description: string
}

interface AbilityLog {
    id: number
    stat_type: string
    delta: number
    reason: string
    created_at: string
}

const TOOLTIPS: Record<string, string> = {
    '?ùÏ†ê??: '((?ùÏ†êx2 + ?ÑÏ?) / Í≤ΩÍ∏∞?? * 20 (ÏµúÎ? 100??',
    'Í∏∞Ïó¨??: '?Ä ?πÎ¶¨?Ä Í≥µÍ≤©?¨Ïù∏?∏Î? Ï¢ÖÌï©?òÏó¨ ?∞Ï∂ú??Í∏∞Ïó¨??,
    '?πÎ•†': '?πÎ¶¨ Í≤ΩÍ∏∞ ??/ ?ÑÏ≤¥ Í≤ΩÍ∏∞ ??(Î∞±Î∂Ñ??',
    'Ï∞∏Ïó¨??: '?úÏ¶å Í≤ΩÍ∏∞ Ï∞∏ÏÑù ?üÏàò Í∏∞Î∞ò (?ÅÎ??âÍ?)'
}

interface UserProfile {
    user: {
        id: number
        username: string
        role: string
    }
    profile?: {
        alias: string
        phone: string
        birth_date: string
        height_cm: number
        weight_kg: number
        age?: number
    }
    player?: {
        id: number
        player_code: string
        link_status: 'PENDING' | 'ACTIVE' | 'REJECTED'
    }
    abilities?: {
        curr_attack: number
        curr_playmaker: number
        curr_competitiveness: number
        curr_diligence: number
    }
    records?: {
        matchesPlayed: number
        goals: number
        assists: number
        attackPoints: number
        wins: number
        attendance: number
        totalScore: number
        rank1?: number
        rank2?: number
        rank3?: number
    }
    badges?: Badge[]
    abilityHistory?: AbilityLog[]
}
function PreferenceSection() {
    const [players, setPlayers] = useState<any[]>([])
    const [preferences, setPreferences] = useState<{ targetId: number, rank: number }[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('auth_token')
        if (!token) return

        // Fetch All Players
        fetch('${API_URL}/players', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => setPlayers(Array.isArray(data) ? data : []))

        // Fetch My Preferences
        fetch('${API_URL}/me/preferences', { headers: { 'Authorization': `Bearer ${token}` } })
            .then(res => res.json())
            .then(data => {
                if (data.preferences) setPreferences(data.preferences)
            })
            .finally(() => setLoading(false))
    }, [])

    const handleSelect = (rank: number, targetId: number) => {
        setPreferences(prev => {
            const filtered = prev.filter(p => p.rank !== rank) // Remove existing at this rank
            if (targetId === -1) return filtered // Clear
            return [...filtered, { rank, targetId }]
        })
    }

    const handleSave = async () => {
        const token = localStorage.getItem('auth_token')
        setSaving(true)
        try {
            const res = await fetch('${API_URL}/me/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ preferences })
            })
            if (res.ok) alert('?†Ìò∏ Î©§Î≤ÑÍ∞Ä ?Ä?•Îêò?àÏäµ?àÎã§.')
            else alert('?Ä???§Ìå®')
        } catch (e) {
            alert('?§Î•ò Î∞úÏÉù')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return null

    return (
        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Heart size={18} className="text-pink-500" />
                ?†Ìò∏ Î©§Î≤Ñ ?§Ï†ï (Chemistry)
            </h2>
            <p className="text-xs text-slate-500">
                ?®Íªò ?∞Í≥† ?∂Ï? Î©§Î≤ÑÎ•??†ÌÉù?òÏÑ∏?? ?Ä Íµ¨ÏÑ± ??Í∞ôÏ? ?Ä?????ïÎ•†???íÏïÑÏßëÎãà?? (1ÏßÄÎßùÏùº?òÎ°ù Í∞ïÎ†•?òÍ≤å Î∞òÏòÅ)
            </p>

            <div className="space-y-3">
                {[1, 2, 3].map(rank => {
                    const current = preferences.find(p => p.rank === rank)
                    return (
                        <div key={rank} className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1 ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}`}>
                                {rank}
                            </div>
                            <select
                                className="flex-1 p-2 bg-slate-50 rounded-xl border border-slate-200 text-sm font-medium outline-none"
                                value={current?.targetId || -1}
                                onChange={(e) => handleSelect(rank, Number(e.target.value))}
                            >
                                <option value={-1}>?†ÌÉù ?àÌï®</option>
                                {players.map(p => (
                                    <option key={p.id} value={p.id}>{p.name} ({p.player_code})</option>
                                ))}
                            </select>
                        </div>
                    )
                })}
            </div>

            <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 mt-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 disabled:opacity-50"
            >
                {saving ? '?Ä??Ï§?..' : '?†Ìò∏???Ä??}
            </button>
        </div>
    )
}

export default function MePage() {
    const navigate = useNavigate()
    const [data, setData] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Form State
    const [form, setForm] = useState({
        alias: '',
        phone: '',
        birth_date: '',
        height_cm: '' as string | number,
        weight_kg: '' as string | number
    })

    useEffect(() => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            navigate('/login')
            return
        }

        fetch('${API_URL}/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (res.status === 401) throw new Error('Unauthorized')
                if (!res.ok) throw new Error('Failed to fetch')
                return res.json()
            })
            .then((resData: UserProfile) => {
                setData(resData)
                setForm({
                    alias: resData.profile?.alias || '',
                    phone: resData.profile?.phone || '',
                    birth_date: resData.profile?.birth_date || '', // YYYY-MM-DD
                    height_cm: resData.profile?.height_cm || '',
                    weight_kg: resData.profile?.weight_kg || ''
                })
                // Sync Role immediately
                if (resData.user.role) {
                    localStorage.setItem('user_role', resData.user.role)
                }
            })
            .catch(err => {
                console.error(err)
                localStorage.removeItem('auth_token')
                localStorage.removeItem('user_role')
                localStorage.removeItem('user_email')
                navigate('/login')
            })
            .finally(() => setLoading(false))
    }, [navigate])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        // Validation
        const h = Number(form.height_cm)
        const w = Number(form.weight_kg)

        if (h && (h < 120 || h > 220)) return alert('?§Îäî 120~220cm ?¨Ïù¥?êÏó¨???©Îãà??')
        if (w && (w < 30 || w > 150)) return alert('Î™∏Î¨¥Í≤åÎäî 30~150kg ?¨Ïù¥?¨Ïïº ?©Îãà??')
        if (form.phone && !/^[0-9-]{10,13}$/.test(form.phone)) return alert('?¨Î∞îÎ•??¥Î???Î≤àÌò∏Î•??ÖÎ†•?¥Ï£º?∏Ïöî.')

        setSaving(true)
        try {
            const token = localStorage.getItem('auth_token')
            const res = await fetch('${API_URL}/me', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form)
            })

            if (res.ok) {
                alert('?Ä?•Îêò?àÏäµ?àÎã§.')
                window.location.reload()
            } else {
                const err = await res.json()
                alert(err.error || '?Ä???§Ìå®')
            }
        } catch (e) {
            alert('?§Î•ò Î∞úÏÉù')
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = () => {
        if (!confirm('Î°úÍ∑∏?ÑÏõÉ ?òÏãúÍ≤†Ïäµ?àÍπå?')) return
        localStorage.clear()
        navigate('/login')
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Î°úÎî© Ï§?..</div>

    // Chart Data
    const chartData = data?.abilities ? [
        { subject: '?ùÏ†ê??, A: data.abilities.curr_attack, fullMark: 100 },
        { subject: 'Í∏∞Ïó¨??, A: data.abilities.curr_playmaker, fullMark: 100 },
        { subject: '?πÎ•†', A: data.abilities.curr_competitiveness, fullMark: 100 },
        { subject: 'Ï∞∏Ïó¨??, A: data.abilities.curr_diligence, fullMark: 100 },
    ] : []

    return (
        <div className="max-w-md mx-auto pb-20 p-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
                ÎßàÏù¥ ?òÏù¥ÏßÄ
            </h1>

            <div className="space-y-6">
                {/* 1. Basic Info */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                        {data?.user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div className="font-bold text-lg text-slate-900">{data?.profile?.alias || data?.user.username}</div>
                        <div className="text-sm text-slate-500">@{data?.user.username}</div>
                        <div className="flex gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                                {['owner', 'OWNER'].includes(data?.user.role || '') ? 'Íµ¨Îã®Ï£? : (['admin', 'ADMIN'].includes(data?.user.role || '') ? '?¥ÏòÅÏß? : 'Î©§Î≤Ñ')}
                            </span>
                            {data?.profile?.age && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                    {data.profile.age}??
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Strict State Rendering */}
                {(() => {
                    // Case 1: No Player Linked -> Claim UI
                    if (!data?.player) {
                        return (
                            <div className="bg-slate-800 text-white rounded-2xl p-6 border border-slate-700 shadow-sm">
                                <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <Users size={20} className="text-yellow-400" />
                                    ?†Ïàò ?∞Í≤∞?òÍ∏∞
                                </h2>
                                <p className="text-sm text-slate-300 mb-4">
                                    Íµ¨Îã®?êÏÑú Î∞úÍ∏âÎ∞õÏ? <strong>?†Ïàò ÏΩîÎìú(6?êÎ¶¨)</strong>Î•??ÖÎ†•?òÏó¨ Í≥ÑÏ†ï???∞Í≤∞?òÏÑ∏??
                                </p>
                                <div className="flex gap-2">
                                    <input
                                        className="flex-1 p-3 bg-slate-700 border border-slate-600 rounded-xl focus:ring-2 focus:ring-yellow-400 outline-none text-white font-mono uppercase placeholder:text-slate-500"
                                        placeholder="CODE"
                                        maxLength={6}
                                        id="playerCodeInput"
                                    />
                                    <button
                                        onClick={async () => {
                                            const input = document.getElementById('playerCodeInput') as HTMLInputElement
                                            const code = input.value.toUpperCase()
                                            if (code.length < 6) return alert('ÏΩîÎìúÎ•??ïÏù∏?¥Ï£º?∏Ïöî.')

                                            try {
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch('${API_URL}/me/claim-player', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                    body: JSON.stringify({ playerCode: code })
                                                })
                                                if (res.ok) {
                                                    alert('?∞Í≤∞ ?îÏ≤≠?òÏóà?µÎãà?? Í¥ÄÎ¶¨Ïûê ?πÏù∏??Í∏∞Îã§?§Ï£º?∏Ïöî.')
                                                    window.location.reload()
                                                } else {
                                                    const err = await res.json()
                                                    alert(err.error || '?∞Í≤∞ ?§Ìå®')
                                                }
                                            } catch (e) { alert('?§Î•ò Î∞úÏÉù') }
                                        }}
                                        className="bg-yellow-400 text-slate-900 px-4 rounded-xl font-bold hover:bg-yellow-300"
                                    >
                                        ?∞Í≤∞
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    // Case 2: Pending Approval -> Pending UI
                    if (data.player.link_status !== 'ACTIVE') {
                        return (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
                                <div className="text-4xl mb-3">??/div>
                                <h3 className="font-bold text-xl text-yellow-800 mb-2">?πÏù∏ ?ÄÍ∏?Ï§?/h3>
                                <p className="text-yellow-700">
                                    Í¥ÄÎ¶¨ÏûêÍ∞Ä ?†Ïàò ?∞Í≤∞???ïÏù∏?òÍ≥† ?àÏäµ?àÎã§.<br />
                                    ?πÏù∏???ÑÎ£å?òÎ©¥ Î™®Îì† Í∏∞Îä•???¥Ïö©?????àÏäµ?àÎã§.
                                </p>
                            </div>
                        )
                    }

                    // Case 3: Active -> Dashboard
                    return (
                        <>
                            {/* Ability Radar Chart */}
                            {data?.abilities && (
                                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                    <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                        <Award size={18} className="text-purple-500" />
                                        ?úÏ¶å ?úÎèô Î∂ÑÏÑù (Performance)
                                    </h2>
                                    <div className="h-64 w-full -ml-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                                                <PolarGrid />
                                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                                <Radar
                                                    name="Ability"
                                                    dataKey="A"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={3}
                                                    fill="#8b5cf6"
                                                    fillOpacity={0.3}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Stat Details */}
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {chartData.map(stat => (
                                            <div key={stat.subject} className="bg-slate-50 p-3 rounded-lg flex justify-between items-center">
                                                <span className="text-xs text-slate-500 font-bold flex items-center gap-1">
                                                    {stat.subject}
                                                    <Tooltip text={TOOLTIPS[stat.subject] || ''} align="left">
                                                        <Info size={12} className="text-slate-300 hover:text-slate-500 transition-colors" />
                                                    </Tooltip>
                                                </span>
                                                <span className="text-lg font-black text-slate-800">{Math.round(stat.A)}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Recent History */}
                                    {data.abilityHistory && data.abilityHistory.length > 0 && (
                                        <div className="mt-6 border-t border-slate-100 pt-4">
                                            <h3 className="text-xs font-bold text-slate-400 uppercase mb-3">ÏµúÍ∑º Î≥Ä???¥Ïó≠</h3>
                                            <div className="space-y-2">
                                                {data.abilityHistory.slice(0, 3).map(log => (
                                                    <div key={log.id} className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-600 flex items-center gap-2">
                                                            <span className={`w-1.5 h-1.5 rounded-full ${log.delta > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                            {log.reason}
                                                        </span>
                                                        <span className={`font-bold ${log.delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                            {log.delta > 0 ? '+' : ''}{log.delta} ({log.stat_type.slice(0, 3)})
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Score & Records */}
                            {data?.records && (
                                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                            <Trophy size={18} className="text-yellow-500" />
                                            ??Í∏∞Î°ù
                                        </h2>
                                        <span className="text-2xl font-black text-slate-900">{data.records.totalScore} <span className="text-sm text-slate-400 font-normal">pts</span></span>
                                    </div>
                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">Í≤ΩÍ∏∞</div>
                                            <div className="font-bold text-slate-900 text-lg">{data.records.matchesPlayed || 0}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">Í≥µÍ≤©P</div>
                                            <div className="font-bold text-slate-900 text-lg">{data.records.attackPoints || 0}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">1??/div>
                                            <div className="font-bold text-yellow-600 text-lg">{data.records.rank1 || 0}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">2??/div>
                                            <div className="font-bold text-slate-600 text-lg">{data.records.rank2 || 0}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">3??/div>
                                            <div className="font-bold text-orange-600 text-lg">{data.records.rank3 || 0}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">?πÎ•†</div>
                                            <div className="font-bold text-slate-900 text-lg">
                                                {data.records.matchesPlayed ? Math.round((data.records.wins / data.records.matchesPlayed) * 100) : 0}%
                                            </div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">Í≥?/div>
                                            <div className="font-bold text-slate-800">{data.records.goals}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">?ÑÏ?</div>
                                            <div className="font-bold text-slate-800">{data.records.assists}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">?πÎ¶¨</div>
                                            <div className="font-bold text-slate-800">{data.records.wins}</div>
                                        </div>
                                        <div className="p-2 bg-slate-50 rounded-xl">
                                            <div className="text-xs text-slate-500 mb-1 whitespace-nowrap">Ï∂úÏÑù</div>
                                            <div className="font-bold text-slate-800">{data.records.attendance}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Badges */}
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                <h2 className="font-bold text-slate-800 flex items-center gap-2 mb-4">
                                    <Award size={18} className="text-blue-500" />
                                    ?çÎìù Î±ÉÏ? ({data?.badges?.length || 0})
                                </h2>
                                {(!data?.badges || data.badges.length === 0) ? (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        ?ÑÏßÅ ?çÎìù??Î±ÉÏ?Í∞Ä ?ÜÏäµ?àÎã§.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {data.badges.map(badge => (
                                            <div key={badge.code} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex flex-col items-center text-center">
                                                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-xl">
                                                    ?èÖ
                                                </div>
                                                <div className="font-bold text-sm text-slate-800">{badge.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{badge.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )
                })()}





                <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                    <h2 className="font-bold text-slate-800 flex items-center gap-2">
                        <User size={18} className="text-slate-400" />
                        ?ÑÎ°ú???∏Ïßë
                    </h2>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">?âÎÑ§??(Alias)</label>
                        <input
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            value={form.alias}
                            onChange={(e) => setForm({ ...form, alias: e.target.value })}
                            placeholder="?âÎÑ§?ÑÏùÑ ?ÖÎ†•?òÏÑ∏??
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">?∞ÎùΩÏ≤?/label>
                        <input
                            type="tel"
                            className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="010-0000-0000"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">?ùÎÖÑ?îÏùº</label>
                            <input
                                type="date"
                                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal"
                                value={form.birth_date}
                                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">??(cm)</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal"
                                value={form.height_cm}
                                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                                placeholder="175"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Î™∏Î¨¥Í≤?(kg)</label>
                            <input
                                type="number"
                                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal"
                                value={form.weight_kg}
                                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                                placeholder="70"
                            />
                        </div>
                    </div>
                </form>

                {/* Preferences Section */}
                <PreferenceSection />

                <div className="pt-4 flex items-center justify-between">
                    <button
                        onClick={handleLogout}
                        className="text-red-500 text-sm font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-2 rounded-lg"
                    >
                        <LogOut size={16} /> Î°úÍ∑∏?ÑÏõÉ
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? '?Ä??Ï§?..' : 'Î≥ÄÍ≤ΩÏÇ¨???Ä??}
                    </button>
                </div>

            </div >
        </div >
    )
}


