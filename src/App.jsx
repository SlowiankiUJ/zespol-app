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
import Osiagniecia from './Osiagniecia';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aktywnaZakladka, setAktywnaZakladka] = useState('harmonogram');
  const [streak, setStreak] = useState(0);

  // INICJALIZACJA ONESIGNAL (Powiadomienia Push)
  useEffect(() => {
    const runOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
          allowLocalhostAsSecureOrigin: true,
        });
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

  // SUPABASE REALTIME: Automatyczna aktualizacja streaka, gdy zmienią się deklaracje obecności
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('zmiany_streaka_uzytkownika')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deklaracje_obecnosci',
          filter: `id_uzytkownika=eq.${profile.id}`
        },
        () => {
          obliczStreak(profile.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile]);

  const pobierzProfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      obliczStreak(userId);
    } catch (error) {
      console.error('Błąd pobierania profilu:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // FUNKCJA OBLICZANIA STREAKA (Z pominięciem prób generalnych)
  const obliczStreak = async (userId) => {
    try {
      // 1. Pobieramy deklaracje obecności użytkownika
      const { data: deklaracje, error: dekError } = await supabase
        .from('deklaracje_obecnosci')
        .select('*')
        .eq('id_uzytkownika', userId);

      if (dekError || !deklaracje || deklaracje.length === 0) {
        setStreak(0);
        return;
      }

      // 2. Pobieramy listę prób z tabeli "proby"
      const { data: probyList, error: probError } = await supabase
        .from('proby')
        .select('*');

      if (probError || !probyList) {
        setStreak(0);
        return;
      }

      // Tworzymy mapę prób po ID (przechowując datę oraz sekcję)
      const probaInfoMap = {};
      probyList.forEach(p => {
        if (p.id && p.data_czas) {
          probaInfoMap[p.id] = {
            data_czas: p.data_czas,
            sekcja: p.sekcja
          };
        }
      });

      // 3. Łączymy deklaracje z próbami i odrzucamy próby generalne
      const wpisyZUstalonaData = deklaracje
        .map(d => {
          const info = probaInfoMap[d.id_proby];
          return {
            obecny: d.obecny,
            data_proba: info ? info.data_czas : null,
            sekcja: info ? info.sekcja : null
          };
        })
        .filter(item => item.data_proba && item.sekcja !== 'generalna' && (item.obecny === true || item.obecny === false));

      if (wpisyZUstalonaData.length === 0) {
        setStreak(0);
        return;
      }

      // 4. Sortujemy próby od najnowszej do najstarszej
      wpisyZUstalonaData.sort((a, b) => new Date(b.data_proba) - new Date(a.data_proba));

      // 5. Liczymy passę (streak)
      let aktualnyStreak = 0;
      for (const wpis of wpisyZUstalonaData) {
        if (wpis.obecny === true) {
          aktualnyStreak++;
        } else if (wpis.obecny === false) {
          break; // Przerwanie passy przy pierwszej nieobecności
        }
      }

      setStreak(aktualnyStreak);
    } catch (err) {
      console.error('Błąd obliczania streaka:', err);
      setStreak(0);
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
          <p style={{ margin: '3px 0 0 0', fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Zalogowany jako: <strong style={{ color: '#e2e8f0' }}>{profile?.imie_nazwisko}</strong> ({profile?.rola}{profile?.sekcja ? ` - ${profile.sekcja}` : ''})</span>
            {profile?.rola === 'członek' && (
              <span style={{ backgroundColor: '#334155', padding: '2px 8px', borderRadius: '12px', color: '#f59e0b', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #475569' }}>
                🔥 {streak} {streak === 1 ? 'próba z rzędu' : 'prób z rzędu'}
              </span>
            )}
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
        
        {profile?.rola === 'członek' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('sprawdz_obecnosc')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'sprawdz_obecnosc' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'sprawdz_obecnosc' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📋 Sprawdź obecność</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
            <button onClick={() => setAktywnaZakladka('moje_statystyki')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'moje_statystyki' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'moje_statystyki' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📊 Moja frekwencja</button>
            <button onClick={() => setAktywnaZakladka('profil')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'profil' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'profil' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>⚙️ Mój profil</button>
            <button onClick={() => setAktywnaZakladka('osiagniecia')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'osiagniecia' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'osiagniecia' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🏆 Osiągnięcia</button>
          </>
        )}

        {profile?.rola === 'pracownik' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
          </>
        )}

        {profile?.rola === 'kierownik' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('czlonkowie')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'czlonkowie' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'czlonkowie' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>👥 Członkowie</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
            <button onClick={() => setAktywnaZakladka('admin')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'admin' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'admin' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🛠️ Panel kadry i weryfikacji</button>
          </>
        )}
      </nav>

      {/* Główna zawartość */}
      <main style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px' }}>
        {aktywnaZakladka === 'harmonogram' && <Harmonogram profile={profile} />}
        {aktywnaZakladka === 'aktualnosci' && <Aktualnosci profile={profile} />}
        {aktywnaZakladka === 'czlonkowie' && profile?.rola === 'kierownik' && <ZarzadzanieCzlonkami />}
        {aktywnaZakladka === 'sprawdz_obecnosc' && profile?.rola === 'członek' && <PodgladObecnosciCzlonka profile={profile} />}
        {aktywnaZakladka === 'koncerty' && <Koncerty profile={profile} />}
        {aktywnaZakladka === 'moje_statystyki' && profile?.rola === 'członek' && <MojaFrekwencja profile={profile} />}
        {aktywnaZakladka === 'profil' && profile?.rola === 'członek' && <PodgladCzlonka profile={profile} />}
        {aktywnaZakladka === 'admin' && profile?.rola === 'kierownik' && <AdminPanel profile={profile} />}
        {aktywnaZakladka === 'osiagniecia' && profile?.rola === 'członek' && <Osiagniecia profile={profile} />}
      </main>
    </div>
  );
}