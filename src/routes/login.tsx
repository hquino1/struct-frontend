import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Box, Database, Eye, EyeOff, Github, Globe, KeyRound, Lock, Mail, Moon, ShieldCheck, Sun, Zap } from 'lucide-react';
import { confirmResetPassword, confirmSignUp, getCurrentUser, resendSignUpCode, resetPassword, signIn, signUp } from 'aws-amplify/auth';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage, isRemembered, setRememberMe } from '@/lib/auth';

export const Route = createFileRoute('/login')({
  head: () => ({ meta: [ { title: 'Sign in — Struct' }, { name: 'description', content: 'Sign in or create a Struct account to explore your codebase architecture.' }, { property: 'og:title', content: 'Sign in — Struct' } ] }),
  component: Login,
});

const previewNodes = [
  { name: 'Web App', tech: 'Next.js', type: 'frontend', icon: Globe, x: 24, y: 40 },
  { name: 'API Gateway', tech: 'Node · Express', type: 'service', icon: Box, x: 196, y: 108 },
  { name: 'PostgreSQL', tech: 'Primary DB', type: 'data', icon: Database, x: 24, y: 196 },
  { name: 'Stripe', tech: 'Payments', type: 'external', icon: Zap, x: 196, y: 264 },
] as const;

type Mode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';
const emailPattern = /^\S+@\S+\.\S+$/;

