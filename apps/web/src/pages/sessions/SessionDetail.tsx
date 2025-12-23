import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { MapPin, Users, ClipboardList, Shield, Activity, Lock, Wand2, RefreshCw, Download, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import html2canvas from 'html2canvas'
import ShareCard from '@/components/ShareCard'
import RatingModal from '@/components/RatingModal'
import { useTheme } from '@/contexts/ThemeContext'

// Define API Base URL
const API_URL = import.meta.env.VITE_API_URL || 'https://conerkicks-api.conerkicks.workers.dev'

function TabOverview({ players, status }: { players: any[], status: string }) {
    const { actualTheme } = useTheme()
    return (
        <div id="capture-area-overview" className={cn("space-y-6 p-4 rounded-xl",
            actualTheme === 'dark' ? "bg-slate-800" : "bg-white"
        )}>
            <div className={cn("p-6 rounded-2xl border shadow-sm",
                actualTheme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-slate-100"
            )}>
                <h3 className={cn("font-bold text-lg mb-4 flex items-center gap-2",
                    actualTheme === 'dark' ? "text-slate-100" : "text-slate-900"
                )}>
                    <Users className="text-blue-600" size={20} /> 참석자 명단 ({players.length}명)
                </h3>
                {players.length === 0 ? (
                    <p className={cn("text-sm", actualTheme === 'dark' ? "text-slate-500" : "text-slate-400")}>참석자가 아직 없습니다. 관리자가 명단을 업데이트할 때까지 기다려주세요.</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {players.map((p, i) => (
                            <span key={i} className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border",
                                actualTheme === 'dark' ? "bg-slate-900/50 text-slate-300 border-slate-700" : "bg-slate-50 text-slate-700 border-slate-100"
                            )}>
                                {p.name}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className={cn("p-6 rounded-2xl border",
                actualTheme === 'dark' ? "bg-blue-900/30 border-blue-800/50" : "bg-blue-50 border-blue-100"
            )}>
                <h3 className={cn("font-bold mb-2",
                    actualTheme === 'dark' ? "text-blue-300" : "text-blue-900"
                )}>상태: {status === 'recruiting' ? '모집 중' : status === 'closed' ? '마감됨' : '종료됨'}</h3>
                <p className={cn("text-sm leading-relaxed",
                    actualTheme === 'dark' ? "text-blue-200" : "text-blue-700"
                )}>
                    {status === 'recruiting'
                        ? '현재 참석자를 파악 중입니다. 투표가 마감되면 팀 구성이 시작됩니다.'
                        : '참석 확인이 완료되었습니다. 팀 구성을 확인해주세요.'}
                </p>
            </div>
        </div>
    )
}

// Calculate team power analysis (0-100 scale)
function calculateTeamPower(teamPlayers: any[]) {
    if (!teamPlayers || teamPlayers.length === 0) return null

    const stats = {
        attack: 0,    // shooting + offball_run
        defense: 0,   // intercept + marking
        midfield: 0,  // passing + ball_keeping
        physical: 0,  // stamina + speed + physical
        overall: 0
    }

    let validPlayers = 0
    teamPlayers.forEach((p: any) => {
        // Check if player has stats
        if (p.shooting !== undefined) {
            stats.attack += (p.shooting || 50) + (p.offball_run || 50)
            stats.defense += (p.intercept || 50) + (p.marking || 50)
            stats.midfield += (p.passing || 50) + (p.ball_keeping || 50)
            stats.physical += (p.stamina || 50) + (p.speed || 50) + (p.physical || 50)
            validPlayers++
        }
    })

    if (validPlayers === 0) return null

    // Average per player, divided by max possible (2 stats at 100 each = 200, 3 stats = 300)
    stats.attack = Math.round((stats.attack / validPlayers / 200) * 100)
    stats.defense = Math.round((stats.defense / validPlayers / 200) * 100)
    stats.midfield = Math.round((stats.midfield / validPlayers / 200) * 100)
    stats.physical = Math.round((stats.physical / validPlayers / 300) * 100)
    stats.overall = Math.round((stats.attack + stats.defense + stats.midfield + stats.physical) / 4)

    return stats
}

// Determine player position based on stats
function getPlayerPosition(player: any): { position: 'FW' | 'MF' | 'DF', color: string, emoji: string } {
    if (!player || player.shooting === undefined) {
        return { position: 'MF', color: 'bg-yellow-100 text-yellow-800', emoji: '🔶' } // Default
    }

    const attackScore = (player.shooting || 5) + (player.offball_run || 5)
    const midScore = (player.passing || 5) + (player.ball_keeping || 5)
    const defScore = (player.intercept || 5) + (player.marking || 5)

    if (attackScore >= midScore && attackScore >= defScore) {
        return { position: 'FW', color: 'bg-red-100 text-red-700', emoji: '⚡' }
    } else if (defScore >= midScore && defScore >= attackScore) {
        return { position: 'DF', color: 'bg-blue-100 text-blue-700', emoji: '🛡️' }
    } else {
        return { position: 'MF', color: 'bg-yellow-100 text-yellow-800', emoji: '🔶' }
    }
}

function TabTeams({ teams, players, onAssign, isAdmin, sessionId, onUpdateTeamName }: {
    teams: any[],
    players: any[],
    onAssign: (pid: number, tid: number | null) => void,
    isAdmin: boolean,
    sessionId: string,
    onUpdateTeamName?: (teamId: number, name: string) => void
}) {
    const [editingTeamId, setEditingTeamId] = useState<number | null>(null)
    const [editingName, setEditingName] = useState('')
    const [ratingPlayer, setRatingPlayer] = useState<{ id: number, name: string } | null>(null)

    // 1. Find Unassigned Players
    // Get all player IDs in teams
    const assignedIds = new Set<number>()
    teams.forEach(t => t.players?.forEach((p: any) => assignedIds.add(p.id)))

    // Filter players who are present (in session.players) but not in any team
    const unassigned = players.filter(p => !assignedIds.has(p.id))

    const colors = [
        { bg: 'bg-red-50', border: 'border-red-100', text: 'text-red-900', badge: 'bg-red-500', bar: 'bg-red-400' },
        { bg: 'bg-blue-50', border: 'border-blue-100', text: 'text-blue-900', badge: 'bg-blue-500', bar: 'bg-blue-400' },
        { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-900', badge: 'bg-emerald-500', bar: 'bg-emerald-400' }
    ]

    // Get AI analysis from team's stored score_stats (saved during team generation)
    const getTeamAi = (team: any) => {
        if (!team.score_stats) return null
        try {
            return typeof team.score_stats === 'string'
                ? JSON.parse(team.score_stats)
                : team.score_stats
        } catch {
            return null
        }
    }

    const handleStartEdit = (team: any) => {
        setEditingTeamId(team.id)
        setEditingName(team.name)
    }

    const handleSaveEdit = () => {
        if (editingTeamId && editingName.trim() && onUpdateTeamName) {
            onUpdateTeamName(editingTeamId, editingName.trim())
        }
        setEditingTeamId(null)
        setEditingName('')
    }

    const handleCancelEdit = () => {
        setEditingTeamId(null)
        setEditingName('')
    }

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

            {/* AI Analysis Button */}
            {isAdmin && teams.length > 0 && (
                <div className="flex justify-center">
                    <button
                        onClick={async () => {
                            const token = localStorage.getItem('auth_token')
                            if (!token) return alert('로그인이 필요합니다')

                            if (!confirm('현재 팀 구성을 AI로 분석하시겠습니까?')) return

                            try {
                                const res = await fetch(`${API_URL}/sessions/${sessionId}/analyze-teams`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    }
                                })

                                if (res.ok) {
                                    alert('팀 분석이 완료되었습니다! 페이지를 새로고침합니다.')
                                    window.location.reload()
                                } else {
                                    const err = await res.json()
                                    alert(`분석 실패: ${err.error || '알 수 없는 오류'}`)
                                }
                            } catch (e: any) {
                                alert(`분석 실패: ${e?.message || '네트워크 오류'}`)
                            }
                        }}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 transition-all"
                    >
                        <span className="text-lg">🤖</span>
                        AI 팀 분석
                    </button>
                </div>
            )}

            {/* Teams Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {teams.map((team, idx) => {
                    const style = colors[idx % colors.length]
                    const power = calculateTeamPower(team.players)
                    const teamAi = getTeamAi(team)
                    const isEditing = editingTeamId === team.id
                    return (
                        <div key={team.id} className={cn("p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md", style.bg, style.border)}>
                            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/50">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md", style.badge)}>
                                    {teamAi?.emoji || team.name?.[0]}
                                </div>
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                className="flex-1 px-2 py-1 border border-slate-300 rounded text-sm font-bold"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveEdit()
                                                    if (e.key === 'Escape') handleCancelEdit()
                                                }}
                                            />
                                            <button onClick={handleSaveEdit} className="text-emerald-600 hover:text-emerald-700 text-xs font-bold">✓</button>
                                            <button onClick={handleCancelEdit} className="text-slate-400 hover:text-slate-600 text-xs font-bold">✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <h3 className={cn("font-bold text-lg truncate", style.text)}>{team.name}</h3>
                                            {isAdmin && onUpdateTeamName && (
                                                <button
                                                    onClick={() => handleStartEdit(team)}
                                                    className="text-slate-400 hover:text-slate-600 text-xs opacity-60 hover:opacity-100"
                                                    title="팀명 수정"
                                                >
                                                    ✏️
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {teamAi && !isEditing && (
                                        <span className="text-xs font-medium text-slate-500">{teamAi.type}</span>
                                    )}
                                </div>
                                <div className="bg-white/50 px-2 py-0.5 rounded text-xs font-bold opacity-70">
                                    {team.players?.length || 0}명
                                </div>
                            </div>

                            {/* AI Strategy Analysis (from stored score_stats) */}
                            {teamAi && (
                                <div className="mb-4 p-3 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl border border-purple-100">
                                    <div className="flex items-center gap-1 mb-2">
                                        <span className="text-xs font-bold text-purple-700">🤖 AI 전략</span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{teamAi.strategy}</p>
                                    <div className="text-xs">
                                        <span className="font-bold text-indigo-600">⭐ 핵심선수:</span>
                                        <span className="ml-1 text-slate-700">{teamAi.keyPlayer}</span>
                                        {teamAi.keyPlayerReason && (
                                            <span className="text-slate-400 ml-1">- {teamAi.keyPlayerReason}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Team Power Analysis */}
                            {power && (
                                <div className="mb-4 p-3 bg-white/70 rounded-xl space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-slate-500">전력 분석</span>
                                        <span className={cn("font-black text-lg", style.text)}>{power.overall}</span>
                                    </div>
                                    <div className="space-y-1.5">
                                        {[
                                            { label: '공격', value: power.attack, emoji: '⚔️' },
                                            { label: '수비', value: power.defense, emoji: '🛡️' },
                                            { label: '미드', value: power.midfield, emoji: '🎯' },
                                            { label: '체력', value: power.physical, emoji: '💪' },
                                        ].map(stat => (
                                            <div key={stat.label} className="flex items-center gap-2">
                                                <span className="text-xs w-4">{stat.emoji}</span>
                                                <span className="text-[10px] text-slate-500 w-8">{stat.label}</span>
                                                <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full rounded-full transition-all", style.bar)}
                                                        style={{ width: `${stat.value}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-600 w-6 text-right">{stat.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                {team.players && team.players.length > 0 ? (
                                    team.players.map((m: any) => {
                                        const pos = getPlayerPosition(m)
                                        return (
                                            <div key={m.id} className="flex items-center justify-between p-2 rounded-lg bg-white/60 hover:bg-white/80 transition-colors group">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("w-1.5 h-1.5 rounded-full", style.badge)}></div>
                                                    <span className="text-sm font-medium text-slate-700">{m.name}</span>
                                                    <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded", pos.color)}>
                                                        {pos.position}
                                                    </span>
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
                                                <button
                                                    onClick={() => setRatingPlayer({ id: m.id, name: m.name })}
                                                    className="p-1 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded transition-colors"
                                                    title="선수 평가"
                                                >
                                                    ⭐
                                                </button>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-sm opacity-50 text-center py-4">팀원이 없습니다.</div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Rating Modal */}
            {ratingPlayer && (
                <RatingModal
                    player={ratingPlayer}
                    sessionId={Number(sessionId)}
                    onClose={() => setRatingPlayer(null)}
                />
            )}
        </div>
    )
}

function TabScoreboard({ matches, teams, onUpdateMatch, isAdmin, onAddMatch, onDeleteMatch, onClearMatches, onRegenMatches, onAutoFillMatches, sessionId }: {
    matches: any[],
    teams: any[],
    onUpdateMatch: (id: number, data: any) => void,
    isAdmin: boolean,
    onAddMatch: () => void,
    onDeleteMatch: (id: number) => void,
    onClearMatches: () => void,
    onRegenMatches: () => void,
    onAutoFillMatches: () => void,
    sessionId: string
}) {
    const navigate = useNavigate()

    // Calculate Standings - only from completed matches
    const standings = teams.map(t => ({
        ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
    }))

    // Filter only completed matches for standings
    const completedMatches = matches.filter(m => m.status === 'completed')

    completedMatches.forEach(m => {
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
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {standings.map((t, i) => (
                        <div key={t.id} className="p-4 flex items-center gap-4">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                                i === 0 ? "bg-yellow-100 text-yellow-700" :
                                    i === 1 ? "bg-slate-200 text-slate-700" :
                                        i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"
                            )}>
                                {i + 1}
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-900">{t.name}</div>
                                <div className="text-xs text-slate-400">{t.played}경기 · {t.won}승 {t.drawn}무 {t.lost}패</div>
                            </div>
                            <div className="text-right">
                                <div className="font-extrabold text-xl text-blue-600">{t.points}</div>
                                <div className="text-xs text-slate-400">득실 {t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-center">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-100 text-xs uppercase tracking-wider">
                            <tr>
                                <th className="px-3 py-3 w-10 text-left">순위</th>
                                <th className="px-3 py-3 text-left">팀</th>
                                <th className="px-2 py-3">경기</th>
                                <th className="px-2 py-3 text-slate-400">승</th>
                                <th className="px-2 py-3 text-slate-400">무</th>
                                <th className="px-2 py-3 text-slate-400">패</th>
                                <th className="px-2 py-3">득실</th>
                                <th className="px-3 py-3 font-bold text-blue-600">승점</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {standings.map((t, i) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-3 text-left font-bold text-slate-400">{i + 1}</td>
                                    <td className="px-3 py-3 text-left font-bold text-slate-900">{t.name}</td>
                                    <td className="px-2 py-3 text-slate-600">{t.played}</td>
                                    <td className="px-2 py-3 text-slate-400">{t.won}</td>
                                    <td className="px-2 py-3 text-slate-400">{t.drawn}</td>
                                    <td className="px-2 py-3 text-slate-400">{t.lost}</td>
                                    <td className="px-2 py-3 font-medium text-slate-600">{t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</td>
                                    <td className="px-3 py-3 font-extrabold text-blue-600 text-base">{t.points}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Matches */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <Activity size={18} /> 매치 일정
                    </h3>
                    {isAdmin && (
                        <div className="flex flex-wrap gap-2 text-xs">
                            <button onClick={onRegenMatches} className="px-2 py-1.5 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-bold">
                                ↻ 재생성
                            </button>
                            <button onClick={onAutoFillMatches} className="px-2 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-bold">
                                + 채움
                            </button>
                            <button onClick={onClearMatches} className="px-2 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-bold">
                                삭제
                            </button>
                            <button onClick={onAddMatch} className="px-2 py-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 font-bold">
                                + 추가
                            </button>
                        </div>
                    )}
                </div>

                {matches.length === 0 && <p className="text-slate-400 text-center py-10">일정이 없습니다.</p>}

                <div className="grid gap-3">
                    {matches.map(m => {
                        const t1 = teams.find(t => t.id === m.team1_id)
                        const t2 = teams.find(t => t.id === m.team2_id)
                        const isCompleted = m.status === 'completed'
                        return (
                            <div key={m.id} className={cn(
                                "bg-white p-4 rounded-xl border flex items-center justify-between shadow-sm relative group",
                                isCompleted ? "border-green-200" : "border-slate-200 opacity-75"
                            )}>
                                {/* Match Number & Status */}
                                <div className="flex flex-col items-center gap-1 w-12">
                                    <div className="font-bold text-slate-300 text-xs">#{m.match_no}</div>
                                    {isAdmin && (
                                        <button
                                            onClick={() => onUpdateMatch(m.id, { status: isCompleted ? 'pending' : 'completed' })}
                                            className={cn(
                                                "text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors",
                                                isCompleted ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                            )}
                                            title={isCompleted ? "경기 완료됨 (클릭해서 대기로 변경)" : "대기 중 (클릭해서 완료로 변경)"}
                                        >
                                            {isCompleted ? "완료" : "대기"}
                                        </button>
                                    )}
                                    {!isAdmin && (
                                        <span className={cn(
                                            "text-[10px] px-1.5 py-0.5 rounded font-bold",
                                            isCompleted ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                                        )}>
                                            {isCompleted ? "완료" : "대기"}
                                        </span>
                                    )}
                                </div>
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

                                    {/* Score - Click to open match live page */}
                                    <button
                                        onClick={() => navigate(`/sessions/${sessionId}/match/${m.id}/record`)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-2 rounded-xl border shadow-inner transition-all cursor-pointer group",
                                            isCompleted
                                                ? "bg-green-50 border-green-200 hover:bg-green-100"
                                                : "bg-slate-50 border-slate-100 hover:bg-slate-100 hover:border-blue-200"
                                        )}
                                        title="클릭하여 기록 페이지로 이동"
                                    >
                                        <span className={cn(
                                            "w-8 text-center font-black text-2xl transition-colors",
                                            isCompleted ? "text-green-700" : "text-slate-400 group-hover:text-blue-600"
                                        )}>{isCompleted ? (m.team1_score ?? 0) : "-"}</span>
                                        <span className="text-slate-300 font-bold">:</span>
                                        <span className={cn(
                                            "w-8 text-center font-black text-2xl transition-colors",
                                            isCompleted ? "text-green-700" : "text-slate-400 group-hover:text-blue-600"
                                        )}>{isCompleted ? (m.team2_score ?? 0) : "-"}</span>
                                    </button>

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
        </div>
    )
}

export default function SessionDetail() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { actualTheme } = useTheme()
    const [searchParams] = useSearchParams()
    const initialTab = (searchParams.get('tab') as 'overview' | 'teams' | 'scoreboard') || 'overview'
    const [session, setSession] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'scoreboard'>(initialTab)
    const [showShareCard, setShowShareCard] = useState(false)

    // Auth State
    const role = localStorage.getItem('user_role')
    const isAdmin = ['admin', 'ADMIN', 'owner', 'OWNER'].includes(role || '')

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
                // Only auto-switch to teams if no tab specified in URL and session is closed
                if (!searchParams.get('tab') && data.status === 'closed' && data.teams?.length > 0) {
                    setActiveTab('teams')
                }
            })
            .catch(() => setError('세션을 찾을 수 없거나 연결 실패'))
    }, [id, searchParams])

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

        const token = localStorage.getItem('auth_token')
        let playerIds = parseResult.matched.map((p: any) => p.id)

        if (parseResult.unknown.length > 0) {
            try {
                const newIds = await Promise.all(parseResult.unknown.map(async (name) => {
                    const res = await fetch(`${API_URL}/players`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ name })
                    })
                    const data = await res.json()
                    if (data.error) {
                        throw new Error(data.error)
                    }
                    return data.id
                }))
                playerIds = [...playerIds, ...newIds]
            } catch (e: any) {
                alert('신규 회원 생성 중 오류가 발생했습니다: ' + (e.message || e))
                return
            }
        }

        await fetch(`${API_URL}/sessions/${id}/attendance`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
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

    const handleDeleteSession = async () => {
        if (!confirm('⚠️ 이 일정을 삭제하시겠습니까?\n\n모든 팀, 경기, 참석자 기록이 함께 삭제됩니다.\n이 작업은 되돌릴 수 없습니다!')) return

        try {
            const token = localStorage.getItem('auth_token')
            await fetch(`${API_URL}/sessions/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            })
            alert('일정이 삭제되었습니다.')
            navigate('/sessions')
        } catch (e) {
            alert('삭제 중 오류가 발생했습니다.')
        }
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
            {/* Share Card Modal */}
            {showShareCard && (activeTab === 'teams' || activeTab === 'scoreboard') && (
                <ShareCard
                    type={activeTab === 'scoreboard' ? 'standings' : 'teams'}
                    sessionDate={session.session_date}
                    data={{
                        teams: session.teams || [],
                        matchStats: session.matchStats || [],
                        standings: activeTab === 'scoreboard' ? (() => {
                            // Calculate standings from matches
                            const standings = (session.teams || []).map((t: any) => ({
                                ...t, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
                            }))
                                // Filter only completed matches
                                ; (session.matches || []).filter((m: any) => m.status === 'completed').forEach((m: any) => {
                                    const t1 = standings.find((t: any) => t.id === m.team1_id)
                                    const t2 = standings.find((t: any) => t.id === m.team2_id)
                                    if (!t1 || !t2) return
                                    const s1 = m.team1_score || 0
                                    const s2 = m.team2_score || 0
                                    t1.played++; t2.played++
                                    t1.gf += s1; t1.ga += s2
                                    t2.gf += s2; t2.ga += s1
                                    if (s1 > s2) { t1.won++; t1.points += 3; t2.lost++ }
                                    else if (s2 > s1) { t2.won++; t2.points += 3; t1.lost++ }
                                    else { t1.drawn++; t1.points += 1; t2.drawn++; t2.points += 1 }
                                })
                            standings.sort((a: any, b: any) => {
                                if (b.points !== a.points) return b.points - a.points
                                const gdA = a.gf - a.ga
                                const gdB = b.gf - b.ga
                                if (gdB !== gdA) return gdB - gdA
                                return b.gf - a.gf
                            })
                            return standings
                        })() : undefined
                    }}
                    onClose={() => setShowShareCard(false)}
                />
            )}

            {/* Toggle Admin Mode */}
            <div className="flex justify-end mb-4 gap-2">
                {(activeTab === 'teams' || activeTab === 'scoreboard') && (
                    <button
                        onClick={() => setShowShareCard(true)}
                        className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg border bg-gradient-to-r from-emerald-50 to-blue-50 text-emerald-700 border-emerald-200 hover:from-emerald-100 hover:to-blue-100 font-bold shadow-sm transition-all"
                    >
                        <Share2 size={14} /> 공유 카드 만들기
                    </button>
                )}
                <button
                    onClick={handleCapture}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 font-bold"
                >
                    <Download size={14} /> 화면 캡처
                </button>
            </div>

            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold">
                        {session.session_date}
                    </span>
                    {/* Game Order - Calculate week number of the year (based on Wednesdays) */}
                    {(() => {
                        const date = new Date(session.session_date)
                        const year = date.getFullYear()

                        // Calculate total Wednesdays in the year
                        const getWednesdaysInYear = (y: number) => {
                            let count = 0
                            const d = new Date(y, 0, 1) // Jan 1
                            while (d.getFullYear() === y) {
                                if (d.getDay() === 3) count++ // 3 = Wednesday
                                d.setDate(d.getDate() + 1)
                            }
                            return count
                        }
                        const totalWednesdays = getWednesdaysInYear(year)

                        // Calculate which Wednesday this is in the year
                        const getWednesdayNumber = (dateStr: string) => {
                            const d = new Date(dateStr)
                            const y = d.getFullYear()
                            let count = 0
                            const iterator = new Date(y, 0, 1)
                            while (iterator <= d) {
                                if (iterator.getDay() === 3) count++
                                iterator.setDate(iterator.getDate() + 1)
                            }
                            return count
                        }
                        const weekNum = getWednesdayNumber(session.session_date)

                        return (
                            <span className="inline-block px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold">
                                {weekNum || 1}/{totalWednesdays}
                            </span>
                        )
                    })()}
                    <span className={cn(
                        "px-2.5 py-1 rounded-lg text-xs font-bold uppercase",
                        session.status === 'recruiting' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
                    )}>
                        {session.status}
                    </span>
                </div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h1 className={cn("text-3xl font-extrabold", actualTheme === 'dark' ? "text-slate-100" : "text-slate-900")}>{session.title || '코너킥스 정기 풋살'}</h1>
                    <div className={cn("flex items-center gap-4 text-sm font-medium", actualTheme === 'dark' ? "text-slate-400" : "text-slate-500")}>
                        <span className="flex items-center gap-1"><MapPin size={16} /> 수성대학교 2번구장</span>
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
                            )}>
                            <Shield size={18} /> 팀 자동 생성
                        </button>

                        <div className="h-8 w-px bg-slate-700 mx-2 hidden md:block"></div>

                        <button
                            onClick={handleDeleteSession}
                            className="px-4 py-3 bg-red-900/50 text-red-300 rounded-xl font-bold flex items-center gap-2 hover:bg-red-800 hover:text-white border border-red-800 transition-colors"
                            title="이 일정 삭제"
                        >
                            🗑️ 일정 삭제
                        </button>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className={cn("grid grid-cols-3 gap-1 mb-6 p-1 rounded-xl border",
                actualTheme === 'dark' ? "bg-slate-800/50 border-slate-700" : "bg-slate-100/50 border-slate-100"
            )}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all",
                            activeTab === tab.id
                                ? actualTheme === 'dark'
                                    ? "bg-slate-700 text-slate-100 shadow-sm ring-1 ring-slate-600"
                                    : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                                : actualTheme === 'dark'
                                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
                                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                        )}
                    >
                        <tab.icon size={14} className={activeTab === tab.id ? "text-blue-600" : ""} />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className="sm:hidden">{tab.id === 'overview' ? '개요' : tab.id === 'teams' ? '팀' : '결과'}</span>
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
                        sessionId={id!}
                        onUpdateTeamName={async (teamId, name) => {
                            await fetch(`${API_URL}/sessions/${id}/teams/${teamId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name })
                            })
                            refreshSession()
                        }}
                    />
                )}
                {activeTab === 'scoreboard' && (
                    <TabScoreboard
                        matches={session.matches || []}
                        teams={session.teams || []}
                        onUpdateMatch={handleUpdateMatch}
                        isAdmin={isAdmin}
                        onAddMatch={handleAddMatch}
                        onDeleteMatch={handleDeleteMatch}
                        onClearMatches={handleClearMatches}
                        onRegenMatches={handleRegenMatches}
                        onAutoFillMatches={handleAutoFillMatches}
                        sessionId={id!}
                    />
                )}
            </div>
        </div>
    )
}
