import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export default function MojaFrekwencja({ profile }) {
  const [odbyteSprawdzoneProby, setOdbyteSprawdzoneProby] = useState([]);
  const [mojeObecnosci, setMojeObecnosci] = useState([]);
  const [ladowanie, setLadowanie] = useState(true);

  useEffect(() => {
    pobierzFrekwencje();
  }, [profile]);

  const pobierzFrekwencje = async () => {
    setLadowanie(true);

    const teraz = new Date();

    const { data: proby } = await supabase
      .from('proby')
      .select('*')
      .eq('sekcja', profile.sekcja)
      .lte('data_czas', teraz.toISOString())
      .order('data_czas', { ascending: false });

    if (!proby || proby.length === 0) {
      setOdbyteSprawdzoneProby([]);
      setLadowanie(false);
      return;
    }

    const { data: wpisyFrekwencji } = await supabase
      .from('frekwencja')
      .select('id_proby, id_uzytkownika, obecny');

    if (wpisyFrekwencji) {
      const sprawdzoneProbyIds = [...new Set(wpisyFrekwencji.map(f => f.id_proby))];
      const finalneProby = proby.filter(p => sprawdzoneProbyIds.includes(p.id));
      
      setOdbyteSprawdzoneProby(finalneProby);

      const mojeFrek = wpisyFrekwencji
        .filter(f => f.id_uzytkownika === profile.id && f.obecny === true)
        .map(f => f.id_proby);

      setMojeObecnosci(mojeFrek);
    }

    setLadowanie(false);
  };

  if (ladowanie) return <p style={{ color: '#64748b', textAlign: 'center', marginTop: '20px' }}>Ładowanie statystyk frekwencji...</p>;

  const iloscWszystkichRozliczonych = odbyteSprawdzoneProby.length;
  const iloscObecnosci = odbyteSprawdzoneProby.filter(p => mojeObecnosci.includes(p.id)).length;
  const procent = iloscWszystkichRozliczonych > 0 ? Math.round((iloscObecnosci / iloscWszystkichRozliczonych) * 100) : 0;

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#1e293b', marginBottom: '5px', fontSize: '20px' }}>Twoja Frekwencja</h2>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
        Sekcja: <strong>{profile.sekcja.toUpperCase()}</strong> | Statystyki uwzględniają wyłącznie zakończone i rozliczone próby.
      </p>
      
      {/* Podsumowanie / Statystyki */}
      <div style={{ display: 'flex', gap: '20px', marginBottom: '25px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Obecności:</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#10b981' }}>{iloscObecnosci} / {iloscWszystkichRozliczonych}</p>
        </div>
        <div>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>Procent obecności:</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '20px', fontWeight: 'bold', color: '#3182ce' }}>{procent}%</p>
        </div>
      </div>

      {/* Szczegółowa historia rozliczonych prób */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>Rozliczona historia prób</h3>
      {odbyteSprawdzoneProby.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zakończonych i rozliczonych prób dla Twojej sekcji.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {odbyteSprawdzoneProby.map(proba => {
            const czyObecny = mojeObecnosci.includes(proba.id);
            return (
              <li key={proba.id} style={{ padding: '12px 15px', backgroundColor: '#ffffff', marginBottom: '8px', borderRadius: '6px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#1e293b', fontSize: '14px' }}>{new Date(proba.data_czas).toLocaleString('pl-PL')}</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>{proba.opis_cwiczen}</p>
                </div>
                <span style={{ 
                  padding: '5px 12px', 
                  borderRadius: '15px', 
                  fontSize: '13px', 
                  fontWeight: '600',
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
  );
}