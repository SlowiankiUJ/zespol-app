import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// Precyzyjne formatowanie daty i godziny wyciągnięte bezpośrednio z tekstu bazy (bez konwersji strefy)
const formatujDate = (dataString) => {
  if (!dataString) return '';
  const [dataCzesc, czasCzesc] = dataString.split('T');
  if (!dataCzesc || !czasCzesc) return dataString;
  
  const [rok, mc, dzien] = dataCzesc.split('-');
  const [godzina, minuta] = czasCzesc.substring(0, 5).split(':');
  
  return `${dzien}.${mc}.${rok}, ${godzina}:${minuta}`;
};

const RenderAvatar = ({ url }) => (
  <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#e2e8f0', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    {url ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '12px' }}>👤</span>}
  </div>
);

export default function Kwiatki({ profile }) {
  const [wydarzenia, setWydarzenia] = useState([]);
  const [uczestnicyMap, setUczestnicyMap] = useState({});
  const [wszyscyCzlonkowie, setWszyscyCzlonkowie] = useState([]);
  const [loading, setLoading] = useState(true);
  const [komunikat, setKomunikat] = useState('');

  // Formularz nowego wydarzenia
  const [tytul, setTytul] = useState('');
  const [dataWydarzenia, setDataWydarzenia] = useState('');
  const [godzinaWydarzenia, setGodzinaWydarzenia] = useState('17:00');
  const [miejsce, setMiejsce] = useState('');
  const [opis, setOpis] = useState('');
  const [wybranaOsobaRęcznie, setWybranaOsobaRęcznie] = useState({});

  // Stany edycji istniejącego wydarzenia
  const [edycjaKwiatekId, setEdycjaKwiatekId] = useState(null);
  const [editTytul, setEditTytul] = useState('');
  const [editData, setEditData] = useState('');
  const [editGodzina, setEditGodzina] = useState('');
  const [editMiejsce, setEditMiejsce] = useState('');
  const [editOpis, setEditOpis] = useState('');

  const czyZarzadzaKwiatkami = Boolean(profile?.rola === 'kierownik' || profile?.czy_inspektor);

  useEffect(() => {
    if (profile) {
      pobierzWszystko();
    }
  }, [profile]);

  const pobierzWszystko = async () => {
    setLoading(true);
    try {
      const { data: kwiatkiData, error: errK } = await supabase
        .from('kwiatki')
        .select('*')
        .order('data_czas', { ascending: true });

      if (errK) throw errK;

      const { data: profData } = await supabase
        .from('profiles')
        .select('id, imie_nazwisko, sekcja, glos, avatar_url')
        .eq('status', 'zatwierdzony')
        .eq('rola', 'członek')
        .order('imie_nazwisko', { ascending: true });

      setWszyscyCzlonkowie(profData || []);

      const profileMap = {};
      (profData || []).forEach(p => { profileMap[p.id] = p; });

      const { data: uczData, error: errU } = await supabase
        .from('kwiatki_uczestnicy')
        .select('*');

      if (errU) throw errU;

      const mapa = {};
      (kwiatkiData || []).forEach(k => { mapa[k.id] = []; });

      (uczData || []).forEach(u => {
        if (mapa[u.id_kwiatka] && profileMap[u.id_uzytkownika]) {
          mapa[u.id_kwiatka].push({
            ...profileMap[u.id_uzytkownika],
            zgloszony: u.zgloszony,
            wybrany: u.wybrany,
            rekordId: u.id
          });
        }
      });

      setWydarzenia(kwiatkiData || []);
      setUczestnicyMap(mapa);
    } catch (err) {
      console.error('Błąd pobierania kwiatków:', err);
    } finally {
      setLoading(false);
    }
  };

  const dodajWydarzenie = async (e) => {
    e.preventDefault();
    if (!dataWydarzenia) { alert('Wybierz datę wydarzenia.'); return; }

    const pelnaDataCzas = `${dataWydarzenia}T${godzinaWydarzenia}:00`;

    const { error } = await supabase
      .from('kwiatki')
      .insert([{ tytul, data_czas: pelnaDataCzas, miejsce, opis }]);

    if (error) {
      setKomunikat('Błąd: ' + error.message);
    } else {
      setKomunikat('Dodano nowe wydarzenie na kwiatki! 🌸');
      setTytul(''); setDataWydarzenia(''); setMiejsce(''); setOpis('');
      pobierzWszystko();
      setTimeout(() => setKomunikat(''), 3000);
    }
  };

  const rozpocznijEdycje = (kw) => {
    setEdycjaKwiatekId(kw.id);
    setEditTytul(kw.tytul);
    setEditData(kw.data_czas ? kw.data_czas.substring(0, 10) : '');
    setEditGodzina(kw.data_czas ? kw.data_czas.substring(11, 16) : '17:00');
    setEditMiejsce(kw.miejsce || '');
    setEditOpis(kw.opis || '');
  };

  const anulujEdycje = () => {
    setEdycjaKwiatekId(null);
  };

  const zapiszEdycje = async (id) => {
    if (!editData || !editGodzina) { alert('Uzupełnij datę i godzinę.'); return; }
    const pelnaDataCzas = `${editData}T${editGodzina}:00`;

    const { error } = await supabase
      .from('kwiatki')
      .update({ tytul: editTytul, data_czas: pelnaDataCzas, miejsce: editMiejsce, opis: editOpis })
      .eq('id', id);

    if (error) {
      alert('Błąd podczas edycji: ' + error.message);
    } else {
      setEdycjaKwiatekId(null);
      pobierzWszystko();
    }
  };

  const usunWydarzenie = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to wydarzenie?')) return;
    const { error } = await supabase.from('kwiatki').delete().eq('id', id);
    if (!error) pobierzWszystko();
  };

  const zmienMojeZgloszenie = async (kwiatekId, czyChce) => {
    if (czyChce) {
      const { error } = await supabase
        .from('kwiatki_uczestnicy')
        .upsert([{ id_kwiatka: kwiatekId, id_uzytkownika: profile.id, zgloszony: true }], { onConflict: 'id_kwiatka, id_uzytkownika' });
      if (!error) pobierzWszystko();
    } else {
      const { error } = await supabase
        .from('kwiatki_uczestnicy')
        .delete()
        .eq('id_kwiatka', kwiatekId)
        .eq('id_uzytkownika', profile.id);
      if (!error) pobierzWszystko();
    }
  };

  const przelaczWyborOsoby = async (kwiatekId, userId, aktualnieWybrany) => {
    if (!czyZarzadzaKwiatkami) return;

    const { error } = await supabase
      .from('kwiatki_uczestnicy')
      .upsert([{ id_kwiatka: kwiatekId, id_uzytkownika: userId, wybrany: !aktualnieWybrany }], { onConflict: 'id_kwiatka, id_uzytkownika' });

    if (!error) pobierzWszystko();
  };

  const dodajCzlonkaRecznie = async (kwiatekId) => {
    const userId = wybranaOsobaRęcznie[kwiatekId];
    if (!userId) return;

    const { error } = await supabase
      .from('kwiatki_uczestnicy')
      .upsert([{ id_kwiatka: kwiatekId, id_uzytkownika: userId, wybrany: true, zgloszony: true }], { onConflict: 'id_kwiatka, id_uzytkownika' });

    if (!error) {
      setWybranaOsobaRęcznie(prev => ({ ...prev, [kwiatekId]: '' }));
      pobierzWszystko();
    }
  };

  const usunUczestnikaZListy = async (kwiatekId, userId) => {
    if (!czyZarzadzaKwiatkami) return;
    const { error } = await supabase
      .from('kwiatki_uczestnicy')
      .delete()
      .eq('id_kwiatka', kwiatekId)
      .eq('id_uzytkownika', userId);

    if (!error) pobierzWszystko();
  };

  const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff', color: '#000' };
  const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie wydarzeń (Kwiatki)... 🌸</div>;
  }

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Kwiatki 🌸💐</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Zgłaszaj się na kwiatki! Skład delegacji wybierają Inspektorzy Sekcji oraz Kierownik.
          </p>
        </div>
        {czyZarzadzaKwiatkami && (
          <span style={{ padding: '6px 12px', backgroundColor: '#fdf2f8', border: '1px solid #fbcfe8', borderRadius: '16px', color: '#be185d', fontSize: '12px', fontWeight: 'bold' }}>
            Tryb zarządzania (Inspektor / Kierownik 🔍)
          </span>
        )}
      </div>

      {/* FORMULARZ DLA KIEROWNIKA / INSPEKTORA */}
      {czyZarzadzaKwiatkami && (
        <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#fdf2f8', borderRadius: '10px', border: '1px solid #fbcfe8' }}>
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#9d174d' }}>
            Zaplanuj nowe wyjście na kwiatki 🌸
          </h3>
          <form onSubmit={dodajWydarzenie} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Tytuł / Okazja:</label>
              <input type="text" placeholder="np. Kwiatki dla Profesora X / Ślub Kasi i Michała" value={tytul} onChange={(e) => setTytul(e.target.value)} required style={inputStyle} />
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px' }}>
                <label style={labelStyle}>Data:</label>
                <input type="date" value={dataWydarzenia} onChange={(e) => setDataWydarzenia(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{ ...inputStyle, cursor: 'pointer' }} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={labelStyle}>Godzina:</label>
                <input type="time" value={godzinaWydarzenia} onChange={(e) => setGodzinaWydarzenia(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} required style={{ ...inputStyle, cursor: 'pointer' }} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Miejsce:</label>
              <input type="text" placeholder="np. Collegium Maius / Kościół św. Anny" value={miejsce} onChange={(e) => setMiejsce(e.target.value)} required style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Dodatkowe informacje / uwagi do stroju:</label>
              <textarea placeholder="np. Zbiórka 20 minut wcześniej, strój organizacyjny / galowy" value={opis} onChange={(e) => setOpis(e.target.value)} rows="2" style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <button type="submit" style={{ padding: '12px', backgroundColor: '#db2777', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Dodaj wydarzenie 🌸
            </button>
          </form>
          {komunikat && <p style={{ color: '#db2777', fontWeight: 'bold', marginTop: '10px' }}>{komunikat}</p>}
        </div>
      )}

      {/* LISTA WYDARZEŃ */}
      <h3 style={{ fontSize: '16px', color: '#334155', marginBottom: '15px' }}>
        Zaplanowane kwiatki ({wydarzenia.length})
      </h3>

      {wydarzenia.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Brak zaplanowanych wyjść na kwiatki w najbliższym czasie.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
          {wydarzenia.map(kw => {
            const uczestnicy = uczestnicyMap[kw.id] || [];
            const zgloszeni = uczestnicy.filter(u => u.zgloszony);
            const wybrani = uczestnicy.filter(u => u.wybrany);
            const czyJestemZgloszony = uczestnicy.some(u => u.id === profile.id && u.zgloszony);
            const czyJestemWybrany = uczestnicy.some(u => u.id === profile.id && u.wybrany);
            const czyEdytowany = edycjaKwiatekId === kw.id;

            return (
              <div 
                key={kw.id} 
                style={{ 
                  borderLeft: '6px solid #ec4899', 
                  backgroundColor: '#fdf2f8', 
                  borderRadius: '10px', 
                  padding: '20px', 
                  borderTop: '1px solid #fbcfe8', 
                  borderRight: '1px solid #fbcfe8', 
                  borderBottom: '1px solid #fbcfe8', 
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)' 
                }}
              >
                {czyZarzadzaKwiatkami && czyEdytowany ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #fbcfe8', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 5px 0', fontSize: '15px', color: '#9d174d' }}>Edycja wydarzenia:</h4>
                    <input type="text" value={editTytul} onChange={(e) => setEditTytul(e.target.value)} placeholder="Tytuł / Okazja" style={inputStyle} />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 120px', ...inputStyle }} />
                      <input type="time" value={editGodzina} onChange={(e) => setEditGodzina(e.target.value)} onClick={(e) => e.target.showPicker && e.target.showPicker()} style={{ flex: '1 1 100px', ...inputStyle }} />
                    </div>
                    <input type="text" value={editMiejsce} onChange={(e) => setEditMiejsce(e.target.value)} placeholder="Miejsce" style={inputStyle} />
                    <textarea value={editOpis} onChange={(e) => setEditOpis(e.target.value)} placeholder="Uwagi" rows="2" style={{ ...inputStyle, resize: 'vertical' }} />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
                      <button onClick={() => zapiszEdycje(kw.id)} style={{ padding: '8px 14px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Zapisz 💾</button>
                      <button onClick={anulujEdycje} style={{ padding: '8px 14px', backgroundColor: '#94a3b8', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 5px 0', color: '#831843', fontSize: '18px' }}>
                          🌸 {kw.tytul}
                        </h4>
                        <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#475569' }}>
                          📅 <strong>{formatujDate(kw.data_czas)}</strong> | 📍 {kw.miejsce}
                        </p>
                        {kw.opis && <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#4a044e' }}><strong>Uwagi:</strong> {kw.opis}</p>}
                      </div>

                      {czyZarzadzaKwiatkami && (
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            onClick={() => rozpocznijEdycje(kw)} 
                            style={{ padding: '5px 10px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Edytuj ✏️
                          </button>
                          <button 
                            onClick={() => usunWydarzenie(kw.id)} 
                            style={{ padding: '5px 10px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Usuń 🗑️
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* PASEK DEKLARACJI CZŁONKA */}
                {profile.rola === 'członek' && (
                  <div style={{ marginTop: '16px', padding: '14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #fbcfe8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>Twój status: </span>
                      {czyJestemWybrany ? (
                        <span style={{ color: '#15803d', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#dcfce7', padding: '3px 10px', borderRadius: '12px' }}>
                          🎉 Jesteś w oficjalnym składzie!
                        </span>
                      ) : czyJestemZgloszony ? (
                        <span style={{ color: '#b45309', fontWeight: 'bold', fontSize: '13px', backgroundColor: '#fef3c7', padding: '3px 10px', borderRadius: '12px' }}>
                          ⏳ Zgłoszony (oczekuje na decyzję)
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '13px' }}>Brak zgłoszenia</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      {!czyJestemZgloszony ? (
                        <button 
                          onClick={() => zmienMojeZgloszenie(kw.id, true)} 
                          style={{ padding: '7px 14px', backgroundColor: '#db2777', color: 'white', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          Chcę iść na kwiatki 🌸
                        </button>
                      ) : (
                        <button 
                          onClick={() => zmienMojeZgloszenie(kw.id, false)} 
                          style={{ padding: '7px 14px', backgroundColor: '#f1f5f9', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                          Wycofaj zgłoszenie ❌
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* WIDOK DLA WSZYSTKICH: PODZIAŁ NA WYBRANYCH I ZGŁOSZONYCH */}
                <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                  
                  {/* OKNO 1: SKŁAD OFICJALNY (WYBRANI) */}
                  <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '2px solid #10b981' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h5 style={{ margin: 0, fontSize: '14px', color: '#047857', fontWeight: 'bold' }}>
                        💐 Idą na kwiatki ({wybrani.length}):
                      </h5>
                      <span style={{ fontSize: '11px', color: '#047857', backgroundColor: '#d1fae5', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Zatwierdzeni</span>
                    </div>

                    {wybrani.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', margin: '6px 0' }}>Jeszcze nikt nie został wybrany.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {wybrani.map(osoba => (
                          <li key={osoba.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#f0fdf4', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <RenderAvatar url={osoba.avatar_url} />
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#065f46' }}>
                                {osoba.imie_nazwisko} <span style={{ fontSize: '11px', fontWeight: 'normal', color: '#047857' }}>({osoba.sekcja})</span>
                              </span>
                            </div>
                            {czyZarzadzaKwiatkami && (
                              <button 
                                onClick={() => przelaczWyborOsoby(kw.id, osoba.id, true)} 
                                style={{ padding: '3px 6px', backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                title="Cofnij wybór"
                              >
                                Usuń ze składu ↩️
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* OKNO 2: OSOBY CHĘTNE (ZGŁOSZONE) */}
                  <div style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h5 style={{ margin: 0, fontSize: '14px', color: '#334155', fontWeight: 'bold' }}>
                        🙋 Zgłoszeni chętni ({zgloszeni.length}):
                      </h5>
                      <span style={{ fontSize: '11px', color: '#64748b', backgroundColor: '#f1f5f9', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>Deklaracje</span>
                    </div>

                    {zgloszeni.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', margin: '6px 0' }}>Brak zgłoszeń od członków.</p>
                    ) : (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {zgloszeni.map(osoba => (
                          <li key={osoba.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <RenderAvatar url={osoba.avatar_url} />
                              <span style={{ fontSize: '13px', color: '#1e293b' }}>
                                {osoba.imie_nazwisko} <span style={{ fontSize: '11px', color: '#64748b' }}>({osoba.sekcja})</span>
                              </span>
                            </div>

                            {czyZarzadzaKwiatkami && (
                              <div style={{ display: 'flex', gap: '4px' }}>
                                {!osoba.wybrany ? (
                                  <button 
                                    onClick={() => przelaczWyborOsoby(kw.id, osoba.id, false)} 
                                    style={{ padding: '4px 8px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}
                                  >
                                    Wybierz ✔️
                                  </button>
                                ) : (
                                  <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold' }}>Wybrany ✅</span>
                                )}
                                <button 
                                  onClick={() => usunUczestnikaZListy(kw.id, osoba.id)} 
                                  style={{ padding: '4px 6px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                                  title="Usuń zgłoszenie"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {/* DLA KIEROWNIKA/INSPEKTORA: WYBÓR DOWOLNEGO CZŁONKA ZESPOŁU */}
                    {czyZarzadzaKwiatkami && (
                      <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #cbd5e1' }}>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '4px' }}>
                          Dopisz członka bezpośrednio ze składu:
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <select 
                            value={wybranaOsobaRęcznie[kw.id] || ''} 
                            onChange={(e) => setWybranaOsobaRęcznie({ ...wybranaOsobaRęcznie, [kw.id]: e.target.value })}
                            style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#000' }}
                          >
                            <option value="">Wybierz członka zespołu...</option>
                            {wszyscyCzlonkowie.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.imie_nazwisko} ({c.sekcja})
                              </option>
                            ))}
                          </select>
                          <button 
                            onClick={() => dodajCzlonkaRecznie(kw.id)}
                            style={{ padding: '6px 10px', backgroundColor: '#db2777', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                          >
                            Dodaj ➕
                          </button>
                        </div>
                      </div>
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
}