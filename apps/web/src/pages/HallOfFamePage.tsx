import { useState, useEffect } from 'react'
import { Trophy, Medal, Star, Crown, Calendar } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface HallOfFameEntry {
    rank: number
    player_name: string
    value: number
    year: number
}

interface CategoryData {
    label: string
    icon: any
    color: string
    entries: HallOfFameEntry[]
}

export default function HallOfFamePage() {
    const [data, setData] = useState<Record<string, CategoryData>>({})
    const [loading, setLoading] = useState(true)
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

    const currentYear = new Date().getFullYear()
    const years = [currentYear, currentYear - 1, currentYear - 2].filter(y => y >= 2024)

    useEffect(() => {
        fetchHallOfFame(selectedYear)
    }, [selectedYear])

    const fetchHallOfFame = async (year: number) => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/rankings/hall-of-fame?year=${year}`)
            const json = await res.json()
            setData(json)
        } catch (e) {
            console.error(e)
            setData({})
        } finally {
            setLoading(false)
        }
    }

    const categories = [
        { id: 'goals', label: '득점왕', icon: Trophy, color: 'from-yellow-400 to-amber-500' },
        { id: 'assists', label: '도움왕', icon: Medal, color: 'from-blue-400 to-blue-600' },
        { id: 'points', label: '공격포인트왕', icon: Trophy, color: 'from-orange-400 to-orange-600' },
        { id: 'wins', label: '다승왕', icon: Crown, color: 'from-emerald-400 to-emerald-600' },
        { id: 'defenses', label: '수비왕', icon: Medal, color: 'from-slate-400 to-slate-600' },
        { id: 'attendance', label: '출석왕', icon: Star, color: 'from-purple-400 to-purple-600' },
        { id: 'streak', label: '연속출석왕', icon: Star, color: 'from-pink-400 to-pink-600' },
    ]

    const getRankBadge = (rank: number) => {
        if (rank === 1) return { bg: 'bg-yellow-400', text: '🥇' }
        if (rank === 2) return { bg: 'bg-slate-300', text: '🥈' }
        if (rank === 3) return { bg: 'bg-amber-600', text: '🥉' }
        return { bg: 'bg-slate-200', text: rank.toString() }
    }

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-slate-900 mb-2 flex items-center gap-2">
                <Trophy className="text-yellow-500" /> 명예의 전당
            </h1>
            <p className="text-sm text-slate-500 mb-6">역대 시즌별 TOP 3 기록</p>

            {/* Year Selector */}
            <div className="flex gap-2 mb-6">
                {years.map(year => (
                    <button
                        key={year}
                        onClick={() => setSelectedYear(year)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-sm transition-all ${selectedYear === year
                            ? 'bg-yellow-400 text-slate-900 shadow-lg'
                            : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                            }`}
                    >
                        <Calendar size={14} />
                        {year}
                        {year === currentYear && <span className="text-[10px] opacity-70">(진행중)</span>}
                    </button>
                ))}
            </div>

            {/* Loading */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 animate-pulse">
                    명예의 전당 로딩 중...
                </div>
            ) : (
                <div className="space-y-6">
                    {categories.map(cat => {
                        const catData = data[cat.id]
                        if (!catData || !catData.entries?.length) {
                            return (
                                <div key={cat.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className={`p-2 rounded-xl bg-gradient-to-br ${cat.color}`}>
                                            <cat.icon size={20} className="text-white" />
                                        </div>
                                        <h2 className="font-bold text-lg text-slate-800">{cat.label}</h2>
                                    </div>
                                    <p className="text-slate-400 text-sm text-center py-4">아직 기록이 없습니다</p>
                                </div>
                            )
                        }

                        return (
                            <div key={cat.id} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className={`p-2 rounded-xl bg-gradient-to-br ${cat.color}`}>
                                        <cat.icon size={20} className="text-white" />
                                    </div>
                                    <h2 className="font-bold text-lg text-slate-800">{cat.label}</h2>
                                </div>

                                <div className="space-y-2">
                                    {catData.entries.slice(0, 3).map(entry => {
                                        const badge = getRankBadge(entry.rank)
                                        return (
                                            <div
                                                key={`${entry.rank}-${entry.player_name}`}
                                                className={`flex items-center gap-3 p-3 rounded-xl ${entry.rank === 1 ? 'bg-yellow-50' : 'bg-slate-50'
                                                    }`}
                                            >
                                                <span className="text-xl">{badge.text}</span>
                                                <span className={`font-bold flex-1 truncate ${entry.rank === 1 ? 'text-yellow-800' : 'text-slate-700'
                                                    }`}>
                                                    {entry.player_name}
                                                </span>
                                                <span className={`font-black text-lg tabular-nums ${entry.rank === 1 ? 'text-yellow-600' : 'text-slate-600'
                                                    }`}>
                                                    {entry.value}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
