import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sbAuth } from '../lib/supabase.js';
import loginCss from '../styles/login.css?inline';

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const passRef = useRef(null);
  const notice = params.get('auth') === 'required';

  useEffect(() => {
    document.title = 'Logowanie — Fastline InfinitiQ';
    // если уже залогинен — сразу в редактор
    sbAuth().auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/editor', { replace: true });
    });
  }, [navigate]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    const { error } = await sbAuth().auth.signInWithPassword({
      email: emailRef.current.value.trim(),
      password: passRef.current.value,
    });
    if (error) {
      setBusy(false);
      setErr(error.message && /invalid login/i.test(error.message)
        ? 'Nieprawidłowy e-mail lub hasło.'
        : ('Błąd logowania: ' + (error.message || 'spróbuj ponownie')));
      return;
    }
    navigate('/editor', { replace: true });
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loginCss }} />
      <div className="glow"></div>
      <form className="card" id="form" autoComplete="on" onSubmit={submit}>
        <img className="logo" src="/assets/logo/LOGO.png" alt="Fastline InfinitiQ" />
        <div className="eyebrow">★ Panel · Edytor strony</div>
        <h1>Zaloguj się</h1>
        <div className={'notice' + (notice ? ' on' : '')} id="notice">Nie jesteś zalogowany — dostęp do edytora wymaga logowania.</div>

        <label htmlFor="email">E-mail</label>
        <input type="email" id="email" name="email" placeholder="imie.nazwisko@greywolfgroup.pl" required autoComplete="username" ref={emailRef} />

        <label htmlFor="password">Hasło</label>
        <input type="password" id="password" name="password" placeholder="••••••••••" required autoComplete="current-password" ref={passRef} />

        <button className="btn" id="submit" type="submit" disabled={busy}>{busy ? 'Logowanie…' : 'Wejdź do edytora'}</button>
        <div className={'err' + (err ? ' on' : '')} id="err">{err}</div>
        <div className="foot">Fastline InfinitiQ · Greywolf Group</div>
      </form>
    </>
  );
}
