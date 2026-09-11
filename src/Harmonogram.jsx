import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import ListaObecnosci from './ListaObecnosci';
import { pobierzStylSekcji } from './kolory';

export default function Harmonogram({ profile }) {
  const [proby, setProby] = useState([]);
  const [mojeObecnosci, setMojeObecnosci] = useState([]);
  const [mojeDeklaracje, setMojeDeklaracje] = useState({});
  
  const [trybFormularza, setTrybFormularza] = useState('pojedyncza');

  const [dataCzas, setDataCzas] = useState('');
  const [sekcja, setSekcja] = useState('chór');
  const [opis, setOpis] = useState('');
  const [wiadomosc, setWiadomosc] = useState('');

  const [dataOd, setDataOd] = useState('');
  const [dataDo, setDataDo] = useState('');
  const [dzienTygodnia, setDzienTygodnia] = useState('1'); 
  const [godzina, setGodzina] = useState('18:00');
  const [opisCyklu, setOpisCyklu] = useState('');

  const [edytowaneId, setEdytowaneId] = useState(null);
  const [nowyOpis, setNowyOpis] = useState('');

  useEffect(() => {
    pobierzProby();
    if (profile.rola === 'członek') {
      pobierzMojaFrekwencje();
      pobierzMojeDeklaracje();
    }
  }, [profile]);

  const pobierzProby = async () => {
    const { data } = await supabase
      .from('proby')
      .select('*')
      .order('data_czas', { ascending: true });
    
    if (data) setProby(data);
  };

  const pobierzMojaFrekwencje = async () => {
    const { data } = await supabase
      .from('frekwencja')
      .select('id_proby')
      .eq('id_uzytkownika', profile.id)
      .eq('obecny', true);
    
    if (data) {
      setMojeObecnosci(data.map(f => f.id_proby));
    }
  };

  const pobierzMojeDeklaracje = async () => {
    const { data } = await supabase
      .from('deklaracje_obecnosci')
      .select('id_proby, planuje')
      .eq('id_uzytkownika', profile.id);
    
    if (data) {
      const mapa = {};
      data.forEach(d => { mapa[d.id_proby] = d.planuje; });
      setMojeDeklaracje(mapa);
    }
  };

  const zmienDeklaracje = async (probaId, planuje) => {
    const { error } = await supabase
      .from('deklaracje_obecnosci')
      .upsert([
        { id_proby: probaId, id_uzytkownika: profile.id, planuje: planuje }
      ], { onConflict: 'id_proby, id_uzytkownika' });

    if (!error) {
      setMojeDeklaracje(prev => ({ ...prev, [probaId]: planuje }));
    }
  };

  const dodajProbe = async (e) => {
    e.preventDefault();
    setWiadomosc('Dodawanie...');

    const { error } = await supabase
      .from('proby')
      .insert([{ data_czas: dataCzas, sekcja: sekcja, opis_cwiczen: opis }]);

    if (error) {
      setWiadomosc('Błąd: ' + error.message);
    } else {
      setWiadomosc('Próba dodana pomyślnie!');
      setDataCzas('');
      setOpis('');
      pobierzProby();
    }
  };

  const dodajCyklProb = async (e) => {
    e.preventDefault();
    if (!dataOd || !dataDo) {
      setWiadomosc('Wybierz zakres dat początkowej i końcowej.');
      return;
    }

    setWiadomosc('Generowanie cyklu prób...');

    let start = new Date(dataOd);
    let end = new Date(dataDo);
    let noweProby = [];

    let current = new Date(start);
    while (current <= end) {
      if (current.getDay() === Number(dzienTygodnia)) {
        const r = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dataCzasStr = `${r}-${m}-${d}T${godzina}`;

        noweProby.push({
          data_czas: dataCzasStr,
          sekcja: sekcja,
          opis_cwiczen: opisCyklu || 'Próba cykliczna'
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (noweProby.length === 0) {
      setWiadomosc('Błąd: Brak dni pasujących do wybranego dnia tygodnia w podanym zakresie.');
      return;
    }

    const { error } = await supabase.from('proby').insert(noweProby);

    if (error) {
      setWiadomosc('Błąd generowania cyklu: ' + error.message);
    } else {
      setWiadomosc(`Pomyślnie dodano ${noweProby.length} prób do kalendarza! ✅`);
      setDataOd('');
      setDataDo('');
      setOpisCyklu('');
      pobierzProby();
    }
  };

  const usunProbe = async (probaId) => {
    if (!window.confirm('Czy na pewno chcesz bezpowrotnie usunąć tę próbę z kalendarza?')) return;

    const { error } = await supabase
      .from('proby')
      .delete()
      .eq('id', probaId);

    if (error) {
      alert('Błąd podczas usuwania: ' + error.message);
    } else {
      pobierzProby();
    }
  };

  const rozpocznijEdycje = (proba) => {
    setEdytowaneId(proba.id);
    setNowyOpis(proba.opis_cwiczen);
  };

  const zapiszEdycje = async (probaId) => {
    const { error } = await supabase
      .from('proby')
      .update({ opis_cwiczen: nowyOpis })
      .eq('id', probaId);

    if (error) {
      alert('Błąd podczas edycji planu: ' + error.message);
    } else {
      setEdytowaneId(null);
      setNowyOpis('');
      pobierzProby();
    }
  };

  const widoczneProby = profile.rola === 'członek' 
    ? proby.filter(proba => proba.sekcja === profile.sekcja)
    : proby;

  return (
    <div style={{ marginTop: '30px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <h2 style={{ color: '#2d3748', marginBottom: '20px' }}>Harmonogram Prób i Frekwencja</h2>

      {/* Formularz dodawania prób (Tylko Kadra) */}
      {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <button 
              onClick={() => { setTrybFormularza('pojedyncza'); setWiadomosc(''); }}
              style={{ 
                padding: '8px 14px', 
                backgroundColor: trybFormularza === 'pojedyncza' ? '#3182ce' : '#e2e8f0', 
                color: trybFormularza === 'pojedyncza' ? '#fff' : '#475569', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '600' 
              }}
            >
              + Dodaj pojedynczą próbę
            </button>
            <button 
              onClick={() => { setTrybFormularza('cykl'); setWiadomosc(''); }}
              style={{ 
                padding: '8px 14px', 
                backgroundColor: trybFormularza === 'cykl' ? '#3182ce' : '#e2e8f0', 
                color: trybFormularza === 'cykl' ? '#fff' : '#475569', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer', 
                fontWeight: '600' 
              }}
            >
              🔄 Dodaj cykl prób (masowo)
            </button>
          </div>

          {/* Formularz 1: Pojedyncza próba */}
          {trybFormularza === 'pojedyncza' ? (
            <div>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#4a5568' }}>Nowa pojedyncza próba</h3>
              <form onSubmit={dodajProbe} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input 
                  type="datetime-local" 
                  value={dataCzas} 
                  onChange={(e) => setDataCzas(e.target.value)} 
                  required 
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000' }}
                />
                <select 
                  value={sekcja} 
                  onChange={(e) => setSekcja(e.target.value)} 
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000' }}
                >
                  <option value="chór">Chór (Niebieski)</option>
                  <option value="balet">Balet (Czerwony)</option>
                  <option value="kapela">Kapela (Zielony)</option>
                </select>
                <textarea 
                  placeholder="Co będzie ćwiczone? (np. nowy układ, rozśpiewka)" 
                  value={opis} 
                  onChange={(e) => setOpis(e.target.value)} 
                  rows="3"
                  required
                  style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000' }}
                />
                <button type="submit" style={{ padding: '12px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                  Zapisz próbę w kalendarzu
                </button>
              </form>
            </div>
          ) : (
            /* Formularz 2: Cykl prób (masowe dodawanie) z poprawionym kontrastem pól */
            <div>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', color: '#4a5568' }}>Masowe generowanie cyklu prób</h3>
              <form onSubmit={dodajCyklProb} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Data od:</label>
                    <input 
                      type="date" 
                      value={dataOd} 
                      onChange={(e) => setDataOd(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Data do:</label>
                    <input 
                      type="date" 
                      value={dataDo} 
                      onChange={(e) => setDataDo(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Dzień tygodnia:</label>
                    <select 
                      value={dzienTygodnia} 
                      onChange={(e) => setDzienTygodnia(e.target.value)} 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                    >
                      <option value="1">Poniedziałek</option>
                      <option value="2">Wtorek</option>
                      <option value="3">Środa</option>
                      <option value="4">Czwartek</option>
                      <option value="5">Piątek</option>
                      <option value="6">Sobota</option>
                      <option value="0">Niedziela</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Godzina próby:</label>
                    <input 
                      type="time" 
                      value={godzina} 
                      onChange={(e) => setGodzina(e.target.value)} 
                      required 
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Sekcja:</label>
                  <select 
                    value={sekcja} 
                    onChange={(e) => setSekcja(e.target.value)} 
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                  >
                    <option value="chór">Chór (Niebieski)</option>
                    <option value="balet">Balet (Czerwony)</option>
                    <option value="kapela">Kapela (Zielony)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>Domyślny plan / opis dla całego cyklu:</label>
                  <textarea 
                    placeholder="np. Standardowa próba sekcyjna" 
                    value={opisCyklu} 
                    onChange={(e) => setOpisCyklu(e.target.value)} 
                    rows="2"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', boxSizing: 'border-box' }}
                  />
                </div>

                <button type="submit" style={{ padding: '12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                  Wygeneruj i dodaj cykl prób do kalendarza 🚀
                </button>
              </form>
            </div>
          )}

          {wiadomosc && <p style={{ color: wiadomosc.includes('Błąd') ? '#dc3545' : 'green', marginTop: '10px', fontWeight: '500' }}>{wiadomosc}</p>}
        </div>
      )}

      {/* Lista prób */}
      <h3 style={{ color: '#4a5568', fontSize: '18px' }}>Nadchodzące wydarzenia ({widoczneProby.length})</h3>
      {widoczneProby.length === 0 ? (
        <p style={{ color: '#718096' }}>Brak zaplanowanych prób.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {widoczneProby.map(proba => {
            const czyObecny = mojeObecnosci.includes(proba.id);
            const deklaracja = mojeDeklaracje[proba.id];
            const stylSekcji = pobierzStylSekcji(proba.sekcja);
            const czyEdytuje = edytowaneId === proba.id;

            return (
              <div key={proba.id} style={{ 
                borderLeft: `6px solid ${stylSekcji.glowny}`, 
                padding: '15px 20px', 
                backgroundColor: stylSekcji.jasny, 
                borderRadius: '8px',
                borderTop: `1px solid ${stylSekcji.border}`,
                borderRight: `1px solid ${stylSekcji.border}`,
                borderBottom: `1px solid ${stylSekcji.border}`,
                boxShadow: '0 2px 4px rgba(0,0,0,0.01)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ margin: '0 0 5px 0', color: stylSekcji.tekst, fontSize: '16px' }}>
                    {new Date(proba.data_czas).toLocaleString('pl-PL')} — Sekcja: {proba.sekcja.toUpperCase()}
                  </h4>
                  
                  {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!czyEdytuje && (
                        <button 
                          onClick={() => rozpocznijEdycje(proba)}
                          style={{ padding: '4px 10px', backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                        >
                          Edytuj plan ✏️
                        </button>
                      )}
                      <button 
                        onClick={() => usunProbe(proba.id)}
                        style={{ padding: '4px 10px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}
                      >
                        Usuń próbę 🗑️
                      </button>
                    </div>
                  )}
                </div>

                {czyEdytuje ? (
                  <div style={{ margin: '10px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <textarea 
                      value={nowyOpis} 
                      onChange={(e) => setNowyOpis(e.target.value)} 
                      rows="3" 
                      style={{ padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#000000', width: '100%', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => zapiszEdycje(proba.id)}
                        style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                      >
                        Zapisz zmiany
                      </button>
                      <button 
                        onClick={() => setEdytowaneId(null)}
                        style={{ padding: '6px 12px', backgroundColor: '#64748b', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: '8px 0 10px 0', color: '#2d3748' }}><strong>Plan:</strong> {proba.opis_cwiczen}</p>
                )}

                {profile.rola === 'członek' && (
                  <div style={{ padding: '10px', backgroundColor: '#fff', borderRadius: '6px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500' }}>Twoja deklaracja udziału:</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => zmienDeklaracje(proba.id, true)}
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: '4px', 
                          border: 'none', 
                          cursor: 'pointer', 
                          fontWeight: '600',
                          backgroundColor: deklaracja === true ? '#198754' : '#e2e8f0',
                          color: deklaracja === true ? '#fff' : '#475569'
                        }}
                      >
                        Planuję być 👍
                      </button>
                      <button 
                        onClick={() => zmienDeklaracje(proba.id, false)}
                        style={{ 
                          padding: '6px 12px', 
                          borderRadius: '4px', 
                          border: 'none', 
                          cursor: 'pointer', 
                          fontWeight: '600',
                          backgroundColor: deklaracja === false ? '#dc3545' : '#e2e8f0',
                          color: deklaracja === false ? '#fff' : '#475569'
                        }}
                      >
                        Nie będzie mnie 👎
                      </button>
                    </div>
                  </div>
                )}
                
                {(profile.rola === 'kierownik' || profile.rola === 'pracownik') && (
                  <ListaObecnosci probaId={proba.id} sekcja={proba.sekcja} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}