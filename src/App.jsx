import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import AdminPanel from './AdminPanel';
import Harmonogram from './Harmonogram';
import MojaFrekwencja from './MojaFrekwencja';
import PodgladCzlonka from './PodgladCzlonka';
import Koncerty from './Koncerty';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [aktywnaZakladka, setAktywnaZakladka] = useState('proby'); // 'proby' | 'frekwencja' | 'koncerty'

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(); 
    
    if (data) setProfile(data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ textAlign: 'center', marginTop: '10px', color: '#000000', fontSize: '24px' }}>
        Panel Wewnętrzny ZPiT UJ Słowianki
      </h1>
      
      {!session ? (
        <Login />
      ) : !profile ? (
        <p style={{ textAlign: 'center', marginTop: '50px' }}>Wczytywanie Twojego profilu...</p>
      ) : (
        <div>
          {/* Górny pasek powitalny z wylogowaniem */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '15px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Witaj, {profile.imie_nazwisko}!</h2>
              <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                Rola: <strong>{profile.rola}</strong> {profile.sekcja !== 'brak' && `| Sekcja: ${profile.sekcja}`}
              </p>
            </div>
            <button 
              onClick={handleLogout} 
              style={{ padding: '8px 15px', cursor: 'pointer', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '13px' }}
            >
              Wyloguj się
            </button>
          </div>

          {/* Panel weryfikacji konta dla nowych */}
          {profile.status === 'oczekujący' ? (
            <div style={{ backgroundColor: '#fef3c7', padding: '20px', borderRadius: '12px', marginTop: '20px', border: '1px solid #fde68a', textAlign: 'center' }}>
              <h3 style={{ color: '#92400e', marginTop: 0 }}>Konto oczekuje na weryfikację</h3>
              <p style={{ color: '#b45309', marginBottom: 0 }}>Twoje konto musi zostać zatwierdzone przez kierownictwo. Zyskasz wtedy pełny dostęp do zakładek zespołu.</p>
            </div>
          ) : (
            <div>
              {/* Panel akceptacji kont dla kierownika (zawsze widoczny na górze dla administratora) */}
              {profile.rola === 'kierownik' && <AdminPanel />}

              {/* --- KAFELKOWE ZAKŁADKI MENU GŁÓWNEGO --- */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '20px' }}>
                
                {/* Kafel 1: Próby */}
                <div 
                  onClick={() => setAktywnaZakladka('proby')}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    textAlign: 'center',
                    backgroundColor: aktywnaZakladka === 'proby' ? '#3182ce' : '#ffffff',
                    color: aktywnaZakladka === 'proby' ? '#ffffff' : '#1e293b',
                    border: '1px solid',
                    borderColor: aktywnaZakladka === 'proby' ? '#3182ce' : '#cbd5e1',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>📅</div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Próby</h3>
                </div>

                {/* Kafel 2: Frekwencja */}
                <div 
                  onClick={() => setAktywnaZakladka('frekwencja')}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    textAlign: 'center',
                    backgroundColor: aktywnaZakladka === 'frekwencja' ? '#3182ce' : '#ffffff',
                    color: aktywnaZakladka === 'frekwencja' ? '#ffffff' : '#1e293b',
                    border: '1px solid',
                    borderColor: aktywnaZakladka === 'frekwencja' ? '#3182ce' : '#cbd5e1',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>📊</div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Frekwencja</h3>
                </div>

                {/* Kafel 3: Koncerty */}
                <div 
                  onClick={() => setAktywnaZakladka('koncerty')}
                  style={{ 
                    padding: '20px', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    textAlign: 'center',
                    backgroundColor: aktywnaZakladka === 'koncerty' ? '#3182ce' : '#ffffff',
                    color: aktywnaZakladka === 'koncerty' ? '#ffffff' : '#1e293b',
                    border: '1px solid',
                    borderColor: aktywnaZakladka === 'koncerty' ? '#3182ce' : '#cbd5e1',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.02)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '5px' }}>🎻</div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>Koncerty</h3>
                </div>

              </div>

              {/* --- ZAWARTOŚĆ AKTYWNEJ ZAKŁADKI --- */}
              <div style={{ marginTop: '20px' }}>
                
                {/* TREŚĆ 1: PRÓBY */}
                {aktywnaZakladka === 'proby' && (
                  <Harmonogram profile={profile} />
                )}

                {/* TREŚĆ 2: FREKWENCJA */}
                {aktywnaZakladka === 'frekwencja' && (
                  <div>
                    {profile.rola === 'członek' ? (
                      <MojaFrekwencja profile={profile} />
                    ) : (
                      <PodgladCzlonka />
                    )}
                  </div>
                )}

                {/* TREŚĆ 3: KONCERTY */}
                {aktywnaZakladka === 'koncerty' && (
                  <Koncerty profile={profile} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;