import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Users, Save, LogOut, Trophy, Award, Heart } from 'lucide-react'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

interface Badge {
    code: string
    name: string
    description: string
    awarded_at: number
}

interface Records {
    wins: number
    rank1: number
    rank2: number
    rank3: number
    podiums: number
    goals: number
    assists: number
    attendance: number
    totalScore: number
    matchesPlayed: number
    attackPoints: number
    streak?: number
    hattricks?: number
}

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts'

interface Ability {
    curr_attack: number
    curr_playmaker: number
    curr_competitiveness: number
    curr_diligence: number
}

interface AbilityLog {
    id: number
    stat_type: string
    delta: number
    reason: string
    created_at: number
}

interface UserProfile {
    user: { email: string | null, username: string | null, role: string }
    profile: {
        alias: string | null
        phone: string | null
        birth_date: string | null // YYYY-MM-DD
        age: number | null
        height_cm: number | null
        weight_kg: number | null
        photo_url: string | null // Profile photo URL
    } | null
    player: any
    badges: Badge[]
    records: Records
    abilities?: Ability
    abilityHistory?: AbilityLog[]
}

interface PlayerSimple {
    id: number
    name: string
}

interface Preference {
    rank: number
    target_player_id: number
    name: string
}

// Member Tier System based on attendance count
const getMemberTier = (attendance: number): { name: string, icon: string, color: string, bgColor: string } => {
    if (attendance >= 80) return { name: '레전드', icon: '👑', color: 'text-yellow-600', bgColor: 'bg-gradient-to-r from-yellow-100 to-amber-100' }
    if (attendance >= 50) return { name: '에이스', icon: '🔥', color: 'text-orange-600', bgColor: 'bg-orange-50' }
    if (attendance >= 30) return { name: '스타터', icon: '⚡', color: 'text-blue-600', bgColor: 'bg-blue-50' }
    if (attendance >= 15) return { name: '슈퍼서브', icon: '🔄', color: 'text-emerald-600', bgColor: 'bg-emerald-50' }
    if (attendance >= 5) return { name: '벤치워머', icon: '🪑', color: 'text-slate-600', bgColor: 'bg-slate-100' }
    if (attendance >= 1) return { name: '주전자', icon: '🫖', color: 'text-slate-500', bgColor: 'bg-slate-50' }
    return { name: '볼보이', icon: '⚽', color: 'text-gray-400', bgColor: 'bg-gray-50' }
}

