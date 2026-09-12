import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Login from './Login';
import Harmonogram from './Harmonogram';
import AdminPanel from './AdminPanel';
import MojaFrekwencja from './MojaFrekwencja';
import PodgladCzlonka from './PodgladCzlonka';
import PodgladObecnosciCzlonka from './PodgladObecnosciCzlonka';
import Koncerty from './Koncerty';
import ZarzadzanieCzlonkami from './ZarzadzanieCzlonkami';
import OneSignal from 'react-onesignal';
import Aktualnosci from './Aktualnosci';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aktywnaZakladka, setAktywnaZakladka] = useState('harmonogram');

  // INICJALIZACJA ONESIGNAL (Powiadomienia Push)
  useEffect(() => {
    const runOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
          allowLocalhostAsSecureOrigin: true, // Pozwala testować lokalnie
        });
        
        // Wyświetla okienko (Slidedown) z prośbą o zgodę na powiadomienia
        OneSignal.Slidedown.promptPush();
      } catch (error) {
        console.error('Błąd inicjalizacji OneSignal:', error);
      }
    };

    runOneSignal();
  }, []);

  // OBSŁUGA SESJI I LOGOWANIA
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) pobierzProfil(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) pobierzProfil(session.user.id);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const pobierzProfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Błąd pobierania profilu:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading || (session && !profile)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <p style={{ fontSize: '18px', color: '#4a5568' }}>Ładowanie profilu użytkownika...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  if (profile && profile.status === 'oczekujacy') {
    return (
      <div style={{ maxWidth: '500px', margin: '80px auto', padding: '30px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontFamily: 'sans-serif' }}>
        <h2 style={{ color: '#d97706', marginBottom: '15px' }}>Konto oczekuje na zatwierdzenie ⏳</h2>
        <p style={{ color: '#4b5563', lineHeight: '1.6' }}>
          Witaj, <strong>{profile.imie_nazwisko}</strong>! Twoje konto zostało utworzone i czeka na akceptację przez kierownictwo zespołu. 
          Po zatwierdzeniu uzyskasz pełny dostęp do harmonogramu i prób.
        </p>
        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ marginTop: '25px', padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
        >
          Wyloguj się
        </button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', paddingBottom: '40px' }}>
      
      {/* Górny pasek nawigacyjny / Nagłówek */}
      <header style={{ backgroundColor: '#1e293b', color: 'white', padding: '15px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '20px', letterSpacing: '0.5px' }}>ZPiT UJ „Słowianki” 🌾</h1>
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
            Zalogowany jako: <strong style={{ color: '#e2e8f0' }}>{profile?.imie_nazwisko}</strong> ({profile?.rola}{profile?.sekcja ? ` - ${profile.sekcja}` : ''})
          </p>
        </div>

        <button 
          onClick={() => supabase.auth.signOut()}
          style={{ padding: '8px 14px', backgroundColor: '#334155', color: 'white', border: '1px solid #475569', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
        >
          Wyloguj się 🚪
        </button>
      </header>

      {/* Pasek zakładek menu */}
      <nav style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #cbd5e1', padding: '10px 30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        
        {/* Zakładki dla członka zespołu */}
        {profile?.rola === 'członek' && (
          <>
            <button 
              onClick={() => setAktywnaZakladka('harmonogram')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📅 Harmonogram prób
            </button>
            <button 
              onClick={() => setAktywnaZakladka('aktualnosci')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📢 Aktualności
            </button>
            <button 
              onClick={() => setAktywnaZakladka('sprawdz_obecnosc')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'sprawdz_obecnosc' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'sprawdz_obecnosc' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📋 Sprawdź obecność
            </button>
            <button 
              onClick={() => setAktywnaZakladka('koncerty')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              🎻 Koncerty
            </button>
            <button 
              onClick={() => setAktywnaZakladka('moje_statystyki')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'moje_statystyki' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'moje_statystyki' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📊 Moja frekwencja
            </button>
            <button 
              onClick={() => setAktywnaZakladka('profil')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'profil' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'profil' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              ⚙️ Mój profil
            </button>
          </>
        )}

        {/* Zakładki dla kierownika / pracownika */}
        {(profile?.rola === 'kierownik' || profile?.rola === 'pracownik') && (
          <>
            <button 
              onClick={() => setAktywnaZakladka('harmonogram')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📅 Harmonogram prób
            </button>
            <button 
              onClick={() => setAktywnaZakladka('aktualnosci')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              📢 Aktualności
            </button>
            <button 
              onClick={() => setAktywnaZakladka('czlonkowie')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'czlonkowie' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'czlonkowie' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              👥 Członkowie
            </button>
            <button 
              onClick={() => setAktywnaZakladka('koncerty')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              🎻 Koncerty
            </button>
            <button 
              onClick={() => setAktywnaZakladka('admin')}
              style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'admin' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'admin' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
            >
              🛠️ Panel kadry i weryfikacji
            </button>
          </>
        )}
      </nav>

      {/* Główna zawartość */}
      <main style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px' }}>
        
        {aktywnaZakladka === 'harmonogram' && (
          <Harmonogram profile={profile} />
        )}

        {aktywnaZakladka === 'aktualnosci' && (
          <Aktualnosci profile={profile} />
        )}

        {aktywnaZakladka === 'czlonkowie' && (profile?.rola === 'kierownik' || profile?.rola === 'pracownik') && (
          <ZarzadzanieCzlonkami />
        )}

        {aktywnaZakladka === 'sprawdz_obecnosc' && profile?.rola === 'członek' && (
          <PodgladObecnosciCzlonka profile={profile} />
        )}

        {aktywnaZakladka === 'koncerty' && (
          <Koncerty profile={profile} />
        )}

        {aktywnaZakladka === 'moje_statystyki' && profile?.rola === 'członek' && (
          <MojaFrekwencja profile={profile} />
        )}

        {aktywnaZakladka === 'profil' && profile?.rola === 'członek' && (
          <PodgladCzlonka profile={profile} />
        )}

        {aktywnaZakladka === 'admin' && (profile?.rola === 'kierownik' || profile?.rola === 'pracownik') && (
          <AdminPanel profile={profile} />
        )}

      </main>
    </div>
  );
}