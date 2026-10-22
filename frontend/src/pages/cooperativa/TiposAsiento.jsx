import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function TiposAsiento() {
  const [tipos, setTipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  // Estado del formulario para crear/editar
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEditar, setIdEditar] = useState(null);
  const [nombre, setNombre] = useState('');
  const [factorPrecio, setFactorPrecio] = useState('1.00');

  useEffect(() => {
    cargarTipos();
  }, []);

  const cargarTipos = async () => {
    try {
      setCargando(true);
      setError('');
      const respuesta = await api.get('/tipos-asiento');
      setTipos(respuesta.data);
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al cargar los tipos de asiento');
    } finally {
      setCargando(false);
    }
  };

  const limpiarFormulario = () => {
    setNombre('');
    setFactorPrecio('1.00');
    setModoEdicion(false);
    setIdEditar(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMensaje('');

    try {
      if (modoEdicion) {
        await api.put(`/tipos-asiento/${idEditar}`, {
          nombre,
          factor_precio: parseFloat(factorPrecio)
        });
        setMensaje('Tipo de asiento actualizado correctamente');
      } else {
        await api.post('/tipos-asiento', {
          nombre,
          factor_precio: parseFloat(factorPrecio)
        });
        setMensaje('Tipo de asiento registrado correctamente');
      }

      limpiarFormulario();
      cargarTipos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al guardar el tipo de asiento');
    }
  };

  const handleEditar = (tipo) => {
    setModoEdicion(true);
    setIdEditar(tipo.id);
    setNombre(tipo.nombre);
    setFactorPrecio(tipo.factor_precio);
  };

  const handleEliminar = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este tipo de asiento?')) return;

    try {
      setError('');
      setMensaje('');
      await api.delete(`/tipos-asiento/${id}`);
      setMensaje('Tipo de asiento eliminado correctamente');
      cargarTipos();
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al eliminar el tipo de asiento');
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '900px', margin: '0 auto' }}>
      <h2>Gestión de Tipos de Asiento</h2>
      <p>Define las categorías de asientos de tu flota y sus factores multiplicadores de precio.</p>

      {error && <div style={{ padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '15px' }}>{error}</div>}
      {mensaje && <div style={{ padding: '10px', backgroundColor: '#dcfce7', color: '#166534', borderRadius: '6px', marginBottom: '15px' }}>{mensaje}</div>}

      {/* Formulario */}
      <form onSubmit={handleSubmit} style={{ background: '#f9fafb', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #e5e7eb' }}>
        <h3>{modoEdicion ? 'Editar Tipo de Asiento' : 'Nuevo Tipo de Asiento'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Nombre del Tipo:</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Normal, VIP, Cama"
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Factor de Precio:</label>
            <input
              type="number"
              step="0.01"
              min="0.50"
              max="3.00"
              value={factorPrecio}
              onChange={(e) => setFactorPrecio(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
            <small style={{ color: '#6b7280' }}>1.00 = Precio base, 1.35 = 35% más costoso</small>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="submit" style={{ padding: '8px 16px', backgroundColor: 'var(--color-primario, #2563eb)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {modoEdicion ? 'Actualizar' : 'Guardar'}
          </button>
          {modoEdicion && (
            <button type="button" onClick={limpiarFormulario} style={{ padding: '8px 16px', backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {/* Lista / Tabla */}
      {cargando ? (
        <p>Cargando tipos de asiento...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb' }}>
          <thead>
            <tr style={{ backgroundColor: '#f3f4f6', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>ID</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Nombre</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Factor de Precio</th>
              <th style={{ padding: '10px', borderBottom: '1px solid #e5e7eb' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {tipos.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '15px', textAlign: 'center', color: '#6b7280' }}>
                  No hay tipos de asiento registrados para tu cooperativa.
                </td>
              </tr>
            ) : (
              tipos.map((tipo) => (
                <tr key={tipo.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '10px' }}>{tipo.id}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{tipo.nombre}</td>
                  <td style={{ padding: '10px' }}>x{parseFloat(tipo.factor_precio).toFixed(2)}</td>
                  <td style={{ padding: '10px', display: 'flex', gap: '8px' }}>
                    <button onClick={() => handleEditar(tipo)} style={{ padding: '4px 8px', backgroundColor: '#f59e0b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Editar
                    </button>
                    <button onClick={() => handleEliminar(tipo.id)} style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}