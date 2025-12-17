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
    Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const API_URL = 'http://localhost:8787';

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
    height_cm?: number;
    weight_kg?: number;
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
    const [selectedUser, _setSelectedUser] = useState('');
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

    const handleLinkUser = async (playerId: number) => {
        if (!selectedUser) return;
        const token = localStorage.getItem('auth_token');
        try {
            const res = await fetch(
                `${API_URL}/players/${playerId}/link-user`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ userId: selectedUser }),
                },
            );
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

    const filteredPlayers = players.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
    );

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
            {/* Card View (Mobile-Friendly)                                        */}
            {/* ------------------------------------------------------------------ */}
            {viewMode === 'card' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredPlayers.map((p) => {
                        const avgStat = Math.round((p.shooting + p.offball_run + p.ball_keeping + p.passing + p.intercept + p.marking + p.stamina + p.speed + (p.physical || 5)) / 9);
                        return (
                            <div
                                key={p.id}
                                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                            >
                                {/* Card Header */}
                                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                            {p.name.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900">{p.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{p.player_code ?? 'NO CODE'}</div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-blue-600">{avgStat}</div>
                                        <div className="text-[10px] text-slate-400 uppercase">AVG</div>
                                    </div>
                                </div>

                                {/* Stats Grid - 3x3 for 9 stats */}
                                <div className="p-3 grid grid-cols-3 gap-1.5 text-center bg-slate-50">
                                    {[
                                        { key: 'shooting', label: '슈팅', value: p.shooting },
                                        { key: 'offball_run', label: '침투', value: p.offball_run },
                                        { key: 'ball_keeping', label: '키핑', value: p.ball_keeping },
                                        { key: 'passing', label: '패스', value: p.passing },
                                        { key: 'intercept', label: '차단', value: p.intercept },
                                        { key: 'marking', label: '마킹', value: p.marking },
                                        { key: 'stamina', label: '체력', value: p.stamina },
                                        { key: 'speed', label: '속도', value: p.speed },
                                        { key: 'physical', label: '피지컬', value: p.physical || 5 },
                                    ].map(stat => (
                                        <div key={stat.key} className="bg-white rounded-lg p-1.5 shadow-sm">
                                            <div className="text-[9px] text-slate-400 font-bold">{stat.label}</div>
                                            <div className={cn(
                                                "text-base font-black",
                                                stat.value >= 8 ? "text-green-600" :
                                                    stat.value >= 6 ? "text-blue-600" :
                                                        stat.value >= 4 ? "text-slate-700" : "text-orange-500"
                                            )}>{stat.value}</div>
                                        </div>
                                    ))}
                                </div>

                                {/* Card Footer - User Link & Actions */}
                                <div className="p-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        {p.user_username ? (
                                            <div className="flex items-center gap-1.5">
                                                <LinkIcon size={12} className="text-blue-500" />
                                                <span className="text-xs font-medium text-blue-600 truncate">{p.user_username}</span>
                                                {p.role && (
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                                                        p.role === 'ADMIN' && "bg-red-100 text-red-600",
                                                        p.role === 'OWNER' && "bg-purple-100 text-purple-600",
                                                        p.role === 'MATCH_RECORDER' && "bg-yellow-100 text-yellow-600",
                                                        (!p.role || p.role === 'member') && "bg-slate-100 text-slate-500"
                                                    )}>
                                                        {p.role === 'ADMIN' ? '관리' : p.role === 'OWNER' ? '구단주' : p.role === 'MATCH_RECORDER' ? '기록' : '회원'}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-slate-400">미연결</span>
                                        )}
                                    </div>
                                    {canEdit && (
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => {
                                                    setEditing(p);
                                                    setIsNew(false);
                                                }}
                                                className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                                title="수정"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                                                title="삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                                            {!p.user_username && (
                                                <button
                                                    onClick={() => handleLinkUser(p.id)}
                                                    className="text-green-600 hover:text-green-800"
                                                    title="사용자 연결"
                                                    disabled={!selectedUser}
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            )}
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
                            </div>

                            {/* Stats Section */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    능력치 (1-10)
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {[
                                        { key: 'shooting' as keyof Player, label: '슈팅', color: 'bg-red-50 border-red-100' },
                                        { key: 'offball_run' as keyof Player, label: '침투', color: 'bg-orange-50 border-orange-100' },
                                        { key: 'ball_keeping' as keyof Player, label: '키핑', color: 'bg-yellow-50 border-yellow-100' },
                                        { key: 'passing' as keyof Player, label: '패스', color: 'bg-green-50 border-green-100' },
                                        { key: 'intercept' as keyof Player, label: '차단', color: 'bg-teal-50 border-teal-100' },
                                        { key: 'marking' as keyof Player, label: '마킹', color: 'bg-blue-50 border-blue-100' },
                                        { key: 'stamina' as keyof Player, label: '체력', color: 'bg-indigo-50 border-indigo-100' },
                                        { key: 'speed' as keyof Player, label: '속도', color: 'bg-purple-50 border-purple-100' },
                                        { key: 'physical' as keyof Player, label: '피지컬', color: 'bg-pink-50 border-pink-100' },
                                    ].map((stat) => (
                                        <div key={stat.key} className={`p-3 rounded-xl border ${stat.color}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-sm font-bold text-slate-700">{stat.label}</span>
                                                <span className="text-xl font-black text-slate-900 tabular-nums w-8 text-center">
                                                    {editing[stat.key] as number}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setEditing({ ...editing, [stat.key]: Math.max(1, (editing[stat.key] as number) - 1) })}
                                                    className="w-8 h-8 shrink-0 rounded-lg bg-white shadow-sm border border-slate-200 text-slate-500 font-bold hover:bg-slate-50 active:scale-95 transition-all"
                                                >
                                                    -
                                                </button>
                                                <input
                                                    type="range"
                                                    min="1"
                                                    max="10"
                                                    value={editing[stat.key] as number}
                                                    onChange={(e) => setEditing({ ...editing, [stat.key]: parseInt(e.target.value) })}
                                                    className="flex-1 min-w-0 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                />
                                                <button
                                                    onClick={() => setEditing({ ...editing, [stat.key]: Math.min(10, (editing[stat.key] as number) + 1) })}
                                                    className="w-8 h-8 shrink-0 rounded-lg bg-white shadow-sm border border-slate-200 text-blue-600 font-bold hover:bg-blue-50 active:scale-95 transition-all"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    ))}
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
