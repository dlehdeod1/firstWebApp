import { useState, useRef, useEffect } from 'react'
import { X, Download, Share2, Copy, Check, Trophy } from 'lucide-react'
import html2canvas from 'html2canvas'
import { cn } from '@/lib/utils'

interface ShareCardProps {
    type: 'match' | 'standings' | 'teams'
    sessionDate: string
    data: any
    onClose: () => void
}

// Format date to "XX년 XX월 XX일" format
function formatDateKorean(dateStr: string): string {
    try {
        const date = new Date(dateStr)
        const year = date.getFullYear().toString().slice(-2)
        const month = date.getMonth() + 1
        const day = date.getDate()
        return `${year}년 ${month}월 ${day}일`
    } catch {
        return dateStr
    }
}

// Analyze MVP from actual match stats
function analyzeMVP(matchStats: any[]): { name: string, reason: string, goals: number, assists: number } | null {
    if (!matchStats || matchStats.length === 0) return null

    // Calculate MVP score: goals*3 + assists*2 + key_passes*1 + blocks*1
    let mvpPlayer: any = null
    let highestScore = 0

    matchStats.forEach((stat: any) => {
        const goals = stat.goals || 0
        const assists = stat.assists || 0
        const keyPasses = stat.key_passes || 0
        const blocks = stat.blocks || 0
        const clearances = stat.clearances || 0

        // MVP score weighted by contribution
        const score = (goals * 3) + (assists * 2) + (keyPasses * 1) + (blocks * 1) + (clearances * 0.5)

        if (score > highestScore) {
            highestScore = score
            mvpPlayer = { ...stat, score }
        }
    })

    if (!mvpPlayer || highestScore === 0) return null

    // Generate reason based on best contribution
    const goals = mvpPlayer.goals || 0
    const assists = mvpPlayer.assists || 0
    const keyPasses = mvpPlayer.key_passes || 0
    const blocks = mvpPlayer.blocks || 0

    let reason = '뛰어난 활약'
    if (goals >= 2) {
        reason = `${goals}골 득점`
    } else if (goals >= 1 && assists >= 1) {
        reason = `${goals}골 ${assists}도움`
    } else if (assists >= 2) {
        reason = `${assists}도움 어시스트왕`
    } else if (goals >= 1) {
        reason = `결승골`
    } else if (assists >= 1) {
        reason = `결정적 도움`
    } else if (keyPasses >= 2) {
        reason = '경기 조율'
    } else if (blocks >= 2) {
        reason = '철벽 수비'
    }

    return {
        name: mvpPlayer.player_name,
        reason,
        goals,
        assists
    }
}

// Generate text for teams
function generateTeamsText(teams: any[], dateStr: string): string {
    const dateFormatted = formatDateKorean(dateStr)
    let text = `${dateFormatted} 코너킥스 축구\n\n`

    teams.forEach((team: any) => {
        text += `${team.name}\n`
        const playerNames = team.players?.map((p: any) => p.name).join(' ') || ''
        text += `${playerNames}\n`
    })

    return text.trim()
}

// Generate text for standings with pricing based on rank
function generateStandingsText(standings: any[], teams: any[], dateStr: string, mvp: { name: string, reason: string } | null): string {
    const dateFormatted = formatDateKorean(dateStr)
    let text = `${dateFormatted} 코너킥스 축구\n\n`

    // Price by rank: 1st = 6,500원, 2nd = 7,000원, 3rd = 7,500원
    const priceByRank: Record<number, string> = {
        0: '6,500원',
        1: '7,000원',
        2: '7,500원'
    }

    standings.forEach((standing: any, rank: number) => {
        // Find the team with players
        const team = teams.find((t: any) => t.id === standing.id)
        const price = priceByRank[rank] || '7,500원'

        text += `${standing.name} ${price}\n`
        const playerNames = team?.players?.map((p: any) => p.name).join(' ') || ''
        text += `${playerNames}\n`
    })

    if (mvp) {
        text += `\n🏆 MVP: ${mvp.name} (${mvp.reason})`
    }

    text += `\n\n국민은행 801301-01-610282 박재형\n고생하셨습니다!!!`

    return text.trim()
}

