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
}

export default function RankingsPage() {
    const [tab, setTab] = useState<'goals' | 'assists' | 'points'>('points')
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
        { id: 'points' as const, label: '공격포인트', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50' },
        { id: 'goals' as const, label: '득점왕', icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-50' },
        { id: 'assists' as const, label: '도움왕', icon: Medal, color: 'text-blue-500', bg: 'bg-blue-50' },
    ]

    return (
        <div className="max-w-2xl mx-auto p-4 pb-24">
            <h1 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
                <Trophy className="text-yellow-500" /> 명예의 전당 (Top 10)
            </h1>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all",
                            tab === t.id
                                ? `${t.bg} ${t.color} shadow-sm ring-1 ring-inset ring-black/5`
                                : "bg-white text-slate-400 hover:bg-slate-50 border border-slate-100"
                        )}
                    >
                        <t.icon size={16} />
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {loading ? (
                <div className="py-20 text-center text-slate-400 animate-pulse">
                    랭킹 집계 중...
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-4 py-3 w-12 text-center whitespace-nowrap">#</th>
                                <th className="px-4 py-3 text-left whitespace-nowrap">선수</th>
                                <th className="px-2 py-3 text-center whitespace-nowrap">경기</th>
                                <th className={cn("px-2 py-3 text-center w-16 whitespace-nowrap", tab === 'goals' && "bg-yellow-50 text-yellow-700")}>득점</th>
                                <th className={cn("px-2 py-3 text-center w-16 whitespace-nowrap", tab === 'assists' && "bg-blue-50 text-blue-700")}>도움</th>
                                <th className={cn("px-2 py-3 text-center w-16 whitespace-nowrap", tab === 'points' && "bg-orange-50 text-orange-700")}>공격P</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.map((item, i) => (
                                <tr key={item.id} className={cn("hover:bg-slate-50 transition-colors", i < 3 && "bg-slate-50/30")}>
                                    <td className="px-4 py-3 text-center">
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
                                    <td className="px-4 py-3 font-bold text-slate-900">
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
                                </tr>
                            ))}
                            {data.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-slate-400">데이터가 없습니다.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
