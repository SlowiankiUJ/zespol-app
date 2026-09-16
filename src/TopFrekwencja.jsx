import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const oczyscTekst = (str) => {
  if (!str) return '';
  return str
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l');
};

const RenderAvatar = ({ url }) => (
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px' }}>👤</span>}
  </div>
);

export default function TopFrekwencja() {
  const [liderzy, setLiderzy] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obliczRanking();
  }, []);

  const obliczRanking = async () => {
    try {
      // 1. Pobieramy aktywnych członków
      const { data: czlonkowie, error: czlonkowieError } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek');

      if (czlonkowieError) throw czlonkowieError;

      // 2. Pobieramy wszystkie próby
      const { data: proby, error: probyError } = await supabase
        .from('proby')
        .select('id, sekcja, data_czas');

      if (probyError) throw probyError;

      // 3. Pobieramy deklaracje obecności
      const { data: deklaracje, error: dekError } = await supabase
        .from('deklaracje_obecnosci')
        .select('id_uzytkownika, id_proby, obecny');

      if (dekError) throw dekError;

      const probyMap = {};
      (proby || []).forEach(p => {
        probyMap[String(p.id)] = {
          sekcja: oczyscTekst(p.sekcja),
          data_czas: p.data_czas
        };
      });

      const userDeklaracjeMap = {};
      (deklaracje || []).forEach(d => {
        if (!userDeklaracjeMap[d.id_uzytkownika]) {
          userDeklaracjeMap[d.id_uzytkownika] = [];
        }
        userDeklaracjeMap[d.id_uzytkownika].push(d);
      });

      const wyniki = [];

      (czlonkowie || []).forEach(czlonek => {
        const glownaSekcja = oczyscTekst(czlonek.sekcja);
        const userDeks = userDeklaracjeMap[czlonek.id] || [];

        let ob = 0;
        let tot = 0;
        let aktualnyStreak = 0;

        // FILTR: Zliczamy TYLKO obecności z prób macierzystej sekcji danego członka
        const wlasneWpisy = userDeks
          .map(d => {
            const info = probyMap[String(d.id_proby)];
            return {
              obecny: d.obecny,
              sekcja: info ? info.sekcja : null,
              data_czas: info ? info.data_czas : null
            };
          })
          .filter(item => item.sekcja && item.sekcja === glownaSekcja && item.sekcja !== 'generalna');

        wlasneWpisy.forEach(item => {
          if (item.obecny === true) {
            ob++;
            tot++;
          } else if (item.obecny === false) {
            tot++;
          }
        });

        // STREAK
        const posortowane = [...wlasneWpisy]
          .filter(item => item.obecny === true || item.obecny === false)
          .sort((a, b) => new Date(b.data_czas) - new Date(a.data_czas));

        for (const item of posortowane) {
          if (item.obecny === true) aktualnyStreak++;
          else if (item.obecny === false) break;
        }

        const procent = tot > 0 ? Math.round((ob / tot) * 100) : 0;

        if (tot >= 1) {
          wyniki.push({
            id: czlonek.id,
            imie_nazwisko: czlonek.imie_nazwisko,
            sekcja: czlonek.sekcja,
            glos: czlonek.glos,
            avatar_url: czlonek.avatar_url,
            procent: procent,
            obecny: ob,
            total: tot,
            streak: aktualnyStreak
          });
        }
      });

      // Sortujemy malejąco: najpierw po frekwencji %, potem po liczbie obecności, potem po streaku
      wyniki.sort((a, b) => {
        if (b.procent !== a.procent) return b.procent - a.procent;
        if (b.obecny !== a.obecny) return b.obecny - a.obecny;
        return b.streak - a.streak;
      });

      setLiderzy(wyniki.slice(0, 5));
    } catch (err) {
      console.error('Błąd obliczania rankingu TopFrekwencja:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>Ładowanie rankingu... 🌟</div>;
  }

  if (liderzy.length === 0) {
    return null;
  }

  return (
    <div style={{ marginBottom: '25px', padding: '18px', backgroundColor: '#fdfcfe', borderRadius: '10px', border: '1px solid #e9d5ff', boxShadow: '0 2px 4px rgba(139, 92, 246, 0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px' }}>🌟</span>
        <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Liderzy Oficjalnej Frekwencji</h3>
        <span style={{ fontSize: '11px', color: '#8b5cf6', backgroundColor: '#ede9fe', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Tylko próby macierzyste</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        {liderzy.map((osoba, index) => {
          const medale = ['🥇', '🥈', '🥉'];
          return (
            <div 
              key={osoba.id} 
              style={{ 
                padding: '10px 14px', 
                backgroundColor: index === 0 ? '#faf5ff' : '#f8fafc', 
                borderRadius: '8px', 
                border: index === 0 ? '1px solid #c084fc' : '1px solid #e2e8f0', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between' 
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <span style={{ fontSize: '16px' }}>{medale[index] || `#${index + 1}`}</span>
                <RenderAvatar url={osoba.avatar_url} />
                <div style={{ overflow: 'hidden' }}>
                  <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {osoba.imie_nazwisko}
                  </span>
                  <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>
                    {osoba.sekcja}
                  </span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '6px' }}>
                <span style={{ display: 'block', fontSize: '14px', fontWeight: '900', color: '#8b5cf6' }}>
                  {osoba.procent}%
                </span>
                <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                  {osoba.obecny}/{osoba.total}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}