import { useState, useEffect } from 'react';

export default function Skladki({ profile }) {
  const [dane, setDane] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Link eksportujący Twój arkusz Google bezpośrednio do formatu CSV
  const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1vtGIEWOK_LA01dyBcqZ04wrGwwbxCxb5F8TadquYUA4/export?format=csv';

  useEffect(() => {
    pobierzArkusz();
  }, []);

  const pobierzArkusz = async () => {
    setLoading(true);
    try {
      const response = await fetch(SHEET_CSV_URL);
      if (!response.ok) throw new Error('Nie udało się pobrać danych z arkusza.');
      
      const csvText = await response.text();
      const wiersze = parsujCSV(csvText);
      
      setDane(wiersze);
    } catch (err) {
      console.error('Błąd pobierania składek:', err);
      setError('Nie udało się załadować danych składek z arkusza.');
    } finally {
      setLoading(false);
    }
  };

  // Prosty parser pliku CSV uwzględniający cudzysłowy
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

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Ładowanie danych składek... 📊</div>;
  }

  if (error) {
    return <div style={{ textAlign: 'center', padding: '40px', color: '#ef4444' }}>{error}</div>;
  }

  // Wiersz nagłówkowy (indeksy: A=0, B=1, C=2, H=7)
  const naglowek = dane.length > 0 ? [dane[0][0], dane[0][1], dane[0][2], dane[0][7]] : [];
  // Wiersze z danymi (od drugiego wiersza wzwyż)
  const wierszeDanych = dane.length > 1 ? dane.slice(1) : [];

  return (
    <div style={{ marginTop: '20px', padding: '25px', border: '1px solid #e2e8f0', borderRadius: '12px', backgroundColor: '#ffffff', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '20px' }}>
        <div>
          <h2 style={{ color: '#1e293b', margin: '0 0 5px 0', fontSize: '20px' }}>Składki Zespołowe 💶📊</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
            Podgląd statusu składek członkowskich z oficjalnego arkusza zespołu.
          </p>
        </div>
        <a 
          href="https://docs.google.com/spreadsheets/d/1vtGIEWOK_LA01dyBcqZ04wrGwwbxCxb5F8TadquYUA4/edit?usp=sharing" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', color: '#334155', fontSize: '12px', fontWeight: 'bold', textDecoration: 'none' }}
        >
          Otwórz cały arkusz w Google 🔗
        </a>
      </div>

      {dane.length === 0 ? (
        <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Arkusz jest pusty.</p>
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
              {wierszeDanych.map((wiersz, index) => (
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
                  <td style={{ padding: '12px 10px', color: '#0f172a', fontWeight: 'bold' }}>{wiersz[7] || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}