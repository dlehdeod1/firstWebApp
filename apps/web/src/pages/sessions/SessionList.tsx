import { Link } from 'react-router-dom'
import { Calendar, Users, MapPin, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

function SessionCard({ status, date, time, location, attendees }: any) {
    const isRecruiting = status === 'recruiting'
    const isClosed = status === 'closed'

    return (
        <Link to="/sessions/1" className="group block bg-white border border-slate-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-blue-100 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider",
                    isRecruiting ? "bg-blue-50 text-blue-600" :
                        isClosed ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-600"
                )}>
                    {status === 'recruiting' ? '모집중' : status === 'closed' ? '마감' : '종료'}
                </div>
                {isRecruiting && (
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                )}
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                {date}
            </h3>

            <div className="space-y-2 text-sm text-slate-500 mb-6">
                <div className="flex items-center gap-2">
                    <Calendar size={14} />
                    <span>{time}</span>
                </div>
                <div className="flex items-center gap-2">
                    <MapPin size={14} />
                    <span>{location}</span>
                </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                <div className="flex items-center gap-2 text-slate-600">
                    <Users size={16} />
                    <span className="font-semibold">{attendees}명</span>
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
    return (
        <div>
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                        일정 목록
                    </h1>
                    <p className="text-slate-500 mt-1">참석 가능한 일정을 확인하세요.</p>
                </div>
                {localStorage.getItem('user_role') === 'admin' && (
                    <Link to="/sessions/new" className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-900/20">
                        <Plus size={18} /> 일정 생성
                    </Link>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <SessionCard
                    status="recruiting"
                    date="12월 17일 (수)"
                    time="20:00 - 22:00"
                    location="경북대 풋살장 A구장"
                    attendees={14}
                />
                <SessionCard
                    status="closed"
                    date="12월 10일 (수)"
                    time="20:00 - 22:00"
                    location="J풋살파크"
                    attendees={18}
                />
                <SessionCard
                    status="finished"
                    date="12월 3일 (수)"
                    time="20:00 - 22:00"
                    location="경북대 풋살장 B구장"
                    attendees={16}
                />
            </div>
        </div>
    )
}