function Login() {
  const { dark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRemember(isRemembered()); getCurrentUser().then(() => navigate({ to: '/' }), () => {}); }, [navigate]);

  const go = (next: Mode, message = '') => { setMode(next); setCode(''); setError(''); setNotice(message); setShowPassword(false); };
  const run = async (action: () => Promise<void>) => {
    setError(''); setNotice(''); setBusy(true);
    try { await action(); }
    catch (err) { if (err instanceof Error && err.name === 'UserAlreadyAuthenticatedException') navigate({ to: '/' }); else setError(authErrorMessage(err)); }
    finally { setBusy(false); }
  };

  const finishSignIn = async () => {
    setRememberMe(remember);
    const username = email.trim();
    const { nextStep } = await signIn({ username, password });
    if (nextStep.signInStep === 'DONE') return void navigate({ to: '/' });
    if (nextStep.signInStep === 'CONFIRM_SIGN_UP') { await resendSignUpCode({ username }); return go('confirm', "Your email isn't verified yet. We sent you a new code."); }
    if (nextStep.signInStep === 'RESET_PASSWORD') { await resetPassword({ username }); return go('reset', 'You need to set a new password. We sent a code to your email.'); }
    setError("This account needs an extra sign-in step that isn't supported yet.");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const username = email.trim();
    if ((mode === 'signin' || mode === 'signup' || mode === 'forgot') && !emailPattern.test(username)) return setError('Enter a valid email address.');
    if ((mode === 'confirm' || mode === 'reset') && !code.trim()) return setError('Enter the code from your email.');
    if (mode === 'signin' && !password) return setError('Enter your password.');
    if ((mode === 'signup' || mode === 'reset') && password.length < 8) return setError('Password must be at least 8 characters.');
    void run(async () => {
      if (mode === 'signin') return finishSignIn();
      if (mode === 'signup') {
        const { nextStep } = await signUp({ username, password, options: { userAttributes: { email: username } } });
        return nextStep.signUpStep === 'CONFIRM_SIGN_UP' ? go('confirm') : finishSignIn();
      }
      if (mode === 'confirm') {
        await confirmSignUp({ username, confirmationCode: code.trim() });
        return password ? finishSignIn() : go('signin', 'Email verified. Sign in to continue.');
      }
      if (mode === 'forgot') { await resetPassword({ username }); return go('reset'); }
      await confirmResetPassword({ username, confirmationCode: code.trim(), newPassword: password });
      setPassword('');
      go('signin', 'Password updated. Sign in with your new password.');
    });
  };

  const copy: Record<Mode, { title: string; sub: ReactNode; action: string }> = {
    signin: { title: 'Welcome back', sub: 'Sign in to keep exploring your architecture.', action: 'Sign in' },
    signup: { title: 'Create your account', sub: 'Start mapping your codebase in minutes.', action: 'Create account' },
    confirm: { title: 'Check your email', sub: <>We sent a verification code to <strong className="text-foreground">{email.trim()}</strong>.</>, action: 'Verify email' },
    forgot: { title: 'Reset your password', sub: "Enter your email and we'll send you a reset code.", action: 'Send reset code' },
    reset: { title: 'Choose a new password', sub: <>Enter the code sent to <strong className="text-foreground">{email.trim()}</strong> and a new password.</>, action: 'Update password' },
  };
  const passwordInput = (autoComplete: string) => <div className="login-input"><Lock size={14}/><input id="password" type={showPassword ? 'text' : 'password'} autoComplete={autoComplete} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}/><button type="button" className="login-eye" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(s => !s)}>{showPassword ? <EyeOff size={14}/> : <Eye size={14}/>}</button></div>;

  return <div className="login-shell">
    <section className="login-form-side">
      <header className="login-header">
        <Link to="/" className="brand login-brand"><div className="brand-mark"><span/><span/><span/></div>struct<span className="text-primary">.</span></Link>
        <Button variant="ghost" size="icon" title={dark ? 'Switch to light mode' : 'Switch to dark mode'} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggleTheme} className="text-muted-foreground h-8 w-8">{dark ? <Sun/> : <Moon/>}</Button>
      </header>
      <div className="login-form-wrap">
        {mode !== 'signin' && mode !== 'signup' && <Button variant="ghost" size="sm" type="button" className="login-back" onClick={() => go('signin')}><ArrowLeft/>Back to sign in</Button>}
        <h1>{copy[mode].title}</h1>
        <p className="login-sub">{copy[mode].sub}</p>
        {(mode === 'signin' || mode === 'signup') && <>
          <Button variant="outline" className="w-full" type="button" onClick={() => setError('GitHub sign-in is not connected yet.')}><Github/>Continue with GitHub</Button>
          <div className="login-divider"><span>or continue with email</span></div>
        </>}
        <form onSubmit={submit} noValidate>
          {(mode === 'signin' || mode === 'signup' || mode === 'forgot') && <>
            <label className="login-label" htmlFor="email">Email</label>
            <div className="login-input"><Mail size={14}/><input id="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)}/></div>
          </>}
          {(mode === 'confirm' || mode === 'reset') && <>
            <label className="login-label" htmlFor="code">Verification code</label>
            <div className="login-input"><KeyRound size={14}/><input id="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" value={code} onChange={e => setCode(e.target.value)}/></div>
          </>}
          {mode === 'signin' && <>
            <div className="flex justify-between items-center"><label className="login-label" htmlFor="password">Password</label><Button variant="link" type="button" className="h-auto p-0 mb-1.75 text-[11px]" onClick={() => go('forgot')}>Forgot password?</Button></div>
            {passwordInput('current-password')}
            <label className="login-remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>Keep me signed in</label>
          </>}
          {(mode === 'signup' || mode === 'reset') && <>
            <label className="login-label" htmlFor="password">{mode === 'reset' ? 'New password' : 'Password'}</label>
            {passwordInput('new-password')}
            <p className="login-hint">At least 8 characters, with upper and lowercase letters, a number, and a symbol.</p>
          </>}
          {notice && <p className="login-notice" role="status">{notice}</p>}
          {error && <p className="login-error" role="alert">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Please wait...' : <>{copy[mode].action}<ArrowRight/></>}</Button>
        </form>
        {mode === 'confirm' && <p className="login-foot">Didn't get a code? <Button variant="link" type="button" className="h-auto p-0 text-xs" disabled={busy} onClick={() => void run(async () => { await resendSignUpCode({ username: email.trim() }); setNotice('A new code is on its way.'); })}>Resend code</Button></p>}
        {mode === 'signin' && <p className="login-foot">Don't have an account? <Button variant="link" type="button" className="h-auto p-0 text-xs" onClick={() => go('signup')}>Create one</Button></p>}
        {mode === 'signup' && <p className="login-foot">Already have an account? <Button variant="link" type="button" className="h-auto p-0 text-xs" onClick={() => go('signin')}>Sign in</Button></p>}
      </div>
      <footer className="footer login-footer"><span className="flex items-center gap-1.5"><ShieldCheck size={11}/>Your code stays yours. Always.</span><span>Built for human understanding.</span></footer>
    </section>
    <aside className="login-visual canvas" aria-hidden="true">
      <div className="login-visual-inner">
        <div className="login-diagram">
          <svg className="edges" viewBox="0 0 372 330"><defs><marker id="login-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z"/></marker></defs>
            <path className="highlight" d="M176,76 C200,76 172,144 196,144" markerEnd="url(#login-arrow)"/>
            <path d="M196,144 C172,144 200,232 176,232" markerEnd="url(#login-arrow)"/>
            <path d="M284,180 L284,264" markerEnd="url(#login-arrow)"/>
          </svg>
          {previewNodes.map(n => <div key={n.name} className="graph-node login-node" style={{ left: n.x, top: n.y }}><div className="node-top"><span className={`node-icon ${n.type}`}><n.icon size={15}/></span><div><div className="node-title">{n.name}</div><div className="node-technology">{n.tech}</div></div></div></div>)}
        </div>
        <h2>Turn complex code into a clear picture.</h2>
        <p>Map services, dependencies, and data flows across your codebase in minutes.</p>
      </div>
    </aside>
  </div>;
}
