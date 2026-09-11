import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const RenderAvatar = ({ url, size = '40px' }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: parseInt(size)/2 + 'px' }}>👤</span>}
  </div>
);

export default function TopFrekwencja() {
  const [ranking, setRanking] = useState({ balet: [], chór: [], kapela: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pobierzTop();

    // SUPABASE REALTIME: Nasłuchiwanie na żywo na każdą zmianę obecności
    const subscription = supabase
      .channel('zmiany_obecnosci_top')
      .on(
        'postgres_changes', 
        { event: '*', schema: 'public', table: 'deklaracje_obecnosci' }, 
        (payload) => {
          // Ktoś właśnie sprawdził obecność -> natychmiast odświeżamy ranking!
          pobierzTop();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription); // Sprzątanie po zamknięciu zakładki
    };
  }, []);

  const pobierzTop = async () => {
    // Nie włączamy ponownie ekranu ładowania (setLoading(true)), żeby ranking odświeżał się "w tle" bez mrugania
    
    const { data: czlonkowie } = await supabase
      .from('profiles')
      .select('id, imie_nazwisko, sekcja, avatar_url')
      .eq('rola', 'członek')
      .eq('status', 'zatwierdzony');

    const { data: obecnosci } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_uzytkownika, obecny')
      .not('obecny', 'is', null);

    if (czlonkowie && obecnosci) {
      const staty = {};
      czlonkowie.forEach(c => { staty[c.id] = { ...c, obecnyCount: 0, totalCount: 0 }; });

      obecnosci.forEach(o => {
        if (staty[o.id_uzytkownika]) {
          staty[o.id_uzytkownika].totalCount++;
          if (o.obecny === true) staty[o.id_uzytkownika].obecnyCount++;
        }
      });

      const sekcjeTop = { balet: [], chór: [], kapela: [] };

      Object.values(staty).forEach(osoba => {
        if (osoba.totalCount > 0) {
          osoba.procent = Math.round((osoba.obecnyCount / osoba.totalCount) * 100);
          if (sekcjeTop[osoba.sekcja]) {
            sekcjeTop[osoba.sekcja].push(osoba);
          }
        }
      });

      Object.keys(sekcjeTop).forEach(sek => {
        sekcjeTop[sek].sort((a, b) => {
          if (b.procent !== a.procent) return b.procent - a.procent;
          return b.totalCount - a.totalCount; 
        });
        sekcjeTop[sek] = sekcjeTop[sek].slice(0, 3);
      });

      setRanking(sekcjeTop);
      setLoading(false);
    }
  };

  const styleMiejsca = (index) => {
    if (index === 0) return { bg: '#fef9c3', border: '#facc15', medal: '🥇' }; 
    if (index === 1) return { bg: '#f8fafc', border: '#cbd5e1', medal: '🥈' }; 
    if (index === 2) return { bg: '#fff7ed', border: '#fdba74', medal: '🥉' }; 
    return { bg: '#ffffff', border: '#e2e8f0', medal: '' };
  };

  if (loading) return <p style={{ color: '#64748b', fontSize: '14px' }}>Wczytywanie rankingu...</p>;

  return (
    <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        🏆 Top Frekwencja (Sekcje)
      </h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {['balet', 'chór', 'kapela'].map(sekcja => (
          <div key={sekcja} style={{ padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', color: '#334155', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px', fontWeight: 'bold' }}>
              {sekcja}
            </h4>
            
            {ranking[sekcja].length === 0 ? (
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, fontStyle: 'italic' }}>Brak sprawdzonych obecności</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ranking[sekcja].map((osoba, idx) => {
                  const { bg, border, medal } = styleMiejsca(idx);
                  return (
                    <div key={osoba.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: bg, border: `1px solid ${border}`, borderRadius: '8px', transition: 'all 0.3s ease' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '20px' }}>{medal}</span>
                        <RenderAvatar url={osoba.avatar_url} size="36px" />
                        <div>
                          <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>{osoba.imie_nazwisko}</p>
                          <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Obecności: {osoba.obecnyCount} z {osoba.totalCount}</p>
                        </div>
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: '900', color: border }}>
                        {osoba.procent}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}