export default function ShareCard({ type, sessionDate, data, onClose }: ShareCardProps) {
    const cardRef = useRef<HTMLDivElement>(null)
    const [downloading, setDownloading] = useState(false)
    const [copied, setCopied] = useState(false)
    const [mvp, setMvp] = useState<{ name: string, reason: string, goals: number, assists: number } | null>(null)

    // Analyze MVP when data changes - use actual match stats
    useEffect(() => {
        if (type === 'standings' && data.matchStats) {
            const mvpResult = analyzeMVP(data.matchStats)
            setMvp(mvpResult)
        }
    }, [type, data])

    // Generate text based on type
    const generateText = (): string => {
        if (type === 'teams' && data.teams) {
            return generateTeamsText(data.teams, sessionDate)
        } else if (type === 'standings' && data.standings) {
            return generateStandingsText(data.standings, data.teams || [], sessionDate, mvp)
        }
        return ''
    }

    // Copy text to clipboard
    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
            return true
        } catch (e) {
            console.error('Copy failed:', e)
            return false
        }
    }

    const handleDownload = async () => {
        if (!cardRef.current) return
        setDownloading(true)

        try {
            // Generate and copy text first
            const text = generateText()
            if (text) {
                await copyToClipboard(text)
            }

            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                backgroundColor: '#0f172a',
                useCORS: true
            })

            // Detect iOS Safari
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)

            if (isIOS || isSafari) {
                // Use Web Share API on iOS Safari
                canvas.toBlob(async (blob) => {
                    if (!blob) {
                        alert('이미지 생성 실패')
                        return
                    }

                    if (navigator.share && navigator.canShare) {
                        const file = new File([blob], `cornerkicks_${sessionDate}_${type}.png`, { type: 'image/png' })
                        const shareData = { files: [file] }

                        if (navigator.canShare(shareData)) {
                            try {
                                await navigator.share(shareData)
                                if (text) {
                                    alert('✅ 이미지 공유 완료! 텍스트가 클립보드에 복사되었습니다.')
                                }
                            } catch (e: any) {
                                if (e.name !== 'AbortError') {
                                    // Open image in new tab as fallback
                                    const url = URL.createObjectURL(blob)
                                    window.open(url, '_blank')
                                    alert('📷 이미지가 새 탭에서 열렸습니다. 이미지를 꾹 눌러 저장하세요!')
                                }
                            }
                        } else {
                            // Can't share files, open in new tab
                            const url = URL.createObjectURL(blob)
                            window.open(url, '_blank')
                            alert('📷 이미지가 새 탭에서 열렸습니다. 이미지를 꾹 눌러 저장하세요!')
                        }
                    } else {
                        // No share API, open in new tab
                        const url = URL.createObjectURL(blob)
                        window.open(url, '_blank')
                        alert('📷 이미지가 새 탭에서 열렸습니다. 이미지를 꾹 눌러 저장하세요!')
                    }
                }, 'image/png')
            } else {
                // Desktop: use download link
                const link = document.createElement('a')
                link.download = `cornerkicks_${sessionDate}_${type}.png`
                link.href = canvas.toDataURL('image/png')
                link.click()

                if (text) {
                    alert('✅ 이미지가 저장되었고, 텍스트가 클립보드에 복사되었습니다!')
                }
            }
        } catch (e) {
            console.error('Download failed:', e)
            alert('이미지 저장 실패')
        } finally {
            setDownloading(false)
        }
    }

    const handleCopyOnly = async () => {
        const text = generateText()
        if (text) {
            const success = await copyToClipboard(text)
            if (success) {
                alert('✅ 텍스트가 클립보드에 복사되었습니다!')
            }
        }
    }

    const handleShare = async () => {
        if (!cardRef.current) return

        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                backgroundColor: '#0f172a',
                useCORS: true
            })

            canvas.toBlob(async (blob) => {
                if (!blob) return

                if (navigator.share) {
                    const file = new File([blob], `cornerkicks_${sessionDate}.png`, { type: 'image/png' })
                    const text = generateText()
                    await navigator.share({
                        files: [file],
                        title: '코너킥스 경기 결과',
                        text: text || `${sessionDate} 경기 결과입니다!`
                    })
                } else {
                    // Fallback to download
                    handleDownload()
                }
            })
        } catch (e) {
            console.error('Share failed:', e)
        }
    }

    // Team colors for enhanced design
    const teamColors = [
        { bg: 'from-red-600/30 to-red-900/30', border: 'border-red-500/50', text: 'text-red-300', badge: 'bg-red-500' },
        { bg: 'from-blue-600/30 to-blue-900/30', border: 'border-blue-500/50', text: 'text-blue-300', badge: 'bg-blue-500' },
        { bg: 'from-emerald-600/30 to-emerald-900/30', border: 'border-emerald-500/50', text: 'text-emerald-300', badge: 'bg-emerald-500' }
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-700/50">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-white font-bold text-lg flex items-center gap-2">
                        📤 공유 카드
                        {copied && <span className="text-xs text-emerald-400 animate-pulse">복사됨!</span>}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Card Preview - Enhanced Design */}
                <div
                    ref={cardRef}
                    className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 rounded-2xl p-6 text-white shadow-xl"
                    style={{ minHeight: '200px' }}
                >
                    {/* Brand Header - Enhanced */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10 gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-shrink">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-blue-500 flex items-center justify-center shadow-lg flex-shrink-0">
                                <span className="text-xl">⚽</span>
                            </div>
                            <div className="min-w-0">
                                <div className="font-black text-lg tracking-tight">
                                    <span className="text-emerald-400">Corner</span>
                                    <span className="text-amber-400">K</span>
                                    <span className="text-blue-400">i</span>
                                    <span className="text-emerald-400">cks</span>
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium">풋살 동호회</div>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                            <div className="text-xs font-bold text-white whitespace-nowrap">{formatDateKorean(sessionDate)}</div>
                            <div className="text-[10px] text-slate-400">{type === 'teams' ? '팀 구성' : '경기 결과'}</div>
                        </div>
                    </div>

                    {/* Content based on type - Enhanced Standings */}
                    {type === 'standings' && data.standings && (
                        <div className="space-y-2">
                            <h3 className="font-bold text-center text-lg mb-4 flex items-center justify-center gap-2">
                                <span className="text-xl">🏆</span>
                                <span className="bg-gradient-to-r from-yellow-300 to-amber-500 bg-clip-text text-transparent">오늘의 결과</span>
                            </h3>
                            {data.standings.map((team: any, i: number) => {
                                const priceByRank: Record<number, string> = { 0: '6,500원', 1: '7,000원', 2: '7,500원' }
                                const teamData = data.teams?.find((t: any) => t.id === team.id)
                                return (
                                    <div key={team.id} className={cn(
                                        "relative overflow-hidden rounded-xl p-3 transition-all",
                                        i === 0 ? "bg-gradient-to-r from-yellow-500/20 via-amber-500/20 to-yellow-600/20 border-2 border-yellow-500/50" :
                                            i === 1 ? "bg-gradient-to-r from-slate-400/20 to-slate-500/20 border border-slate-400/40" :
                                                "bg-gradient-to-r from-orange-600/20 to-orange-700/20 border border-orange-500/40"
                                    )}>
                                        {/* Rank Badge */}
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xl shadow-lg flex-shrink-0",
                                                i === 0 ? "bg-gradient-to-br from-yellow-400 to-amber-500" :
                                                    i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-400" :
                                                        "bg-gradient-to-br from-orange-500 to-orange-600"
                                            )}>
                                                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-base">{team.name}</div>
                                                <div className="grid grid-cols-3 gap-1 mt-1">
                                                    {teamData?.players?.slice(0, 6).map((p: any) => (
                                                        <span key={p.id} className="text-[10px] text-slate-400 truncate">{p.name}</span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className={cn(
                                                    "font-black text-xl",
                                                    i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-400"
                                                )}>{team.points}<span className="text-xs font-normal text-slate-400 ml-0.5">점</span></div>
                                                <div className="text-[10px] text-slate-400">{team.won}승 {team.drawn}무 {team.lost}패</div>
                                                <div className={cn(
                                                    "text-xs font-bold mt-0.5 px-1.5 py-0.5 rounded inline-block",
                                                    i === 0 ? "bg-emerald-500/20 text-emerald-300" :
                                                        i === 1 ? "bg-slate-500/20 text-slate-300" :
                                                            "bg-red-500/20 text-red-300"
                                                )}>{priceByRank[i]}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                            {/* MVP Section */}
                            {mvp && (
                                <div className="mt-3 p-3 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/40">
                                    <div className="flex items-center gap-2">
                                        <Trophy size={18} className="text-purple-400" />
                                        <span className="font-bold text-purple-300 text-sm">MVP</span>
                                        <span className="font-bold text-white text-sm">{mvp.name}</span>
                                        <span className="text-xs text-slate-400">- {mvp.reason}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Content based on type - Enhanced Teams */}
                    {type === 'teams' && data.teams && (
                        <div className="space-y-3">
                            <h3 className="font-bold text-center text-lg mb-4 flex items-center justify-center gap-2">
                                <span className="text-xl">⚽</span>
                                <span className="bg-gradient-to-r from-blue-300 to-cyan-400 bg-clip-text text-transparent">오늘의 팀 구성</span>
                            </h3>
                            {data.teams.map((team: any, i: number) => {
                                const color = teamColors[i % teamColors.length]
                                return (
                                    <div key={team.id} className={cn(
                                        "p-3 rounded-xl border bg-gradient-to-r",
                                        color.bg, color.border
                                    )}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-md flex-shrink-0", color.badge)}>
                                                {i + 1}
                                            </div>
                                            <div className={cn("font-bold text-base", color.text)}>{team.name}</div>
                                            <div className="text-xs text-slate-400 ml-auto">{team.players?.length || 0}명</div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1.5">
                                            {team.players?.map((p: any) => (
                                                <span key={p.id} className="bg-white/10 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-medium border border-white/10 text-center truncate">
                                                    {p.name}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Footer - Enhanced */}
                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                        <p className="text-xs text-slate-500">코너킥스 풋살 동호회</p>
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>🔥</span>
                            <span>매주 경기 진행</span>
                        </div>
                    </div>
                </div>

                {/* Actions - Enhanced */}
                <div className="flex flex-col gap-3 mt-4">
                    <div className="flex gap-3">
                        <button
                            onClick={handleDownload}
                            disabled={downloading}
                            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-lg shadow-emerald-500/30"
                        >
                            <Download size={18} />
                            {downloading ? '저장 중...' : '이미지 저장 + 텍스트 복사'}
                        </button>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCopyOnly}
                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            {copied ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                            텍스트만 복사
                        </button>
                        <button
                            onClick={handleShare}
                            className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/30"
                        >
                            <Share2 size={18} />
                            공유하기
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
