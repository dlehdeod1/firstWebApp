import { useState, useEffect } from 'react';
import {
    Users,
    Search,
    Edit2,
    Trash2,
    Plus,
    Save,
    X,
    LayoutGrid,
    LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

interface Player {
    id: number;
    name: string;
    nickname?: string;
    aliases_json?: string[];
    shooting: number;
    offball_run: number;
    ball_keeping: number;
    passing: number;
    intercept: number;
    marking: number;
    stamina: number;
    speed: number;
    physical: number;
    linkup: number; // 연계 능력치
    height_cm?: number;
    weight_kg?: number;
    birth_year?: number; // 생년
    photo_url?: string; // 프로필 사진 URL
    notes?: string;
    join_date?: string;
    user_id?: string; // linked user id
    user_username?: string; // linked user username
    role?: string; // linked user role (from users table via JOIN)
    player_code?: string; // unique player code
}

const DEFAULT_STATS = {
    shooting: 5,
    offball_run: 5,
    ball_keeping: 5,
    passing: 5,
    intercept: 5,
    marking: 5,
    stamina: 5,
    speed: 5,
    physical: 5,
    linkup: 5,
};

/* -------------------------------------------------------------------------- */
/* StatCell – table cell with a numeric input                                 */
/* -------------------------------------------------------------------------- */
const StatCell = ({
    value,
    onChange,
    bg,
    disabled
}: {
    value: number;
    onChange: (v: number) => void;
    bg: string;
    disabled?: boolean;
}) => (
    <td className={`px-2 py-3 ${bg}`}>
        <input
            type="number"
            min={1}
            max={10}
            disabled={disabled}
            className={cn(
                "w-8 text-center bg-transparent font-bold text-slate-700 outline-none focus:bg-white/50 rounded",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            value={value}
            onChange={(e) => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= 10) onChange(val);
            }}
        />
    </td>
);

export default function PlayerEditor() {
    /* ---------------------------------------------------------------------- */
    /* State                                                                 */
    /* ---------------------------------------------------------------------- */
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editing, setEditing] = useState<Player | null>(null);
    const [isNew, setIsNew] = useState(false);
    const [users, setUsers] = useState<
        { id: string; username: string; email: string }[]
    >([]);
    const [modified, setModified] = useState<Record<number, Player>>({});
    const [currentUserRole, setCurrentUserRole] = useState('');
    const [roleLoaded, setRoleLoaded] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('card'); // Default to card for mobile

    /* ---------------------------------------------------------------------- */
    /* Effect – fetch data & determine role                                    */
    /* ---------------------------------------------------------------------- */
    useEffect(() => {
        fetchPlayers();
        fetchUsers();

        const token = localStorage.getItem('auth_token');

        // [RBAC] Strict Server-Side Role Check
        if (token) {
            if (token === 'demo_admin_token') {
                // Demo Override
                setCurrentUserRole('ADMIN');
                setRoleLoaded(true);
                console.log('[PlayerEditor] Demo Token -> ADMIN');
            } else {
                console.log('[PlayerEditor] Starting fetch to:', `${API_URL}/me`);
                fetch(`${API_URL}/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                })
                    .then(async (r) => {
                        console.log('[PlayerEditor] Response status:', r.status);
                        window.sessionStorage.setItem('last_api_status', r.status.toString());
                        if (!r.ok) {
                            const txt = await r.text();
                            window.sessionStorage.setItem('last_api_error', `Status ${r.status}: ${txt}`);
                            throw new Error(`API Error ${r.status}`);
                        }
                        return r.json();
                    })
                    .then((data) => {
                        const role = data.user?.role || 'GUEST';
                        setCurrentUserRole(role);
                        console.log(`[PlayerEditor] Server Role: ${role}`);
                        // Store detailed info for debug
                        window.sessionStorage.setItem('last_api_user', `${data.user?.username} (${data.user?.email})`);
                        window.sessionStorage.removeItem('last_api_error');
                    })
                    .catch((e) => {
                        console.error('[PlayerEditor] Role fetch failed', e);
                        setCurrentUserRole('GUEST');
                        const errorMsg = e.message || 'Unknown Error';
                        if (!window.sessionStorage.getItem('last_api_error')) {
                            window.sessionStorage.setItem('last_api_error', errorMsg);
                        }
                        // alert(`DEBUG: Fetch Failed. \nError: ${errorMsg}\nURL: ${API_URL}/users/me`);
                    })
                    .finally(() => setRoleLoaded(true));
            }
        } else {
            setCurrentUserRole('GUEST');
            setRoleLoaded(true);
            console.log('[PlayerEditor] No Token -> GUEST');
        }
    }, []);

    /* ---------------------------------------------------------------------- */
    /* Data fetching helpers                                                  */
    /* ---------------------------------------------------------------------- */
    const fetchPlayers = async () => {
        try {
            const res = await fetch(`${API_URL}/players`);
            const data = await res.json();
            setPlayers(data);
            setModified({});
        } catch (e) {
            console.error(e);
            alert('Failed to fetch players');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`${API_URL}/users`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    /* ---------------------------------------------------------------------- */
    /* Permission helpers                                                     */
    /* ---------------------------------------------------------------------- */
    const isAdmin = ['admin', 'ADMIN'].includes(currentUserRole);
    const isOwner = ['owner', 'OWNER'].includes(currentUserRole);
    const canEdit = isAdmin; // ADMIN can edit everything
    const canView = isAdmin || isOwner; // OWNER/ADMIN can view list

    // Debug Log for Critical Rendering Path
    if (roleLoaded) {
        console.log(`[PlayerEditor Render] Role: ${currentUserRole}, canView: ${canView}, canEdit: ${canEdit}`);
    }

    /* ---------------------------------------------------------------------- */
    /* Handlers                                                               */
    /* ---------------------------------------------------------------------- */
    const handleStatChange = (
        id: number,
        field: keyof Player,
        value: any,
    ) => {
        setPlayers((prev) =>
            prev.map((p) => {
                if (p.id === id) {
                    const updated = { ...p, [field]: value };
                    setModified((m) => ({ ...m, [id]: updated }));
                    return updated;
                }
                return p;
            }),
        );
    };

    const handleUnlinkUser = async (playerId: number) => {
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(
                `${API_URL}/players/${playerId}/unlink-user`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                },
            );
            if (res.ok) {
                alert('연결이 해제되었습니다.');
                fetchPlayers();
            } else {
                alert('해제에 실패했습니다.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleDelete = async (playerId: number) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(`${API_URL}/players/${playerId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                alert('삭제되었습니다.');
                fetchPlayers();
            } else {
                alert('삭제에 실패했습니다.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleBatchSave = async () => {
        const updates = Object.values(modified);
        const token = localStorage.getItem('auth_token');
        // Batch save isn't directly supported by a single endpoint in my previous fix, 
        // but the old code used Promise.all on PUT /players/:id
        // I restored PUT /players/:id, so we can use concurrent requests.

        if (Object.keys(modified).length === 0) return;
        if (!confirm(`${Object.keys(modified).length}명의 데이터를 저장하시겠습니까?`)) return;

        try {
            await Promise.all(updates.map(p =>
                fetch(`${API_URL}/players/${p.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(p)
                })
            ));
            alert('저장되었습니다.');
            setModified({});
            fetchPlayers();
        } catch (e) {
            console.error(e);
            alert('일부 저장 실패');
        }
    };

    const handleAddNew = () => {
        setIsNew(true);
        setEditing({
            id: 0, // Placeholder
            name: '',
            shooting: DEFAULT_STATS.shooting,
            offball_run: DEFAULT_STATS.offball_run,
            ball_keeping: DEFAULT_STATS.ball_keeping,
            passing: DEFAULT_STATS.passing,
            intercept: DEFAULT_STATS.intercept,
            marking: DEFAULT_STATS.marking,
            stamina: DEFAULT_STATS.stamina,
            speed: DEFAULT_STATS.speed,
            physical: DEFAULT_STATS.physical,
            linkup: DEFAULT_STATS.linkup,
        } as Player);
    };

    const handleSaveEdit = async () => {
        if (!editing) return;
        const endpoint = isNew
            ? `${API_URL}/players`
            : `${API_URL}/players/${editing.id}`;
        const method = isNew ? 'POST' : 'PUT';

        const token = localStorage.getItem('auth_token');

        try {
            const res = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editing),
            });
            if (res.ok) {
                alert(isNew ? '생성되었습니다.' : '수정되었습니다.');
                setIsNew(false);
                setEditing(null);
                fetchPlayers();
            } else {
                const err = await res.json();
                alert(err.error || '저장에 실패했습니다.');
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleCancelEdit = () => {
        setIsNew(false);
        setEditing(null);
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value);
    };

    /* ---------------------------------------------------------------------- */
    /* Render                                                                 */
    /* ---------------------------------------------------------------------- */
    // [FIX] Block Flash of Content: Wait for BOTH loading and roleLoaded
    if (loading || !roleLoaded) {
        return <div className="p-20 text-center text-slate-500 animate-pulse">데이터 및 권한 로딩 중...</div>
    }

    if (!canView) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-10">
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mb-4">
                    <Users size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                    접근 권한이 없습니다.
                </h2>
                <p className="text-slate-500 mb-4">
                    구단주 또는 관리자 계정으로 로그인해주세요.
                </p>
                <div className="text-xs text-slate-400 bg-slate-100 p-2 rounded text-left">
                    <p>DEBUG INFO:</p>
                    <p>User: {window.sessionStorage.getItem('last_api_user') || 'Unknown'}</p>
                    <p>Server Role: {currentUserRole}</p>
                    <p>Token: {localStorage.getItem('auth_token') ? 'Present' : 'Missing'}</p>
                    <p>API Status: {window.sessionStorage.getItem('last_api_status') || 'N/A'}</p>
                    <p>API Error: {window.sessionStorage.getItem('last_api_error') || 'None'}</p>
                </div>
            </div>
        );
    }

    // Helper to calculate overall rating for sorting
    const getOverallRating = (p: Player) => {
        const totalStats = p.shooting + p.offball_run + p.ball_keeping + p.passing +
            p.intercept + p.marking + p.stamina + p.speed +
            (p.physical || 5) + (p.linkup || 5);
        return Math.round((totalStats / 10) * 10);
    };

    const filteredPlayers = players
        .filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => getOverallRating(b) - getOverallRating(a)); // Sort by overall rating (highest first)

    const linkedUserIds = new Set(
        players.map((p) => (p as any).user_id).filter(Boolean),
    );

    return (
        <div className="max-w-7xl mx-auto p-4 md:p-8 pb-24">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 flex items-center gap-2 mb-1">
                    <Users className="text-blue-600" size={28} /> 선수 관리
                </h1>
                <p className="text-sm text-slate-500">
                    {filteredPlayers.length}명의 선수 · 능력치 수정 및 계정 연결
                </p>
            </div>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100">
                {/* Left: Search + View Toggle */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                        <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="이름 검색..."
                            value={search}
                            onChange={handleSearch}
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-44 text-sm bg-white"
                        />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                        <button
                            onClick={() => setViewMode('card')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'card' ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                            title="카드 뷰"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "p-1.5 rounded transition-colors",
                                viewMode === 'table' ? "bg-blue-100 text-blue-600" : "text-slate-400 hover:text-slate-600"
                            )}
                            title="테이블 뷰"
                        >
                            <LayoutList size={16} />
                        </button>
                    </div>
                </div>

                {/* Right: Action Buttons */}
                {canEdit && (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleAddNew}
                            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm flex-1 sm:flex-initial justify-center"
                        >
                            <Plus size={16} />
                            <span>새 선수</span>
                        </button>

                        {Object.keys(modified).length > 0 && (
                            <button
                                onClick={handleBatchSave}
                                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-medium shadow-sm"
                            >
                                <Save size={16} />
                                <span>저장 ({Object.keys(modified).length})</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* ------------------------------------------------------------------ */}
            {/* Card View - FIFA Ultimate Team Style                                */}
            {/* ------------------------------------------------------------------ */}
            {viewMode === 'card' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredPlayers.map((p) => {
                        // Calculate overall rating (average of all 10 stats, on 100-point scale)
                        const totalStats = p.shooting + p.offball_run + p.ball_keeping + p.passing +
                            p.intercept + p.marking + p.stamina + p.speed +
                            (p.physical || 5) + (p.linkup || 5);
                        const overallRating = Math.round((totalStats / 10) * 10); // 1-10 scale -> 10-100

                        // Card gradient color based on rating (new tier system)
                        // 90+ = Master (rainbow/holographic)
                        // 80+ = Gold
                        // 70+ = Silver
                        // 60+ = Bronze
                        // <60 = Basic (gray)
                        const cardGradient = overallRating >= 90
                            ? 'from-pink-500 via-purple-500 to-cyan-500' // Master - holographic rainbow
                            : overallRating >= 80
                                ? 'from-yellow-500 via-amber-400 to-yellow-600' // Gold
                                : overallRating >= 70
                                    ? 'from-slate-300 via-gray-200 to-slate-400' // Silver
                                    : overallRating >= 60
                                        ? 'from-orange-700 via-amber-600 to-orange-800' // Bronze
                                        : 'from-slate-600 via-slate-500 to-slate-700'; // Basic

                        // Card tier label
                        const tierLabel = overallRating >= 90 ? 'MASTER'
                            : overallRating >= 80 ? 'GOLD'
                                : overallRating >= 70 ? 'SILVER'
                                    : overallRating >= 60 ? 'BRONZE' : 'BASIC';

                        // Card border style based on tier
                        const borderStyle = overallRating >= 90
                            ? 'ring-4 ring-pink-400 ring-offset-2 ring-offset-purple-500' // Master - fancy ring
                            : overallRating >= 80
                                ? 'ring-4 ring-yellow-400 ring-offset-1 ring-offset-amber-600' // Gold - gold ring
                                : overallRating >= 70
                                    ? 'ring-2 ring-slate-300' // Silver
                                    : overallRating >= 60
                                        ? 'ring-2 ring-orange-600' // Bronze
                                        : 'ring-1 ring-slate-500'; // Basic - thin border

                        // Use actual stats with Korean labels (9 stats -> show 6 key ones)
                        const cardStats = [
                            { label: '슈팅', value: Math.round(p.shooting) },
                            { label: '침투', value: Math.round(p.offball_run) },
                            { label: '패스', value: Math.round(p.passing) },
                            { label: '차단', value: Math.round(p.intercept) },
                            { label: '속도', value: Math.round(p.speed) },
                            { label: '체력', value: Math.round(p.stamina) },
                        ];

                        return (
                            <div
                                key={p.id}
                                className="group relative"
                            >
                                {/* FIFA Card */}
                                <div className={`relative bg-gradient-to-b ${cardGradient} ${borderStyle} rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all transform hover:scale-105 aspect-[3/4]`}>

                                    {/* Full Background Photo */}
                                    {p.photo_url ? (
                                        <img
                                            src={p.photo_url}
                                            alt={p.name}
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                    ) : (
                                        /* Silhouette for no photo */
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <svg
                                                viewBox="0 0 100 120"
                                                className="h-[70%] w-auto opacity-40"
                                                fill="currentColor"
                                            >
                                                <ellipse cx="50" cy="25" rx="20" ry="22" className="text-black" />
                                                <path d="M25 55 Q25 45 50 45 Q75 45 75 55 L80 120 L20 120 Z" className="text-black" />
                                                <ellipse cx="30" cy="52" rx="12" ry="8" className="text-black" />
                                                <ellipse cx="70" cy="52" rx="12" ry="8" className="text-black" />
                                            </svg>
                                        </div>
                                    )}

                                    {/* Top Section - Rating & Tier with background */}
                                    <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm rounded-lg px-2 py-1 z-10">
                                        <div className="text-white text-3xl font-black leading-none">{overallRating}</div>
                                        <div className="text-white/80 text-[9px] font-bold tracking-wider text-center">{tierLabel}</div>
                                    </div>

                                    {/* Player Code Badge */}
                                    <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[9px] text-white font-mono z-10">
                                        {p.player_code ?? 'N/A'}
                                    </div>

                                    {/* Bottom Section - Name & Stats with solid background */}
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm pt-2 pb-2 px-2">
                                        {/* Player Name & Birth Year */}
                                        <div className="text-center mb-1.5">
                                            <div className="text-white font-black text-sm uppercase tracking-wider truncate">
                                                {p.name}
                                            </div>
                                            {p.birth_year && (
                                                <div className="text-white/60 text-[10px] font-medium">
                                                    {p.birth_year}년생
                                                </div>
                                            )}
                                        </div>

                                        {/* Stats Grid - 3x2 layout */}
                                        <div className="grid grid-cols-3 gap-1">
                                            {cardStats.map((stat) => (
                                                <div key={stat.label} className="text-center bg-white/10 rounded py-0.5">
                                                    <div className="text-white font-black text-sm leading-tight">{stat.value}</div>
                                                    <div className="text-white/60 text-[8px] font-bold">{stat.label}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* User Link Indicator */}
                                    {p.user_username && (
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-green-500/90 backdrop-blur-sm px-2 py-0.5 rounded-full text-[8px] text-white font-bold z-10">
                                            🔗 연결됨
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons (shown on hover) */}
                                {canEdit && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                                        <button
                                            onClick={() => {
                                                setEditing(p);
                                                setIsNew(false);
                                            }}
                                            className="p-1.5 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
                                            title="수정"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-1.5 rounded-full bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors"
                                            title="삭제"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* Player Table (Desktop View)                                        */}
            {/* ------------------------------------------------------------------ */}
            {viewMode === 'table' && (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                    <table className="w-full bg-white text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">ID</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">이름</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">코드</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">역할</th>
                                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">연결</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">슈팅</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">침투</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">키핑</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">패스</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">차단</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">마킹</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">체력</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">속도</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">피지컬</th>
                                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">연계</th>
                                {canEdit && <th className="px-3 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">액션</th>}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPlayers.map((p, idx) => (
                                <tr key={p.id} className={cn("hover:bg-slate-50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-slate-25")}>
                                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{p.id}</td>
                                    <td className="px-3 py-2.5 font-semibold text-slate-900 whitespace-nowrap">{p.name}</td>
                                    <td className="px-3 py-2.5 font-mono text-xs text-slate-400 whitespace-nowrap">{p.player_code ?? '-'}</td>
                                    <td className="px-4 py-2 text-sm">
                                        {p.user_id && canEdit ? (
                                            <select
                                                value={p.role || 'member'}
                                                onChange={async (e) => {
                                                    const newRole = e.target.value;
                                                    const token = localStorage.getItem('auth_token');
                                                    try {
                                                        const res = await fetch(`${API_URL}/users/${p.user_id}/role`, {
                                                            method: 'PATCH',
                                                            headers: {
                                                                'Content-Type': 'application/json',
                                                                'Authorization': `Bearer ${token}`
                                                            },
                                                            body: JSON.stringify({ role: newRole })
                                                        });
                                                        if (res.ok) {
                                                            setPlayers(prev => prev.map(player =>
                                                                player.id === p.id ? { ...player, role: newRole } : player
                                                            ));
                                                        } else {
                                                            const err = await res.json();
                                                            alert(err.error || '역할 변경 실패');
                                                        }
                                                    } catch (e) {
                                                        console.error(e);
                                                        alert('역할 변경 중 오류 발생');
                                                    }
                                                }}
                                                className="border rounded px-2 py-1 text-xs"
                                            >
                                                <option value="member">일반회원</option>
                                                <option value="MATCH_RECORDER">기록원</option>
                                                <option value="OWNER">구단주</option>
                                                <option value="ADMIN">관리자</option>
                                                <option value="GUEST">게스트</option>
                                            </select>
                                        ) : p.user_id ? (
                                            <span className={cn(
                                                "px-2 py-1 rounded text-xs font-medium",
                                                p.role === 'ADMIN' && "bg-red-100 text-red-700",
                                                p.role === 'OWNER' && "bg-purple-100 text-purple-700",
                                                p.role === 'MATCH_RECORDER' && "bg-yellow-100 text-yellow-700",
                                                (!p.role || p.role === 'member') && "bg-slate-100 text-slate-600"
                                            )}>
                                                {p.role === 'ADMIN' ? '관리자' : p.role === 'OWNER' ? '구단주' : p.role === 'MATCH_RECORDER' ? '기록원' : '일반회원'}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2">
                                        {p.user_username ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium bg-blue-50 text-blue-600 px-2 py-1 rounded">{p.user_username}</span>
                                                {canEdit && (
                                                    <button
                                                        onClick={() => handleUnlinkUser(p.id)}
                                                        className="text-red-400 hover:text-red-600"
                                                        title="연결 해제"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ) : canEdit ? (
                                            <div className="flex items-center gap-1">
                                                <select
                                                    value={(p as any)._selectedUser || ''}
                                                    onChange={(e) => {
                                                        setPlayers(prev => prev.map(player =>
                                                            player.id === p.id
                                                                ? { ...player, _selectedUser: e.target.value } as any
                                                                : player
                                                        ));
                                                    }}
                                                    className="border rounded px-2 py-1 text-xs w-28"
                                                >
                                                    <option value="">사용자 선택</option>
                                                    {users
                                                        .filter((u) => !linkedUserIds.has(u.id))
                                                        .map((u) => (
                                                            <option key={u.id} value={u.id}>
                                                                {u.username}
                                                            </option>
                                                        ))}
                                                </select>
                                                <button
                                                    onClick={async () => {
                                                        const userId = (p as any)._selectedUser;
                                                        if (!userId) {
                                                            alert('사용자를 선택해주세요.');
                                                            return;
                                                        }
                                                        const token = localStorage.getItem('auth_token');
                                                        try {
                                                            const res = await fetch(`${API_URL}/players/${p.id}/link-user`, {
                                                                method: 'POST',
                                                                headers: {
                                                                    'Content-Type': 'application/json',
                                                                    'Authorization': `Bearer ${token}`
                                                                },
                                                                body: JSON.stringify({ userId }),
                                                            });
                                                            if (res.ok) {
                                                                alert('연결되었습니다.');
                                                                fetchPlayers();
                                                            } else {
                                                                const err = await res.json();
                                                                alert(err.error || '연결에 실패했습니다.');
                                                            }
                                                        } catch (e) {
                                                            console.error(e);
                                                        }
                                                    }}
                                                    className="bg-green-500 text-white px-2 py-1 rounded text-xs hover:bg-green-600"
                                                    title="연결 확인"
                                                >
                                                    연결
                                                </button>
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </td>

                                    {/* Stat columns – editable only if canEdit. But wait, `StatCell` uses `onChange`.
                    If !canEdit, we should probably disable input or render text.
                    I added `disabled` prop to StatCell.
                */}
                                    <StatCell
                                        value={p.shooting}
                                        onChange={(v) => handleStatChange(p.id, 'shooting', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.offball_run}
                                        onChange={(v) => handleStatChange(p.id, 'offball_run', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.ball_keeping}
                                        onChange={(v) => handleStatChange(p.id, 'ball_keeping', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.passing}
                                        onChange={(v) => handleStatChange(p.id, 'passing', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.intercept}
                                        onChange={(v) => handleStatChange(p.id, 'intercept', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.marking}
                                        onChange={(v) => handleStatChange(p.id, 'marking', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.stamina}
                                        onChange={(v) => handleStatChange(p.id, 'stamina', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.speed}
                                        onChange={(v) => handleStatChange(p.id, 'speed', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.physical || 5}
                                        onChange={(v) => handleStatChange(p.id, 'physical', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />
                                    <StatCell
                                        value={p.linkup || 5}
                                        onChange={(v) => handleStatChange(p.id, 'linkup', v)}
                                        bg={canEdit ? 'bg-slate-50' : 'bg-slate-100'}
                                        disabled={!canEdit}
                                    />

                                    {canEdit && (
                                        <td className="px-4 py-2 flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setEditing(p);
                                                    setIsNew(false);
                                                }}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="수정"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="text-red-600 hover:text-red-800"
                                                title="삭제"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ------------------------------------------------------------------ */}
            {/* Edit / Add Modal                                                   */}
            {/* ------------------------------------------------------------------ */}
            {editing && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center z-50">
                    <div className="bg-white rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b border-slate-100 p-4 flex items-center justify-between z-10">
                            <h2 className="text-lg font-bold text-slate-900">
                                {isNew ? '새 선수 등록' : `${editing.name} 수정`}
                            </h2>
                            <button
                                onClick={handleCancelEdit}
                                className="p-2 rounded-full hover:bg-slate-100 text-slate-400"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        선수 이름
                                    </label>
                                    <input
                                        type="text"
                                        value={editing.name}
                                        onChange={(e) =>
                                            setEditing({ ...editing, name: e.target.value })
                                        }
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        placeholder="이름 입력"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                        선수 코드
                                    </label>
                                    <input
                                        type="text"
                                        value={editing.player_code ?? ''}
                                        onChange={(e) =>
                                            setEditing({ ...editing, player_code: e.target.value.toUpperCase() })
                                        }
                                        placeholder="자동 생성"
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        maxLength={6}
                                    />
                                    <p className="text-xs text-slate-400 mt-1">비워두면 자동 생성됩니다</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            생년 🎂
                                        </label>
                                        <input
                                            type="number"
                                            value={editing.birth_year ?? ''}
                                            onChange={(e) =>
                                                setEditing({ ...editing, birth_year: e.target.value ? parseInt(e.target.value) : undefined })
                                            }
                                            placeholder="1990"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                            min={1950}
                                            max={2015}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                            사진 URL 📷
                                        </label>
                                        <input
                                            type="text"
                                            value={editing.photo_url ?? ''}
                                            onChange={(e) =>
                                                setEditing({ ...editing, photo_url: e.target.value || undefined })
                                            }
                                            placeholder="/player-photos/name.jpg"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Section */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    능력치 (1-10)
                                </label>
                                <div className="space-y-2">
                                    {[
                                        { key: 'shooting' as keyof Player, label: '슈팅', emoji: '⚽' },
                                        { key: 'offball_run' as keyof Player, label: '침투', emoji: '🏃' },
                                        { key: 'ball_keeping' as keyof Player, label: '키핑', emoji: '🎯' },
                                        { key: 'passing' as keyof Player, label: '패스', emoji: '📤' },
                                        { key: 'intercept' as keyof Player, label: '차단', emoji: '🛡️' },
                                        { key: 'marking' as keyof Player, label: '마킹', emoji: '👁️' },
                                        { key: 'stamina' as keyof Player, label: '체력', emoji: '💪' },
                                        { key: 'speed' as keyof Player, label: '속도', emoji: '⚡' },
                                        { key: 'physical' as keyof Player, label: '피지컬', emoji: '🏋️' },
                                        { key: 'linkup' as keyof Player, label: '연계', emoji: '🤝' },
                                    ].map((stat) => {
                                        // Handle undefined/null values with default of 5
                                        const statValue = (editing[stat.key] as number) ?? 5;
                                        return (
                                            <div key={stat.key} className="flex items-center gap-3 p-2 bg-slate-50 rounded-xl">
                                                <span className="text-lg w-8 text-center">{stat.emoji}</span>
                                                <span className="text-sm font-bold text-slate-700 w-16">{stat.label}</span>
                                                <div className="flex-1 flex items-center gap-1">
                                                    <button
                                                        onClick={() => setEditing({ ...editing, [stat.key]: Math.max(1, statValue - 1) })}
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 font-bold hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center"
                                                    >
                                                        -
                                                    </button>
                                                    <div className="flex-1 relative h-2 bg-slate-200 rounded-full overflow-hidden mx-2">
                                                        <div
                                                            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all"
                                                            style={{ width: `${(statValue / 10) * 100}%` }}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => setEditing({ ...editing, [stat.key]: Math.min(10, statValue + 1) })}
                                                        className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-blue-500 font-bold hover:bg-blue-50 active:scale-95 transition-all flex items-center justify-center"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <span className="text-xl font-black text-slate-900 tabular-nums w-8 text-right">
                                                    {statValue}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-4 flex gap-3">
                            <button
                                onClick={handleCancelEdit}
                                className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18} />
                                저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
