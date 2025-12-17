import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Users, ClipboardList, Shield, Activity, Lock, Wand2, RefreshCw, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import html2canvas from 'html2canvas'

// Define API Base URL
const API_URL = 'http://localhost:8787'

function TabOverview({ players, status }: { players: any[], status: string }) {
    return (
        <div id="capture-area-overview" className="space-y-6 bg-white p-4 rounded-xl">
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <Users className="text-blue-600" size={20} /> 참석자 명단 ({players.length}명)
                </h3>
                {players.length === 0 ? (
                    <p className="text-slate-400 text-sm">참석자가 아직 없습니다. 관리자가 명단을 업데이트할 때까지 기다려주세요.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {players.map((p, i) => (
                            <span key={i} className="px-3 py-1.5 bg-slate-50 text-slate-700 rounded-lg text-sm font-medium border border-slate-100">
                                {p.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                <h3 className="font-bold text-blue-900 mb-2">상태: {status === 'recruiting' ? '모집 중' : status === 'closed' ? '마감됨' : '종료됨'}</h3>
                <p className="text-blue-700 text-sm leading-relaxed">
                    {status === 'recruiting'
                        ? '현재 참석자를 파악 중입니다. 투표가 마감되면 팀 구성이 시작됩니다.'
                        : '참석 확인이 완료되었습니다. 팀 구성을 확인해주세요.'}
                </p>
            </div>
        </div>
    )
}

function TabTeams({ teams, players, onAssign, isAdmin }: { teams: any[], players: any[], onAssign: (pid: number, tid: number | null) => void, isAdmin: boolean }) {
    // 1. Find Unassigned Players
    // Get all player IDs in teams
    const assignedIds = new Set<number>()
    teams.forEach(t => t.players?.forEach((p: any) => assignedIds.add(p.id)))

    // Filter players who are present (in session.players) but not in any team
    const unassigned = players.filter(p => !assignedIds.has(p.id))

    const colors = [
        { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-900', badge: 'bg-red-500' },
        { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-900', badge: 'bg-blue-500' },
        { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-900', badge: 'bg-emerald-500' }
    ]

    return (
        <div id="capture-area-teams" className="space-y-6">
            {/* Unassigned Area */}
            <div className="bg-slate-100 p-4 rounded-xl border border-dashed border-slate-300">
                <h3 className="font-bold text-slate-500 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Users size={14} /> 미배정 선수 (대기 명단)
                </h3>
                {unassigned.length === 0 ? (
                    <p className="text-xs text-slate-400">대기 중인 선수가 없습니다.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {unassigned.map(p => (
                            <div key={p.id} className="bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-700">{p.name}</span>
                                {isAdmin && (
                                    <select
                                        className="text-[10px] bg-slate-50 border border-slate-200 rounded p-1 outline-none cursor-pointer"
                                        onChange={(e) => onAssign(p.id, Number(e.target.value))}
                                        value=""
                                    >
                                        <option value="" disabled>팀 선택...</option>
                                        {teams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teams.map((team, idx) => {
                    const style = colors[idx % colors.length]
                    return (
                        <div key={team.id} className={cn("p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md", style.bg, style.border)}>
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/50">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md", style.badge)}>
                                    {team.name?.[0]}
                                </div>
                                <h3 className={cn("font-bold text-lg truncate", style.text)}>{team.name}</h3>
                                <div className="ml-auto bg-white/50 px-2 py-0.5 rounded text-xs font-bold opacity-70">
                                    {team.players?.length || 0}명
                                </div>
                            </div>
                            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                                {team.players && team.players.length > 0 ? (
                                    team.players.map((m: any) => (
                                        <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white/60 hover:bg-white/80 transition-colors group">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", style.badge)}></div>
                                                <span className="text-sm font-medium text-slate-700">{m.name}</span>
                                            </div>
                                            {isAdmin && (
                                                <select
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] bg-white border border-slate-200 rounded p-0.5 outline-none max-w-[70px] cursor-pointer"
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        onAssign(m.id, val === 'unassign' ? null : Number(val))
                                                    }}
                                                    value={team.id}
                                                >
                                                    <option value={team.id} disabled>이동</option>
                                                    <option value="unassign">미배정</option>
                                                    {teams.filter((t: any) => t.id !== team.id).map((t: any) => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm opacity-50 text-center py-4">팀원이 없습니다.</div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function TabScoreboard({ matches, teams, onUpdateMatch, isAdmin, canRecord, onRecordEvent, onAddMatch, onDeleteMatch, onClearMatches, onRegenMatches, onAutoFillMatches }: {
    matches: any[],
    teams: any[],
    onUpdateMatch: (id: number, data: any) => void,
    isAdmin: boolean,
    canRecord: boolean,
    onRecordEvent: (mid: number, event: any) => void,
    onAddMatch: () => void,
    onDeleteMatch: (id: number) => void,
    onClearMatches: () => void,
    onRegenMatches: () => void,
    onAutoFillMatches: () => void
}) {
    // Goal Modal State
    const [goalModal, setGoalModal] = useState<{ matchId: number, teamId: number } | null>(null)
    const [selectedScorer, setSelectedScorer] = useState<string>('')
    const [selectedAssister, setSelectedAssister] = useState<string>('')

    const handleSaveGoal = () => {
        if (!goalModal || !selectedScorer) return alert('득점자를 선택해주세요')
        onRecordEvent(goalModal.matchId, {
            type: 'GOAL',
            scorerId: Number(selectedScorer),
            assisterId: selectedAssister ? Number(selectedAssister) : null,
            teamId: goalModal.teamId
        })
        setGoalModal(null)
        setSelectedScorer('')
        setSelectedAssister('')
    }

    // Calculate Standings
    const standings = teams.map(t => ({
        ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
    }))

    matches.forEach(m => {
        const t1 = standings.find(t => t.id === m.team1_id)
        const t2 = standings.find(t => t.id === m.team2_id)
        if (!t1 || !t2) return

        const s1 = m.team1_score || 0
        const s2 = m.team2_score || 0

        t1.played++; t2.played++
        t1.gf += s1; t1.ga += s2
        t2.gf += s2; t2.ga += s1

        if (s1 > s2) { t1.won++; t1.points += 3; t2.lost++; }
        else if (s2 > s1) { t2.won++; t2.points += 3; t1.lost++; }
        else { t1.drawn++; t1.points += 1; t2.drawn++; t2.points += 1; }
    })

    standings.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        const gdA = a.gf - a.ga
        const gdB = b.gf - b.ga
        if (gdB !== gdA) return gdB - gdA
        return b.gf - a.gf
    })

    return (
        <div id="capture-area-scoreboard" className="space-y-8">
            {/* Standings */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm text-center">
                    <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 w-12 text-left whitespace-nowrap">순위</th>
                            <th className="px-4 py-3 text-left whitespace-nowrap">팀</th>
                            <th className="px-2 py-3 whitespace-nowrap">경기</th>
                            <th className="px-2 py-3 text-slate-400 whitespace-nowrap">승</th>
                            <th className="px-2 py-3 text-slate-400 whitespace-nowrap">무</th>
                            <th className="px-2 py-3 text-slate-400 whitespace-nowrap">패</th>
                            <th className="px-2 py-3 whitespace-nowrap">득실</th>
                            <th className="px-4 py-3 font-bold text-blue-600 whitespace-nowrap">승점</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {standings.map((t, i) => (
                            <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3 text-left font-bold text-slate-400">{i + 1}</td>
                                <td className="px-4 py-3 text-left font-bold text-slate-900">{t.name}</td>
                                <td className="px-2 py-3 text-slate-600">{t.played}</td>
                                <td className="px-2 py-3 text-slate-400">{t.won}</td>
                                <td className="px-2 py-3 text-slate-400">{t.drawn}</td>
                                <td className="px-2 py-3 text-slate-400">{t.lost}</td>
                                <td className="px-2 py-3 font-medium text-slate-600">{t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</td>
                                <td className="px-4 py-3 font-extrabold text-blue-600 text-base">{t.points}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Matches */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Activity size={18} /> 매치 일정
                    </h3>
                    {isAdmin && (
                        <div className="flex gap-2 text-xs">
                            <button onClick={onRegenMatches} className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-bold whitespace-nowrap">
                                ↻ 9경기 재생성
                            </button>
                            <button onClick={onAutoFillMatches} className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-bold whitespace-nowrap">
                                + 로테이션 채움
                            </button>
                            <button onClick={onClearMatches} className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-bold whitespace-nowrap">
                                전체 삭제
                            </button>
                            <button onClick={onAddMatch} className="px-3 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold whitespace-nowrap">
                                + 경기 추가
                            </button>
                        </div>
                    )}
                </div>

                {matches.length === 0 && <p className="text-slate-400 text-center py-10">일정이 없습니다.</p>}

                <div className="grid gap-3">
                    {matches.map(m => {
                        const t1 = teams.find(t => t.id === m.team1_id)
                        const t2 = teams.find(t => t.id === m.team2_id)
                        return (
                            <div key={m.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm relative group">
                                <div className="font-bold text-slate-300 w-8 text-xs">#{m.match_no}</div>
                                <div className="flex-1 flex items-center justify-center gap-2 md:gap-4">

                                    {/* Team 1 */}
                                    {isAdmin ? (
                                        <select
                                            value={m.team1_id}
                                            onChange={(e) => onUpdateMatch(m.id, { team1_id: Number(e.target.value) })}
                                            className="w-20 md:w-32 text-right text-sm font-bold bg-transparent border-b border-slate-100 focus:border-blue-500 outline-none truncate"
                                        >
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    ) : (
                                        <span className="font-bold text-slate-800 w-24 md:w-32 text-right truncate text-sm">{t1?.name}</span>
                                    )}

                                    <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 shadow-inner">
                                        {/* Team 1 Controls */}
                                        <div className="flex items-center gap-1">
                                            {canRecord && (
                                                <>
                                                    <button onClick={() => setGoalModal({ matchId: m.id, teamId: m.team1_id })} className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-full text-xs transition-colors" title="골/어시스트 기록">
                                                        ⚽
                                                    </button>
                                                    <button onClick={() => onUpdateMatch(m.id, { team1_score: Math.max(0, m.team1_score - 1) })} className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-500 hover:bg-slate-300 rounded text-xs">
                                                        -
                                                    </button>
                                                </>
                                            )}
                                            <span className="w-6 text-center font-black text-xl text-slate-900">{m.team1_score}</span>
                                            {canRecord && (
                                                <button onClick={() => onUpdateMatch(m.id, { team1_score: m.team1_score + 1 })} className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-500 hover:bg-slate-300 rounded text-xs">
                                                    +
                                                </button>
                                            )}
                                        </div>

                                        <span className="text-slate-300 font-bold">:</span>

                                        {/* Team 2 Controls */}
                                        <div className="flex items-center gap-1">
                                            {canRecord && (
                                                <button onClick={() => onUpdateMatch(m.id, { team2_score: m.team2_score + 1 })} className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-500 hover:bg-slate-300 rounded text-xs">
                                                    +
                                                </button>
                                            )}
                                            <span className="w-6 text-center font-black text-xl text-slate-900">{m.team2_score}</span>
                                            {canRecord && (
                                                <>
                                                    <button onClick={() => onUpdateMatch(m.id, { team2_score: Math.max(0, m.team2_score - 1) })} className="w-5 h-5 flex items-center justify-center bg-slate-200 text-slate-500 hover:bg-slate-300 rounded text-xs">
                                                        -
                                                    </button>
                                                    <button onClick={() => setGoalModal({ matchId: m.id, teamId: m.team2_id })} className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white rounded-full text-xs transition-colors" title="골/어시스트 기록">
                                                        ⚽
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Team 2 */}
                                    {isAdmin ? (
                                        <select
                                            value={m.team2_id}
                                            onChange={(e) => onUpdateMatch(m.id, { team2_id: Number(e.target.value) })}
                                            className="w-20 md:w-32 text-left text-sm font-bold bg-transparent border-b border-slate-100 focus:border-blue-500 outline-none truncate"
                                        >
                                            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    ) : (
                                        <span className="font-bold text-slate-800 w-24 md:w-32 text-left truncate text-sm">{t2?.name}</span>
                                    )}
                                </div>
                                {isAdmin && (
                                    <button onClick={() => onDeleteMatch(m.id)} className="absolute top-2 right-2 p-1.5 text-slate-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                                        <div className="w-4 h-4 flex items-center justify-center">x</div>
                                    </button>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Goal Modal */}
            {goalModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
                        <h3 className="font-bold text-lg text-center">골 기록</h3>
                        <div>
                            <label className="text-xs font-bold text-slate-500">득점자 (골)</label>
                            <select
                                value={selectedScorer}
                                onChange={e => setSelectedScorer(e.target.value)}
                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold border border-slate-200"
                            >
                                <option value="">선택하세요</option>
                                {teams.find(t => t.id === goalModal.teamId)?.players?.map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500">도움 (어시스트)</label>
                            <select
                                value={selectedAssister}
                                onChange={e => setSelectedAssister(e.target.value)}
                                className="w-full mt-1 p-3 bg-slate-50 rounded-xl font-bold border border-slate-200"
                            >
                                <option value="">없음 (개인 돌파)</option>
                                {teams.find(t => t.id === goalModal.teamId)?.players?.filter((p: any) => p.id !== Number(selectedScorer)).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setGoalModal(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold text-slate-600">취소</button>
                            <button onClick={handleSaveGoal} className="flex-1 py-3 bg-blue-600 rounded-xl font-bold text-white shadow-lg shadow-blue-500/30">기록 저장</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default function SessionDetail() {
    const { id } = useParams()
    const [session, setSession] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'scoreboard'>('overview')

    // Auth State
    const role = localStorage.getItem('user_role')
    const isAdmin = ['admin', 'ADMIN', 'owner', 'OWNER'].includes(role || '')
    const canRecord = isAdmin || ['recorder', 'RECORDER'].includes(role || '')

    // Admin Actions State
    const [parseText, setParseText] = useState('')
    const [parsing, setParsing] = useState(false)
    const [parseResult, setParseResult] = useState<{ matched: any[], unknown: string[] } | null>(null)

    useEffect(() => {
        fetch(`${API_URL}/sessions/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error)
                setSession(data)
                if (data.status === 'closed' && data.teams?.length > 0) {
                    setActiveTab('teams')
                }
            })
            .catch(() => setError('세션을 찾을 수 없거나 연결 실패'))
    }, [id])

    const refreshSession = async () => {
        try {
            const res = await fetch(`${API_URL}/sessions/${id}`)
            const data = await res.json()
            setSession(data)
        } catch (e) { console.error(e) }
    }

    const handleParse = async () => {
        setParsing(true)
        try {
            const res = await fetch(`${API_URL}/sessions/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: parseText })
            })
            const data = await res.json()
            setParseResult({ matched: data.matched, unknown: data.unknown })
        } catch (e) {
            alert('Failed to parse')
        } finally {
            setParsing(false)
        }
    }

    const handleSaveAttendees = async () => {
        if (!parseResult) return

        const totalCount = parseResult.matched.length + parseResult.unknown.length
        const confirmMsg = parseResult.unknown.length > 0
            ? `기존 회원 ${parseResult.matched.length}명과 신규(미등록) ${parseResult.unknown.length}명을 포함하여 총 ${totalCount}명을 등록하시겠습니까?\n(신규 회원은 자동 생성됩니다)`
            : `총 ${totalCount}명의 참석자를 등록하시겠습니까?`

        if (!confirm(confirmMsg)) return

        let playerIds = parseResult.matched.map((p: any) => p.id)

        if (parseResult.unknown.length > 0) {
            try {
                const newIds = await Promise.all(parseResult.unknown.map(async (name) => {
                    const res = await fetch(`${API_URL}/players`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name })
                    })
                    const data = await res.json()
                    return data.id
                }))
                playerIds = [...playerIds, ...newIds]
            } catch (e) {
                alert('신규 회원 생성 중 오류가 발생했습니다.')
                return
            }
        }

        await fetch(`${API_URL}/sessions/${id}/attendance`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_ids: playerIds })
        })
        alert('저장되었습니다.')
        setParseResult(null)
        setParseText('')
        refreshSession()
    }

    const handleStatusChange = async (newStatus: string) => {
        if (newStatus === 'closed' && !confirm('마감 처리 하시겠습니까? 더 이상 참석자를 수정할 수 없게 됩니다.')) return
        if (newStatus === 'recruiting' && !confirm('마감을 취소하고 다시 모집 중으로 변경하시겠습니까?')) return

        await fetch(`${API_URL}/sessions/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        })
        refreshSession()
    }

    const handleCloseSession = () => handleStatusChange('closed')

    // Generate Teams
    const handleGenerateTeams = async () => {
        if (!confirm('기존 팀 구성이 모두 초기화되고 새로 생성됩니다. 계속하시겠습니까? (덮어쓰기)')) return
        try {
            const res = await fetch(`${API_URL}/sessions/${id}/teams/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numTeams: 3 })
            })
            if (res.ok) {
                // Refresh
                window.location.reload()
            }
        } catch (error) {
            console.error(error)
        }
    }

    // Update Match Score
    const handleUpdateMatch = async (matchId: number, data: any) => {
        try {
            await fetch(`${API_URL}/matches/${matchId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            // Refresh matches locally or reload
            setSession((prev: any) => ({
                ...prev,
                matches: prev.matches.map((m: any) => m.id === matchId ? { ...m, ...data } : m)
            }))
        } catch (error) {
            console.error(error)
        }
    }

    // Record Goal Event
    const handleRecordEvent = async (matchId: number, event: any) => {
        try {
            await fetch(`${API_URL}/matches/${matchId}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            })
            refreshSession() // Reload session to get updated scores
        } catch (error) {
            console.error(error)
            alert('기록 실패')
        }
    }

    const handleClearMatches = async () => {
        if (!confirm('모든 경기를 삭제하시겠습니까?')) return
        await fetch(`${API_URL}/sessions/${id}/matches`, { method: 'DELETE' })
        refreshSession()
    }

    const handleRegenMatches = async () => {
        if (!confirm('기존 경기를 삭제하고 9경기를 새로 생성합니다.')) return
        await fetch(`${API_URL}/sessions/${id}/matches/generate`, { method: 'POST' })
        refreshSession()
    }

    const handleAutoFillMatches = async () => {
        await fetch(`${API_URL}/sessions/${id}/matches/autofill`, { method: 'POST' })
        refreshSession()
    }

    const handleAddMatch = async () => {
        if (!session.teams || session.teams.length < 2) return alert('팀이 최소 2개 필요합니다.')

        await fetch(`${API_URL}/matches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: id,
                team1_id: session.teams[0].id,
                team2_id: session.teams[1].id
            })
        })
        refreshSession()
    }

    const handleDeleteMatch = async (mid: number) => {
        if (!confirm('경기를 삭제하시겠습니까?')) return
        await fetch(`${API_URL}/matches/${mid}`, { method: 'DELETE' })
        refreshSession()
    }

    const handleAssignPlayer = async (playerId: number, teamId: number | null) => {
        await fetch(`${API_URL}/sessions/${id}/teams/assign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, teamId })
        })
        refreshSession()
    }

    const handleCapture = async () => {
        const elementId = `capture-area-${activeTab}`
        const element = document.getElementById(elementId)
        if (!element) return

        try {
            const canvas = await html2canvas(element, { useCORS: true, backgroundColor: '#ffffff', scale: 2 })
            const link = document.createElement('a')
            link.href = canvas.toDataURL('image/png')
            link.download = `wed_futsal_${session.session_date}_${activeTab}.png`
            link.click()
        } catch (e) {
            console.error('Capture failed', e)
            alert('이미지 저장에 실패했습니다.')
        }
    }

    if (error) return (
        <div className="p-20 text-center">
            <h2 className="text-xl font-bold text-slate-700 mb-2">오류 발생</h2>
            <p className="text-slate-500">{error}</p>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-slate-200 rounded text-slate-700 font-bold">새로고침</button>
        </div>
    )

    if (!session) return <div className="p-20 text-center text-slate-500 animate-pulse">데이터 로딩 중...</div>

    const tabs = [
        { id: 'overview' as const, label: '개요/참석', icon: ClipboardList },
        { id: 'teams' as const, label: '팀 구성 (수동)', icon: Shield },
        { id: 'scoreboard' as const, label: '점수판', icon: Activity },
    ]

    return (
        <div className="max-w-4xl mx-auto pb-20">
            {/* Toggle Admin Mode */}
            <div className="flex justify-end mb-4 gap-2">
                <button
                    onClick={handleCapture}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 font-bold"
                >
                    <Download size={14} /> 이미지 저장
                </button>
            </div>

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                        {session.session_date}
                    </span>
                    <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold uppercase",
                        session.status === 'recruiting' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}>
                        {session.status}
                    </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className="text-3xl font-extrabold text-slate-900">{session.title || '정기 풋살'}</h1>
                    <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
                        <span className="flex items-center gap-1"><MapPin size={16} /> 경북대 A구장</span>
                    </div>
                </div>
            </div>

            {/* Admin Controls Area */}
            {isAdmin && (
                <div className="bg-slate-900 rounded-2xl p-6 mb-8 text-white shadow-xl">
                    <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                        <Lock size={18} className="text-yellow-400" /> 관리자 컨트롤 패널
                    </h2>

                    {/* Step 1: Manage Attendees (Only if recruiting) */}
                    {session.status === 'recruiting' && (
                        <div className="space-y-4 mb-8 border-b border-slate-700 pb-6">
                            <label className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                <Wand2 size={14} /> 카카오톡 투표 붙여넣기 (참석자 갱신)
                            </label>
                            <textarea
                                className="w-full h-32 p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm font-mono text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="카톡 내용을 붙여넣으세요..."
                                value={parseText}
                                onChange={(e) => setParseText(e.target.value)}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleParse}
                                    disabled={parsing || !parseText}
                                    className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-bold hover:bg-blue-500 disabled:opacity-50"
                                >
                                    {parsing ? '분석 중...' : '1. 분석하기'}
                                </button>

                                {parseResult && (
                                    <button
                                        onClick={handleSaveAttendees}
                                        className="px-4 py-2 bg-emerald-600 rounded-lg text-sm font-bold hover:bg-emerald-500 animate-pulse"
                                    >
                                        2. 결과 저장 (기존 {parseResult.matched.length}명 + 신규 {parseResult.unknown.length}명)
                                    </button>
                                )}
                            </div>

                            {parseResult && (
                                <div className="mt-4 p-4 bg-slate-800 rounded-xl border border-slate-700">
                                    <div className="flex flex-wrap gap-2">
                                        {parseResult.matched.map((p, i) => (
                                            <span key={`m-${i}`} className="px-2 py-1 bg-emerald-900/50 text-emerald-400 border border-emerald-800 rounded text-xs">
                                                {p.name}
                                            </span>
                                        ))}
                                        {parseResult.unknown.map((name, i) => (
                                            <span key={`u-${i}`} className="px-2 py-1 bg-yellow-900/50 text-yellow-400 border border-yellow-800 rounded text-xs flex items-center gap-1">
                                                <Wand2 size={10} /> {name} (신규)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Close & Generate */}
                    <div className="flex flex-wrap gap-4 items-center">
                        {session.status === 'recruiting' ? (
                            <button
                                onClick={handleCloseSession}
                                className="px-6 py-3 bg-red-600 rounded-xl font-bold flex items-center gap-2 hover:bg-red-500"
                            >
                                <Lock size={18} /> 마감 처리 (Finalize)
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <button className="px-6 py-3 bg-slate-700 text-slate-400 rounded-xl font-bold flex items-center gap-2 cursor-not-allowed">
                                    <Lock size={18} /> 마감 완료됨
                                </button>
                                <button
                                    onClick={() => handleStatusChange('recruiting')}
                                    className="px-4 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-700 hover:text-white border border-slate-700"
                                    title="마감 취소 (다시 모집 중으로 변경)"
                                >
                                    <RefreshCw size={18} /> 마감 취소
                                </button>
                            </div>
                        )}

                        <div className="h-8 w-px bg-slate-700 mx-2 hidden md:block"></div>

                        <button
                            onClick={handleGenerateTeams}
                            disabled={session.status !== 'closed'}
                            className={cn(
                                "px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all",
                                session.status === 'closed'
                                    ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                            )}
                        >
                            <Shield size={18} /> 팀 자동 생성
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex overflow-x-auto gap-2 mb-6 p-1 bg-slate-100/50 rounded-xl border border-slate-100 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                        )}
                    >
                        <tab.icon size={16} className={activeTab === tab.id ? "text-blue-600" : ""} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="min-h-[300px]">
                {activeTab === 'overview' && <TabOverview players={session.players || []} status={session.status} />}
                {activeTab === 'teams' && (
                    <TabTeams
                        teams={session.teams || []}
                        players={session.players || []}
                        onAssign={handleAssignPlayer}
                        isAdmin={isAdmin}
                    />
                )}
                {activeTab === 'scoreboard' && (
                    <TabScoreboard
                        matches={session.matches || []}
                        teams={session.teams || []}
                        onUpdateMatch={handleUpdateMatch}
                        isAdmin={isAdmin}
                        canRecord={canRecord}
                        onRecordEvent={handleRecordEvent}
                        onAddMatch={handleAddMatch}
                        onDeleteMatch={handleDeleteMatch}
                        onClearMatches={handleClearMatches}
                        onRegenMatches={handleRegenMatches}
                        onAutoFillMatches={handleAutoFillMatches}
                    />
                )}
            </div>
        </div>
    )
}
