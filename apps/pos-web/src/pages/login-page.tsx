import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '@roi/api-client';
import { useSession } from '../app/session-context';

export function LoginPage() {
  const { user, login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<'pin' | 'password'>('pin');

  const redirectPath = useMemo(() => {
    const nextPath = (location.state as { from?: string } | null)?.from;
    return nextPath ?? '/tables';
  }, [location.state]);

  if (user) {
    return <Navigate to={redirectPath} replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(
        method === 'pin'
          ? { username, pin }
          : username
            ? { username, password }
            : { email, password },
      );
      navigate(redirectPath, { replace: true });
    } catch (submissionError) {
      if (submissionError instanceof ApiError) {
        setError(submissionError.message);
      } else {
        setError('Could not sign in.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="screen-center">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>ROI POS Login</h1>
        <p className="muted">Touch-ready ordering shell</p>

        <label>
          Login Type
          <select value={method} onChange={(event) => setMethod(event.target.value as 'pin' | 'password')}>
            <option value="pin">Username + PIN</option>
            <option value="password">Username + Password</option>
          </select>
        </label>

        <label>
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} required />
        </label>

        {method === 'pin' ? (
          <label>
            PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" required />
          </label>
        ) : (
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
        )}

        <label>
          Email (legacy fallback)
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>

        {error ? <p className="error">{error}</p> : null}

        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in...' : 'Enter POS'}
        </button>
      </form>
    </div>
  );
}
