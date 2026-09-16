import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Osiagniecia from './Osiagniecia';

export default function ListaCzlonkow({ profile }) {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wybranyCzłonek, setWybranyCzłonek] = useState(null);

  useEffect(() => {
    if (profile) {
      pobierzWszystkichCzlonkow();
    }
  }, [profile]);

  const pobierzWszystkichCzlonkow = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('rola', 'członek')
        .order('imie_nazwisko', { ascending: true });

      if (error) throw error;
      if (data) {
        setCzlonkowie(data);
      }
    } catch (err) {
      console.error('Błąd pobierania członków:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && czlonkowie.length === 0) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie listy członków zespołu... 👥</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '8px', fontSize: '20px' }}>Członkowie Zespołu 👥</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '25px' }}>
        Przeglądaj profile znajomych z zespołu, sprawdź ich sekcje oraz pełne statystyki i osiągnięcia!
      </p>

      {/* SZCZEGÓŁY WYBRANEGO CZŁONKA (WYŚWIETLAMY PEŁNY KOMPONENT OSIĄGNIĘĆ) */}
      {wybranyCzłonek && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '2px solid #8b5cf6', position: 'relative' }}>
          <button 
            onClick={() => setWybranyCzłonek(null)}
            style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b', zIndex: 10 }}
            title="Zamknij"
          >
            ✕
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '15px' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '2px solid #8b5cf6', flexShrink: 0 }}>
              {wybranyCzłonek.avatar_url ? (
                <img src={wybranyCzłonek.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '28px' }}>👤</span>
              )}
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1e293b' }}>{wybranyCzłonek.imie_nazwisko}</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Sekcja główna: <strong style={{ textTransform: 'uppercase', color: '#3182ce' }}>{wybranyCzłonek.sekcja}</strong>
                {wybranyCzłonek.glos && ` (${wybranyCzłonek.glos})`}
              </p>
            </div>
          </div>

          {/* Wstrzykujemy uniwersalny komponent osiągnięć dla wybranego członka */}
          <Osiagniecia profile={wybranyCzłonek} />
        </div>
      )}

      {/* LISTA CZŁONKÓW */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '15px' }}>
        {czlonkowie.map((czlonek) => (
          <div 
            key={czlonek.id} 
            onClick={() => setWybranyCzłonek(czlonek)}
            style={{ 
              padding: '16px', 
              borderRadius: '8px', 
              border: '1px solid #e2e8f0', 
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = '#8b5cf6'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = '#e2e8f0'}
          >
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, border: '1px solid #cbd5e1' }}>
              {czlonek.avatar_url ? (
                <img src={czlonek.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontSize: '22px' }}>👤</span>
              )}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {czlonek.imie_nazwisko}
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                Sekcja: <strong style={{ textTransform: 'uppercase', color: '#3182ce' }}>{czlonek.sekcja}</strong>
              </p>
              <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '11px', color: '#8b5cf6', fontWeight: 'bold' }}>
                Kliknij po osiągnięcia 🏆
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}