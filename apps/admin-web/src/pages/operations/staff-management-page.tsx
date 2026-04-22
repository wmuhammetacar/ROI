import { FormEvent, useCallback, useEffect, useState } from 'react';
import { staffManagementApi, type StaffUser } from '../../api';
import { useBranchContext } from '../../app/branch-context';
import { toErrorMessage } from '../../app/error-utils';
import { DataState, Modal, PageHeader, StatusBadge } from '../../components';

export function StaffManagementPage() {
  const { effectiveBranchId } = useBranchContext();
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'waiter' | 'cashier' | 'manager' | 'production'>('waiter');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const users = await staffManagementApi.list(effectiveBranchId ?? undefined);
      setStaff(users);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [effectiveBranchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await staffManagementApi.create({
        name,
        username,
        email,
        branchId: effectiveBranchId ?? '',
        roleNames: [role],
        password: password.trim() || undefined,
        pin: pin.trim() || undefined,
      });
      setIsCreateOpen(false);
      setName('');
      setUsername('');
      setEmail('');
      setPassword('');
      setPin('');
      await load();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (user: StaffUser) => {
    try {
      await staffManagementApi.setActive(user.id, !user.isActive);
      await load();
    } catch (err) {
      setError(toErrorMessage(err));
    }
  };

  return (
    <div className="catalog-content">
      <PageHeader
        title="Staff Management"
        description="Create waiter/cashier/manager accounts for in-venue operations."
        actions={<button className="secondary" onClick={() => setIsCreateOpen(true)}>Create Staff</button>}
      />

      <DataState isLoading={isLoading} error={error} empty={!isLoading && staff.length === 0} emptyMessage="No staff yet." />

      {staff.length > 0 ? (
        <div className="table-wrap page-card">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.username}</td>
                  <td>{user.email}</td>
                  <td>{user.roles.join(', ')}</td>
                  <td><StatusBadge active={user.isActive} activeLabel="Active" inactiveLabel="Inactive" /></td>
                  <td>
                    <button className="secondary" onClick={() => void toggleActive(user)}>
                      {user.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isCreateOpen ? (
        <Modal title="Create Staff" onClose={() => setIsCreateOpen(false)}>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              Full Name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label>
              Username
              <input value={username} onChange={(e) => setUsername(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                <option value="waiter">waiter</option>
                <option value="cashier">cashier</option>
                <option value="manager">manager</option>
                <option value="production">kitchen/bar</option>
              </select>
            </label>
            <label>
              Password (optional)
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <label>
              PIN (optional)
              <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" />
            </label>
            <div className="form-actions">
              <button type="button" className="secondary" onClick={() => setIsCreateOpen(false)}>Cancel</button>
              <button type="submit" className="secondary" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Create'}</button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
