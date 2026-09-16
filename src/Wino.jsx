import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const RenderAvatar = ({ url }) => (
  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>👤</span>}
  </div>
);

export default function Wino({ profile }) {
  const [ranking, setRanking] = useState([]);
  const [mojeWina, setMojeWina] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      pobierzWino();
    }
  }, [profile]);

  const pobierzWino = async () => {
    setLoading(true);
    try {
      // 1. Pobieramy statystyki win wszystkich użytkowników
      const { data: winaData, error: winaErr } = await supabase
        .from('wina_statystyki')
        .select('*');

      if (winaErr) throw winaErr;

      // 2. Pobieramy profile wszystkich zatwierdzonych członków zespołu
      const { data: profData, error: profErr } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek');

      if (profErr) throw profErr;

      const winaMap = {};
      (winaData || []).forEach(w => {
        winaMap[w.id_uzytkownika] = w.liczba_win;
      });

      // Łączymy profile z liczbą win (dla osób bez wpisu domyślnie 0)
      const pelnyRanking = (profData || []).map(p => ({
        ...p,
        liczba_win: winaMap[p.id] || 0
      }));

      // Sortowanie: od największej liczby win do najmniejszej
      pelnyRanking.sort((a, b) => b.liczba_win - a.liczba_win);

      setRanking(pelnyRanking);

      // Ustawiamy stan dla zalogowanego użytkownika
      const moje = winaMap[profile.id] || 0;
      setMojeWina(moje);
    } catch (err) {
      console.error('Błąd pobierania danych o winie:', err);
    } finally {
      setLoading(false);
    }
  };

  const zmienLiczbeWin = async (nowaWartosc) => {
    if (nowaWartosc < 0) return;

    try {
      const { error } = await supabase
        .from('wina_statystyki')
        .upsert([{ id_uzytkownika: profile.id, liczba_win: nowaWartosc, updated_at: new Date() }], { onConflict: 'id_uzytkownika' });

      if (error) throw error;

      setMojeWina(nowaWartosc);
      // Natychmiast aktualizujemy lokalny ranking
      setRanking(prev => {
        const zaktualizowany = prev.map(osoba => 
          osoba.id === profile.id ? { ...osoba, liczba_win: nowaWartosc } : osoba
        );
        zaktualizowany.sort((a, b) => b.liczba_win - a.liczba_win);
        return zaktualizowany;
      });
    } catch (err) {
      console.error('Błąd aktualizacji wina:', err);
      alert('Nie udało się zapisać zmiany.');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie piwniczkowej statystyki... 🍷</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Wino UJ 🍷🍇</h2>
        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
          Rejestr koncertowych i bankietowych sukcesów enologicznych zespołu Słowianki!
        </p>
      </div>

      {/* SEKCJA OSOBISTA NA SAMEJ GÓRZE */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fdf2f2', borderRadius: '10px', border: '2px solid #fecaca', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '32px' }}>🍷</span>
          <div>
            <h3 style={{ margin: '0 0 2px 0', fontSize: '16px', color: '#991b1b' }}>Twoja osobista piwniczka</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#7f1d1d' }}>Zarządzaj swoimi wypitymi winami UJ:</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => zmienLiczbeWin(mojeWina - 1)} 
            disabled={mojeWina <= 0}
            style={{ padding: '8px 16px', backgroundColor: mojeWina <= 0 ? '#cbd5e1' : '#ef4444', color: '#white', border: 'none', borderRadius: '6px', cursor: mojeWina <= 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '16px' }}
          >
            -
          </button>
          
          <span style={{ fontSize: '22px', fontWeight: '900', color: '#991b1b', minWidth: '40px', textAlign: 'center' }}>
            {mojeWina}
          </span>

          <button 
            onClick={() => zmienLiczbeWin(mojeWina + 1)} 
            style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}
          >
            +
          </button>
        </div>
      </div>

      {/* RANKING ZESPOŁU */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>
        Ranking Winnego Grona Zespołu 🍇 ({ranking.length} członków)
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px', width: '50px', textAlign: 'center' }}>Miejsce</th>
              <th style={{ padding: '10px' }}>Członek</th>
              <th style={{ padding: '10px' }}>Sekcja</th>
              <th style={{ padding: '10px', textAlign: 'right' }}>Wypite Wina 🍷</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((osoba, index) => {
              const medale = ['🥇', '🥈', '🥉'];
              const czyJa = osoba.id === profile.id;

              return (
                <tr 
                  key={osoba.id} 
                  style={{ 
                    borderBottom: '1px solid #f1f5f9', 
                    backgroundColor: czyJa ? '#fef2f2' : (index % 2 === 0 ? '#fafaf9' : '#ffffff') 
                  }}
                >
                  <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>
                    {medale[index] || `#${index + 1}`}
                  </td>
                  <td style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RenderAvatar url={osoba.avatar_url} />
                    <span style={{ fontWeight: czyJa ? 'bold' : 'normal', color: czyJa ? '#991b1b' : '#1e293b' }}>
                      {osoba.imie_nazwisko} {czyJa && '(Ty)'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textTransform: 'uppercase', fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>
                    {osoba.sekcja} {osoba.glos && `(${osoba.glos})`}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', fontWeight: '900', fontSize: '16px', color: '#991b1b' }}>
                    {osoba.liczba_win} 🍷
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}