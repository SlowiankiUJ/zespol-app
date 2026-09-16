import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { pobierzStylSekcji } from './kolory';
import TopFrekwencja from './TopFrekwencja';

const RenderAvatar = ({ url }) => (
  <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px' }}>👤</span>}
  </div>
);

export default function PodgladObecnosciCzlonka({ profile }) {
  const [proby, setProby] = useState([]);
  const [czlonkowieGlowni, setCzlonkowieGlowni] = useState([]);
  const [czlonkowieGoscinni, setCzlonkowieGoscinni] = useState([]);
  const [deklaracje, setDeklaracje] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && profile.sekcja) {
      pobierzDaneDlaSekcji();
    }
  }, [profile]);

  const pobierzDaneDlaSekcji = async () => {
    setLoading(true);
    try {
      const glownaSekcja = profile.sekcja;

      // Obliczamy początek bieżącego dnia (godzina 00:00:00), aby próby z dzisiaj były nadal widoczne, 
      // a wszystkie starsze/minione próby zostały zarchiwizowane z widoku członka.
      const dzis = new Date();
      dzis.setHours(0, 0, 0, 0);
      const isoPoczatekDzis = dzis.toISOString();

      // Zbieramy sekcje do pobrania: sekcja główna użytkownika ORAZ próby generalne
      const sekcjeDoPobrania = [glownaSekcja];
      if (!sekcjeDoPobrania.includes('generalna')) {
        sekcjeDoPobrania.push('generalna');
      }

      // Sprawdzamy też ewentualne dodatkowe sekcje gościnne członka
      const { data: dodatkowe } = await supabase
        .from('dodatkowe_sekcje')
        .select('sekcja')
        .eq('id_uzytkownika', profile.id)
        .eq('status', 'zatwierdzony');

      if (dodatkowe) {
        dodatkowe.forEach(d => {
          if (!sekcjeDoPobrania.includes(d.sekcja)) {
            sekcjeDoPobrania.push(d.sekcja);
          }
        });
      }

      // 1. Próby dla sekcji profilu ORAZ próby generalne (od dzisiaj w przód)
      const { data: probyData, error: probyError } = await supabase
        .from('proby')
        .select('*')
        .in('sekcja', sekcjeDoPobrania)
        .gte('data_czas', isoPoczatekDzis)
        .order('data_czas', { ascending: true });

      if (probyError) throw probyError;

      if (probyData) {
        setProby(probyData);
        pobierzDeklaracjeIZasoby(probyData);
      }

      // 2. Główni członkowie z tej samej sekcji
      const { data: czlonkowieData } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek')
        .eq('sekcja', glownaSekcja)
        .order('imie_nazwisko', { ascending: true });

      if (czlonkowieData) {
        setCzlonkowieGlowni(czlonkowieData);
      }

      // 3. Osoby gościnne z innych sekcji
      const { data: dodatkoweData } = await supabase
        .from('dodatkowe_sekcje')
        .select('id_uzytkownika')
        .eq('sekcja', glownaSekcja)
        .eq('status', 'zatwierdzony');

      if (dodatkoweData && dodatkoweData.length > 0) {
        const ids = dodatkoweData.map(d => d.id_uzytkownika);
        const { data: goscieData } = await supabase
          .from('profiles')
          .select('id, imie_nazwisko, sekcja, glos, avatar_url')
          .in('id', ids)
          .eq('status', 'zatwierdzony')
          .order('imie_nazwisko', { ascending: true });

        if (goscieData) {
          setCzlonkowieGoscinni(goscieData);
        }
      } else {
        setCzlonkowieGoscinni([]);
      }
    } catch (err) {
      console.error('Błąd pobierania danych w PodgladObecnosciCzlonka:', err);
    } finally {
      setLoading(false);
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
        let status = d.status_deklaracji;
        if (!status) {
          if (d.planuje === true) status = 'obecny';
          else if (d.planuje === false) status = 'nieobecny';
        }

        if (!mapa[d.id_proby]) mapa[d.id_proby] = {};
        mapa[d.id_proby][d.id_uzytkownika] = {
          planuje: d.planuje,
          status_deklaracji: status,
          usprawiedliwienie: d.usprawiedliwienie
        };
      });
    }
    setDeklaracje(mapa);
  };

  const renderujOsobe = (czlonek, info, isGosc = false) => {
    const status = info ? info.status_deklaracji : (info?.planuje === true ? 'obecny' : info?.planuje === false ? 'nieobecny' : undefined);
    const usprawiedliwienie = info ? info.usprawiedliwienie : null;

    return (
      <li key={czlonek.id} style={{ padding: '8px 12px', backgroundColor: isGosc ? '#faf5ff' : '#f8fafc', borderRadius: '6px', border: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <span style={{ fontSize: '14px', fontWeight: '500', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RenderAvatar url={czlonek.avatar_url} />
          {czlonek.imie_nazwisko} 
          {isGosc && <span style={{ fontSize: '12px', color: '#8b5cf6', fontWeight: '600' }}> (Gościnnie z: {czlonek.sekcja})</span>}
          {czlonek.id === profile.id && ' (Ty)'}
        </span>
        <div>
          {status === 'spozniony' ? (
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#b45309', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fef3c7', padding: '3px 10px', borderRadius: '12px', display: 'inline-block', border: '1px solid #fde68a' }}>
                Spóźni się ⏰
              </span>
              {usprawiedliwienie && <div style={{ fontSize: '11px', color: '#92400e', fontStyle: 'italic', marginTop: '3px' }}>Powód: „{usprawiedliwienie}”</div>}
            </div>
          ) : status === 'obecny' ? (
            <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#d1fae5', padding: '3px 10px', borderRadius: '12px' }}>
              Będzie 👍
            </span>
          ) : status === 'nieobecny' ? (
            <div style={{ textAlign: 'right' }}>
              <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fee2e2', padding: '3px 10px', borderRadius: '12px', display: 'inline-block' }}>
                Nie będzie 👎
              </span>
              {usprawiedliwienie && <div style={{ fontSize: '11px', color: '#b91c1c', fontStyle: 'italic', marginTop: '3px' }}>Powód: „{usprawiedliwienie}”</div>}
            </div>
          ) : (
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Brak deklaracji ⚪</span>
          )}
        </div>
      </li>
    );
  };

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      
      {/* RANKING FREKWENCJI (TYLKO Z OFICJALNYCH PRÓB) */}
      <TopFrekwencja />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '30px', marginBottom: '5px' }}>
        <h2 style={{ color: '#1e293b', margin: 0, fontSize: '20px' }}>Sprawdź obecność w sekcji</h2>
        <span style={{ fontSize: '12px', color: '#0284c7', backgroundColor: '#e0f2fe', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Tylko aktualne i nadchodzące próby ⏳
        </span>
      </div>

      <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
        Podgląd deklaracji obecności Twojej sekcji oraz prób generalnych: <strong style={{ textTransform: 'uppercase', color: '#0f172a' }}>{profile.sekcja}</strong>
      </p>

      {loading ? (
        <p style={{ color: '#64748b', fontSize: '14px' }}>Ładowanie aktualnych prób...</p>
      ) : proby.length === 0 ? (
        <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            Brak nadchodzących prób dla Twojej sekcji. Minione próby zostały zarchiwizowane. 📂
          </p>
        </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: stylSekcji.glowny, color: 'white', textTransform: 'uppercase' }}>
                    {proba.sekcja === 'generalna' ? '🎭 Próba generalna' : proba.sekcja}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '16px' }}>
                  📅 {new Date(proba.data_czas).toLocaleString('pl-PL')}
                </h4>
                <p style={{ margin: '0 0 15px 0', fontSize: '13px', color: '#475569' }}>
                  <strong>Program:</strong> {proba.opis_cwiczen}
                </p>

                <div style={{ backgroundColor: '#ffffff', padding: '15px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#1e293b' }}>Lista obecności sekcji:</h5>

                  {profile.sekcja === 'chór' ? (
                    ['Sopran', 'Alt', 'Tenor', 'Bas'].map(glosName => {
                      const osobyGlosu = czlonkowieGlowni.filter(c => (c.glos || 'Sopran') === glosName);
                      if (osobyGlosu.length === 0) return null;

                      return (
                        <div key={glosName} style={{ marginBottom: '15px' }}>
                          <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#d97706', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                            {glosName} ({osobyGlosu.length}):
                          </p>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {osobyGlosu.map(czlonek => renderujOsobe(czlonek, deklaracjeTejProby[czlonek.id], false))}
                          </ul>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ marginBottom: '15px' }}>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {czlonkowieGlowni.map(czlonek => renderujOsobe(czlonek, deklaracjeTejProby[czlonek.id], false))}
                      </ul>
                    </div>
                  )}

                  {/* Członkowie gościnni */}
                  {czlonkowieGoscinni.length > 0 && (
                    <div style={{ marginTop: '15px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#8b5cf6', margin: '0 0 6px 0', textTransform: 'uppercase' }}>
                        Członkowie gościnni (dodatkowa sekcja — bez wpływu na statystyki):
                      </p>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {czlonkowieGoscinni.map(gosc => renderujOsobe(gosc, deklaracjeTejProby[gosc.id], true))}
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