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
import SkanerQR from './SkanerQR';
import ListaCzlonkow from './ListaCzlonkow';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aktywnaZakladka, setAktywnaZakladka] = useState('harmonogram');
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const runOneSignal = async () => {
      try {
        await OneSignal.init({
          appId: "2847ff42-0d1c-4968-9e50-a47e42fddac5",
          allowLocalhostAsSecureOrigin: true,
        });
        OneSignal.Slidedown.promptPush();
      } catch (error) {
        console.error('Błąd OneSignal:', error);
      }
    };
    runOneSignal();
  }, []);

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

  // Nasłuchiwanie na żywo: zmiany w profilu (np. gdy kierownik zatwierdzi konto) oraz streak
  useEffect(() => {
    if (!profile) return;

    // 1. Nasłuchiwanie na zatwierdzenie konta w profiles
    const profilChannel = supabase
      .channel(`zmiany_profilu_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`
        },
        (payload) => {
          if (payload.new) {
            setProfile(payload.new);
          }
        }
      )
      .subscribe();

    // 2. Nasłuchiwanie na deklaracje (streak)
    const streakChannel = supabase
      .channel(`zmiany_streaka_${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deklaracje_obecnosci',
          filter: `id_uzytkownika=eq.${profile.id}`
        },
        () => {
          obliczStreak(profile.id, profile.sekcja);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilChannel);
      supabase.removeChannel(streakChannel);
    };
  }, [profile?.id]);

  const pobierzProfil = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
      if (data && czyKontoZatwierdzone(data.status)) {
        obliczStreak(userId, data.sekcja);
      }
    } catch (error) {
      console.error('Błąd pobierania profilu:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const czyKontoZatwierdzone = (status) => {
    if (!status) return false;
    const s = status.toString().trim().toLowerCase();
    return s === 'zatwierdzony';
  };

  const obliczStreak = async (userId, sekcjaGlowna) => {
    try {
      if (!sekcjaGlowna) return;
      const glownaSekcjaClean = sekcjaGlowna.trim().toLowerCase();

      const { data: probyList } = await supabase
        .from('proby')
        .select('id, data_czas, sekcja')
        .order('data_czas', { ascending: false });

      const { data: deklaracje } = await supabase
        .from('deklaracje_obecnosci')
        .select('id_proby, obecny')
        .eq('id_uzytkownika', userId);

      if (!probyList || !deklaracje) {
        setStreak(0);
        return;
      }

      const dekMap = {};
      deklaracje.forEach(d => {
        dekMap[String(d.id_proby)] = d.obecny;
      });

      // TYLKO próby sekcji macierzystej
      const wlasneProby = probyList.filter(p => {
        const s = (p.sekcja || '').trim().toLowerCase();
        return s === glownaSekcjaClean && s !== 'generalna';
      });

      let aktualnyStreak = 0;
      for (const p of wlasneProby) {
        const stan = dekMap[String(p.id)];
        if (stan === true) {
          aktualnyStreak++;
        } else if (stan === false) {
          break;
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif', backgroundColor: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#4a5568' }}>Ładowanie aplikacji...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  // BLOKADA: Jeśli konto NIE MA statusu "zatwierdzony", użytkownik nie widzi nic poza ekranem oczekiwania
  if (profile && !czyKontoZatwierdzone(profile.status)) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
        <div style={{ maxWidth: '520px', width: '100%', padding: '40px 30px', textAlign: 'center', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
          
          <div style={{ width: '80px', height: '80px', margin: '0 auto 20px auto', backgroundColor: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', border: '2px solid #fde68a' }}>
            ⏳
          </div>

          <h2 style={{ color: '#1e293b', fontSize: '22px', margin: '0 0 10px 0' }}>
            Oczekiwanie na akceptację
          </h2>

          <p style={{ color: '#475569', fontSize: '15px', lineHeight: '1.6', margin: '0 0 20px 0' }}>
            Witaj, <strong>{profile.imie_nazwisko || 'Członku'}</strong>!<br />
            Twoje konto zostało utworzone, jednak wymaga jeszcze <strong>zatwierdzenia przez Kierownika Zespołu</strong>.
          </p>

          <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '25px', textAlign: 'left', fontSize: '13px', color: '#64748b' }}>
            <p style={{ margin: '0 0 4px 0' }}><strong>Sekcja startowa:</strong> <span style={{ textTransform: 'uppercase', color: '#3182ce', fontWeight: 'bold' }}>{profile.sekcja || 'Brak'}</span></p>
            <p style={{ margin: 0 }}><strong>Status:</strong> <span style={{ color: '#d97706', fontWeight: 'bold' }}>Oczekuje na weryfikację</span></p>
          </div>

          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 25px 0' }}>
            Gdy Kierownik zaakceptuje Twoje zgłoszenie, ta strona odświeży się automatycznie i uzyskasz pełny dostęp do harmonogramu oraz koncertów.
          </p>

          <button 
            onClick={() => supabase.auth.signOut()}
            style={{ padding: '10px 24px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px', transition: 'background-color 0.2s' }}
          >
            Wyloguj się 🚪
          </button>
        </div>
      </div>
    );
  }

  // UŻYTKOWNIK ZATWIERDZONY - PEŁNY DOSTĘP DO APLIKACJI:
  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'sans-serif', paddingBottom: '40px' }}>
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

      <nav style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #cbd5e1', padding: '10px 30px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {profile?.rola === 'członek' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('skaner_qr')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'skaner_qr' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'skaner_qr' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📷 Skaner QR</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('sprawdz_obecnosc')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'sprawdz_obecnosc' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'sprawdz_obecnosc' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📋 Sprawdź obecność</button>
            <button onClick={() => setAktywnaZakladka('czlonkowie_lista')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'czlonkowie_lista' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'czlonkowie_lista' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>👥 Członkowie</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
            <button onClick={() => setAktywnaZakladka('moje_statystyki')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'moje_statystyki' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'moje_statystyki' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📊 Moja frekwencja</button>
            <button onClick={() => setAktywnaZakladka('profil')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'profil' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'profil' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>⚙️ Mój profil</button>
            <button onClick={() => setAktywnaZakladka('osiagniecia')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'osiagniecia' ? '#8b5cf6' : '#f8fafc', color: aktywnaZakladka === 'osiagniecia' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🏆 Osiągnięcia</button>
          </>
        )}

        {profile?.rola === 'pracownik' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('skaner_qr')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'skaner_qr' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'skaner_qr' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📷 Kod QR sali</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#d97706' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
          </>
        )}

        {profile?.rola === 'kierownik' && (
          <>
            <button onClick={() => setAktywnaZakladka('harmonogram')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'harmonogram' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'harmonogram' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📅 Harmonogram prób</button>
            <button onClick={() => setAktywnaZakladka('skaner_qr')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'skaner_qr' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'skaner_qr' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📷 Kod QR sali</button>
            <button onClick={() => setAktywnaZakladka('aktualnosci')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'aktualnosci' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'aktualnosci' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>📢 Aktualności</button>
            <button onClick={() => setAktywnaZakladka('czlonkowie')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'czlonkowie' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'czlonkowie' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>👥 Członkowie</button>
            <button onClick={() => setAktywnaZakladka('koncerty')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'koncerty' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'koncerty' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🎻 Koncerty</button>
            <button onClick={() => setAktywnaZakladka('admin')} style={{ padding: '8px 16px', backgroundColor: aktywnaZakladka === 'admin' ? '#3182ce' : '#f8fafc', color: aktywnaZakladka === 'admin' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>🛠️ Panel kadry i weryfikacji</button>
          </>
        )}
      </nav>

      <main style={{ maxWidth: '1000px', margin: '20px auto', padding: '0 20px' }}>
        {aktywnaZakladka === 'harmonogram' && <Harmonogram profile={profile} />}
        {aktywnaZakladka === 'skaner_qr' && <SkanerQR profile={profile} />}
        {aktywnaZakladka === 'aktualnosci' && <Aktualnosci profile={profile} />}
        {aktywnaZakladka === 'czlonkowie' && profile?.rola === 'kierownik' && <ZarzadzanieCzlonkami />}
        {aktywnaZakladka === 'czlonkowie_lista' && profile?.rola === 'członek' && <ListaCzlonkow profile={profile} />}
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