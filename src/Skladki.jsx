import { useState, useEffect } from 'react';

export default function Skladki({ profile }) {
  const [aktywnaSekcja, setAktywnaSekcja] = useState('balet');
  const [daneBalet, setDaneBalet] = useState([]);
  const [daneChor, setDaneChor] = useState([]);
  const [daneKapela, setDaneKapela] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const SHEET_ID = '1vtGIEWOK_LA01dyBcqZ04wrGwwbxCxb5F8TadquYUA4';

  const URLS = {
    balet: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`,
    chor: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=2086525756`,
    kapela: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1558094963`
  };

  useEffect(() => {
    pobierzWszystkieSkladki();
  }, []);

  const parsujCSV = (text) => {
    const lines = text.split('\n');
    const result = [];

    for (let i = 0; i < lines.length; i++) {
      const row = [];
      let inQuotes = false;
      let entry = '';
      
      const line = lines[i];
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(entry.trim());
          entry = '';
        } else {
          entry += char;
        }
      }
      row.push(entry.trim());
      if (row.some(cell => cell !== '')) {
        result.push(row);
      }
    }
    return result;
  };

  const pobierzWszystkieSkladki = async () => {
    setLoading(true);
    try {
      const [resBalet, resChor, resKapela] = await Promise.all([
        fetch(URLS.balet).then(r => r.text()).catch(() => ''),
        fetch(URLS.chor).then(r => r.text()).catch(() => ''),
        fetch(URLS.kapela).then(r => r.text()).catch(() => '')
      ]);

      setDaneBalet(parsujCSV(resBalet));
      setDaneChor(parsujCSV(resChor));
      setDaneKapela(parsujCSV(resKapela));
    } catch (err) {
      console.error('Błąd pobierania składek:', err);
      setError('Nie udało się załadować danych składek z arkuszy.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie składek ze wszystkich sekcji... 💶📊</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>{error}</div>;
  }

  const aktualneDane = aktywnaSekcja === 'balet' ? daneBalet : aktywnaSekcja === 'chor' ? daneChor : daneKapela;
  
  // Nagłówek (Indeksy: A=0, B=1, C=2, H=7)
  const naglowek = aktualneDane.length > 0 ? [aktualneDane[0][0], aktualneDane[0][1], aktualneDane[0][2], aktualneDane[0][7]] : [];
  const wierszeDanych = aktualneDane.length > 1 ? aktualneDane.slice(1) : [];

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Składki Zespołowe 💶📊</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Status składek członkowskich z podziałem na sekcje zespołu.
          </p>
        </div>
        <a 
          href={`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
        >
          Otwórz cały arkusz w Google 🔗
        </a>
      </div>

      {/* POD-ZAKŁADKI SEKCJI: BALET, CHÓR, KAPELA */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setAktywnaSekcja('balet')}
          style={{ padding: '8px 18px', backgroundColor: aktywnaSekcja === 'balet' ? '#3182ce' : '#f8fafc', color: aktywnaSekcja === 'balet' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          🩰 Balet
        </button>
        <button 
          onClick={() => setAktywnaSekcja('chor')}
          style={{ padding: '8px 18px', backgroundColor: aktywnaSekcja === 'chor' ? '#d97706' : '#f8fafc', color: aktywnaSekcja === 'chor' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          🎤 Chór
        </button>
        <button 
          onClick={() => setAktywnaSekcja('kapela')}
          style={{ padding: '8px 18px', backgroundColor: aktywnaSekcja === 'kapela' ? '#059669' : '#f8fafc', color: aktywnaSekcja === 'kapela' ? '#fff' : '#334155', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
        >
          🎻 Kapela
        </button>
      </div>

      {aktualneDane.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Brak danych w tej zakładce.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', backgroundColor: '#f8fafc' }}>
                <th style={{ padding: '12px 10px' }}>{naglowek[0] || 'Kolumna A'}</th>
                <th style={{ padding: '12px 10px' }}>{naglowek[1] || 'Kolumna B'}</th>
                <th style={{ padding: '12px 10px' }}>{naglowek[2] || 'Kolumna C'}</th>
                <th style={{ padding: '12px 10px' }}>{naglowek[3] || 'Kolumna H'}</th>
              </tr>
            </thead>
            <tbody>
              {wierszeDanych.map((wiersz, index) => {
                const wartoscH = wiersz[7] || '';
                // Sprawdzamy czy wartość to 0 (lub pusta), żeby oznaczyć na zielono; w przeciwnym razie na czerwono
                const czyZero = wartoscH === '0' || wartoscH === '0.00' || wartoscH === '';
                
                const kolorStyl = {
                  backgroundColor: czyZero ? '#dcfce7' : '#fee2e2',
                  color: czyZero ? '#166534' : '#991b1b',
                  border: czyZero ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  fontWeight: 'bold',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  display: 'inline-block'
                };

                return (
                  <tr 
                    key={index} 
                    style={{ 
                      borderBottom: '1px solid #f1f5f9', 
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#fafaf9' 
                    }}
                  >
                    <td style={{ padding: '12px 10px', color: '#1e293b', fontWeight: '500' }}>{wiersz[0] || ''}</td>
                    <td style={{ padding: '12px 10px', color: '#475569' }}>{wiersz[1] || ''}</td>
                    <td style={{ padding: '12px 10px', color: '#475569' }}>{wiersz[2] || ''}</td>
                    <td style={{ padding: '12px 10px' }}>
                      <span style={kolorStyl}>
                        {wartoscH !== '' ? wartoscH : '0'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}