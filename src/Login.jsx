import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // Stan na powtórzone hasło
  const [imieNazwisko, setImieNazwisko] = useState('');
  const [sekcja, setSekcja] = useState('chór');
  const [rola, setRola] = useState('członek');
  const [message, setMessage] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setMessage('Przetwarzanie...');

    if (isLogin) {
      // Logowanie
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage('Błąd logowania: ' + error.message);
    } else {
      // Rejestracja - walidacja haseł
      if (password !== confirmPassword) {
        setMessage('Błąd: Wprowadzone hasła muszą być takie same!');
        return;
      }

      if (password.length < 6) {
        setMessage('Błąd: Hasło musi mieć co najmniej 6 znaków.');
        return;
      }

      // Rejestracja w Supabase Auth
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: { imie_nazwisko: imieNazwisko }
        }
      });

      if (error) {
        setMessage('Błąd rejestracji: ' + error.message);
      } else if (data?.user) {
        // Jeśli rola to nie członek, sekcja zapisuje się jako null
        const zapisywanaSekcja = rola === 'członek' ? sekcja : null;

        const { error: profileError } = await supabase.from('profiles').insert([
          { 
            id: data.user.id, 
            imie_nazwisko: imieNazwisko, 
            sekcja: zapisywanaSekcja, 
            rola: rola, 
            status: 'oczekujący' 
          }
        ]);

        if (profileError) {
          setMessage('Błąd profilu: ' + profileError.message);
        } else {
          setMessage('Konto utworzone! Oczekuje na zatwierdzenie przez kierownictwo.');
        }
      }
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '40px auto', padding: '25px', border: '1px solid #334155', borderRadius: '12px', backgroundColor: '#1e293b', color: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', textAlign: 'center' }}>
      
      {/* Białe logo idealnie widoczne na ciemnym tle */}
      <img 
        src="/logo.png" 
        alt="Logo ZPiT UJ Słowianki" 
        style={{ width: '90px', height: 'auto', marginBottom: '10px', objectFit: 'contain' }} 
      />

      <h2 style={{ color: '#ffffff', marginBottom: '20px' }}>
        {isLogin ? 'Logowanie' : 'Rejestracja'}
      </h2>

      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px', textAlign: 'left' }}>
        {!isLogin && (
          <>
            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>Imię i nazwisko</label>
              <input 
                type="text" 
                placeholder="np. Jan Kowalski" 
                value={imieNazwisko} 
                onChange={(e) => setImieNazwisko(e.target.value)} 
                required 
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>Rola</label>
              <select 
                value={rola} 
                onChange={(e) => setRola(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
              >
                <option value="członek">Członek zespołu</option>
                <option value="pracownik">Pracownik / Instruktor</option>
                {/* Opcja kierownika została usunięta */}
              </select>
            </div>

            {/* Wybór sekcji widoczny TYLKO gdy rola to 'członek' */}
            {rola === 'członek' && (
              <div>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>Sekcja</label>
                <select 
                  value={sekcja} 
                  onChange={(e) => setSekcja(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
                >
                  <option value="chór">Chór</option>
                  <option value="balet">Balet</option>
                  <option value="kapela">Kapela</option>
                </select>
              </div>
            )}
          </>
        )}

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>E-mail</label>
          <input 
            type="email" 
            placeholder="twoj@email.pl" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>Hasło</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
          />
        </div>

        {/* Drugie pole hasła widoczne tylko przy rejestracji */}
        {!isLogin && (
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500', color: '#cbd5e1' }}>Powtórz hasło</label>
            <input 
              type="password" 
              placeholder="••••••••" 
              value={confirmPassword} 
              onChange={(e) => setConfirmPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', backgroundColor: '#0f172a', color: '#ffffff', boxSizing: 'border-box' }}
            />
          </div>
        )}

        <button 
          type="submit" 
          style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '15px', marginTop: '5px' }}
        >
          {isLogin ? 'Zaloguj się' : 'Zarejestruj się'}
        </button>
      </form>

      {message && <p style={{ textAlign: 'center', marginTop: '15px', fontWeight: '500', color: message.includes('Błąd') ? '#f87171' : '#4ade80' }}>{message}</p>}

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <button 
          onClick={() => { setIsLogin(!isLogin); setMessage(''); setPassword(''); setConfirmPassword(''); }}
          style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
        >
          {isLogin ? 'Nie masz konta? Zarejestruj się' : 'Masz już konto? Zaloguj się'}
        </button>
      </div>
    </div>
  );
}