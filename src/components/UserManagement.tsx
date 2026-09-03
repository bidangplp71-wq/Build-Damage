import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_LIMITS, UserAccount, UserRole } from '../types';
import { decryptPassword, maskPassword } from '../utils/security';
import { PasswordAuthModal } from './PasswordAuthModal';
import {
  Users,
  ShieldCheck,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  UserCheck,
  AlertCircle,
  Key,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';

export const UserManagement: React.FC = () => {
  const {
    users,
    currentUser,
    setCurrentUser,
    getUserCountsByRole,
    addUser,
    updateUser,
    updateUserPassword,
    canCurrentUserManagePassword,
    canCurrentUserViewPassword,
    deleteUser,
    showToast,
  } = useApp();

  const roleCounts = getUserCountsByRole();
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('');

  // Modal State for Add/Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Password Auth Modal State for Session Login
  const [authModalUser, setAuthModalUser] = useState<UserAccount | null>(null);

  // Password View State per user ID (revealed passwords)
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('admin_user');
  const [agency, setAgency] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [plainPassword, setPlainPassword] = useState('');

  const handleOpenAdd = (presetRole?: UserRole) => {
    setEditingUser(null);
    setName('');
    setEmail('');
    const targetRole = presetRole || (currentUser.role === 'admin' ? 'admin_user' : 'admin_user');
    setRole(targetRole);
    setAgency('Dinas Pekerjaan Umum dan Penataan Ruang Nagekeo');
    setPhone('0812' + Math.floor(10000000 + Math.random() * 90000000));
    setStatus('active');
    setPlainPassword('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: UserAccount) => {
    if (!canCurrentUserManagePassword(user.role)) {
      showToast('Akses ditolak: Anda tidak memiliki wewenang untuk mengedit akun ini.', 'error');
      return;
    }
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setAgency(user.agency);
    setPhone(user.phone);
    setStatus(user.status);
    setPlainPassword('');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      showToast('Nama dan Email wajib diisi', 'error');
      return;
    }

    if (editingUser) {
      const res = updateUser(editingUser.id, {
        name: name.trim(),
        email: email.trim(),
        role,
        agency: agency.trim(),
        phone: phone.trim(),
        status,
        plainPassword: plainPassword.trim() ? plainPassword.trim() : undefined,
      });
      showToast(res.message, res.success ? 'success' : 'error');
      if (res.success) setIsModalOpen(false);
    } else {
      const res = addUser({
        name: name.trim(),
        email: email.trim(),
        role,
        agency: agency.trim(),
        phone: phone.trim(),
        status,
        plainPassword: plainPassword.trim() ? plainPassword.trim() : undefined,
      });
      showToast(res.message, res.success ? 'success' : 'error');
      if (res.success) setIsModalOpen(false);
    }
  };

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const filteredUsers = users.filter((u) => {
    if (!selectedRoleFilter) return true;
    return u.role === selectedRoleFilter;
  });

  // Super Admin and Admin can manage users
  const canManageUsers = currentUser.role === 'super_admin' || currentUser.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span>Manajemen Pengguna & Pembatasan Kuota Peran (RBAC)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Sistem menerapkan batas kuota ketat: Super Admin (1), Admin (3), Verifikator (15), Surveyor/User (100), Publik (10).
          </p>
        </div>

        {canManageUsers ? (
          <button
            onClick={() => handleOpenAdd()}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Pengguna Baru</span>
          </button>
        ) : (
          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium flex items-center gap-1.5">
            <Lock className="w-4 h-4" />
            <span>Hanya Super Admin yang berhak menambah / mengubah akun pengguna.</span>
          </div>
        )}
      </div>

      {/* Role Quotas Overview Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(ROLE_LIMITS) as UserRole[]).map((roleKey) => {
          const limit = ROLE_LIMITS[roleKey];
          const currentCount = roleCounts[roleKey] || 0;
          const isFull = currentCount >= limit.max;
          const percent = Math.min(100, Math.round((currentCount / limit.max) * 100));

          return (
            <div
              key={roleKey}
              className={`p-4 rounded-2xl border transition-all ${
                selectedRoleFilter === roleKey
                  ? 'bg-indigo-50/70 border-indigo-300 shadow-xs'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-900 truncate">{limit.title}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    isFull
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {isFull ? 'PENUH' : 'TERSEDIA'}
                </span>
              </div>

              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{currentCount}</span>
                <span className="text-xs text-slate-500 font-semibold">/ {limit.max} Akun</span>
              </div>

              {/* Progress Bar */}
              <div className="mt-2.5 w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isFull ? 'bg-rose-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${percent}%` }}
                ></div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <button
                  onClick={() =>
                    setSelectedRoleFilter(selectedRoleFilter === roleKey ? '' : roleKey)
                  }
                  className="text-indigo-600 font-semibold hover:underline"
                >
                  {selectedRoleFilter === roleKey ? 'Tampilkan Semua' : 'Filter Tabel'}
                </button>

                {canManageUsers && !isFull && (
                  <button
                    onClick={() => handleOpenAdd(roleKey)}
                    className="text-slate-500 hover:text-slate-800 font-bold"
                  >
                    + Tambah
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Daftar Akun Terdaftar</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
              {filteredUsers.length} Pengguna
            </span>
          </div>
          {selectedRoleFilter && (
            <button
              onClick={() => setSelectedRoleFilter('')}
              className="text-xs text-indigo-600 font-semibold hover:underline"
            >
              Reset Filter Peran
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Nama Lengkap & Kontak</th>
                <th className="py-3 px-3">Instansi / Unit Kerja</th>
                <th className="py-3 px-3">Peran (Role)</th>
                <th className="py-3 px-3">Kata Sandi (Terenkripsi)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-center">Aksi / Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const isCurrentSession = currentUser.id === user.id;
                const roleConfig = ROLE_LIMITS[user.role];
                const canViewPwd = canCurrentUserViewPassword(user.role);
                const isRevealed = revealedPasswords[user.id] || false;
                const decryptedPwd = user.password ? decryptPassword(user.password) : 'simpkbg2026';

                return (
                  <tr
                    key={user.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      isCurrentSession ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{user.name}</span>
                            {isCurrentSession && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                                Sesi Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{user.email} &bull; {user.phone}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {user.agency}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleConfig.badgeColor}`}
                      >
                        {roleConfig.title}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {canViewPwd ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-slate-800 text-xs bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
                            {isRevealed ? decryptedPwd : maskPassword(decryptedPwd.length)}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleRevealPassword(user.id)}
                            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition-colors cursor-pointer"
                            title={isRevealed ? 'Sembunyikan sandi' : 'Tampilkan sandi terenkripsi'}
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Rahasia (Hanya Super Admin/Admin)</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {user.status === 'active' ? 'Aktif' : 'Non-aktif'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Open password auth modal to switch session securely */}
                        <button
                          onClick={() => setAuthModalUser(user)}
                          title="Masuk / Ganti Sesi dengan verifikasi kata sandi"
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                        >
                          <KeyRound className="w-3 h-3" />
                          <span>Login Sesi</span>
                        </button>

                        {canCurrentUserManagePassword(user.role) && (
                          <button
                            onClick={() => handleOpenEdit(user)}
                            className="p-1 rounded-lg hover:bg-indigo-50 text-indigo-600 transition-colors cursor-pointer"
                            title="Edit Pengguna & Sandi"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {currentUser.role === 'super_admin' && user.role !== 'super_admin' && (
                          <button
                            onClick={() => {
                              const res = deleteUser(user.id);
                              showToast(res.message, res.success ? 'success' : 'error');
                            }}
                            className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Pengguna"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Tambah / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              {editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Pengguna Baru'}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Kuota peran akan divalidasi secara otomatis sebelum akun disimpan.
            </p>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap & Gelar</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Budi Santoso, S.T."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-semibold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="budi.santoso@pupr.go.id"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Peran & Hak Akses (Batas Kuota)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold"
                >
                  {(Object.keys(ROLE_LIMITS) as UserRole[]).map((rKey) => {
                    const lim = ROLE_LIMITS[rKey];
                    const count = roleCounts[rKey] || 0;
                    return (
                      <option key={rKey} value={rKey}>
                        {lim.title} (Terisi: {count}/{lim.max})
                      </option>
                    );
                  })}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {ROLE_LIMITS[role].description}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Instansi / Unit Kerja</label>
                <input
                  type="text"
                  value={agency}
                  onChange={(e) => setAgency(e.target.value)}
                  placeholder="Dinas Pekerjaan Umum dan Penataan Ruang"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">No. WhatsApp / HP</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Status Akun</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                >
                  <option value="active">Aktif</option>
                  <option value="inactive">Non-aktif</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {editingUser ? 'Ubah Kata Sandi (Opsional)' : 'Kata Sandi Akun'}
                </label>
                <input
                  type="text"
                  value={plainPassword}
                  onChange={(e) => setPlainPassword(e.target.value)}
                  placeholder={editingUser ? 'Kosongkan jika tidak ingin mengubah sandi' : 'Contoh: sandiBaru2026'}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Kata sandi akan otomatis dienkripsi secara aman dalam penyimpanan sistem.
                </p>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Authentication Modal for Session Login */}
      <PasswordAuthModal
        isOpen={Boolean(authModalUser)}
        targetUser={authModalUser}
        onClose={() => setAuthModalUser(null)}
      />
    </div>
  );
};
