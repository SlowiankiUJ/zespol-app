import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';

const formatujWyswietlanie = (isoStr) => {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ', ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
};

const nazwyMiesiecy = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'
];

export default function MojaFrekwencja({ profile }) {
  const [proby, setProby] = useState([]);
  const [mojeObecnosci, setMojeObecnosci] = useState({});
  const [statystyki, setStatystyki] = useState({ obecny: 0, nieobecny: 0, total: 0 });
  const [rozwinieteMiesiace, setRozwinieteMiesiace] = useState({});

  useEffect(() => {
    if (profile) {
      pobierzMojaFrekwencje();

      const subscription = supabase
        .channel('zmiany_moja_frekwencja')
        .on(
          'postgres_changes', 
          { event: '*', schema: 'public', table: 'deklaracje_obecnosci' }, 
          () => {
            pobierzMojaFrekwencje(); 
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [profile]);

  const pobierzMojaFrekwencje = async () => {
    let sekcjeDoWyswietlenia = [profile.sekcja];
    const { data: dodatkowe } = await supabase
      .from('dodatkowe_sekcje')
      .select('sekcja')
      .eq('id_uzytkownika', profile.id)
      .eq('status', 'zatwierdzony');
      
    if (dodatkowe) {
      dodatkowe.forEach(d => {
        if (!sekcjeDoWyswietlenia.includes(d.sekcja)) sekcjeDoWyswietlenia.push(d.sekcja);
      });
    }

    if (!sekcjeDoWyswietlenia.includes('generalna')) {
      sekcjeDoWyswietlenia.push('generalna');
    }

    const { data: probyData } = await supabase
      .from('proby')
      .select('*')
      .in('sekcja', sekcjeDoWyswietlenia)
      .order('data_czas', { ascending: true });

    const { data: dekData } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_proby, planuje, usprawiedliwienie, obecny')
      .eq('id_uzytkownika', profile.id);

    const mapa = {};
    if (dekData) {
      dekData.forEach(d => {
        mapa[d.id_proby] = d;
      });
    }

    const probyMap = {};
    (probyData || []).forEach(p => {
      probyMap[p.id] = p;
    });

    let ob = 0;
    let nieob = 0;
    let tot = 0;

    if (dekData) {
      dekData.forEach(d => {
        const proba = probyMap[d.id_proby];
        // STATYSTYKI LICZONE SĄ WYŁĄCZNIE Z GŁÓWNEJ SEKCJI CZŁONKA!
        if (proba && proba.sekcja === profile.sekcja) {
          if (d.obecny === true) {
            ob++;
            tot++;
          } else if (d.obecny === false) {
            nieob++;
            tot++;
          }
        }
      });
    }

    setProby(probyData || []);
    setMojeObecnosci(mapa);
    setStatystyki({ obecny: ob, nieobecny: nieob, total: tot });
  };

  const procentFrekwencji = statystyki.total > 0 
    ? Math.round((statystyki.obecny / statystyki.total) * 100) 
    : 0;

  const aktualnaData = new Date();
  const aktualnyKluczMiesiaca = `${aktualnaData.getFullYear()}-${String(aktualnaData.getMonth()).padStart(2, '0')}`;

  const pogrupowaneProby = proby.reduce((akregator, proba) => {
    const data = new Date(proba.data_czas);
    const rok = data.getFullYear();
    const miesiacIdx = data.getMonth();
    const klucz = `${rok}-${String(miesiacIdx).padStart(2, '0')}`;
    const nazwaMiesiaca = `${nazwyMiesiecy[miesiacIdx]} ${rok}`;

    if (!akregator[klucz]) {
      akregator[klucz] = { nazwa: nazwaMiesiaca, proby: [] };
    }
    akregator[klucz].proby.push(proba);
    return akregator;
  }, {});

  const przelaczZakladkeMiesiaca = (klucz) => {
    setRozwinieteMiesiace(prev => {
      const isCurrentlyOpen = prev[klucz] ?? (klucz === aktualnyKluczMiesiaca);
      return { ...prev, [klucz]: !isCurrentlyOpen };
    });
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Moja Frekwencja i Rozliczenia 📊</h2>
      <p style={{ margin: '0 0 20px 0', fontSize: '13px', color: '#64748b' }}>
        Oficjalna sekcja: <strong style={{ textTransform: 'uppercase', color: '#8b5cf6' }}>{profile.sekcja}</strong> (tylko próby tej sekcji wliczają się do Twojej frekwencji i streaka).
      </p>
      
      {/* GŁÓWNE KAFELKI ZE STATYSTYKAMI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '30px' }}>
        <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Twój wynik</p>
          <span style={{ fontSize: '32px', fontWeight: '900', color: procentFrekwencji >= 50 ? '#8b5cf6' : '#ef4444' }}>{procentFrekwencji}%</span>
        </div>
        
        <div style={{ padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #a7f3d0', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#047857', fontWeight: 'bold', textTransform: 'uppercase' }}>Sprawdzone jako Obecny</p>
          <span style={{ fontSize: '32px', fontWeight: '900', color: '#10b981' }}>{statystyki.obecny}</span>
        </div>

        <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '13px', color: '#b91c1c', fontWeight: 'bold', textTransform: 'uppercase' }}>Sprawdzone jako Nieobecny</p>
          <span style={{ fontSize: '32px', fontWeight: '900', color: '#ef4444' }}>{statystyki.nieobecny}</span>
        </div>
      </div>

      <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#334155' }}>Rozliczenie poszczególnych prób ({proby.length}):</h3>

      {Object.keys(pogrupowaneProby).length === 0 ? (
        <p style={{ color: '#718096' }}>Nie masz przypisanych żadnych prób.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {Object.keys(pogrupowaneProby).sort().map(kluczMiesiaca => {
            const grupa = pogrupowaneProby[kluczMiesiaca];
            const isRozwiniety = rozwinieteMiesiace[kluczMiesiaca] ?? (kluczMiesiaca === aktualnyKluczMiesiaca);

            return (
              <div key={kluczMiesiaca} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#f8fafc' }}>
                <button 
                  onClick={() => przelaczZakladkeMiesiaca(kluczMiesiaca)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '15px 20px', backgroundColor: '#f1f5f9', border: 'none', borderBottom: isRozwiniety ? '1px solid #e2e8f0' : 'none', textAlign: 'left', fontWeight: 'bold', fontSize: '16px', color: '#1e293b', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span>📅 {grupa.nazwa} <span style={{ color: '#64748b', fontSize: '14px', fontWeight: 'normal' }}>({grupa.proby.length} prób)</span></span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{isRozwiniety ? '▲ Zwiń' : '▼ Rozwiń'}</span>
                </button>

                {isRozwiniety && (
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '15px', backgroundColor: '#ffffff' }}>
                    {grupa.proby.map(proba => {
                      const stylSekcji = pobierzStylSekcji(proba.sekcja);
                      const mojeDane = mojeObecnosci[proba.id] || {};
                      const { planuje, usprawiedliwienie, obecny } = mojeDane;
                      const czyMinela = new Date(proba.data_czas) < new Date();
                      const czyGoscinna = proba.sekcja !== profile.sekcja && proba.sekcja !== 'generalna';

                      return (
                        <div key={proba.id} style={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px',
                          borderLeft: `6px solid ${stylSekcji.glowny}`, padding: '15px', backgroundColor: stylSekcji.jasny, 
                          borderRadius: '8px', borderTop: `1px solid ${stylSekcji.border}`, borderRight: `1px solid ${stylSekcji.border}`, borderBottom: `1px solid ${stylSekcji.border}`
                        }}>
                          <div style={{ flex: '1 1 300px' }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: stylSekcji.glowny, color: 'white', textTransform: 'uppercase' }}>
                                {proba.sekcja === 'generalna' ? '🎭 Próba generalna' : proba.sekcja}
                              </span>
                              {czyGoscinna && (
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', backgroundColor: '#e2e8f0', color: '#475569' }}>
                                  👁️ Udział gościnny (bez wpływu na statystyki)
                                </span>
                              )}
                            </div>
                            <h4 style={{ margin: '0 0 4px 0', color: '#1e293b', fontSize: '15px' }}>
                              📅 {formatujWyswietlanie(proba.data_czas)}
                            </h4>
                            <p style={{ margin: 0, fontSize: '13px', color: '#475569' }}>
                              <strong>Program:</strong> {proba.opis_cwiczen}
                            </p>
                          </div>

                          <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '1px dashed #cbd5e1', paddingLeft: '15px' }}>
                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Weryfikacja kadry:</span>
                              {obecny === true ? (
                                <span style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: '#10b981', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>✅ Jesteś sprawdzony jako OBECNY</span>
                              ) : obecny === false ? (
                                <span style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>❌ Jesteś sprawdzony jako NIEOBECNY</span>
                              ) : (
                                <span style={{ display: 'inline-block', padding: '4px 10px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                  {czyMinela ? '⏳ Oczekuje na sprawdzenie...' : '⏰ Próba w przyszłości'}
                                </span>
                              )}
                            </div>

                            <div>
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Twoja deklaracja:</span>
                              {planuje === true ? (
                                <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '600' }}>👍 Zadeklarowałeś obecność</span>
                              ) : planuje === false ? (
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>👎 Zgłosiłeś nieobecność</span>
                                  {usprawiedliwienie && <span style={{ fontSize: '11px', color: '#7f1d1d', fontStyle: 'italic' }}>Powód: "{usprawiedliwienie}"</span>}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>⚪ Brak deklaracji</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}