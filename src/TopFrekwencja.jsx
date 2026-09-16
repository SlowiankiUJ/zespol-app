import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';

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
  <div style={{ width: '30px', height: '30px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>👤</span>}
  </div>
);

export default function TopFrekwencja() {
  const [liderzySekcji, setLiderzySekcji] = useState({ balet: [], chór: [], kapela: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    obliczRankingSekcji();
  }, []);

  const obliczRankingSekcji = async () => {
    try {
      // 1. Pobieramy aktywnych członków
      const { data: czlonkowie, error: czlonkowieError } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek');

      if (czlonkowieError) throw czlonkowieError;

      // 2. Pobieramy próby
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

      // Kontener na wyniki per sekcja
      const grupy = {
        balet: [],
        chor: [],
        kapela: []
      };

      (czlonkowie || []).forEach(czlonek => {
        const glownaSekcja = oczyscTekst(czlonek.sekcja);
        if (!grupy[glownaSekcja]) return;

        const userDeks = userDeklaracjeMap[czlonek.id] || [];

        let ob = 0;
        let tot = 0;
        let streak = 0;

        // FILTR: TYLKO i wyłącznie próby macierzystej sekcji danego członka
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
          if (item.obecny === true) streak++;
          else if (item.obecny === false) break;
        }

        const procent = tot > 0 ? Math.round((ob / tot) * 100) : 0;

        // Do rankingu wliczamy osoby, które mają przynajmniej 1 sprawdzoną próbę
        if (tot > 0) {
          grupy[glownaSekcja].push({
            id: czlonek.id,
            imie_nazwisko: czlonek.imie_nazwisko,
            sekcja: czlonek.sekcja,
            glos: czlonek.glos,
            avatar_url: czlonek.avatar_url,
            procent,
            obecny: ob,
            total: tot,
            streak
          });
        }
      });

      // Funkcja sortująca wewnątrz sekcji: % frekwencji -> liczba obecności -> streak
      const sortuj = (arr) => arr.sort((a, b) => {
        if (b.procent !== a.procent) return b.procent - a.procent;
        if (b.obecny !== a.obecny) return b.obecny - a.obecny;
        return b.streak - a.streak;
      }).slice(0, 3); // TOP 3

      setLiderzySekcji({
        balet: sortuj(grupy.balet),
        chór: sortuj(grupy.chor),
        kapela: sortuj(grupy.kapela)
      });
    } catch (err) {
      console.error('Błąd obliczania rankingu sekcji:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '15px', color: '#64748b', fontSize: '13px' }}>Ładowanie rankingu TOP 3 sekcji... 🌟</div>;
  }

  const kolumnySekcji = [
    { klucz: 'balet', tytul: 'Balet 🩰' },
    { klucz: 'chór', tytul: 'Chór 🎶' },
    { klucz: 'kapela', tytul: 'Kapela 🎻' }
  ];

  const medale = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🏆</span> Najwyższa frekwencja sekcyjna (TOP 3)
        </h3>
        <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Tylko oficjalne próby sekcji
        </span>
      </div>

      {/* 3 KOLUMNY DLA 3 SEKCJI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '15px' }}>
        {kolumnySekcji.map(({ klucz, tytul }) => {
          const stylSekcji = pobierzStylSekcji(klucz);
          const liderzy = liderzySekcji[klucz] || [];

          return (
            <div 
              key={klucz} 
              style={{ 
                backgroundColor: stylSekcji.jasny, 
                borderRadius: '10px', 
                border: `1px solid ${stylSekcji.border}`, 
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ borderBottom: `2px solid ${stylSekcji.glowny}`, paddingBottom: '6px', marginBottom: '2px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: stylSekcji.glowny, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {tytul}
                </h4>
              </div>

              {liderzy.length === 0 ? (
                <p style={{ margin: '10px 0', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Brak sprawdzonych prób w tej sekcji.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {liderzy.map((osoba, idx) => (
                    <div 
                      key={osoba.id} 
                      style={{ 
                        padding: '8px 10px', 
                        backgroundColor: '#ffffff', 
                        borderRadius: '6px', 
                        border: '1px solid #e2e8f0', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '8px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{medale[idx]}</span>
                        <RenderAvatar url={osoba.avatar_url} />
                        <div style={{ overflow: 'hidden' }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {osoba.imie_nazwisko}
                          </span>
                          {osoba.glos && (
                            <span style={{ display: 'block', fontSize: '10px', color: '#64748b' }}>
                              {osoba.glos}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ display: 'block', fontSize: '13px', fontWeight: '900', color: stylSekcji.glowny }}>
                          {osoba.procent}%
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                          {osoba.obecny}/{osoba.total}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}