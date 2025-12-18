import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Users, MapPin, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787'

function getSeasonTitle(dateStr: string) {
    const date = new Date(dateStr)
    const year = date.getFullYear()

    // Find 1st Wednesday of the year
    const firstJan = new Date(year, 0, 1)
    const day = firstJan.getDay()
    const diff = (3 - day + 7) % 7 // Distance to next Wednesday (0=Sun, 3=Wed)
    const firstWed = new Date(year, 0, 1 + diff)

    // Calculate difference in weeks
    const msDiff = date.getTime() - firstWed.getTime()
    if (msDiff < 0) return `${year} 프리시즌` // Before first Wed

    const weekNum = Math.floor(msDiff / (7 * 24 * 60 * 60 * 1000)) + 1
    return `${year}시즌 ${weekNum}경기`
}

function SessionCard({ session }: { session: any }) {
    const isRecruiting = session.status === 'recruiting'
    const isClosed = session.status === 'closed'
    const dateTitle = getSeasonTitle(session.session_date)

    return (
        <Link to={`/sessions/${session.id}`} className="group block bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
                    isRecruiting ? "bg-blue-50 text-blue-600" :
                        isClosed ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"
                )}>
                    {session.status === 'recruiting' ? '모집중' : session.status === 'closed' ? '마감' : '종료'}
                </div>
                {isRecruiting && (
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                {dateTitle}
            </h3>

            <div className="space-y-2 text-sm text-slate-500 mb-6">
                <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{session.session_date} (수) 20:00</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>경북대 풋살장 A구장</span>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Users size={16} />
                    <span className="font-semibold">{session.attendance_count || 0}명</span>
                    <span className="text-slate-400 font-normal">참석</span>
                </div>
                <span className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <ChevronRight size={18} />
                </span>
            </div>
        </Link>
    )
}

export default function SessionList() {
    const [sessions, setSessions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const role = localStorage.getItem('user_role')
    const isAdmin = ['ADMIN', 'OWNER', 'admin', 'owner'].includes(role || '')

    useEffect(() => {
        fetch(`${API_URL}/sessions`)
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setSessions(data)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                        일정 목록
                    </h1>
                    <p className="text-slate-500 mt-1">참석 가능한 일정을 확인하세요.</p>
                </div>
                {isAdmin && (
                    <Link to="/sessions/new" className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-200">
                        <Plus size={18} />
                        일정 생성
                    </Link>
                )}
            </div>
            {
                loading ? (
                    <div className="text-center py-20 text-slate-400">일정을 불러오는 중...</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {sessions.map(session => (
                            <SessionCard key={session.id} session={session} />
                        ))}
                        {sessions.length === 0 && (
                            <div className="col-span-full text-center py-20 text-slate-400">
                                등록된 일정이 없습니다.
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    )
}