export default function MePage() {
    const navigate = useNavigate()
    const { actualTheme } = useTheme()
    const [data, setData] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    // Form State
    const [form, setForm] = useState({
        alias: '',
        phone: '',
        birth_date: '',
        height_cm: '' as string | number,
        weight_kg: '' as string | number,
        photo_url: ''
    })

    // Chemistry Preferences State
    const [allPlayers, setAllPlayers] = useState<PlayerSimple[]>([])
    const [preferences, setPreferences] = useState<Preference[]>([])
    const [savingPrefs, setSavingPrefs] = useState(false)

    useEffect(() => {
        const token = localStorage.getItem('auth_token')
        if (!token) {
            navigate('/login')
            return
        }

        fetch(`${API_URL}/me`, {
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
                    weight_kg: resData.profile?.weight_kg || '',
                    photo_url: resData.profile?.photo_url || ''
                })
                // Sync Role immediately
                if (resData.user.role) {
                    localStorage.setItem('user_role', resData.user.role)
                }

                // Fetch all players for preferences if user has a linked player
                if (resData.player) {
                    fetch(`${API_URL}/players`, { headers: { 'Authorization': `Bearer ${token}` } })
                        .then(res => res.json())
                        .then(players => setAllPlayers(players.filter((p: any) => p.id !== resData.player?.id)))
                        .catch(console.error)

                    fetch(`${API_URL}/me/preferences`, { headers: { 'Authorization': `Bearer ${token}` } })
                        .then(res => res.json())
                        .then(data => setPreferences(data.preferences || []))
                        .catch(console.error)
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

        if (h && (h < 120 || h > 220)) return alert('키는 120~220cm 사이에여야 합니다.')
        if (w && (w < 30 || w > 150)) return alert('몸무게는 30~150kg 사이여야 합니다.')
        if (form.phone && !/^[0-9-]{10,13}$/.test(form.phone)) return alert('올바른 휴대폰 번호를 입력해주세요.')

        setSaving(true)
        try {
            const token = localStorage.getItem('auth_token')
            const res = await fetch(`${API_URL}/me`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(form)
            })

            if (res.ok) {
                alert('저장되었습니다.')
                window.location.reload()
            } else {
                const err = await res.json()
                alert(err.error || '저장 실패')
            }
        } catch (e) {
            alert('오류 발생')
        } finally {
            setSaving(false)
        }
    }

    const handleLogout = () => {
        if (!confirm('로그아웃 하시겠습니까?')) return
        localStorage.clear()
        navigate('/login')
    }

    const handleSavePreferences = async () => {
        setSavingPrefs(true)
        try {
            const token = localStorage.getItem('auth_token')
            const prefsToSend = preferences
                .filter(p => p.target_player_id)
                .map(p => ({ targetId: p.target_player_id, rank: p.rank }))

            const res = await fetch(`${API_URL}/me/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ preferences: prefsToSend })
            })

            if (res.ok) {
                alert('저장되었습니다!')
            } else {
                const err = await res.json()
                alert(err.error || '저장 실패')
            }
        } catch (e) {
            alert('오류 발생')
        } finally {
            setSavingPrefs(false)
        }
    }

    const updatePreference = (rank: number, playerId: number) => {
        const player = allPlayers.find(p => p.id === playerId)
        setPreferences(prev => {
            const filtered = prev.filter(p => p.rank !== rank && p.target_player_id !== playerId)
            if (playerId) {
                return [...filtered, { rank, target_player_id: playerId, name: player?.name || '' }].sort((a, b) => a.rank - b.rank)
            }
            return filtered
        })
    }

    if (loading) return <div className={cn("p-8 text-center", actualTheme === 'dark' ? "text-slate-400" : "text-slate-500")}>로딩 중...</div>

    // Chart Data
    const chartData = data?.abilities ? [
        { subject: '공격력', A: data.abilities.curr_attack, fullMark: 100 },
        { subject: '플레이메이커', A: data.abilities.curr_playmaker, fullMark: 100 },
        { subject: '승부사', A: data.abilities.curr_competitiveness, fullMark: 100 },
        { subject: '성실도', A: data.abilities.curr_diligence, fullMark: 100 },
    ] : []

    return (
        <div className="max-w-md mx-auto pb-20 p-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-6">
                마이 페이지
            </h1>

            <div className="space-y-6">
                {/* 1. Basic Info */}
                <div className={cn("rounded-2xl p-6 border shadow-sm flex items-center gap-4",
                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                )}>
                    {data?.profile?.photo_url ? (
                        <img
                            src={data.profile.photo_url}
                            alt="프로필"
                            className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
                        />
                    ) : (
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-2xl">
                            {data?.user.username?.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div className="flex-1">
                        <div className={cn("font-bold text-lg", actualTheme === 'dark' ? "text-slate-100" : "text-slate-900")}>{data?.profile?.alias || data?.user.username}</div>
                        <div className={cn("text-sm", actualTheme === 'dark' ? "text-slate-400" : "text-slate-500")}>@{data?.user.username}</div>
                        <div className="flex flex-wrap gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-bold">
                                {['owner', 'OWNER'].includes(data?.user.role || '') ? '구단주' : (['admin', 'ADMIN'].includes(data?.user.role || '') ? '운영진' : '멤버')}
                            </span>
                            {data?.records && (() => {
                                const tier = getMemberTier(data.records.attendance || 0)
                                return (
                                    <span className={`text-xs px-2 py-0.5 ${tier.bgColor} ${tier.color} rounded-full font-bold flex items-center gap-1`}>
                                        <span>{tier.icon}</span> {tier.name}
                                    </span>
                                )
                            })()}
                            {data?.profile?.age && (
                                <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                    {data.profile.age}세
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
                            <div className={cn("rounded-2xl p-6 border shadow-sm",
                                actualTheme === 'dark' ? "bg-slate-900 text-white border-slate-700" : "bg-slate-800 text-white border-slate-700"
                            )}>
                                <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
                                    <Users size={20} className="text-yellow-400" />
                                    선수 연결하기
                                </h2>
                                <p className="text-sm text-slate-300 mb-4">
                                    구단에서 발급받은 <strong>선수 코드(6자리)</strong>를 입력하여 계정을 연결하세요.
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
                                            if (code.length < 6) return alert('코드를 확인해주세요.')

                                            try {
                                                const token = localStorage.getItem('auth_token')
                                                const res = await fetch(`${API_URL}/me/claim-player`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                    body: JSON.stringify({ playerCode: code })
                                                })
                                                if (res.ok) {
                                                    alert('연결 요청되었습니다. 관리자 승인을 기다려주세요.')
                                                    window.location.reload()
                                                } else {
                                                    const err = await res.json()
                                                    alert(err.error || '연결 실패')
                                                }
                                            } catch (e) { alert('오류 발생') }
                                        }}
                                        className="bg-yellow-400 text-slate-900 px-4 rounded-xl font-bold hover:bg-yellow-300"
                                    >
                                        연결
                                    </button>
                                </div>
                            </div>
                        )
                    }

                    // Case 2: Pending Approval -> Pending UI
                    if (data.player.link_status !== 'ACTIVE') {
                        return (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-8 text-center">
                                <div className="text-4xl mb-3">⏳</div>
                                <h3 className="font-bold text-xl text-yellow-800 mb-2">승인 대기 중</h3>
                                <p className="text-yellow-700">
                                    관리자가 선수 연결을 확인하고 있습니다.<br />
                                    승인이 완료되면 모든 기능을 이용할 수 있습니다.
                                </p>
                            </div>
                        )
                    }

                    // Case 3: Active -> Dashboard
                    return (
                        <>
                            {/* Ability Radar Chart */}
                            {data?.abilities && (
                                <div className={cn("rounded-2xl p-6 border shadow-sm",
                                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                                )}>
                                    <h2 className={cn("font-bold flex items-center gap-2 mb-4",
                                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                                    )}>
                                        <Award size={18} className="text-purple-500" />
                                        시즌 퍼포먼스 분석
                                    </h2>
                                    <div className="h-64 w-full overflow-hidden">
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

                                    {/* Stat Details with Tooltips */}
                                    <div className="grid grid-cols-2 gap-3 mt-2">
                                        {chartData.map(stat => {
                                            // Tooltip descriptions based on actual calculation logic
                                            const statDescriptions: Record<string, string> = {
                                                '공격력': '골 +0.3, 해트트릭 보너스 +0.5 (세션당 최대 +2.0)',
                                                '플레이메이커': '어시스트 +0.4 (세션당 최대 +2.0)',
                                                '승부사': '1등 +0.7, 2등 +0.3, 3등 -0.7',
                                                '성실도': '출석 +0.2, 3경기 연속 출석 보너스',
                                            };
                                            return (
                                                <div
                                                    key={stat.subject}
                                                    className={cn("p-3 rounded-lg flex justify-between items-center cursor-help",
                                                        actualTheme === 'dark' ? "bg-slate-900/50" : "bg-slate-50"
                                                    )}
                                                    title={statDescriptions[stat.subject] || ''}
                                                >
                                                    <span className={cn("text-xs font-bold flex items-center gap-1",
                                                        actualTheme === 'dark' ? "text-slate-400" : "text-slate-500"
                                                    )}>
                                                        {stat.subject}
                                                        <span className={cn("text-[10px]", actualTheme === 'dark' ? "text-slate-600" : "text-slate-300")}>ⓘ</span>
                                                    </span>
                                                    <span className={cn("text-lg font-black", actualTheme === 'dark' ? "text-slate-100" : "text-slate-800")}>{Math.round(stat.A)}</span>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Recent History */}
                                    {data.abilityHistory && data.abilityHistory.length > 0 && (
                                        <div className={cn("mt-6 border-t pt-4", actualTheme === 'dark' ? "border-slate-700" : "border-slate-100")}>
                                            <h3 className={cn("text-xs font-bold uppercase mb-3", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>최근 변동 내역</h3>
                                            <div className="space-y-2">
                                                {data.abilityHistory.slice(0, 3).map(log => (
                                                    <div key={log.id} className="flex justify-between items-center text-sm">
                                                        <span className={cn("flex items-center gap-2", actualTheme === 'dark' ? "text-slate-400" : "text-slate-600")}>
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
                                <div className={cn("rounded-2xl p-6 border shadow-sm",
                                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                                )}>
                                    <h2 className={cn("font-bold flex items-center gap-2 mb-4",
                                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                                    )}>
                                        <Trophy size={18} className="text-yellow-500" />
                                        내 기록
                                    </h2>

                                    {/* Main Stats */}
                                    <div className="grid grid-cols-4 gap-3 mb-4">
                                        <div className="p-3 bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl border border-yellow-100 text-center">
                                            <div className="text-2xl font-black text-yellow-600">{data.records.goals}</div>
                                            <div className="text-xs text-yellow-700 font-bold">골</div>
                                        </div>
                                        <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 text-center">
                                            <div className="text-2xl font-black text-blue-600">{data.records.assists}</div>
                                            <div className="text-xs text-blue-700 font-bold">도움</div>
                                        </div>
                                        <div className="p-3 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl border border-orange-100 text-center">
                                            <div className="text-2xl font-black text-orange-600">{data.records.attackPoints || 0}</div>
                                            <div className="text-xs text-orange-700 font-bold">공격P</div>
                                        </div>
                                        <div className="p-3 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 text-center">
                                            <div className="text-2xl font-black text-emerald-600">{data.records.wins || 0}</div>
                                            <div className="text-xs text-emerald-700 font-bold">승리</div>
                                        </div>
                                    </div>

                                    {/* Secondary Stats */}
                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                        {/* Win Rate */}
                                        <div className={cn("p-3 rounded-xl", actualTheme === 'dark' ? "bg-slate-900/50" : "bg-slate-50")}>
                                            <div className="flex items-center justify-between">
                                                <span className={cn("text-xs font-bold", actualTheme === 'dark' ? "text-slate-400" : "text-slate-500")}>승률</span>
                                                <span className={cn("text-lg font-black", actualTheme === 'dark' ? "text-slate-100" : "text-slate-900")}>
                                                    {data.records.matchesPlayed > 0
                                                        ? Math.round((data.records.wins / data.records.matchesPlayed) * 100)
                                                        : 0}%
                                                </span>
                                            </div>
                                            <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500 rounded-full"
                                                    style={{
                                                        width: `${data.records.matchesPlayed > 0
                                                            ? (data.records.wins / data.records.matchesPlayed) * 100
                                                            : 0}%`
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Goal per Match */}
                                        <div className={cn("p-3 rounded-xl", actualTheme === 'dark' ? "bg-slate-900/50" : "bg-slate-50")}>
                                            <div className="flex items-center justify-between">
                                                <span className={cn("text-xs font-bold", actualTheme === 'dark' ? "text-slate-400" : "text-slate-500")}>경기당 득점</span>
                                                <span className={cn("text-lg font-black", actualTheme === 'dark' ? "text-slate-100" : "text-slate-900")}>
                                                    {data.records.matchesPlayed > 0
                                                        ? (data.records.goals / data.records.matchesPlayed).toFixed(2)
                                                        : '0.00'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Detail Stats Grid */}
                                    <div className={cn("grid grid-cols-3 md:grid-cols-6 gap-2 text-center border-t pt-4",
                                        actualTheme === 'dark' ? "border-slate-700" : "border-slate-100"
                                    )}>
                                        <div className="p-2">
                                            <div className={cn("text-xs mb-1", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>경기</div>
                                            <div className={cn("font-bold", actualTheme === 'dark' ? "text-slate-300" : "text-slate-700")}>{data.records.matchesPlayed || 0}</div>
                                        </div>
                                        <div className="p-2">
                                            <div className={cn("text-xs mb-1", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>출석</div>
                                            <div className={cn("font-bold", actualTheme === 'dark' ? "text-slate-300" : "text-slate-700")}>{data.records.attendance}</div>
                                        </div>
                                        <div className="p-2">
                                            <div className="text-xs text-slate-400 mb-1">1위</div>
                                            <div className="font-bold text-yellow-600">{data.records.rank1 || 0}</div>
                                        </div>
                                        <div className="p-2">
                                            <div className="text-xs text-slate-400 mb-1">2위</div>
                                            <div className="font-bold text-slate-500">{data.records.rank2 || 0}</div>
                                        </div>
                                        <div className="p-2">
                                            <div className="text-xs text-slate-400 mb-1">3위</div>
                                            <div className="font-bold text-orange-600">{data.records.rank3 || 0}</div>
                                        </div>
                                        <div className="p-2">
                                            <div className="text-xs text-slate-400 mb-1 truncate">연속</div>
                                            <div className="font-bold text-purple-600">{data.records.streak || 0}</div>
                                        </div>
                                    </div>

                                    {/* Hat-tricks highlight if any */}
                                    {(data.records.hattricks || 0) > 0 && (
                                        <div className="mt-4 p-3 bg-gradient-to-r from-yellow-100 to-amber-100 rounded-xl border border-yellow-200 flex items-center gap-3">
                                            <span className="text-2xl">🎩</span>
                                            <div>
                                                <div className="font-bold text-yellow-800">해트트릭 {data.records.hattricks}회</div>
                                                <div className="text-xs text-yellow-700">한 경기 3골 이상</div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Badges */}
                            <div className={cn("rounded-2xl p-6 border shadow-sm",
                                actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                            )}>
                                <h2 className={cn("font-bold flex items-center gap-2 mb-4",
                                    actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                                )}>
                                    <Award size={18} className="text-blue-500" />
                                    획득 뱃지 ({data?.badges?.length || 0})
                                </h2>
                                {(!data?.badges || data.badges.length === 0) ? (
                                    <div className="text-center py-8 text-slate-400 text-sm">
                                        아직 획득한 뱃지가 없습니다.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {data.badges.map(badge => (
                                            <div key={badge.code} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex flex-col items-center text-center">
                                                <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center mb-2 text-xl">
                                                    🏅
                                                </div>
                                                <div className="font-bold text-sm text-slate-800">{badge.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{badge.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Favorite Players (Chemistry Preferences) */}
                            {data?.player && allPlayers.length > 0 && (
                                <div className={cn("rounded-2xl p-6 border shadow-sm",
                                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                                )}>
                                    <h2 className={cn("font-bold flex items-center gap-2 mb-2",
                                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                                    )}>
                                        <Heart size={18} className="text-pink-500" />
                                        좋아하는 선수
                                    </h2>
                                    <p className="text-xs text-slate-400 mb-4">
                                        케미가 좋은 선수를 선택하면 팀 구성 시 가점이 적용됩니다 (본인만 열람 가능)
                                    </p>

                                    <div className="space-y-3">
                                        {[1, 2, 3].map(rank => {
                                            const current = preferences.find(p => p.rank === rank)
                                            const selectedIds = preferences.map(p => p.target_player_id)
                                            const availablePlayers = allPlayers.filter(p =>
                                                p.id === current?.target_player_id || !selectedIds.includes(p.id)
                                            )

                                            return (
                                                <div key={rank} className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${rank === 1 ? 'bg-yellow-100 text-yellow-700' :
                                                        rank === 2 ? 'bg-slate-100 text-slate-600' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {rank}
                                                    </div>
                                                    <select
                                                        value={current?.target_player_id || ''}
                                                        onChange={(e) => updatePreference(rank, Number(e.target.value))}
                                                        className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-100 focus:ring-2 focus:ring-pink-500 outline-none font-bold text-sm"
                                                    >
                                                        <option value="">{rank}지망 선택...</option>
                                                        {availablePlayers.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <button
                                        onClick={handleSavePreferences}
                                        disabled={savingPrefs}
                                        className="mt-4 w-full py-3 bg-pink-500 text-white rounded-xl font-bold shadow-lg shadow-pink-500/30 hover:bg-pink-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        <Heart size={16} />
                                        {savingPrefs ? '저장 중...' : '선호 선수 저장'}
                                    </button>
                                </div>
                            )}
                        </>
                    )
                })()}

                <form onSubmit={handleSave} className={cn("rounded-2xl p-6 border shadow-sm space-y-4",
                    actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
                )}>
                    <h2 className={cn("font-bold flex items-center gap-2",
                        actualTheme === 'dark' ? "text-slate-100" : "text-slate-800"
                    )}>
                        <User size={18} className="text-slate-400" />
                        프로필 편집
                    </h2>

                    <div>
                        <label className={cn("block text-sm font-bold mb-1",
                            actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                        )}>프로필 사진 URL</label>
                        <div className="flex gap-3 items-center">
                            {form.photo_url && (
                                <img src={form.photo_url} alt="미리보기" className="w-12 h-12 rounded-full object-cover border-2 border-blue-200" />
                            )}
                            <input
                                className={cn("flex-1 p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none text-sm",
                                    actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                                )}
                                value={form.photo_url}
                                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                                placeholder="https://example.com/photo.jpg"
                            />
                        </div>
                        <p className={cn("text-xs mt-1", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>구글 드라이브, 카카오톡 프로필 등 외부 이미지 URL을 입력하세요</p>
                    </div>

                    <div>
                        <label className={cn("block text-sm font-bold mb-1",
                            actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                        )}>닉네임 (Alias)</label>
                        <input
                            className={cn("w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold",
                                actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                            )}
                            value={form.alias}
                            onChange={(e) => setForm({ ...form, alias: e.target.value })}
                            placeholder="닉네임을 입력하세요"
                        />
                    </div>

                    <div>
                        <label className={cn("block text-sm font-bold mb-1",
                            actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                        )}>연락처</label>
                        <input
                            type="tel"
                            className={cn("w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold",
                                actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                            )}
                            value={form.phone}
                            onChange={(e) => setForm({ ...form, phone: e.target.value })}
                            placeholder="010-0000-0000"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={cn("block text-sm font-bold mb-1",
                                actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                            )}>생년월일</label>
                            <input
                                type="date"
                                className={cn("w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal",
                                    actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                                )}
                                value={form.birth_date}
                                onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className={cn("block text-sm font-bold mb-1",
                                actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                            )}>키 (cm)</label>
                            <input
                                type="number"
                                className={cn("w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal",
                                    actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                                )}
                                value={form.height_cm}
                                onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                                placeholder="175"
                            />
                        </div>
                        <div>
                            <label className={cn("block text-sm font-bold mb-1",
                                actualTheme === 'dark' ? "text-slate-300" : "text-slate-700"
                            )}>몸무게 (kg)</label>
                            <input
                                type="number"
                                className={cn("w-full p-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none font-bold placeholder:font-normal",
                                    actualTheme === 'dark' ? "bg-slate-900/50 border-slate-700 text-slate-100" : "bg-slate-50 border-slate-100"
                                )}
                                value={form.weight_kg}
                                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                                placeholder="70"
                            />
                        </div>
                    </div>
                </form>

                <div className="pt-4 flex items-center justify-between">
                    <button
                        onClick={handleLogout}
                        className="text-red-500 text-sm font-bold flex items-center gap-1 hover:bg-red-50 px-3 py-2 rounded-lg"
                    >
                        <LogOut size={16} /> 로그아웃
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
                    >
                        <Save size={18} />
                        {saving ? '저장 중...' : '변경사항 저장'}
                    </button>
                </div>

            </div>
        </div >
    )
}
