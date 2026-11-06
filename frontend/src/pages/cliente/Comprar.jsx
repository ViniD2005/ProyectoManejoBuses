import React, { useState } from 'react';

export default function Comprar() {
  const [origen, setOrigen] = useState('');
  const [destino, setDestino] = useState('');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Buscar Pasajes</h2>
      <form className="flex gap-4">
        <input 
          type="text" 
          placeholder="Origen" 
          value={origen} 
          onChange={(e) => setOrigen(e.target.value)} 
          className="border p-2 rounded w-full" 
        />
        <input 
          type="text" 
          placeholder="Destino" 
          value={destino} 
          onChange={(e) => setDestino(e.target.value)} 
          className="border p-2 rounded w-full" 
        />
        <button type="button" className="bg-blue-600 text-white px-4 py-2 rounded">Buscar</button>
      </form>
    </div>
  );
}