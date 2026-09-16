import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const RenderAvatar = ({ url }) => (
  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '13px' }}>👤</span>}
  </div>
);

export default function ListaObecnosci({ probaId, sekcja }) {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [deklaracje, setDeklaracje] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (probaId) {
      pobierzListeIWeryfikacje();
    }
  }, [probaId, sekcja]);

  const pobierzListeIWeryfikacje = async () => {
    try {
      // 1. Członkowie główni danej sekcji
      let query = supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek');

      if (sekcja && sekcja !== 'generalna') {
        query = query.eq('sekcja', sekcja);
      }

      const { data: czlonkowieData } = await query.order('imie_nazwisko', { ascending: true });

      // 2. Członkowie gościnni (jeśli próba nie jest generalna)
      let goscieData = [];
      if (sekcja && sekcja !== 'generalna') {
        const { data: dodatkowe } = await supabase
          .from('dodatkowe_sekcje')
          .select('id_uzytkownika')
          .eq('sekcja', sekcja)
          .eq('status', 'zatwierdzony');

        if (dodatkowe && dodatkowe.length > 0) {
          const ids = dodatkowe.map(d => d.id_uzytkownika);
          const { data: goscieProfiles } = await supabase
            .from('profiles')
            .select('id, imie_nazwisko, sekcja, glos, avatar_url')
            .in('id', ids)
            .eq('status', 'zatwierdzony')
            .order('imie_nazwisko', { ascending: true });

          if (goscieProfiles) goscieData = goscieProfiles;
        }
      }

      // Oznaczamy gości flagą czyGosc
      const calaLista = [
        ...(czlonkowieData || []).map(c => ({ ...c, czyGosc: false })),
        ...goscieData.map(g => ({ ...g, czyGosc: true }))
      ];

      // 3. Pobieramy deklaracje dla tej próby
      const { data: dekData } = await supabase
        .from('deklaracje_obecnosci')
        .select('*')
        .eq('id_proby', probaId);

      const mapa = {};
      (dekData || []).forEach(d => {
        let status = d.status_deklaracji;
        if (!status) {
          if (d.planuje === true) status = 'obecny';
          else if (d.planuje === false) status = 'nieobecny';
        }

        mapa[d.id_uzytkownika] = {
          planuje: d.planuje,
          status_deklaracji: status,
          usprawiedliwienie: d.usprawiedliwienie,
          obecny: d.obecny
        };
      });

      setCzlonkowie(calaLista);
      setDeklaracje(mapa);
    } catch (err) {
      console.error('Błąd pobierania listy obecności:', err);
    } finally {
      setLoading(false);
    }
  };

  const ustawObecnoscKadra = async (userId, wartoscObecny) => {
    const dotychczasowyWpis = deklaracje[userId] || {};
    
    // Jeśli kliknięto ten sam przycisk, czyścimy oznaczenie (null)
    const nowaWartosc = dotychczasowyWpis.obecny === wartoscObecny ? null : wartoscObecny;

    const payload = {
      id_proby: probaId,
      id_uzytkownika: userId,
      obecny: nowaWartosc,
      planuje: dotychczasowyWpis.planuje,
      status_deklaracji: dotychczasowyWpis.status_deklaracji,
      usprawiedliwienie: dotychczasowyWpis.usprawiedliwienie
    };

    const { error } = await supabase
      .from('deklaracje_obecnosci')
      .upsert([payload], { onConflict: 'id_proby, id_uzytkownika' });

    if (!error) {
      setDeklaracje(prev => ({
        ...prev,
        [userId]: { ...prev[userId], obecny: nowaWartosc }
      }));
    }
  };

  if (loading) {
    return <div style={{ padding: '15px', color: '#64748b', fontSize: '13px' }}>Ładowanie listy do sprawdzenia... ⏳</div>;
  }

  return (
    <div style={{ marginTop: '15px', backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
      <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b' }}>
        Weryfikacja obecności przez kadrę ({czlonkowie.length} osób):
      </h5>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {czlonkowie.map(c => {
          const dek = deklaracje[c.id] || {};
          const status = dek.status_deklaracji;

          return (
            <div 
              key={c.id} 
              style={{ 
                padding: '10px 14px', 
                backgroundColor: c.czyGosc ? '#faf5ff' : '#f8fafc', 
                borderRadius: '6px', 
                border: '1px solid #e2e8f0', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                flexWrap: 'wrap', 
                gap: '10px' 
              }}
            >
              {/* Dane członka i deklaracja */}
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <RenderAvatar url={c.avatar_url} />
                  <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                    {c.imie_nazwisko}
                  </span>
                  {c.czyGosc && (
                    <span style={{ fontSize: '11px', color: '#8b5cf6', backgroundColor: '#ede9fe', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                      Gość ({c.sekcja})
                    </span>
                  )}
                  {c.glos && (
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      ({c.glos})
                    </span>
                  )}
                </div>

                {/* Etykieta deklaracji ze spóźnieniem */}
                <div style={{ marginTop: '4px', marginLeft: '36px' }}>
                  {status === 'spozniony' ? (
                    <div>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                        ⏰ Spóźni się
                      </span>
                      {dek.usprawiedliwienie && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#92400e', fontStyle: 'italic', marginTop: '2px' }}>
                          Powód: „{dek.usprawiedliwienie}”
                        </span>
                      )}
                    </div>
                  ) : status === 'obecny' || (status == null && dek.planuje === true) ? (
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d' }}>
                      👍 Będzie
                    </span>
                  ) : status === 'nieobecny' || (status == null && dek.planuje === false) ? (
                    <div>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fee2e2', color: '#b91c1c' }}>
                        👎 Nie będzie
                      </span>
                      {dek.usprawiedliwienie && (
                        <span style={{ display: 'block', fontSize: '11px', color: '#991b1b', fontStyle: 'italic', marginTop: '2px' }}>
                          Powód: „{dek.usprawiedliwienie}”
                        </span>
                      )}
                    </div>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
                      ⚪ Brak deklaracji
                    </span>
                  )}
                </div>
              </div>

              {/* Przyciski weryfikacji kadry */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => ustawObecnoscKadra(c.id, true)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: dek.obecny === true ? '#10b981' : '#cbd5e1',
                    backgroundColor: dek.obecny === true ? '#10b981' : '#ffffff',
                    color: dek.obecny === true ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  Obecny ✅
                </button>

                <button
                  onClick={() => ustawObecnoscKadra(c.id, false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: dek.obecny === false ? '#ef4444' : '#cbd5e1',
                    backgroundColor: dek.obecny === false ? '#ef4444' : '#ffffff',
                    color: dek.obecny === false ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12px'
                  }}
                >
                  Nieobecny ❌
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}