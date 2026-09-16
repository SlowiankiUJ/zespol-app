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
  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '14px' }}>👤</span>}
  </div>
);

export default function ZarzadzanieCzlonkami() {
  const [czlonkowie, setCzlonkowie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtrSekcja, setFiltrSekcja] = useState('wszystkie');
  const [szukanaFraza, setSzukanaFraza] = useState('');
  const [statyCzlonkow, setStatyCzlonkow] = useState({});
  const [wybranyDoEdycji, setWybranyDoEdycji] = useState(null);
  const [nowaSekcja, setNowaSekcja] = useState('');
  const [nowyGlos, setNowyGlos] = useState('');
  const [nowaRola, setNowaRola] = useState('');
  const [komunikat, setKomunikat] = useState('');

  useEffect(() => {
    pobierzDane();
  }, []);

  const pobierzDane = async () => {
    setLoading(true);
    try {
      const { data: profilesData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('imie_nazwisko', { ascending: true });

      if (profError) throw profError;

      const { data: probyData, error: probyError } = await supabase
        .from('proby')
        .select('id, data_czas, sekcja');

      if (probyError) throw probyError;

      const { data: dekData, error: dekError } = await supabase
        .from('deklaracje_obecnosci')
        .select('id_uzytkownika, id_proby, obecny');

      if (dekError) throw dekError;

      const probyMap = {};
      (probyData || []).forEach(p => {
        probyMap[String(p.id)] = {
          data_czas: p.data_czas,
          sekcja: oczyscTekst(p.sekcja)
        };
      });

      const userDekMap = {};
      (dekData || []).forEach(d => {
        const uid = d.id_uzytkownika;
        if (!userDekMap[uid]) userDekMap[uid] = [];
        userDekMap[uid].push(d);
      });

      const wyliczoneStaty = {};

      (profilesData || []).forEach(osoba => {
        const glownaSekcja = oczyscTekst(osoba.sekcja);
        const deklaracjeOsoby = userDekMap[osoba.id] || [];

        let ob = 0;
        let tot = 0;
        let aktualnyStreak = 0;

        const tylkoWlasneObecnosci = deklaracjeOsoby
          .map(d => {
            const probaInfo = probyMap[String(d.id_proby)];
            return {
              obecny: d.obecny,
              sekcja: probaInfo ? probaInfo.sekcja : null,
              data_czas: probaInfo ? probaInfo.data_czas : null
            };
          })
          .filter(item => item.sekcja && item.sekcja === glownaSekcja && item.sekcja !== 'generalna');

        tylkoWlasneObecnosci.forEach(item => {
          if (item.obecny === true) {
            ob++;
            tot++;
          } else if (item.obecny === false) {
            tot++;
          }
        });

        const posortowane = [...tylkoWlasneObecnosci]
          .filter(item => item.obecny === true || item.obecny === false)
          .sort((a, b) => new Date(b.data_czas) - new Date(a.data_czas));

        for (const item of posortowane) {
          if (item.obecny === true) aktualnyStreak++;
          else if (item.obecny === false) break;
        }

        const procent = tot > 0 ? Math.round((ob / tot) * 100) : 0;

        wyliczoneStaty[osoba.id] = {
          obecny: ob,
          lacznie: tot,
          procent: procent,
          streak: aktualnyStreak
        };
      });

      setCzlonkowie(profilesData || []);
      setStatyCzlonkow(wyliczoneStaty);
    } catch (err) {
      console.error('Błąd pobierania danych w ZarzadzanieCzlonkami:', err);
    } finally {
      setLoading(false);
    }
  };

  const rozpocznijEdycje = (osoba) => {
    setWybranyDoEdycji(osoba);
    setNowaSekcja(osoba.sekcja || 'balet');
    setNowyGlos(osoba.glos || '');
    setNowaRola(osoba.rola || 'członek');
  };

  const zapiszEdycje = async () => {
    if (!wybranyDoEdycji) return;
    setKomunikat('Zapisywanie zmian...');

    const { error } = await supabase
      .from('profiles')
      .update({
        sekcja: nowaSekcja,
        glos: nowaSekcja === 'chór' ? nowyGlos : null,
        rola: nowaRola
      })
      .eq('id', wybranyDoEdycji.id);

    if (error) {
      setKomunikat('Błąd zapisu: ' + error.message);
    } else {
      setKomunikat('Zaktualizowano profil pomyślnie! ✅');
      setWybranyDoEdycji(null);
      pobierzDane();
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const zmienStatusKonta = async (userId, nowyStatus) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: nowyStatus })
      .eq('id', userId);

    if (!error) pobierzDane();
  };

  // CAŁKOWITE USUNIĘCIE KONTA Z BAZY
  const usunKontoCalkowicie = async (userId, imieNazwisko) => {
    const zgoda = window.confirm(
      `⚠️ UWAGA: Czy na pewno chcesz CAŁKOWICIE I BEZPOWROTNIE usunąć konto użytkownika "${imieNazwisko}"?\n\nOsoba ta zostanie skasowana z systemu logowania, straci dostęp do aplikacji, a jej wpisy zostaną usunięte.`
    );
    if (!zgoda) return;

    setKomunikat('Usuwanie konta...');
    try {
      const { error } = await supabase.rpc('usun_konto_uzytkownika', { user_id: userId });

      if (error) {
        // Fallback: próba usunięcia z profiles
        const { error: deleteProfError } = await supabase.from('profiles').delete().eq('id', userId);
        if (deleteProfError) throw deleteProfError;
      }

      setKomunikat(`Konto "${imieNazwisko}" zostało trwale usunięte! 🗑️`);
      pobierzDane();
      setTimeout(() => setKomunikat(''), 3500);
    } catch (err) {
      setKomunikat('Błąd usuwania konta: ' + err.message);
    }
  };

  const przefiltrowaniCzlonkowie = czlonkowie.filter(c => {
    const pasujeSekcja = filtrSekcja === 'wszystkie' ? true : oczyscTekst(c.sekcja) === oczyscTekst(filtrSekcja);
    const pasujeSzukaj = (c.imie_nazwisko || '').toLowerCase().includes(szukanaFraza.toLowerCase());
    return pasujeSekcja && pasujeSzukaj;
  });

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie panelu zarządzania członkami... 👥</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Zarządzanie Członkami i Frekwencja 👥</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Frekwencja i streak każdego członka wyliczane są <strong>wyłącznie z prób jego macierzystej sekcji</strong>.
          </p>
        </div>

        {/* FILTRY */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Szukaj po nazwisku..."
            value={szukanaFraza}
            onChange={(e) => setSzukanaFraza(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
          />
          <select
            value={filtrSekcja}
            onChange={(e) => setFiltrSekcja(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}
          >
            <option value="wszystkie">Wszystkie sekcje</option>
            <option value="balet">Balet</option>
            <option value="chór">Chór</option>
            <option value="kapela">Kapela</option>
          </select>
        </div>
      </div>

      {komunikat && (
        <div style={{ padding: '10px 15px', borderRadius: '6px', backgroundColor: komunikat.includes('Błąd') ? '#fef2f2' : '#f0fdf4', color: komunikat.includes('Błąd') ? '#dc2626' : '#16a34a', marginBottom: '15px', fontSize: '14px', fontWeight: 'bold' }}>
          {komunikat}
        </div>
      )}

      {/* FORMULARZ EDYCJI CZŁONKA */}
      {wybranyDoEdycji && (
        <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '2px solid #3b82f6' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1e293b' }}>
            Edycja członka: <strong>{wybranyDoEdycji.imie_nazwisko}</strong>
          </h3>
          <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Sekcja główna:</label>
              <select value={nowaSekcja} onChange={(e) => setNowaSekcja(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}>
                <option value="balet">Balet</option>
                <option value="chór">Chór</option>
                <option value="kapela">Kapela</option>
              </select>
            </div>

            {nowaSekcja === 'chór' && (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Głos:</label>
                <select value={nowyGlos} onChange={(e) => setNowyGlos(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}>
                  <option value="">Wybierz głos</option>
                  <option value="Sopran">Sopran</option>
                  <option value="Alt">Alt</option>
                  <option value="Tenor">Tenor</option>
                  <option value="Bas">Bas</option>
                </select>
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>Rola w systemie:</label>
              <select value={nowaRola} onChange={(e) => setNowaRola(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#fff', color: '#000' }}>
                <option value="członek">Członek</option>
                <option value="pracownik">Pracownik / Instruktor</option>
                <option value="kierownik">Kierownik</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '20px' }}>
              <button onClick={zapiszEdycje} style={{ padding: '8px 16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Zapisz 💾</button>
              <button onClick={() => setWybranyDoEdycji(null)} style={{ padding: '8px 16px', backgroundColor: '#94a3b8', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Anuluj</button>
            </div>
          </div>
        </div>
      )}

      {/* TABELA CZŁONKÓW */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
              <th style={{ padding: '12px 10px' }}>Członek</th>
              <th style={{ padding: '12px 10px' }}>Sekcja macierzysta</th>
              <th style={{ padding: '12px 10px' }}>Rola</th>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Frekwencja (Oficjalna)</th>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Streak</th>
              <th style={{ padding: '12px 10px', textAlign: 'center' }}>Status konta</th>
              <th style={{ padding: '12px 10px', textAlign: 'right' }}>Akcje</th>
            </tr>
          </thead>
          <tbody>
            {przefiltrowaniCzlonkowie.map(c => {
              const stylSekcji = pobierzStylSekcji(c.sekcja);
              const stat = statyCzlonkow[c.id] || { obecny: 0, lacznie: 0, procent: 0, streak: 0 };

              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <RenderAvatar url={c.avatar_url} />
                    <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{c.imie_nazwisko}</span>
                  </td>
                  <td style={{ padding: '12px 10px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', backgroundColor: stylSekcji.jasny, color: stylSekcji.glowny, border: `1px solid ${stylSekcji.border}`, textTransform: 'uppercase' }}>
                      {c.sekcja} {c.glos && `(${c.glos})`}
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', color: '#475569', fontSize: '13px' }}>
                    {c.rola}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    <span style={{ fontSize: '15px', fontWeight: 'bold', color: stat.procent >= 50 ? '#10b981' : '#ef4444' }}>
                      {stat.procent}%
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>
                      ({stat.obecny}/{stat.lacznie} prób)
                    </span>
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center', fontWeight: 'bold', color: stat.streak > 0 ? '#f59e0b' : '#94a3b8' }}>
                    🔥 {stat.streak}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'center' }}>
                    {c.status === 'zatwierdzony' ? (
                      <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#dcfce7', color: '#15803d' }}>Aktywny</span>
                    ) : (
                      <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#fef3c7', color: '#b45309' }}>Oczekujący</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <button onClick={() => rozpocznijEdycje(c)} style={{ padding: '5px 8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Edytuj ✏️
                      </button>
                      
                      {c.status === 'oczekujacy' ? (
                        <button onClick={() => zmienStatusKonta(c.id, 'zatwierdzony')} style={{ padding: '5px 8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                          Zatwierdź ✔️
                        </button>
                      ) : (
                        <button onClick={() => zmienStatusKonta(c.id, 'oczekujacy')} style={{ padding: '5px 8px', backgroundColor: '#f59e0b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                          Zawieś ⏸️
                        </button>
                      )}

                      {/* PRZYCISK TRWAŁEGO USUNIĘCIA KONTA */}
                      <button 
                        onClick={() => usunKontoCalkowicie(c.id, c.imie_nazwisko)} 
                        style={{ padding: '5px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                        title="Usuń trwale konto użytkownika"
                      >
                        Usuń 🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}