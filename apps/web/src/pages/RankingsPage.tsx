import { useState, useEffect } from 'react'
import { Trophy, Medal, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = 'http://localhost:8787'

interface RankItem {
    id: number
    rank: number
    name: string
    games: number
    goals: number
    assists: number
    points: number
    ppm: number
    winRate: number
    rank1: number
    rank2: number
    rank3: number
}

export default function RankingsPage() {
    const [tab, setTab] = useState<'goals' | 'assists' | 'points' | 'ppm' | 'winRate'>('points')
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

    const tabs = [
        { id: 'points' as const, label: 'P', fullLabel: '공격포인트', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50', activeBg: 'bg-orange-500' },
        { id: 'goals' as const, label: 'G', fullLabel: '득점', icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50', activeBg: 'bg-yellow-500' },
        { id: 'assists' as const, label: 'A', fullLabel: '도움', icon: Medal, color: 'text-blue-500', bg: 'bg-blue-50', activeBg: 'bg-blue-500' },
        { id: 'ppm' as const, label: 'PPM', fullLabel: '경기당P', icon: Flame, color: 'text-purple-500', bg: 'bg-purple-50', activeBg: 'bg-purple-500' },
        { id: 'winRate' as const, label: '%', fullLabel: '승률', icon: Trophy, color: 'text-green-500', bg: 'bg-green-50', activeBg: 'bg-green-500' },
    ]

    const activeTab = tabs.find(t => t.id === tab)!

    const getMainStat = (item: RankItem) => {
        switch (tab) {
            case 'goals': return item.goals
            case 'assists': return item.assists
            case 'points': return item.points
            case 'ppm': return item.ppm
            case 'winRate': return `${item.winRate}%`
        }
    }

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <h1 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} /> 시즌 랭킹
            </h1>

            {/* Tab Pills */}
            <div className="flex gap-1.5 mb-4 p-1 bg-slate-100 rounded-xl">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex-1 flex flex-col items-center py-2 rounded-lg font-bold text-xs transition-all",
                            tab === t.id
                                ? `${t.activeBg} text-white shadow-md`
                                : "text-slate-400 hover:text-slate-600"
                        )}
                    >
                        <t.icon size={14} />
                        <span className="mt-0.5">{t.label}</span>
                    </button>
                ))}
            </div>

            {/* Tab Label */}
            <div className="flex items-center gap-2 mb-3">
                <div className={cn("px-2 py-0.5 rounded-full text-xs font-bold", activeTab.bg, activeTab.color)}>
                    {activeTab.fullLabel} 순위
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 animate-pulse">
                    랭킹 집계 중...
                </div>
            ) : (
                <div className="space-y-2">
                    {data.map((item, i) => (
                        <div
                            key={item.id}
                            className={cn(
                                "bg-white rounded-xl px-3 py-3 flex items-center gap-3 border border-slate-100 shadow-sm",
                                i < 3 && "ring-1 ring-inset",
                                i === 0 && "ring-yellow-200 bg-yellow-50/30",
                                i === 1 && "ring-slate-200 bg-slate-50/30",
                                i === 2 && "ring-orange-200 bg-orange-50/30"
                            )}
                        >
                            {/* Rank Badge */}
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0",
                                i === 0 ? "bg-yellow-400 text-white" :
                                    i === 1 ? "bg-slate-400 text-white" :
                                        i === 2 ? "bg-orange-400 text-white" :
                                            "bg-slate-100 text-slate-400"
                            )}>
                                {item.rank}
                            </div>

                            {/* Name */}
                            <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900 truncate">
                                    {item.name}
                                    {i === 0 && <span className="ml-1">👑</span>}
                                </div>
                                <div className="text-[10px] text-slate-400 flex gap-2">
                                    <span>{item.games}경기</span>
                                    <span className="text-yellow-500">🥇{item.rank1}</span>
                                    <span className="text-slate-400">🥈{item.rank2}</span>
                                    <span className="text-orange-500">🥉{item.rank3}</span>
                                </div>
                            </div>

                            {/* Main Stat */}
                            <div className={cn(
                                "text-right shrink-0",
                                activeTab.color
                            )}>
                                <div className="text-2xl font-black">{getMainStat(item)}</div>
                                <div className="text-[10px] opacity-70">{activeTab.fullLabel}</div>
                            </div>

                            {/* Secondary Stats */}
                            <div className="hidden sm:flex flex-col gap-0.5 text-right shrink-0 border-l pl-3 border-slate-100">
                                <div className="text-xs text-slate-500">{item.goals}골 {item.assists}도움</div>
                                <div className="text-xs text-slate-400">승률 {item.winRate}%</div>
                            </div>
                        </div>
                    ))}
                    {data.length === 0 && (
                        <div className="py-10 text-center text-slate-400">데이터가 없습니다.</div>
                    )}
                </div>
            )}
        </div>
    )
}
