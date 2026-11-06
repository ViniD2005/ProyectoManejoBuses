import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Comprar() {
  const navigate = useNavigate();
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');
  const [viajes, setViajes] = useState([]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setViajes([
      { id: 1, cooperativa: 'Coopera-Andina', hora: '08:00', precio: 5.00 },
      { id: 2, cooperativa: 'Transportes Baños', hora: '10:30', precio: 6.00 }
    ]);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Comprar Boletos</h2>
      <form onSubmit={handleBuscar} className="grid grid-cols-3 gap-4 mb-6">
        <input type="text" placeholder="Origen" value={origen} onChange={(e) => setOrigen(e.target.value)} className="border p-2 rounded" required />
        <input type="text" placeholder="Destino" value={destino} onChange={(e) => setDestino(e.target.value)} className="border p-2 rounded" required />
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">Buscar Viajes</button>
      </form>

      {viajes.map((v) => (
        <div key={v.id} className="flex justify-between border p-4 mb-2 rounded bg-white shadow-sm">
          <div>
            <h3 className="font-bold">{v.cooperativa}</h3>
            <p className="text-sm text-gray-600">Salida: {v.hora}</p>
          </div>
          <div className="text-right">
            <span className="font-bold text-lg">${v.precio.toFixed(2)}</span>
            <button 
              onClick={() => navigate(`/cliente/asientos/${v.id}`)}
              className="block bg-green-600 text-white px-3 py-1 mt-1 rounded text-sm"
            >
              Seleccionar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}