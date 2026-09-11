import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';

export default function PodgladObecnosciCzlonka({ profile }) {
  const [proby, setProby] = useState([]);
  const [czlonkowieGłówni, setCzlonkowieGłówni] = useState([]);
  const [czlonkowieGoscinni, setCzlonkowieGoscinni] = useState([]);
  const [deklaracje, setDeklaracje] = useState({}); // id_proby -> { id_uzytkownika: { planuje, usprawiedliwienie } }

  useEffect(() => {
    if (profile && profile.sekcja) {
      pobierzDaneDlaSekcji();
    }
  }, [profile]);

  const pobierzDaneDlaSekcji = async () => {
    // 1. Pobierz próby tylko dla sekcji członka
    const { data: probyData } = await supabase
      .from('proby')
      .select('*')
      .eq('sekcja', profile.sekcja)
      .order('data_czas', { ascending: true });

    if (probyData) {
      setProby(probyData);
      pobierzDeklaracjeIZasoby(probyData);
    }

    // 2. Pobierz głównych członków z tej samej sekcji
    const { data: czlonkowieData } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'zatwierdzony')
      .eq('rola', 'członek')
      .eq('sekcja', profile.sekcja)
      .order('imie_nazwisko', { ascending: true });

    if (czlonkowieData) {
      setCzlonkowieGłówni(czlonkowieData);
    }

    // 3. Pobierz osoby z innych sekcji, które mają zatwierdzony gościnny dostęp do tej sekcji
    const { data: dodatkoweData } = await supabase
      .from('dodatkowe_sekcje')
      .select('id_uzytkownika')
      .eq('sekcja', profile.sekcja)
      .eq('status', 'zatwierdzony');

    if (dodatkoweData && dodatkoweData.length > 0) {
      const ids = dodatkoweData.map(d => d.id_uzytkownika);
      const { data: goscieData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids)
        .eq('status', 'zatwierdzony')
        .order('imie_nazwisko', { ascending: true });

      if (goscieData) {
        setCzlonkowieGoscinni(goscieData);
      }
    } else {
      setCzlonkowieGoscinni([]);
    }
  };

  const pobierzDeklaracjeIZasoby = async (listaProb) => {
    const probaIds = listaProb.map(p => p.id);
    if (probaIds.length === 0) return;

    const { data: dekData } = await supabase
      .from('deklaracje_obecnosci')
      .select('*')
      .in('id_proby', probaIds);

    const mapa = {};
    if (dekData) {
      dekData.forEach(d => {
        if (!mapa[d.id_proby]) mapa[d.id_proby] = {};
        mapa[d.id_proby][d.id_uzytkownika] = {
          planuje: d.planuje,
          usprawiedliwienie: d.usprawiedliwienie
        };
      });
    }
    setDeklaracje(mapa);
  };

  const renderujListeOsob = (lista, naglowek) => {
    if (lista.length === 0) return null;

    return (
      <div style={{ marginTop: '15px' }}>
        <h6 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {naglowek}
        </h6>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lista.map(czlonek => {
            const deklaracjeTejProby = deklaracje[activeProbaId] || {}; // uwaga: zmienna pomocnicza w mapowaniu niżej
            // w pętli prób przekazujemy konkretną próbę, więc zrobimy to elegancko poniżej
          })}
        </ul>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Sprawdź obecność w sekcji</h2>
      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
        Podgląd deklaracji obecności Twojej sekcji: <strong style={{ textTransform: 'uppercase', color: '#0f172a' }}>{profile.sekcja}</strong>
      </p>

      {proby.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych prób dla Twojej sekcji.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {proby.map(proba => {
            const stylSekcji = pobierzStylSekcji(proba.sekcja);
            const deklaracjeTejProby = deklaracje[proba.id] || {};

            return (
              <div key={proba.id} style={{ 
                borderLeft: `6px solid ${stylSekcji.glowny}`, 
                padding: '20px', 
                backgroundColor: stylSekcji.jasny, 
                borderRadius: '8px',
                borderTop: `1px solid ${stylSekcji.border}`,
                borderRight: `1px solid ${stylSekcji.border}`,
                borderBottom: `1px solid ${stylSekcji.border}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
              }}>
                <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '16px' }}>
                  📅 {new Date(proba.data_czas).toLocaleString('pl-PL')}
                </h4>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#475569' }}>
                  <strong>Program:</strong> {proba.opis_cwiczen}
                </p>

                <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h5 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#1e293b' }}>Lista obecności sekcji:</h5>

                  {/* Główni członkowie */}
                  <div style={{ marginBottom: czlonkowieGoscinni.length > 0 ? '15px' : '0' }}>
                    <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', margin: '0 0 5px 0', textTransform: 'uppercase' }}>Członkowie stałi:</p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {czlonkowieGłówni.map(czlonek => {
                        const info = deklaracjeTejProby[czlonek.id];
                        const statusPlanuje = info ? info.planuje : undefined;
                        const usprawiedliwienie = info ? info.usprawiedliwienie : null;

                        return (
                          <li key={czlonek.id} style={{ padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                              {czlonek.imie_nazwisko} {czlonek.id === profile.id && '(Ty)'}
                            </span>
                            <div>
                              {statusPlanuje === true ? (
                                <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#d1fae5', padding: '3px 10px', borderRadius: '12px' }}>Będzie 👍</span>
                              ) : statusPlanuje === false ? (
                                <div style={{ textAlign: 'right' }}>
                                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fee2e2', padding: '3px 10px', borderRadius: '12px', display: 'inline-block' }}>Nie będzie 👎</span>
                                  {usprawiedliwienie && <div style={{ fontSize: '11px', color: '#b91c1c', fontStyle: 'italic', marginTop: '3px' }}>Powód: „{usprawiedliwienie}”</div>}
                                </div>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '13px' }}>Brak deklaracji ⚪</span>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {/* Gościnni członkowie (na samym dole) */}
                  {czlonkowieGoscinni.length > 0 && (
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6', margin: '15px 0 5px 0', textTransform: 'uppercase' }}>Członkowie gościnni (dodatkowa sekcja):</p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {czlonkowieGoscinni.map(gosc => {
                          const info = deklaracjeTejProby[gosc.id];
                          const statusPlanuje = info ? info.planuje : undefined;
                          const usprawiedliwienie = info ? info.usprawiedliwienie : null;

                          return (
                            <li key={gosc.id} style={{ padding: '8px 12px', backgroundColor: '#faf5ff', borderRadius: '6px', border: '1px solid #f3e8ff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                              <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>
                                {gosc.imie_nazwisko} <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600' }}>(Gościnnie z: {gosc.sekcja})</span> {gosc.id === profile.id && '(Ty)'}
                              </span>
                              <div>
                                {statusPlanuje === true ? (
                                  <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#d1fae5', padding: '3px 10px', borderRadius: '12px' }}>Będzie 👍</span>
                                ) : statusPlanuje === false ? (
                                  <div style={{ textAlign: 'right' }}>
                                    <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fee2e2', padding: '3px 10px', borderRadius: '12px', display: 'inline-block' }}>Nie będzie 👎</span>
                                    {usprawiedliwienie && <div style={{ fontSize: '11px', color: '#b91c1c', fontStyle: 'italic', marginTop: '3px' }}>Powód: „{usprawiedliwienie}”</div>}
                                  </div>
                                ) : (
                                  <span style={{ color: '#94a3b8', fontSize: '13px' }}>Brak deklaracji ⚪</span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}