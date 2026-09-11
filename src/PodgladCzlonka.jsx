import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function PodgladCzlonka() {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [wybranyUserId, setWybranyUserId] = useState('');
  const [wybranyProfil, setWybranyProfil] = useState(null);
  const [odbyteSprawdzoneProby, setOdbyteSprawdzoneProby] = useState([]);
  const [obecnosciUsera, setObecnosciUsera] = useState([]);
  const [ladowanie, setLadowanie] = useState(false);

  useEffect(() => {
    pobierzCzlonkow();
  }, []);

  const pobierzCzlonkow = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('rola', 'członek')
      .eq('status', 'zatwierdzony')
      .order('imie_nazwisko', { ascending: true });

    if (data) setCzlonkowie(data);
  };

  const wybierzOsobe = async (e) => {
    const userId = e.target.value;
    setWybranyUserId(userId);

    if (!userId) {
      setWybranyProfil(null);
      setOdbyteSprawdzoneProby([]);
      setObecnosciUsera([]);
      return;
    }

    setLadowanie(true);

    const profil = czlonkowie.find(c => c.id === userId);
    setWybranyProfil(profil);

    const teraz = new Date().toISOString();

    const { data: proby } = await supabase
      .from('proby')
      .select('*')
      .eq('sekcja', profil.sekcja)
      .lte('data_czas', teraz)
      .order('data_czas', { ascending: false });

    const { data: frek } = await supabase
      .from('frekwencja')
      .select('id_proby, obecny')
      .eq('id_uzytkownika', userId);

    if (proby && frek) {
      const rozliczoneIds = frek.map(f => f.id_proby);
      const ostateczneProby = proby.filter(p => rozliczoneIds.includes(p.id));
      
      setOdbyteSprawdzoneProby(ostateczneProby);

      const obecneIds = frek.filter(f => f.obecny === true).map(f => f.id_proby);
      setObecnosciUsera(obecneIds);
    }

    setLadowanie(false);
  };

  const iloscProb = odbyteSprawdzoneProby.length;
  const iloscObecnosci = odbyteSprawdzoneProby.filter(p => obecnosciUsera.includes(p.id)).length;
  const procent = iloscProb > 0 ? Math.round((iloscObecnosci / iloscProb) * 100) : 0;

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h3 style={{ margin: '0 0 5px 0', color: '#1e293b', fontSize: '18px' }}>Sprawdź frekwencję członka zespołu</h3>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>Zestawienie obliczane jest wyłącznie z minionych i sprawdzonych prób.</p>

      {/* Wyraźne pole wyboru z ciemnym tekstem i białym tłem */}
      <select 
        value={wybranyUserId} 
        onChange={wybierzOsobe}
        style={{ width: '100%', padding: '12px', fontSize: '15px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '20px', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
      >
        <option value="">-- Wybierz członka zespołu --</option>
        {czlonkowie.map(czlonek => (
          <option key={czlonek.id} value={czlonek.id}>
            {czlonek.imie_nazwisko} (Sekcja: {czlonek.sekcja})
          </option>
        ))}
      </select>

      {ladowanie && <p style={{ color: '#64748b' }}>Ładowanie danych...</p>}

      {wybranyProfil && !ladowanie && (
        <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <h4 style={{ margin: '0 0 15px 0', color: '#1e293b', fontSize: '16px' }}>
            Statystyki dla: <strong>{wybranyProfil.imie_nazwisko}</strong> ({wybranyProfil.sekcja.toUpperCase()})
          </h4>

          {/* Kafelki ze statystykami */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px', padding: '15px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
            <div>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Obecności:</span>
              <p style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{iloscObecnosci} / {iloscProb}</p>
            </div>
            <div>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Frekwencja:</span>
              <p style={{ margin: '2px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#3182ce' }}>{procent}%</p>
            </div>
          </div>

          <h5 style={{ margin: '0 0 10px 0', color: '#475569', fontSize: '15px' }}>Rozliczona historia prób:</h5>
          {iloscProb === 0 ? (
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>Brak zakończonych i sprawdzonych prób dla tej osoby.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: '300px', overflowY: 'auto' }}>
              {odbyteSprawdzoneProby.map(proba => {
                const czyObecny = obecnosciUsera.includes(proba.id);
                return (
                  <li key={proba.id} style={{ padding: '12px 15px', backgroundColor: '#ffffff', marginBottom: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#1e293b' }}>{new Date(proba.data_czas).toLocaleString('pl-PL')}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#64748b' }}>{proba.opis_cwiczen}</p>
                    </div>
                    <span style={{ 
                      padding: '4px 12px', 
                      borderRadius: '15px', 
                      fontSize: '12px', 
                      fontWeight: '700',
                      backgroundColor: czyObecny ? '#d1e7dd' : '#f8d7da',
                      color: czyObecny ? '#0f5132' : '#842029'
                    }}>
                      {czyObecny ? 'Obecny ✅' : 'Nieobecny ❌'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}