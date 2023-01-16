import * as React from 'react';

interface TableProps {
  headers: string[];
  rows: string[][];
}

const Table: React.FunctionComponent<TableProps> = ({ headers, rows }) => {
  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {headers.map((header, index) => (
            <th key={index} style={thStyle}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} style={tdStyle}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  margin: '20px 0',
}

const thStyle: React.CSSProperties = {
  border: '1px solid #dddddd',
  padding: '8px',
  backgroundColor: '#f2f2f2',
}

const tdStyle: React.CSSProperties = {
  border: '1px solid #dddddd',
  padding: '8px',
}

interface AppProps {
  headers: string[];
  rows: string[][];
}

const App: React.FunctionComponent<AppProps> = ({ headers, rows }) => {
  return (
    <div dir='rtl'>
      <Table headers={headers} rows={rows} />
    </div>
  );
}

export default App;