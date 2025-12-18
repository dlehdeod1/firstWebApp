import { useState, useEffect } from 'react'
import { Trophy, Medal, Flame, Target, Shield, TrendingUp, Users, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

interface RankItem {
    id: number
    rank: number
    name: string
    games: number
    goals: number
    assists: number
    points: number
    wins?: number
    defenses?: number
    attendance?: number
    streak?: number
}

type TabType = 'points' | 'goals' | 'assists' | 'wins' | 'defenses' | 'attendance' | 'streak'

export default function RankingsPage() {
    const [tab, setTab] = useState<TabType>('points')
    const [data, setData] = useState<RankItem[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchRankings(tab)
    }, [tab])

    const fetchRankings = async (type: string) => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/rankings/${type}`)
            const json = await res.json()
            if (Array.isArray(json)) {
                setData(json)
            } else {
                console.error('Invalid data format', json)
                setData([])
            }
        } catch (e) {
            console.error(e)
            setData([])
        } finally {
            setLoading(false)
        }
    }

    const tabs: { id: TabType; label: string; icon: any; color: string; bg: string; shortLabel: string }[] = [
        { id: 'points', label: '공격포인트', shortLabel: '공격P', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'goals', label: '득점왕', shortLabel: '득점', icon: Target, color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'assists', label: '도움왕', shortLabel: '도움', icon: Medal, color: 'text-blue-500', bg: 'bg-blue-50' },
        { id: 'wins', label: '다승왕', shortLabel: '다승', icon: Trophy, color: 'text-emerald-500', bg: 'bg-emerald-50' },
        { id: 'defenses', label: '수비왕', shortLabel: '수비', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-50' },
        { id: 'attendance', label: '출석왕', shortLabel: '출석', icon: Users, color: 'text-teal-500', bg: 'bg-teal-50' },
        { id: 'streak', label: '연속출석', shortLabel: '연속', icon: Zap, color: 'text-pink-500', bg: 'bg-pink-50' },
    ]

    const currentTab = tabs.find(t => t.id === tab)!

    // Get the main stat value for display based on current tab
    const getMainStat = (item: RankItem) => {
        switch (tab) {
            case 'goals': return item.goals
            case 'assists': return item.assists
            case 'wins': return item.wins || 0
            case 'defenses': return item.defenses || 0
            case 'attendance': return item.attendance || 0
            case 'streak': return item.streak || 0
            default: return item.points
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                <Trophy className="text-yellow-500" /> 시즌 랭킹
            </h1>

            {/* Tabs - Mobile Friendly Scrollable */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-all flex-shrink-0",
                            tab === t.id
                                ? `${t.bg} ${t.color} shadow-sm ring-1 ring-inset ring-black/5`
                                : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-100"
                        )}
                    >
                        <t.icon size={14} />
                        <span className="hidden sm:inline">{t.label}</span>
                        <span className="sm:hidden">{t.shortLabel}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 animate-pulse">
                    랭킹 집계 중...
                </div>
            ) : (
                <>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-2">
                        {data.map((item, i) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "bg-white rounded-xl p-3 border shadow-sm flex items-center gap-3",
                                    i < 3 ? "border-yellow-200" : "border-slate-100"
                                )}
                            >
                                {/* Rank Badge */}
                                <div className={cn(
                                    "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm flex-shrink-0",
                                    i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30" :
                                        i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400 text-white" :
                                            i === 2 ? "bg-gradient-to-br from-orange-400 to-amber-600 text-white" :
                                                "bg-slate-100 text-slate-500"
                                )}>
                                    {i + 1}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="font-bold text-slate-900 truncate flex items-center gap-1">
                                        {item.name}
                                        {i === 0 && <span className="text-xs">👑</span>}
                                    </div>
                                    <div className="text-xs text-slate-400 truncate">
                                        {/* Show different stats based on tab */}
                                        {(tab === 'points' || tab === 'goals' || tab === 'assists') && (
                                            <>{item.games}경기 | G {item.goals} | A {item.assists}</>
                                        )}
                                        {tab === 'wins' && (
                                            <>{item.games}경기 | 1등 {item.wins || 0}회</>
                                        )}
                                        {tab === 'defenses' && (
                                            <>호수비 {item.defenses || 0}회</>
                                        )}
                                        {tab === 'attendance' && (
                                            <>출석 {item.attendance || 0}회</>
                                        )}
                                        {tab === 'streak' && (
                                            <>최대 연속 {item.streak || 0}회</>
                                        )}
                                    </div>
                                </div>

                                {/* Main Stat */}
                                <div className={cn(
                                    "text-right flex-shrink-0 px-3 py-1.5 rounded-lg",
                                    currentTab.bg
                                )}>
                                    <div className={cn("text-lg font-black", currentTab.color)}>
                                        {getMainStat(item)}
                                    </div>
                                    <div className="text-[10px] text-slate-400 uppercase">{currentTab.shortLabel}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop Table View */}
                    <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                    <tr>
                                        <th className="px-3 py-3 w-10 text-center">#</th>
                                        <th className="px-3 py-3 text-left">선수</th>
                                        <th className="px-2 py-3 text-center">경기</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'goals' && "bg-yellow-50 text-yellow-700")}>득점</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'assists' && "bg-blue-50 text-blue-700")}>도움</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'points' && "bg-orange-50 text-orange-700")}>공격P</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'defenses' && "bg-purple-50 text-purple-700")}>수비</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'wins' && "bg-emerald-50 text-emerald-700")}>1등</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'attendance' && "bg-teal-50 text-teal-700")}>출석</th>
                                        <th className={cn("px-2 py-3 text-center", tab === 'streak' && "bg-pink-50 text-pink-700")}>연속</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.map((item, i) => (
                                        <tr key={item.id} className={cn("hover:bg-slate-50 transition-colors", i < 3 && "bg-slate-50/30")}>
                                            <td className="px-3 py-3 text-center">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs mx-auto",
                                                    i === 0 ? "bg-yellow-100 text-yellow-700" :
                                                        i === 1 ? "bg-slate-200 text-slate-700" :
                                                            i === 2 ? "bg-orange-100 text-orange-700" :
                                                                "text-slate-400"
                                                )}>
                                                    {i + 1}
                                                </div>
                                            </td>
                                            <td className="px-3 py-3 font-bold text-slate-900 truncate max-w-[120px]">
                                                {item.name}
                                                {i === 0 && <span className="ml-1 text-xs">👑</span>}
                                            </td>
                                            <td className="px-2 py-3 text-center text-slate-400">{item.games}</td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'goals' ? "text-slate-900 bg-yellow-50/50" : "text-slate-300")}>
                                                {item.goals}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'assists' ? "text-slate-900 bg-blue-50/50" : "text-slate-300")}>
                                                {item.assists}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-extrabold", tab === 'points' ? "text-orange-600 bg-orange-50/50" : "text-slate-300")}>
                                                {item.points}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'defenses' ? "text-purple-600 bg-purple-50/50" : "text-slate-300")}>
                                                {item.defenses || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'wins' ? "text-emerald-600 bg-emerald-50/50" : "text-slate-300")}>
                                                {item.wins || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'attendance' ? "text-teal-600 bg-teal-50/50" : "text-slate-300")}>
                                                {item.attendance || 0}
                                            </td>
                                            <td className={cn("px-2 py-3 text-center font-bold", tab === 'streak' ? "text-pink-600 bg-pink-50/50" : "text-slate-300")}>
                                                {item.streak || 0}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="py-10 text-center text-slate-400">데이터가 없습니다.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* Empty State for Mobile */}
                    {data.length === 0 && (
                        <div className="md:hidden py-10 text-center text-slate-400 bg-white rounded-xl border border-slate-100">
                            데이터가 없습니다.
                        </div>
                    )}

                    {/* Stats Summary */}
                    {data.length > 0 && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <TrendingUp size={14} />
                                <span>총 {data.length}명의 선수가 기록되어 있습니다.</span>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
